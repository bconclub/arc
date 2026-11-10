// Reference library: other tools' template previews, each rated, with our remake prompt.
// The data is two JSON files in the private studio bucket, never in the repo, because
// the previews and some prompts belong to the sites they came from.
//
// GET  ?part=kept|skipped -> { url }            short-lived signed link the page fetches
// POST { part }           -> { path, signedUrl } the EDITR session PUTs a fresh file there
import { STUDIO_BUCKET } from "@/lib/studio"
import { supabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PARTS: Record<string, string> = { kept: "refs/kept.json", skipped: "refs/skipped.json" }

export async function GET(req: Request) {
  const path = PARTS[new URL(req.url).searchParams.get("part") || "kept"]
  if (!path) return Response.json({ error: "part must be kept or skipped" }, { status: 400 })
  const { data, error } = await supabaseAdmin.storage.from(STUDIO_BUCKET).createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return Response.json({ error: "The library has not been uploaded yet." }, { status: 404 })
  return Response.json({ url: data.signedUrl })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const path = PARTS[String(body.part || "")]
  if (!path) return Response.json({ error: "part must be kept or skipped" }, { status: 400 })
  const { data, error } = await supabaseAdmin.storage.from(STUDIO_BUCKET).createSignedUploadUrl(path, { upsert: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ path, signedUrl: data.signedUrl })
}
