#!/usr/bin/env node
/**
 * Reconcile ARC's live delivery board against the CEO's structured dump in BCON
 * OPS (mail is the source of truth), as of 2026-08-23.
 *
 * Source data lives in scripts/data/live-delivery-seed.json — 8 brands and the 8
 * engagements actually in flight, with the status, next action, progress and
 * dates stated in the dump. Nothing is inferred: a project with no deadline in
 * the mail lands with end_date null rather than a guessed one.
 *
 * Brands are reconciled, not blindly inserted. Each seed brand is looked up by
 * its canonical name OR any of its aliases (normalised to lowercase alphanumerics),
 * so "Wind Chasers" and "WindChasers" resolve to the row that already exists
 * instead of creating a second one. Aliases are merged into what is already
 * there, never replaced.
 *
 * Kosh Studios is a client that arrives through an agency: kind stays 'client'
 * (it is the name on the invoice) and via_brand_id points at Now Media, which is
 * created as kind='agency' if it is missing.
 *
 * Idempotent. A project is matched to an existing row by the `seed:live-delivery`
 * marker in its notes, or by (brand_id + name), so re-running updates the same
 * eight rows rather than appending duplicates.
 *
 *   node scripts/seed-live-delivery.mjs           # dry run
 *   node scripts/seed-live-delivery.mjs --apply   # needs .env.local
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
const APPLY = process.argv.includes('--apply')
const SEED_TAG = 'seed:live-delivery'

// ── env ──────────────────────────────────────────────────────────────────────
// Same .env.local the Next app and the python agent read, with a fall back to
// the real environment so this can run in CI / a shell that already exports them.
let fileEnv = {}
try {
  const envRaw = await readFile(join(here, '..', '.env.local'), 'utf8')
  fileEnv = Object.fromEntries(
    envRaw.split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
  )
} catch {
  // no .env.local — process.env is the only source left
}
const url = fileEnv.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = fileEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('✗ Missing Supabase credentials.')
  console.error('  Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, from either')
  console.error(`  ${join(here, '..', '.env.local')} or the environment.`)
  console.error('  Even the dry run reads the database to work out what would change.')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const data = JSON.parse(await readFile(join(here, 'data', 'live-delivery-seed.json'), 'utf8'))
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

console.log('BCON OPS live delivery → ARC')
console.log(`  as of ${data.as_of} · ${data.brands.length} brands · ${data.projects.length} projects`)
console.log(`  ${data.source}`)
console.log(`  mode: ${APPLY ? 'APPLY' : 'DRY RUN (pass --apply to write)'}\n`)

// ── preflight ────────────────────────────────────────────────────────────────
for (const t of ['brands', 'projects']) {
  const { error } = await db.from(t).select('id').limit(1)
  if (error) { console.error(`✗ table "${t}" not reachable: ${error.message}`); process.exit(1) }
}

// ── brands: read what is already there ───────────────────────────────────────
let { data: brandRows, error: brandReadErr } = await db
  .from('brands').select('id, name, aliases, status, kind, via_brand_id')
if (brandReadErr) { console.error('✗ brands read:', brandReadErr.message); process.exit(1) }
brandRows = brandRows || []

/** Every spelling currently on a brand row: its name plus its aliases. */
const keysOf = (b) => [b.name, ...(b.aliases || [])].filter(Boolean).map(norm)

const index = new Map()
for (const b of brandRows) for (const k of keysOf(b)) if (!index.has(k)) index.set(k, b)

/** Match a seed brand to an existing row by canonical name first, then any alias. */
const findBrand = (seed) =>
  index.get(norm(seed.canonical)) ||
  (seed.aliases_add || []).map((a) => index.get(norm(a))).find(Boolean) ||
  null

// ── brands: plan ─────────────────────────────────────────────────────────────
const brandPlan = []

// The agencies referenced by `via_brand` have to exist before anyone points at
// them, and they are not seed brands in their own right.
for (const seed of data.brands) {
  if (!seed.via_brand) continue
  if (index.get(norm(seed.via_brand))) continue
  if (brandPlan.some((p) => norm(p.name) === norm(seed.via_brand))) continue
  brandPlan.push({
    action: 'insert', name: seed.via_brand, aliases: [],
    status: 'active', kind: seed.via_kind || 'agency', why: `via-brand for ${seed.canonical}`,
  })
}

