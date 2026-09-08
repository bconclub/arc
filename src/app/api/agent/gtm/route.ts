// The one URL bots pull. Markdown for a system prompt, JSON for anything
// that can shape it. Same bearer as the rest of /api/agent.
import { checkIngestAuth, authError } from "@/lib/ingest-auth";
import { buildGtmPack, gtmPackMarkdown } from "@/lib/arc/gtm-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  const auth = checkIngestAuth(req);
  if (!auth.ok) return authError(auth);

  const pack = await buildGtmPack();
  const format = new URL(req.url).searchParams.get("format") || "json";

  if (format === "md") {
    return new Response(gtmPackMarkdown(pack), {
      headers: { ...NO_STORE, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return Response.json(pack, { headers: NO_STORE });
}
