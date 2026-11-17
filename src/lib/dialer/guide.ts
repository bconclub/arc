// The call guide: the questions a salesperson should get answered on a call.
// Shown on screen during the call; after the call the transcript is checked
// against them. The owner edits the list on the Dialer page (dialer_settings).
import { db } from "./members"

export const DEFAULT_GUIDE = [
  "Where do your leads come from (ads, Google, Justdial, WhatsApp, walk-ins)?",
  "How many leads or enquiries do you get in a day?",
  "Who replies to them today, and how fast?",
  "How many leads go cold or get missed in a week?",
  "What do you use now to track leads (sheet, CRM, WhatsApp)?",
  "How many people are on the sales or front-desk team?",
  "Who decides on a tool like this: you or someone else?",
  "Next step agreed: demo or callback, with the day and time?",
]

export async function getGuide(): Promise<string[]> {
  const { data } = await db.from("dialer_settings").select("value").eq("key", "guide").maybeSingle()
  const v = data?.value
  const list = Array.isArray(v) ? v.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 20) : []
  return list.length ? list : DEFAULT_GUIDE
}

export async function saveGuide(list: string[]) {
  const clean = list.map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 20)
  return db.from("dialer_settings").upsert({ key: "guide", value: clean, updated_at: new Date().toISOString() }, { onConflict: "key" })
}
