/**
 * Gmail read access. SERVER ONLY, never import into a client component.
 *
 * This exists because attachment bytes cannot be reached any other way. The
 * Gmail connector available to tooling exposes attachment IDs but has no
 * download call, and the invoice figures live only inside those PDFs, so ARC has
 * to fetch them itself.
 *
 * Scope is `gmail.readonly` throughout. ARC reads invoices; it never sends,
 * labels, moves or deletes mail.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 15_000;

export type GmailAttachment = {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  subject: string;
  from: string;
  sentAt: string | null;
};

export function gmailConfigured(): boolean {
  return !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}

export async function gmailAccessToken(): Promise<string> {
  const id = process.env.GMAIL_CLIENT_ID;
  const secret = process.env.GMAIL_CLIENT_SECRET;
  const refresh = process.env.GMAIL_REFRESH_TOKEN;
  if (!id || !secret || !refresh) throw new Error("Gmail OAuth credentials are incomplete.");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) {
    // An OAuth consent screen left in Testing mode expires refresh tokens after
    // seven days, which presents exactly as invalid_grant. Naming it saves a
    // long hunt through code that has not changed.
    const hint = json.error === "invalid_grant"
      ? " The refresh token is invalid or expired. If the OAuth consent screen is still in Testing mode, Google expires refresh tokens after 7 days; publish the app or set it to Internal."
      : "";
    throw new Error(`${json.error_description ?? json.error ?? `HTTP ${res.status}`}.${hint}`);
  }
  return json.access_token as string;
}

async function call(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

type Part = {
  filename?: string;
  mimeType?: string;
  body?: { attachmentId?: string; size?: number };
  parts?: Part[];
};

/** Attachments nest arbitrarily deep inside multipart messages. */
function walkParts(part: Part | undefined, out: Part[]): void {
  if (!part) return;
  if (part.body?.attachmentId && part.filename) out.push(part);
  for (const child of part.parts ?? []) walkParts(child, out);
}

function header(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Documents the parser can actually read. */
const READABLE = /\.(pdf|png|jpe?g|webp)$/i;

/**
 * Finds candidate invoice attachments.
 *
 * The default query looks at mail BCON sent, because these are invoices issued
 * to clients. Anything received from a vendor is a payable, not a receivable,
 * and folding the two together would corrupt both sides of the books.
 */
export async function findInvoiceAttachments(
  query = 'in:sent has:attachment filename:pdf (invoice OR "tax invoice")',
  max = 25,
): Promise<GmailAttachment[]> {
  const token = await gmailAccessToken();

  const list = await call("messages", token, { q: query, maxResults: String(max) });
  const ids: string[] = (list.messages ?? []).map((m: { id: string }) => m.id);

  const found: GmailAttachment[] = [];
  for (const id of ids) {
    const msg = await call(`messages/${id}`, token, { format: "full" });
    const headers = (msg.payload?.headers ?? []) as { name: string; value: string }[];

    const parts: Part[] = [];
    walkParts(msg.payload as Part, parts);

    for (const p of parts) {
      if (!p.filename || !READABLE.test(p.filename)) continue;
      found.push({
        messageId: id,
        attachmentId: p.body!.attachmentId!,
        filename: p.filename,
        mimeType: p.mimeType ?? "application/pdf",
        sizeBytes: p.body?.size ?? 0,
        subject: header(headers, "Subject"),
        from: header(headers, "From"),
        sentAt: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
      });
    }
  }
  return found;
}

/** Attachment bytes. Gmail returns base64url, which is not base64. */
export async function downloadAttachment(messageId: string, attachmentId: string): Promise<Uint8Array> {
  const token = await gmailAccessToken();
  const res = await call(`messages/${messageId}/attachments/${attachmentId}`, token);
  const data = String(res.data ?? "");
  if (!data) throw new Error("Attachment returned no data.");
  // Buffer accepts base64url directly; converting by hand risks getting the
  // padding wrong on lengths that are not a multiple of four.
  return new Uint8Array(Buffer.from(data, "base64url"));
}