for (const seed of data.brands) {
  const found = findBrand(seed)
  if (!found) {
    brandPlan.push({
      action: 'insert', name: seed.canonical, aliases: seed.aliases_add || [],
      status: seed.status, kind: seed.kind || 'client', via: seed.via_brand || null,
    })
    continue
  }
  const have = new Set(keysOf(found))
  // Keep the canonical spelling reachable. If we matched on an alias, the name
  // the projects below carry as `client` is not yet a key on this brand, and the
  // dashboard's text matching would miss every one of them.
  const wanted = [...(seed.aliases_add || [])]
  if (norm(found.name) !== norm(seed.canonical)) wanted.unshift(seed.canonical)
  const addAliases = []
  for (const a of wanted) {
    if (have.has(norm(a))) continue
    have.add(norm(a))
    addAliases.push(a)
  }
  const patch = {}
  if (addAliases.length) patch.aliases = [...(found.aliases || []), ...addAliases]
  if (found.status !== seed.status) patch.status = seed.status
  if (seed.kind && found.kind !== seed.kind) patch.kind = seed.kind
  brandPlan.push({
    action: Object.keys(patch).length || seed.via_brand ? 'update' : 'skip',
    id: found.id, name: found.name, canonical: seed.canonical,
    addAliases, patch, via: seed.via_brand || null,
  })
}

console.log('Brands')
for (const p of brandPlan) {
  if (p.action === 'insert') {
    console.log(`  + ${p.name.padEnd(30)} new  ${p.kind}/${p.status}` +
      (p.aliases.length ? `  aliases: ${p.aliases.join(' | ')}` : '') + (p.why ? `  (${p.why})` : ''))
  } else if (p.action === 'update') {
    const bits = []
    if (p.addAliases.length) bits.push(`+aliases ${p.addAliases.join(' | ')}`)
    if (p.patch.status) bits.push(`status → ${p.patch.status}`)
    if (p.patch.kind) bits.push(`kind → ${p.patch.kind}`)
    if (p.via) bits.push(`via → ${p.via}`)
    console.log(`  ~ ${p.name.padEnd(30)} ${bits.join(', ') || 'no change'}`)
  } else {
    console.log(`  = ${p.name.padEnd(30)} already correct`)
  }
}

// ── projects: read what is already there ─────────────────────────────────────
let { data: projectRows, error: projectReadErr } = await db
  .from('projects').select('id, name, client, brand_id, status, next, progress, start_date, end_date, kind, notes')
if (projectReadErr) { console.error('✗ projects read:', projectReadErr.message); process.exit(1) }
projectRows = projectRows || []

// Brand ids are only known for rows that already exist. On a dry run against a
// fresh database the inserts above have no id yet, which is reported rather than
// hidden — the apply run resolves them.
const brandIdFor = (client) => {
  const b = index.get(norm(client))
  return b ? b.id : null
}

const projectPlan = data.projects.map((sp) => {
  const bid = brandIdFor(sp.client)
  const marked = projectRows.filter((p) => (p.notes || '').includes(SEED_TAG))
  const found =
    marked.find((p) => p.name === sp.name && ((bid && p.brand_id === bid) || norm(p.client) === norm(sp.client))) ||
    (bid ? projectRows.find((p) => p.brand_id === bid && p.name === sp.name) : null) ||
    projectRows.find((p) => norm(p.client) === norm(sp.client) && p.name === sp.name) ||
    null
  const row = {
    brand_id: bid,
    client: sp.client,
    name: sp.name,
    status: sp.status,
    next: sp.next,
    progress: sp.progress,
    start_date: sp.start_date,
    end_date: sp.end_date,
    kind: sp.kind,
    notes: sp.notes,
  }
  return { action: found ? 'update' : 'insert', id: found?.id || null, row, unresolved: !bid }
})

