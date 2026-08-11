/**
 * Google Analytics 4 Data API. SERVER ONLY, never import into a client component.
 *
 * Auth accepts either shape, checked in this order:
 *
 *   1. GA4_SERVICE_ACCOUNT_JSON, the contents of a service account key. Preferred
 *      for anything unattended, because it has no refresh token to expire.
 *   2. GA4_CLIENT_ID / GA4_CLIENT_SECRET / GA4_REFRESH_TOKEN, matching the shape
 *      the Gmail connector already uses.
 *
 * Both need GA4_PROPERTY_ID, which is the numeric property id from Admin ->
 * Property Settings, NOT the G-XXXXXXX measurement id. The API rejects the
 * measurement id, and it is the more familiar of the two, so it is the mistake
 * worth catching early.
 */

const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 10_000;

export type ChannelRow = { channel: string; sessions: number; users: number; conversions: number };

export type Ga4Summary = {
  propertyId: string;
  since: string;
  until: string;
  sessions: number;
  users: number;
  newUsers: number;
  conversions: number;
  channels: ChannelRow[];
};

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? Buffer.from(input) : Buffer.from(input);
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Signs the JWT a service account exchanges for an access token. Done by hand
 * because pulling in googleapis for one RS256 signature would add a large
 * dependency to a server bundle that needs nothing else from it.
 */
async function serviceAccountToken(raw: string): Promise<string> {
  let key: { client_email?: string; private_key?: string };
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error("GA4_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  if (!key.client_email || !key.private_key) {
    throw new Error("GA4_SERVICE_ACCOUNT_JSON is missing client_email or private_key.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));

  // Env vars flatten the PEM's newlines into the literal characters \n.
  const pem = key.private_key.replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const der = Uint8Array.from(Buffer.from(pem, "base64"));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(`${header}.${claim}`),
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${b64url(sig)}`,
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? `Token exchange failed (${res.status})`);
  return json.access_token as string;
}

async function refreshToken(): Promise<string> {
  const id = process.env.GA4_CLIENT_ID;
  const secret = process.env.GA4_CLIENT_SECRET;
  const refresh = process.env.GA4_REFRESH_TOKEN;
  if (!id || !secret || !refresh) throw new Error("GA4 OAuth credentials are incomplete.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? `Refresh failed (${res.status})`);
  return json.access_token as string;
}

export async function ga4AccessToken(): Promise<string> {
  const sa = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (sa) return serviceAccountToken(sa);
  return refreshToken();
}

function propertyId(): string {
  const id = (process.env.GA4_PROPERTY_ID ?? "").trim();
  if (!id) throw new Error("GA4_PROPERTY_ID is not set.");
  if (/^G-/i.test(id)) {
    throw new Error(
      "GA4_PROPERTY_ID looks like a measurement id (G-XXXXXXX). The Data API needs the " +
      "numeric property id from Admin, Property Settings.",
    );
  }
  return id.replace(/^properties\//, "");
}

export async function fetchGa4(days = 30): Promise<Ga4Summary> {
  const id = propertyId();
  const token = await ga4AccessToken();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${DATA_API}/properties/${id}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [
          { name: "sessions" }, { name: "totalUsers" },
          { name: "newUsers" }, { name: "conversions" },
        ],
        limit: 25,
      }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);

    type Row = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
    const rows: Row[] = json.rows ?? [];
    const n = (r: Row, i: number) => Number(r.metricValues?.[i]?.value ?? 0) || 0;

    const channels: ChannelRow[] = rows.map((r) => ({
      channel: r.dimensionValues?.[0]?.value ?? "Unknown",
      sessions: n(r, 0),
      users: n(r, 1),
      conversions: n(r, 3),
    })).sort((a, b) => b.sessions - a.sessions);

    return {
      propertyId: id,
      since: `${days} days ago`,
      until: "today",
      // Summed from the channel rows rather than requested separately: a second
      // unfiltered query can disagree with the breakdown it sits above, and a
      // total that does not match its own parts is worse than no total.
      sessions: rows.reduce((s, r) => s + n(r, 0), 0),
      users: rows.reduce((s, r) => s + n(r, 1), 0),
      newUsers: rows.reduce((s, r) => s + n(r, 2), 0),
      conversions: rows.reduce((s, r) => s + n(r, 3), 0),
      channels,
    };
  } finally {
    clearTimeout(timer);
  }
}
