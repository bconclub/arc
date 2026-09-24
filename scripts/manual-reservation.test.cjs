const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

async function run({ targets = [], agent = 'bdr-bdr', manual = true, dry = false }) {
  const writes = []
  const db = {
    rpc() { return Promise.resolve({ data: null, error: null }) },
    from(table) {
      const query = {
        select() { return query }, order() { return query }, eq() { return query },
        single() { return Promise.resolve({ data: { next_at: null }, error: null }) },
        maybeSingle() { return Promise.resolve({ data: null, error: null }) },
        range() { return Promise.resolve({ data: targets, error: null }) },
        upsert(row) { writes.push({ table, row }); return Promise.resolve({ error: null }) },
        insert(row) {
          writes.push({ table, row })
          return { select() { return { single() { return Promise.resolve({ data: { id: 'new-target', phone: row.phone, status: row.status }, error: null }) } } } }
        },
      }
      return query
    },
  }
  const output = ts.transpileModule(fs.readFileSync('src/app/api/agent/outreach/reserve/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(output, {
    exports, Response, Date, crypto,
    require: (name) => name.includes('ingest-auth')
      ? { checkIngestAuth: () => ({ ok: true, agent }), authError: () => {} }
      : { supabaseAdmin: db },
  })
  const response = await exports.POST(new Request('https://arc.test', {
    method: 'POST', body: JSON.stringify({ phone: '9999999999', manual_override: manual, dry_run: dry, business_name: 'Clinic', first_name: 'Rakesh' }),
  }))
  return { status: response.status, body: await response.json(), writes }
}

(async () => {
  const target = { id: 'known', phone: '+919999999999', status: 'identified' }
  const repeat = await run({ targets: [target] })
  assert.equal(repeat.status, 200)
  assert.equal(repeat.body.target_id, 'known')
  assert.equal(repeat.writes[0].table, 'outreach_dial_reservations')

  const fresh = await run({})
  assert.equal(fresh.status, 200)
  assert.equal(fresh.body.target_id, 'new-target')
  assert.deepEqual(fresh.writes.map((write) => write.table), ['outreach_targets', 'outreach_dial_reservations'])

  const ambiguous = await run({ targets: [target, { ...target, id: 'other' }] })
  assert.equal(ambiguous.body.target_id, 'new-target')

  const preview = await run({ dry: true })
  assert.equal(preview.status, 200)
  assert.equal(preview.writes.length, 0)

  const bot = await run({ targets: [target], agent: 'bdr-bot' })
  assert.equal(bot.writes.length, 0)
  assert.equal(bot.status, 409)
  console.log('5 manual reservation checks passed')
})().catch((error) => { console.error(error); process.exitCode = 1 })
