// A client's view of one brand board. No ARC login: the board's share key is the
// credential, and only boards the owner has shared answer at all.
//
// GET  ?k=<key>&voter=<name>  -> { brand, items, mine }   ideas + images only
// POST { k, item_id, voter, choice?: "like"|"pass"|null, comment? }   one pick per person per item
// POST { k, voter, submit: true }   "Send picks": posts a summary note to the admin board
// POST { k, voter, input: "..." }   "Give inputs": a general note to BCON (offers, do's and don'ts, references)
// POST { k, event: "open"|"name"|"view"|"tray", voter?, item_id?, session? }   activity ping
// Comments on script/frame items count against the order's changes_allowed (3 by default).
import { db, signPaths, isClientVisible, sameKey, CHANGE_KINDS, type StudioItem } from "@/lib/studio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NOPE = () => Response.json({ error: "This board is not available." }, { status: 404 })

async function sharedBrand(slug: string, key: string | null) {
  const { data } = await db
    .from("studio_brands")
    .select("id, slug, name, mood, palette, logo_path, share_token, share_enabled, share_intro, reel_length, changes_allowed")
    .eq("slug", slug)
    .maybeSingle()
  if (!data || !data.share_enabled || !sameKey(data.share_token, key)) return null
  return data
}

const cleanName = (s: unknown) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 60)

const PING_KINDS = ["open", "name", "view", "tray"]

