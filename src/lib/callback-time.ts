/**
 * "tomorrow morning at 10:00 a.m." -> { date: "2026-10-27", time: "10:00" } in IST.
 *
 * The AI caller's callback_request is free text (the agent's data_collection
 * field, else the caller's own words). Relative days resolve against the CALL
 * time, not the clock, so a replay a day later still lands on the slot the
 * person agreed to. No clear clock time -> null: "call me in the morning" is a
 * follow-up for a human, never a booking.
 */
const IST_MS = 5.5 * 3600_000
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

export type CallbackSlot = { date: string; time: string; at: string }

export function parseCallbackTime(text: string | null | undefined, callAt: string | Date): CallbackSlot | null {
  const s = String(text || "").toLowerCase().replace(/\s+/g, " ")
  if (!s.trim()) return null
  const base = new Date(callAt)
  if (!Number.isFinite(base.getTime())) return null

  // Clock time. "10 a.m." / "10:30am" / "10.30 pm" / "15:00" / "10 o'clock".
  const m = s.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])/)
    || s.match(/\b(\d{1,2})[:.](\d{2})\b()/)
    || s.match(/\b(\d{1,2})()\s*o'?\s?clock\b()/)
    || s.match(/\bat (\d{1,2})()()\b(?![:.\d])/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] || 0)
  const mer = (m[3] || "").replace(/[^ap]/g, "")
  if (h > 23 || min > 59) return null
  if (mer === "p" && h < 12) h += 12
  else if (mer === "a" && h === 12) h = 0
  else if (!mer && h <= 12) {
    // No am/pm: the part of day decides, else business hours (8-11 am, 12-7 pm).
    if (/\b(evening|afternoon|night)\b/.test(s) && h < 12) h += 12
    else if (!/\bmorning\b/.test(s) && h >= 1 && h <= 7) h += 12
  }

  // Day, in IST, counted from the call.
  const callIst = new Date(base.getTime() + IST_MS)
  const day = new Date(Date.UTC(callIst.getUTCFullYear(), callIst.getUTCMonth(), callIst.getUTCDate()))
  const named = DAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(s))
  if (/\bday after tomorrow\b/.test(s)) day.setUTCDate(day.getUTCDate() + 2)
  else if (/\b(tomorrow|tmrw|tmw)\b/.test(s)) day.setUTCDate(day.getUTCDate() + 1)
  else if (named >= 0) day.setUTCDate(day.getUTCDate() + (((named - day.getUTCDay() + 7) % 7) || 7))
  else if (!/\b(today|tonight|this (morning|afternoon|evening))\b/.test(s)) {
    // No day said: today if that time is still ahead of the call, else tomorrow.
    if (h * 60 + min <= callIst.getUTCHours() * 60 + callIst.getUTCMinutes()) day.setUTCDate(day.getUTCDate() + 1)
  }

  const date = day.toISOString().slice(0, 10)
  const time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
  const at = new Date(Date.parse(`${date}T${time}:00Z`) - IST_MS).toISOString()
  return { date, time, at }
}

/** The person's own name from the call ("I'm Dr. Shobha Joel, Managing Director" -> "Dr Shobha Joel"). */
export function contactNameFromTranscript(transcript: string | null | undefined): string | null {
  for (const line of String(transcript || "").split("\n")) {
    if (!/^caller:/i.test(line)) continue
    const m = line.match(/\b(?:i'?m|i am|this is|my name is|it'?s)\s+((?:dr\.?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i)
    if (!m) continue
    const name = m[1].replace(/^dr\.?\s+/i, "Dr ").trim()
    // "I'm fine" / "this is Glam" are not names: need a title or two capitalised words.
    if (/^Dr /.test(name) || /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(name)) return name
  }
  return null
}
/**
 * The day only, when no clock time was agreed ("call me Thursday"): the IST
 * date counted from the call, or null when no day was said. Used to put a
 * follow-up on the calendar instead of dropping the call (Z, 27 Oct 2026:
 * Arjunaa Academy agreed to Thursday and nothing reached PROXe).
 */
export function parseCallbackDay(text: string | null | undefined, callAt: string | Date): { date: string } | null {
  const s = String(text || "").toLowerCase().replace(/\s+/g, " ")
  if (!s.trim()) return null
  const base = new Date(callAt)
  if (!Number.isFinite(base.getTime())) return null
  const callIst = new Date(base.getTime() + IST_MS)
  const day = new Date(Date.UTC(callIst.getUTCFullYear(), callIst.getUTCMonth(), callIst.getUTCDate()))
  const named = DAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(s))
  if (/\bday after tomorrow\b/.test(s)) day.setUTCDate(day.getUTCDate() + 2)
  else if (/\b(tomorrow|tmrw|tmw)\b/.test(s)) day.setUTCDate(day.getUTCDate() + 1)
  else if (named >= 0) day.setUTCDate(day.getUTCDate() + (((named - day.getUTCDay() + 7) % 7) || 7))
  else if (/\b(next week)\b/.test(s)) day.setUTCDate(day.getUTCDate() + 7)
  else if (!/\b(today|later today|this (morning|afternoon|evening))\b/.test(s)) return null
  return { date: day.toISOString().slice(0, 10) }
}
