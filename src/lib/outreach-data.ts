import { supabaseAdmin } from "@/lib/supabase";
import {
  legacyActivity,
  OUTCOMES,
  safeUrl,
  type ActivityChannel,
  type OutreachActivity,
} from "@/lib/outreach-workflow";
import type { OutreachMessage, OutreachTarget } from "@/types/ops";

// Supabase defaults to 1,000 rows. Read every page so imports never vanish silently.
async function allRows<T>(table: string): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    result.push(...(data as T[]));
    if (data.length < 1000) return result;
  }
}
export async function readOutreachWorkspace() {
  const [targets, messages, activityResult] = await Promise.all([
    allRows<OutreachTarget>("outreach_targets"),
    allRows<OutreachMessage>("outreach_messages"),
    allRows<OutreachActivity>("outreach_activity")
      .then((data) => ({ data, missing: false }))
      .catch((error) => {
        if (["42P01", "PGRST205"].includes(error.code))
          return { data: [] as OutreachActivity[], missing: true };
        throw error;
      }),
  ]);
  return {
    targets,
    activity: [...activityResult.data, ...messages.map(legacyActivity)].sort(
      (a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at),
    ),
    reportingReady: !activityResult.missing,
  };
}

export async function recordOutreachActivity(body: unknown, worker: string) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json(
      { error: "A JSON object is required." },
      { status: 400 },
    );
  const b = body as Record<string, unknown>;
  const channel = b.channel as ActivityChannel;
  if (
    !Object.hasOwn(OUTCOMES, channel) ||
    !(OUTCOMES[channel] as readonly unknown[]).includes(b.outcome)
  )
    return Response.json(
      { error: "Choose a valid channel and outcome." },
      { status: 400 },
    );
  if (
    typeof b.target_id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(b.target_id) ||
    typeof b.external_id !== "string" ||
    !b.external_id.trim() ||
    b.external_id.length > 200
  )
    return Response.json(
      { error: "target_id and a stable external_id are required." },
      { status: 400 },
    );
  const date = (v: unknown) =>
    typeof v === "string" && Number.isFinite(Date.parse(v));
  if (
    !date(b.occurred_at) ||
    Date.parse(String(b.occurred_at)) > Date.now() + 300_000 ||
    (b.next_at != null && !date(b.next_at))
  )
    return Response.json(
      { error: "Use valid timestamps. occurred_at cannot be in the future." },
      { status: 400 },
    );
  if (
    typeof b.summary !== "string" ||
    !b.summary.trim() ||
    b.summary.length > 20000
  )
    return Response.json(
      { error: "Add a summary (up to 20,000 characters)." },
      { status: 400 },
    );
  if (
    b.evidence_url &&
    (typeof b.evidence_url !== "string" || !safeUrl(b.evidence_url))
  )
    return Response.json(
      { error: "Evidence must be an HTTP or HTTPS URL." },
      { status: 400 },
    );
  if (b.outcome === "live" && !b.evidence_url)
    return Response.json(
      { error: "A live citation needs its public evidence URL." },
      { status: 400 },
    );
  const { data: target, error: targetError } = await supabaseAdmin
    .from("outreach_targets")
    .select("id,kind")
    .eq("id", b.target_id)
    .maybeSingle();
  if (targetError)
    return Response.json(
      { error: "Could not check the target. Retry." },
      { status: 500 },
    );
  if (!target)
    return Response.json({ error: "Target not found." }, { status: 404 });
  if (channel === "citation" && target.kind !== "citation")
    return Response.json(
      { error: "Citation updates require a citation target." },
      { status: 400 },
    );
  const row = {
    target_id: b.target_id,
    channel,
    outcome: b.outcome,
    worker,
    external_id: b.external_id,
    occurred_at: new Date(String(b.occurred_at)).toISOString(),
    summary: b.summary.trim(),
    evidence_url: safeUrl(b.evidence_url as string) || null,
    next_at: b.next_at ? new Date(String(b.next_at)).toISOString() : null,
  };
  const { data, error } = await supabaseAdmin
    .from("outreach_activity")
    .insert(row)
    .select()
    .single();
  if (error?.code === "23505") {
    const { data: existing, error: readError } = await supabaseAdmin
      .from("outreach_activity")
      .select("*")
      .eq("worker", worker)
      .eq("external_id", b.external_id)
      .single();
    if (readError)
      return Response.json(
        { error: "Could not verify the previous update. Retry." },
        { status: 500 },
      );
    const same = Object.entries(row).every(([key, value]) =>
      key.endsWith("_at") && value
        ? Date.parse(existing[key]) === Date.parse(String(value))
        : existing[key] === value,
    );
    return same
      ? Response.json({ activity: existing, duplicate: true })
      : Response.json(
          {
            error:
              "This event ID already records a different update. Use a new external_id for a new event.",
          },
          { status: 409 },
        );
  }
  if (error)
    return Response.json(
      {
        error: ["42P01", "PGRST205"].includes(error.code)
          ? "Activity reporting is not installed yet. Apply the outreach activity migration."
          : "Could not save activity. Retry with the same event ID.",
      },
      { status: 503 },
    );
  return Response.json({ activity: data }, { status: 201 });
}
