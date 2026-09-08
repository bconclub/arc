import { supabaseAdmin } from "@/lib/supabase";
import { callSession } from "@/lib/outreach-calls";
import { isTestTarget } from "@/lib/outreach-workflow";
export const dynamic = "force-dynamic";
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await callSession()))
    return Response.json(
      { error: "Sign in to qualify contacts." },
      { status: 401 },
    );
  const b = await req.json().catch(() => null);
  if (
    typeof b?.qualification_note !== "string" ||
    b.qualification_note.trim().length < 10 ||
    b.qualification_note.length > 4000
  )
    return Response.json(
      {
        error:
          "Describe the business need and agreed next step (10-4,000 characters).",
      },
      { status: 400 },
    );
  const { data: t, error: readError } = await supabaseAdmin
    .from("outreach_targets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (readError)
    return Response.json({ error: "Could not check target." }, { status: 503 });
  if (!t || t.kind !== "business" || isTestTarget(t))
    return Response.json(
      { error: "Only real business prospects can qualify for PROXe." },
      { status: 400 },
    );
  const { data, error } = await supabaseAdmin
    .from("outreach_targets")
    .update({
      qualified_at: new Date().toISOString(),
      qualification_note: b.qualification_note.trim(),
    })
    .eq("id", params.id)
    .select()
    .single();
  if (error)
    return Response.json(
      { error: "Qualification could not save. Check the database update." },
      { status: 503 },
    );
  return Response.json(data);
}