/** One line in the admin activity feed. Never throws: tracking must not break the client page. */
async function track(brandId: string, kind: string, voter: string | null, itemId: string | null, session: unknown, meta: Record<string, unknown> = {}) {
  try {
    await db.from("studio_events").insert({
      brand_id: brandId, kind, voter: voter || null, item_id: itemId, session: typeof session === "string" ? session.slice(0, 40) : null, meta,
    })
  } catch { /* ignore */ }
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url)
  const brand = await sharedBrand(params.slug, url.searchParams.get("k"))
  if (!brand) return NOPE()
  const voter = cleanName(url.searchParams.get("voter"))

  const [items, mine, comments, inputs] = await Promise.all([
    db.from("studio_items").select("id, kind, title, body, status, image_path, hidden, pinned, parent_id, position, created_at").eq("brand_id", brand.id).order("created_at", { ascending: true }),
    voter ? db.from("studio_votes").select("item_id, choice, comment, sent_at").eq("brand_id", brand.id).eq("voter", voter) : Promise.resolve({ data: [] }),
    db.from("studio_votes").select("item_id, comment").eq("brand_id", brand.id).not("comment", "is", null),
    // Only this person's own inputs come back, never another reviewer's.
    voter ? db.from("studio_items").select("id, body, created_at").eq("brand_id", brand.id).eq("kind", "note")
      .eq("created_by", `client: ${voter}`).contains("tags", ["client-input"]).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
  ])
  const visible = ((items.data || []) as StudioItem[]).filter(isClientVisible)
  const urls = await signPaths([...visible.map((i) => i.image_path), brand.logo_path])
  const changesUsed = changeCount(visible, (comments.data || []) as { item_id: string; comment: string | null }[])

  return Response.json(
    {
      brand: { name: brand.name, mood: brand.mood, palette: brand.palette, intro: brand.share_intro, logo_url: brand.logo_path ? urls.get(brand.logo_path) ?? null : null, reel_length: brand.reel_length, changes_allowed: brand.changes_allowed, changes_used: changesUsed },
      // Only what a client needs: no prompts, sources, authors or internal statuses.
      // An image whose parent is an idea is one of that idea's options; the rest is
      // reference material (what we were given), shown as context, not to pick from.
      items: visible
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.created_at.localeCompare(b.created_at))
        .map((i) => ({ id: i.id, kind: i.kind, title: i.title, body: i.kind === "image" ? null : i.body, url: i.image_path ? urls.get(i.image_path) ?? null : null, featured: i.pinned, parent_id: i.parent_id, position: i.position })),
      mine: mine.data || [],
      inputs: inputs.data || [],
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  )
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const body = await req.json().catch(() => ({}))
  const brand = await sharedBrand(params.slug, body.k)
  if (!brand) return NOPE()
  const voter = cleanName(body.voter)

  if (typeof body.event === "string") {
    if (!PING_KINDS.includes(body.event)) return Response.json({ error: "unknown event" }, { status: 400 })
    let itemId: string | null = null
    if (typeof body.item_id === "string") {
      const { data: it } = await db.from("studio_items").select("id, brand_id").eq("id", body.item_id).maybeSingle()
      if (it && it.brand_id === brand.id) itemId = it.id
    }
    await track(brand.id, body.event, voter, itemId, body.session, { ua: (req.headers.get("user-agent") || "").slice(0, 160) })
    return Response.json({ ok: true })
  }

  if (!voter) return Response.json({ error: "Add your name first." }, { status: 400 })

  if (typeof body.input === "string") {
    const text = body.input.trim().slice(0, 4000)
    if (!text) return Response.json({ error: "Write something first." }, { status: 400 })
    const { data, error } = await db.from("studio_items").insert({
      brand_id: brand.id, kind: "note", title: `${voter} sent inputs`, body: text,
      created_by: `client: ${voter}`, tags: ["client-input"],
    }).select("id, body, created_at").single()
    if (error) return Response.json({ error: "Could not send that. Try again." }, { status: 500 })
    await db.from("studio_brands").update({ updated_at: new Date().toISOString() }).eq("id", brand.id)
    await track(brand.id, "input", voter, null, body.session, { text: text.slice(0, 200) })
    return Response.json({ ok: true, input: data })
  }

  if (body.submit === true) {
    const [{ data: votes }, { data: items }] = await Promise.all([
      db.from("studio_votes").select("item_id, choice, comment").eq("brand_id", brand.id).eq("voter", voter),
      db.from("studio_items").select("id, kind, title, parent_id").eq("brand_id", brand.id),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byId = new Map(((items || []) as any[]).map((i) => [i.id, i]))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lines = ((votes || []) as any[]).map((v) => {
      const it = byId.get(v.item_id)
      const parent = it?.parent_id ? byId.get(it.parent_id) : null
      const what = parent ? `${parent.title}: option "${it?.title || "untitled"}"` : it?.title || "untitled"
      const verdict = v.choice === "like" ? "LOVE" : v.choice === "pass" ? "not for us" : "note"
      return `- ${verdict}: ${what}${v.comment ? ` (note: ${v.comment})` : ""}`
    })
    if (!lines.length) return Response.json({ error: "Pick at least one thing first." }, { status: 400 })
    const sentAt = new Date().toISOString()
    await db.from("studio_votes").update({ sent_at: sentAt }).eq("brand_id", brand.id).eq("voter", voter)
    await db.from("studio_items").insert({
      brand_id: brand.id, kind: "note", title: `${voter} sent their picks`, body: lines.join("\n"),
      created_by: `client: ${voter}`, tags: ["client-picks"],
    })
    // The client's yes/no on the ideas starts the order: one "write the script" task per reviewer
    // in the editors' inbox, listing every yes with notes (and the noes). Re-sending updates it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ideaVotes = ((votes || []) as any[]).filter((v) => byId.get(v.item_id)?.kind === "idea" && v.choice)
    const yesVotes = ideaVotes.filter((v) => v.choice === "like")
    if (yesVotes.length) {
      const t = (v: { item_id: string }) => byId.get(v.item_id)?.title || "untitled"
      const task = {
        title: yesVotes.length === 1 ? `Write the script for "${t(yesVotes[0])}": ${voter} said yes` : `${voter} said yes to ${yesVotes.length} ideas: pick one and write the script`,
        body: [
          `${voter} answered on the client page.`,
          ...yesVotes.map((v) => `YES: ${t(v)}${v.comment ? ` (note: ${v.comment})` : ""}`),
          ...ideaVotes.filter((v) => v.choice === "pass").map((v) => `no: ${t(v)}${v.comment ? ` (note: ${v.comment})` : ""}`),
          "Next: post the script under the idea (kind script). The client sees it and approves or asks for a change.",
        ].join("\n"),
        parent_id: yesVotes.length === 1 ? yesVotes[0].item_id : null,
      }
      const { data: open } = await db.from("studio_items").select("id").eq("brand_id", brand.id).eq("kind", "request")
        .eq("created_by", `client: ${voter}`).contains("tags", ["client-pick"]).in("status", ["open", "doing"]).limit(1)
      if (open?.length) await db.from("studio_items").update(task).eq("id", open[0].id)
      else await db.from("studio_items").insert({ ...task, brand_id: brand.id, kind: "request", status: "open", created_by: `client: ${voter}`, tags: ["client-pick"] })
    }
    await db.from("studio_brands").update({ updated_at: new Date().toISOString() }).eq("id", brand.id)
    await track(brand.id, "send", voter, null, body.session, { count: lines.length })
    return Response.json({ ok: true, sent: lines.length, sent_at: sentAt })
  }

  const { data: item } = await db.from("studio_items").select("id, brand_id, kind, hidden, status").eq("id", body.item_id).maybeSingle()
  if (!item || item.brand_id !== brand.id || !isClientVisible(item)) return NOPE()

  // Comments on the script or board frames are the order's included changes.
  if (CHANGE_KINDS.includes(item.kind) && typeof body.comment === "string" && body.comment.trim()) {
    const [{ data: all }, { data: mine }] = await Promise.all([
      db.from("studio_items").select("id, kind, hidden, status").eq("brand_id", brand.id),
      db.from("studio_votes").select("item_id, comment, voter").eq("brand_id", brand.id).not("comment", "is", null),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (mine || []) as any[]
    const already = rows.some((r) => r.item_id === item.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!already && changeCount((all || []) as any[], rows) >= (brand.changes_allowed ?? 3)) {
      return Response.json({ error: `All ${brand.changes_allowed ?? 3} included changes are used. Message the BCON team for more.` }, { status: 409 })
    }
  }

  const choice = body.choice === "like" || body.choice === "pass" ? body.choice : null
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) || null : undefined
  // Changing a pick makes it a draft again until the client sends.
  const row: Record<string, unknown> = { brand_id: brand.id, item_id: item.id, voter, choice, sent_at: null }
  if (comment !== undefined) row.comment = comment
  const { error } = await db.from("studio_votes").upsert(row, { onConflict: "item_id,voter" })
  if (error) return Response.json({ error: "Could not save that. Try again." }, { status: 500 })
  if (comment) await track(brand.id, "note", voter, item.id, body.session, { text: comment.slice(0, 200) })
  // A note save also re-sends the current choice; only a choice change is a choice event.
  if (comment === undefined) await track(brand.id, choice === "like" ? "choose" : choice === "pass" ? "pass" : "unchoose", voter, item.id, body.session)
  return Response.json({ ok: true })
}

/** Distinct script/frame items carrying at least one client comment. */
function changeCount(items: { id: string; kind: string }[], comments: { item_id: string; comment: string | null }[]) {
  const changeIds = new Set(items.filter((i) => CHANGE_KINDS.includes(i.kind)).map((i) => i.id))
  return new Set(comments.filter((c) => c.comment && changeIds.has(c.item_id)).map((c) => c.item_id)).size
}
