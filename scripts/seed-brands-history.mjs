#!/usr/bin/env node
/**
 * Seed ARC's brand roster, service catalogue and seven years of receipts from the
 * BCON_OP sheet (Payin tab).
 *
 * Source data lives in scripts/data/bcon-history.json — 72 brands (aliases already
 * merged), 17 service lines with price bands derived from actual receipts, and 325
 * payment rows spanning Nov 2019 → Jul 2026.
 *
 * What it does NOT do: invent tax data. Every historical row lands as a receipt with
 * invoice_no null and reconciled=false, so the gap between "cash we received" and
 * "invoices we can file" is visible as a worklist instead of quietly assumed. A CA
 * fills the invoice side in.
 *
 * Requires the 20260728 migrations. Idempotent — re-running updates rather than
 * duplicating (brands by name, services by name, receipts by source_message_id).
 *
 *   node scripts/seed-brands-history.mjs           # dry run, prints the plan
 *   node scripts/seed-brands-history.mjs --apply   # writes
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
const APPLY = process.argv.includes('--apply')

// ── env (same .env.local the Next app and the python agent read) ──────────────
const envRaw = await readFile(join(here, '..', '.env.local'), 'utf8')
const env = Object.fromEntries(
  envRaw.split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const db = createClient(url, key, { auth: { persistSession: false } })

const data = JSON.parse(await readFile(join(here, 'data', 'bcon-history.json'), 'utf8'))
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN')

// Historical receipts have no message id; synthesise a stable one so re-runs update
// the same row instead of appending a duplicate.
const receiptKey = (r, i) => `bcon_op:payin:${i}:${r.brand}:${r.received_on}:${r.amount}`

console.log(`BCON_OP → ARC`)
console.log(`  ${data.brands.length} brands · ${data.services.length} services · ${data.receipts.length} receipts`)
console.log(`  total ${inr(data.receipts.reduce((a, b) => a + b.amount, 0))}`)
console.log(`  mode: ${APPLY ? 'APPLY' : 'DRY RUN (pass --apply to write)'}\n`)

// ── preflight: the migrations must be in ─────────────────────────────────────
for (const t of ['brands', 'services']) {
  const { error } = await db.from(t).select('id').limit(1)
  if (error) {
    console.error(`✗ table "${t}" not reachable: ${error.message}`)
    console.error(`  Run supabase/migrations/20260728000000_brands_services_tax.sql first.`)
    process.exit(1)
  }
}

if (!APPLY) {
  console.log('Top 10 brands by lifetime revenue:')
  data.brands.slice(0, 10).forEach((b, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${b.name.padEnd(22)} ${inr(b.lifetime_revenue).padStart(13)}  ${b.status}` +
      (b.aliases.length > 1 ? `  aliases: ${b.aliases.join(' | ')}` : '')))
  console.log('\nService catalogue:')
  data.services.forEach((s) =>
    console.log(`  ${s.name.padEnd(26)} ${String(s.txns).padStart(4)} txns  median ${inr(s.median)}`))
  console.log('\nNothing written. Re-run with --apply.')
  process.exit(0)
}

// ── services ─────────────────────────────────────────────────────────────────
const serviceRows = data.services.map((s) => ({
  name: s.name,
  median_amount: s.median,
  p25_amount: s.p25,
  p75_amount: s.p75,
  txns: s.txns,
  lifetime_revenue: s.lifetime_revenue,
}))
{
  const { error } = await db.from('services').upsert(serviceRows, { onConflict: 'name' })
  if (error) { console.error('✗ services:', error.message); process.exit(1) }
  console.log(`✓ services  ${serviceRows.length}`)
}
const { data: services } = await db.from('services').select('id, name')
const serviceId = Object.fromEntries((services || []).map((s) => [s.name, s.id]))

// ── brands ───────────────────────────────────────────────────────────────────
const brandRows = data.brands.map((b) => ({
  name: b.name,
  aliases: b.aliases,
  domains: b.domains,
  status: b.status,
  country: b.country || 'IN',
  currency: b.currency || 'INR',
  is_export: !!b.is_export,
  first_seen: b.first_seen,
  last_seen: b.last_seen,
  lifetime_revenue: b.lifetime_revenue,
}))
{
  const { error } = await db.from('brands').upsert(brandRows, { onConflict: 'name' })
  if (error) { console.error('✗ brands:', error.message); process.exit(1) }
  console.log(`✓ brands    ${brandRows.length}`)
}
const { data: brands } = await db.from('brands').select('id, name, aliases')

// resolve a seed key (normalised client string) back to a brand id
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const brandId = {}
for (const b of brands || []) {
  brandId[norm(b.name)] = b.id
  for (const a of b.aliases || []) brandId[norm(a)] = b.id
}

// ── receipts → payments ──────────────────────────────────────────────────────
// status 'paid' + received_on set; the FY trigger fills fy. invoice side stays null
// and reconciled stays false — that IS the CA worklist.
const paymentRows = data.receipts.map((r, i) => ({
  brand_id: brandId[norm(r.brand)] || null,
  service_id: serviceId[r.service_line] || null,
  client: r.brand,
  item: r.raw_service,
  amount: r.amount,
  net_received: r.amount,
  received_on: r.received_on,
  stage: r.stage,
  status: 'paid',
  currency: 'INR',
  reconciled: false,
  source: r.source,
  source_message_id: receiptKey(r, i),
}))

const unmatched = paymentRows.filter((p) => !p.brand_id)
if (unmatched.length) console.log(`  ! ${unmatched.length} receipts could not resolve a brand`)

let written = 0
for (let i = 0; i < paymentRows.length; i += 100) {
  const chunk = paymentRows.slice(i, i + 100)
  const { error } = await db.from('payments').upsert(chunk, { onConflict: 'source_message_id' })
  if (error) { console.error('✗ payments:', error.message); process.exit(1) }
  written += chunk.length
}
console.log(`✓ payments  ${written}`)

// ── link the two projects already in ARC to their brands ─────────────────────
const { data: projects } = await db.from('projects').select('id, name, client, brand_id')
for (const p of projects || []) {
  if (p.brand_id) continue
  const id = brandId[norm(p.client)] || brandId[norm(p.name)]
  if (!id) { console.log(`  ! project "${p.name}" — no brand match for client "${p.client}"`); continue }
  const { error } = await db.from('projects').update({ brand_id: id }).eq('id', p.id)
  if (!error) console.log(`✓ linked project "${p.name}" → brand`)
}

// ── summary ──────────────────────────────────────────────────────────────────
const { data: fy } = await db.from('brand_fy_revenue').select('fy, received')
const byFy = {}
for (const r of fy || []) byFy[r.fy] = (byFy[r.fy] || 0) + Number(r.received || 0)
console.log('\nRevenue by Indian FY (Apr–Mar), as loaded:')
Object.keys(byFy).sort().forEach((k) => console.log(`  FY${k}  ${inr(byFy[k]).padStart(14)}`))
console.log(`\n${paymentRows.length} receipts loaded unreconciled — invoice_no, GST split and TDS still to be filled in.`)
