// Connector registry. SERVER ONLY. Never import this into a client component.
//
// Secrets live in env vars, never in the database. Everything here reports
// PRESENCE and REACHABILITY only: `process.env[x]` is coerced to a boolean at the
// edge of this module and the raw value never leaves it. Nothing in the returned
// shape can carry a credential, so the API route physically cannot leak one.

export type ConnectorCategory =
  | "Repos" | "AI API" | "Database" | "Deployments"
  | "Workflows" | "Email" | "Messaging" | "Research";

export type ProbeResult = { ok: boolean; detail: string };

export type ConnectorDef = {
  key: string;
  name: string;
  category: ConnectorCategory;
  /** All must be present for the connector to count as configured. */
  envVars: string[];
  optionalEnv?: string[];
  description: string;
  docsUrl: string;
  /** Cheap, read-only reachability check. Omit when no safe GET exists. */
  probe?: () => Promise<ProbeResult>;
};

const TIMEOUT_MS = 6000;

/** fetch with a hard timeout so a hanging provider can't stall the panel. */
async function get(url: string, headers: Record<string, string>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function fail(err: unknown): ProbeResult {
  if (err instanceof Error && err.name === "AbortError") {
    return { ok: false, detail: `No response in ${TIMEOUT_MS / 1000}s` };
  }
  return { ok: false, detail: err instanceof Error ? err.message : "Request failed" };
}

export const CONNECTORS: ConnectorDef[] = [
  {
    key: "github",
    name: "GitHub",
    category: "Repos",
    envVars: ["GITHUB_TOKEN"],
    optionalEnv: ["GITHUB_ORG"],
    description: "Repo activity, commits, PRs and issues across the org.",
    docsUrl: "https://github.com/settings/tokens",
    async probe() {
      const token = process.env.GITHUB_TOKEN;
      if (!token) return { ok: false, detail: "No token" };
      // /users/{name} resolves both users and orgs; /orgs/{name} 404s for a user account.
      const account = process.env.GITHUB_ORG || "bconclub";
      const h = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "arc-dashboard",
      };
      try {
        const res = await get(`https://api.github.com/users/${account}`, h);
        if (res.status === 401) return { ok: false, detail: "Token rejected" };
        if (res.status === 404) return { ok: false, detail: `"${account}" not visible to this token` };
        if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
        const kind = ((await res.json()) as { type?: string }).type === "Organization" ? "Org" : "User";
        const remaining = res.headers.get("x-ratelimit-remaining");
        return { ok: true, detail: `${kind} "${account}" reachable${remaining ? ` · ${remaining} calls left` : ""}` };
      } catch (e) { return fail(e); }
    },
  },
  {
    key: "anthropic",
    name: "Anthropic",
    category: "AI API",
    envVars: ["ANTHROPIC_API_KEY"],
    description: "Claude models powering ARC's drafting and analysis.",
    docsUrl: "https://console.anthropic.com/settings/keys",
    async probe() {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return { ok: false, detail: "No API key" };
      try {
        const res = await get("https://api.anthropic.com/v1/models?limit=1", {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        });
        if (res.status === 401) return { ok: false, detail: "Key rejected" };
        if (res.status === 429) return { ok: false, detail: "Rate limited" };
        if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
        return { ok: true, detail: "Key valid" };
      } catch (e) { return fail(e); }
    },
  },
  {
    key: "supabase",
    name: "Supabase",
    category: "Database",
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    optionalEnv: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    description: "Every table behind ARC, projects, money, brands, signals.",
    docsUrl: "https://supabase.com/dashboard/project/_/settings/api",
    async probe() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) return { ok: false, detail: "URL or service key missing" };
      try {
        const res = await get(`${url}/rest/v1/brands?select=id&limit=1`, {
          apikey: key,
          Authorization: `Bearer ${key}`,
        });
        if (res.status === 401 || res.status === 403) return { ok: false, detail: "Service key rejected" };
        if (res.status === 404) return { ok: false, detail: "brands table missing, run the migration" };
        if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
        return { ok: true, detail: "Connected, brands table present" };
      } catch (e) { return fail(e); }
    },
  },
  {
    key: "vercel",
    name: "Vercel",
    category: "Deployments",
    envVars: ["VERCEL_TOKEN"],
    optionalEnv: ["VERCEL_TEAM_ID"],
    description: "Deployment status and build failures for your projects.",
    docsUrl: "https://vercel.com/account/tokens",
    async probe() {
      const token = process.env.VERCEL_TOKEN;
      if (!token) return { ok: false, detail: "No token" };
      try {
        const res = await get("https://api.vercel.com/v2/user", { Authorization: `Bearer ${token}` });
        if (res.status === 401 || res.status === 403) return { ok: false, detail: "Token rejected" };
        if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
        return { ok: true, detail: "Token valid" };
      } catch (e) { return fail(e); }
    },
  },
  {
    key: "openrouter",
    name: "OpenRouter",
    category: "AI API",
    envVars: ["OPENROUTER_API_KEY"],
    description: "Fallback model routing for the ARC agent.",
    docsUrl: "https://openrouter.ai/keys",
    async probe() {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) return { ok: false, detail: "No API key" };
      try {
        const res = await get("https://openrouter.ai/api/v1/key", { Authorization: `Bearer ${key}` });
        if (res.status === 401) return { ok: false, detail: "Key rejected" };
        if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
        return { ok: true, detail: "Key valid" };
      } catch (e) { return fail(e); }
    },
  },
  {
    key: "tavily",
    name: "Tavily",
    category: "Research",
    envVars: ["TAVILY_API_KEY"],
    description: "Web research feeding the signals pipeline.",
    docsUrl: "https://app.tavily.com/home",
    // No free read-only endpoint, a probe would burn a paid search credit.
  },
  {
    key: "whatsapp",
    name: "WhatsApp",
    category: "Messaging",
    envVars: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_ID"],
    description: "Message delivery status via the Meta Graph API.",
    docsUrl: "https://developers.facebook.com/apps",
    async probe() {
      const token = process.env.WHATSAPP_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_ID;
      if (!token || !phoneId) return { ok: false, detail: "Token or phone ID missing" };
      try {
        const res = await get(`https://graph.facebook.com/v21.0/${phoneId}`, {
          Authorization: `Bearer ${token}`,
        });
        if (res.status === 401) return { ok: false, detail: "Token rejected" };
        if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
        return { ok: true, detail: "Number reachable" };
      } catch (e) { return fail(e); }
    },
  },
  {
    key: "gmail",
    name: "Gmail",
    category: "Email",
    envVars: ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"],
    description: "Inbox signals, bounces, client replies, invoice mail.",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    async probe() {
      const id = process.env.GMAIL_CLIENT_ID;
      const secret = process.env.GMAIL_CLIENT_SECRET;
      const refresh = process.env.GMAIL_REFRESH_TOKEN;
      if (!id || !secret || !refresh) return { ok: false, detail: "OAuth credentials incomplete" };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        // Exchanging the refresh token is the only way to confirm it still works.
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: id, client_secret: secret,
            refresh_token: refresh, grant_type: "refresh_token",
          }),
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) return { ok: false, detail: `Refresh failed. HTTP ${res.status}` };
        return { ok: true, detail: "Refresh token valid" };
      } catch (e) {
        return fail(e);
      } finally {
        clearTimeout(timer);
      }
    },
  },
  {
    key: "pabbly",
    name: "Pabbly",
    category: "Workflows",
    envVars: ["PABBLY_WEBHOOK_URL"],
    description: "Automation workflows. ARC posts events to your Pabbly webhook.",
    docsUrl: "https://connect.pabbly.com",
    // Webhook-only: probing would fire a real workflow run. Presence check only.
  },
];