console.log('\nProjects')
for (const p of projectPlan) {
  const r = p.row
  const dates = `${r.start_date || '—'} → ${r.end_date || '—'}`
  console.log(`  ${p.action === 'insert' ? '+' : '~'} ${r.client.padEnd(30)} ${r.name.padEnd(26)} ` +
    `${String(r.status).padEnd(8)} ${String(r.progress).padStart(3)}%  ${dates}`)
  console.log(`      next: ${r.next}`)
  if (p.unresolved) console.log(`      ! brand not resolved yet${APPLY ? '' : ' (dry run — the insert above creates it)'}`)
}

if (!APPLY) {
  const bIns = brandPlan.filter((p) => p.action === 'insert').length
  const bUpd = brandPlan.filter((p) => p.action === 'update').length
  const pIns = projectPlan.filter((p) => p.action === 'insert').length
  const pUpd = projectPlan.filter((p) => p.action === 'update').length
  console.log(`\nWould write: brands ${bIns} new / ${bUpd} updated · projects ${pIns} new / ${pUpd} updated`)
  console.log('Nothing written. Re-run with --apply.')
  process.exit(0)
}

// ── apply: brands ────────────────────────────────────────────────────────────
console.log('')
for (const p of brandPlan) {
  if (p.action === 'insert') {
    const { data: ins, error } = await db.from('brands')
      .insert({ name: p.name, aliases: p.aliases, status: p.status, kind: p.kind })
      .select('id, name, aliases, status, kind, via_brand_id').single()
    if (error) { console.error(`✗ brand insert "${p.name}":`, error.message); process.exit(1) }
    for (const k of keysOf(ins)) if (!index.has(k)) index.set(k, ins)
    console.log(`✓ brand  + ${p.name}`)
  } else if (p.action === 'update' && Object.keys(p.patch).length) {
    const { data: upd, error } = await db.from('brands').update(p.patch).eq('id', p.id)
      .select('id, name, aliases, status, kind, via_brand_id').single()
    if (error) { console.error(`✗ brand update "${p.name}":`, error.message); process.exit(1) }
    for (const k of keysOf(upd)) if (!index.has(k)) index.set(k, upd)
    console.log(`✓ brand  ~ ${p.name}`)
  }
}

// via_brand_id is a second pass: both sides have to exist first.
for (const seed of data.brands) {
  if (!seed.via_brand) continue
  const child = index.get(norm(seed.canonical))
  const agency = index.get(norm(seed.via_brand))
  if (!child || !agency) { console.log(`  ! ${seed.canonical} → ${seed.via_brand}: one side missing`); continue }
  if (child.via_brand_id === agency.id) continue
  const { error } = await db.from('brands').update({ via_brand_id: agency.id }).eq('id', child.id)
  if (error) { console.error(`✗ via_brand_id "${seed.canonical}":`, error.message); process.exit(1) }
  console.log(`✓ brand  ~ ${seed.canonical} via ${seed.via_brand}`)
}

// ── apply: projects ──────────────────────────────────────────────────────────
let inserted = 0, updated = 0, orphaned = 0
for (const p of projectPlan) {
  const row = { ...p.row, brand_id: p.row.brand_id || brandIdFor(p.row.client) }
  if (!row.brand_id) { console.log(`  ! project "${row.name}" — no brand for client "${row.client}"`); orphaned++ }
  if (p.action === 'update') {
    const { error } = await db.from('projects').update(row).eq('id', p.id)
    if (error) { console.error(`✗ project update "${row.name}":`, error.message); process.exit(1) }
    updated++
  } else {
    const { error } = await db.from('projects').insert(row)
    if (error) { console.error(`✗ project insert "${row.name}":`, error.message); process.exit(1) }
    inserted++
  }
  console.log(`✓ project ${p.action === 'insert' ? '+' : '~'} ${row.client} — ${row.name}`)
}

console.log(`\n✓ projects  ${inserted} inserted · ${updated} updated` + (orphaned ? ` · ${orphaned} without a brand link` : ''))
console.log('Re-run is safe: the same rows are matched by the seed marker in notes.')
