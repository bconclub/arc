import { comfyReport } from "@/lib/comfy";

/**
 * Comfy Cloud clips and spend for the Editr page, read live. Session-gated like every /api/ops route.
 * `configured: false` means COMFY_API_KEY isn't set, which the page explains instead of erroring.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const m = Number(new URL(req.url).searchParams.get("months")) || 12;
  try {
    return Response.json(await comfyReport(Math.min(24, Math.max(1, Math.round(m)))));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
