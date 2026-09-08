import { supabaseAdmin } from "@/lib/supabase";
import { isTestTarget } from "@/lib/outreach-workflow";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const key = process.env.PROXE_INBOUND_API_KEY;
  if (!key || req.headers.get("authorization") !== "Bearer " + key)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("target_id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))
    return Response.json({ error: "target_id required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("outreach_targets")
    .select(
      "id,name,phone,email,org,city,kind,source,segment,qualified_at,qualification_note",
    )
    .eq("id", id)
    .maybeSingle();
  if (error)
    return Response.json(
      { error: "Qualification unavailable" },
      { status: 503 },
    );
  if (!data)
    return Response.json({ error: "Target not found" }, { status: 404 });
  return Response.json(
    {
      target: data,
      qualified:
        !!data.qualified_at &&
        !!data.qualification_note &&
        !isTestTarget(data) &&
        data.kind === "business",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