export type ConnectorStatus = {
  key: string;
  name: string;
  category: ConnectorCategory;
  description: string;
  docsUrl: string;
  /** Every required env var is present. Never reveals the values. */
  configured: boolean;
  missing: string[];
  optionalSet: string[];
  probed: boolean;
  ok: boolean | null;
  detail: string;
};

/** Presence of required env vars, with no network calls. */
export function inspect(def: ConnectorDef): Omit<ConnectorStatus, "probed" | "ok" | "detail"> {
  const missing = def.envVars.filter((v) => !process.env[v]);
  const optionalSet = (def.optionalEnv ?? []).filter((v) => !!process.env[v]);
  return {
    key: def.key,
    name: def.name,
    category: def.category,
    description: def.description,
    docsUrl: def.docsUrl,
    configured: missing.length === 0,
    missing,
    optionalSet,
  };
}

/** Presence check plus, when configured and probeable, a live reachability call. */
export async function statusOf(def: ConnectorDef, runProbe: boolean): Promise<ConnectorStatus> {
  const base = inspect(def);

  if (!base.configured) {
    return { ...base, probed: false, ok: null, detail: `Missing ${base.missing.join(", ")}` };
  }
  if (!runProbe || !def.probe) {
    return { ...base, probed: false, ok: null, detail: "Configured, not probed" };
  }

  const result = await def.probe();
  return { ...base, probed: true, ok: result.ok, detail: result.detail };
}

/** Maps a probe outcome onto the `services` table status vocabulary. */
export function toServiceStatus(s: ConnectorStatus): "healthy" | "issue" | "paused" | "down" {
  if (!s.configured) return "paused";
  if (!s.probed) return "healthy";
  return s.ok ? "healthy" : "down";
}
