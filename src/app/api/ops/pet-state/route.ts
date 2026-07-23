import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { OpsTask, PetState } from "@/types/ops";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const [payments, signals, projects, nowTasks] = await Promise.all([
    supabaseAdmin.from("payments").select("status, due"),
    supabaseAdmin.from("ops_signals").select("severity, seen"),
    supabaseAdmin.from("projects").select("tasks, status"),
    supabaseAdmin.from("now_tasks").select("done, due"),
  ]);

  const firstError = payments.error || signals.error || projects.error || nowTasks.error;
  if (firstError) console.error("[pet-state]", firstError.message);

  const pay = payments.data ?? [];
  const sig = signals.data ?? [];
  const proj = projects.data ?? [];
  const now = nowTasks.data ?? [];

  const overduePayment = pay.some(
    (p) =>
      p.status === "overdue" ||
      (["pending", "invoiced"].includes(p.status as string) && p.due && (p.due as string) < today)
  );
  const criticalSignal = sig.some((s) => s.severity === "critical" && !s.seen);
  const highSignal = sig.some((s) => s.severity === "high" && !s.seen);

  let overdueTask = false;
  for (const p of proj) {
    const tasks = (p.tasks ?? []) as OpsTask[];
    if (tasks.some((t) => !t.done && t.due && t.due < today)) overdueTask = true;
  }
  if (now.some((t) => !t.done && t.due && (t.due as string) < today)) overdueTask = true;

  const anyOpen =
    proj.some((p) => p.status === "active" || p.status === "waiting") ||
    now.some((t) => !t.done) ||
    pay.some((p) => p.status !== "paid");

  let state: PetState;
  if (overduePayment || criticalSignal) state = "fire";
  else if (overdueTask || highSignal) state = "alert";
  else if (anyOpen) state = "happy";
  else state = "sleeping";

  return NextResponse.json({ state });
}
