import {
  BDR_AGENTS,
  callDetail,
  callSession,
  TEST_PHONE,
} from "@/lib/outreach-calls";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await callSession()))
    return Response.json({ error: "Sign in to view calls." }, { status: 401 });
  try {
    const d = await callDetail(params.id);
    if (!d)
      return Response.json({ error: "BDR call not found." }, { status: 404 });
    const phone = d.metadata?.phone_call?.external_number || null;
    return Response.json({
      id: d.conversation_id,
      agent: BDR_AGENTS[d.agent_id],
      phone,
      is_test: phone
        ? phone.replace(/\D/g, "").slice(-10) === TEST_PHONE
        : null,
      status: d.status,
      started_at: new Date(
        d.metadata.start_time_unix_secs * 1000,
      ).toISOString(),
      duration: d.metadata.call_duration_secs,
      summary: d.analysis?.transcript_summary || null,
      outcome: d.evidence?.outcome || null,
      callback_request: d.evidence?.callback_request || null,
      failure: d.metadata?.error?.message || null,
      has_audio: Boolean(d.has_audio),
      transcript: (d.transcript || []).map(
        (t: { role: string; message: string; time_in_call_secs: number }) => ({
          role: t.role,
          message: t.message,
          seconds: t.time_in_call_secs,
        }),
      ),
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Call unavailable." },
      { status: 503 },
    );
  }
}
