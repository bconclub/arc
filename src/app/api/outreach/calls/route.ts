import {
  BDR_AGENTS,
  callProvider,
  callSession,
  callDetail,
  TEST_PHONE,
} from "@/lib/outreach-calls";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  if (!(await callSession()))
    return Response.json({ error: "Sign in to view calls." }, { status: 401 });
  try {
    const groups = await Promise.all(
      Object.entries(BDR_AGENTS).map(async ([id, name]) => {
        const calls = [];
        let cursor = "";
        do {
          const r = await callProvider(
            `conversations?agent_id=${id}&page_size=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          );
          if (!r.ok)
            throw new Error("Call history is unavailable. Retry shortly.");
          const d = await r.json();
          calls.push(
            ...d.conversations.map(
              (c: {
                conversation_id: string;
                start_time_unix_secs: number;
                call_duration_secs: number;
                status: string;
                message_count: number;
              }) => ({
                id: c.conversation_id,
                agent: name,
                started_at: new Date(
                  c.start_time_unix_secs * 1000,
                ).toISOString(),
                duration: c.call_duration_secs,
                status: c.status,
                turns: c.message_count,
              }),
            ),
          );
          cursor = d.has_more ? d.next_cursor : "";
        } while (cursor);
        return calls;
      }),
    );
    const calls = groups
      .flat()
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
    const enriched = [];
    for (let i = 0; i < calls.length; i += 5)
      enriched.push(
        ...(await Promise.all(
          calls.slice(i, i + 5).map(async (c) => {
            try {
              const d = await callDetail(c.id);
              const phone = d?.metadata?.phone_call?.external_number || null;
              return {
                ...c,
                phone,
                is_test: phone
                  ? phone.replace(/\D/g, "").slice(-10) === TEST_PHONE
                  : null,
                has_audio: Boolean(d?.has_audio),
                summary: d?.analysis?.transcript_summary || null,
              };
            } catch {
              return {
                ...c,
                phone: null,
                is_test: null,
                has_audio: null,
                summary: null,
              };
            }
          }),
        )),
      );
    return Response.json({ calls: enriched });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Call history unavailable." },
      { status: 503 },
    );
  }
}
