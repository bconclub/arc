// The call guide: the questions a salesperson should get answered on a call.
// Shown on screen during the call, most important first; the live transcript
// ticks them off and after the call the recording is checked against them.
// The owner edits the list on the Dialer setup page (dialer_settings key
// "guide"), one question per line. A line may start with "High:", "Medium:" or
// "Low:" to set how much it matters; a line without one counts as Medium.
import { db } from "./members"

export type Level = 1 | 2 | 3 // 1 must ask, 2 should ask, 3 if there is time

// Loss first, then who decides, then the rest: the order of the PROXe pain model
// (docs/gtm/learning/axlrate-gtm/pain-model.md). No loss, no demo.
export const DEFAULT_GUIDE = [
  "High: How many leads or enquiries do you get in a day?",
  "High: How many go unanswered, get a late reply or go cold in a week?",
  "High: Out of 10 leads, how many buy, and what is one customer worth to you?",
  "High: Next step agreed: a call with our founder, with the day and time?",
  "Medium: Who replies to them today, and how fast?",
  "Medium: Who decides on a tool like this: you or someone else?",
  "Medium: Where do your leads come from (ads, Google, Justdial, WhatsApp, walk-ins)?",
  "Low: What do you use now to track leads (sheet, CRM, WhatsApp)?",
  "Low: How many people are on the sales or front-desk team?",
]

const PREFIX = /^(high|medium|med|low)\s*[:\-]\s*/i

export function parseLine(raw: string): { q: string; level: Level } {
  const m = raw.trim().match(PREFIX)
  const word = m?.[1].toLowerCase()
  return { q: raw.trim().replace(PREFIX, "").trim(), level: word === "high" ? 1 : word === "low" ? 3 : 2 }
}

/** The lines as the owner wrote them (with their High/Medium/Low). */
export async function getGuideRaw(): Promise<string[]> {
  const { data } = await db.from("dialer_settings").select("value").eq("key", "guide").maybeSingle()
  const v = data?.value
  const list = Array.isArray(v) ? v.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 20) : []
  return list.length ? list : DEFAULT_GUIDE
}

/** Most important first. Every reader uses this order, so an answer's number always means the same question. */
export async function getGuideItems(): Promise<{ q: string; level: Level }[]> {
  return (await getGuideRaw()).map(parseLine).filter((x) => x.q)
    .map((x, i) => ({ ...x, i })).sort((a, b) => a.level - b.level || a.i - b.i).map(({ q, level }) => ({ q, level }))
}

export async function getGuide(): Promise<string[]> {
  return (await getGuideItems()).map((x) => x.q)
}

export async function saveGuide(list: string[]) {
  const clean = list.map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 20)
  return db.from("dialer_settings").upsert({ key: "guide", value: clean, updated_at: new Date().toISOString() }, { onConflict: "key" })
}
