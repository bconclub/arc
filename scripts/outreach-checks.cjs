const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  ts = require("typescript");
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(
    source,
    {
      exports,
      require: (n) => {
        if (n in mocks) return mocks[n];
        throw Error("Unexpected import " + n);
      },
      Response,
      Request,
      URL,
      AbortSignal,
      process: { env: {} },
      console,
      ...globals,
    },
    { filename: file },
  );
  return exports;
}
let count = 0;
async function check(name, fn) {
  await fn();
  count++;
  console.log("PASS " + name);
}
(async () => {
  const w = load("src/lib/outreach-workflow.ts");
  await check("citations marked sent remain unverified", () =>
    assert.equal(w.citationOutcome({ status: "sent" }, []), "unverified"),
  );
  await check("no-answer needs follow-up, not done", () =>
    assert.equal(w.workState("no_answer"), "pending"),
  );
  await check("submitted citation is awaiting review", () =>
    assert.equal(w.workState("submitted"), "in_progress"),
  );
  await check("live citation is done", () =>
    assert.equal(w.workState("live"), "done"),
  );
  await check("test source and test number isolated", () => {
    assert(
      w.isTestTarget({ name: "Business", source: "elevenlabs_outbound_test" }),
    );
    assert(w.isTestTarget({ name: "Clinic", phone: "+91 97316 60933" }));
    assert(!w.isTestTarget({ name: "Contest Dental", source: "maps" }));
  });
  await check("unsafe links refused", () => {
    assert.equal(w.safeUrl("javascript:alert(1)"), undefined);
    assert.equal(w.safeUrl("https://example.com"), "https://example.com/");
  });
  await check("out-of-order events use event time", () =>
    assert.equal(
      w.latestActivity([
        { id: "2", occurred_at: "2026-09-01", outcome: "live" },
        { id: "1", occurred_at: "2026-09-02", outcome: "submitted" },
      ]).outcome,
      "submitted",
    ),
  );
  await check("legacy call is not labelled email draft", () =>
    assert.equal(
      w.legacyActivity({
        id: "x",
        channel: "call",
        direction: "out",
        created_at: "2026-09-02",
        body: "DISPOSITION: no_answer",
      }).outcome,
      "no_answer",
    ),
  );
  const db = {
    from() {
      throw Error("Database should not be called for invalid input");
    },
  };
  const data = load("src/lib/outreach-data.ts", {
    "@/lib/supabase": { supabaseAdmin: db },
    "@/lib/outreach-workflow": w,
  });
  await check("invalid channel rejected before writes", async () =>
    assert.equal(
      (await data.recordOutreachActivity({ channel: "constructor" }, "bot"))
        .status,
      400,
    ),
  );
  const valid = {
    target_id: "00000000-0000-0000-0000-000000000001",
    external_id: "test-event",
    channel: "citation",
    outcome: "live",
    summary: "Listing verified",
    occurred_at: "2026-09-01T00:00:00Z",
  };
  await check("live citation needs evidence", async () =>
    assert.equal((await data.recordOutreachActivity(valid, "bot")).status, 400),
  );
  await check("future events rejected", async () =>
    assert.equal(
      (
        await data.recordOutreachActivity(
          {
            ...valid,
            occurred_at: "2099-01-01",
            evidence_url: "https://example.com",
          },
          "bot",
        )
      ).status,
      400,
    ),
  );
  for (const file of [
    "src/app/api/outreach/calls/route.ts",
    "src/app/api/outreach/calls/[id]/route.ts",
    "src/app/api/outreach/calls/[id]/audio/route.ts",
  ]) {
    const route = load(file, {
      "@/lib/outreach-costs": load("src/lib/outreach-costs.ts"),
      "@/lib/outreach-calls": {
        callSession: async () => false,
        callProvider: () => {
          throw Error("Provider must not be called");
        },
      },
    });
    await check("unauthenticated call access blocked: " + file, async () =>
      assert.equal(
        (
          await route.GET(new Request("https://arc.test"), {
            params: { id: "conv_test" },
          })
        ).status,
        401,
      ),
    );
  }
  const audio = load("src/app/api/outreach/calls/[id]/audio/route.ts", {
    "@/lib/outreach-calls": {
      callSession: async () => true,
      callDetail: async () => ({ has_audio: true }),
      callProvider: async () =>
        new Response(new Uint8Array(100), {
          headers: { "Content-Type": "audio/mpeg" },
        }),
    },
  });
  const getAudio = (range) =>
    audio.GET(
      new Request("http://arc.test/audio", { headers: range ? { range } : {} }),
      { params: { id: "conv_test" } },
    );
  await check("recording exposes finite byte length", async () => {
    const r = await getAudio();
    assert.equal(r.headers.get("content-length"), "100");
  });
  await check("recording supports seeking ranges", async () => {
    const r = await getAudio("bytes=10-19");
    assert.equal(r.status, 206);
    assert.equal(r.headers.get("content-range"), "bytes 10-19/100");
    assert.equal((await r.arrayBuffer()).byteLength, 10);
  });
  await check("recording supports suffix ranges", async () => {
    const r = await getAudio("bytes=-10");
    assert.equal(r.headers.get("content-range"), "bytes 90-99/100");
  });
  await check("invalid recording range refused", async () =>
    assert.equal((await getAudio("bytes=100-200")).status, 416),
  );
  await check("multi-range recording request refused", async () =>
    assert.equal((await getAudio("bytes=0-1,3-4")).status, 416),
  );
  const pro = process.argv[2];
  if (pro) {
    const dir = load(path.join(pro, "core/src/lib/leadDirection.ts"));
    await check("organic search stays inbound", () =>
      assert.equal(
        dir.leadDirection({
          unified_context: { attribution: { source: "google_search" } },
        }),
        "inbound",
      ),
    );
    await check("legacy dial stubs go to review", () =>
      assert.equal(
        dir.leadDirection({
          unified_context: {
            voice: {
              source: "hero_phone",
              calls: [{ reason: "outreach_dm_bot" }],
            },
          },
        }),
        "review",
      ),
    );
    await check("unverified outbound never enters qualified outbound", () =>
      assert.equal(
        dir.leadDirection({
          unified_context: {
            attribution: { direction: "outbound", source: "arc_outreach" },
          },
        }),
        "review",
      ),
    );
    await check("verified handoff is outbound", () =>
      assert.equal(
        dir.leadDirection({
          unified_context: {
            outreach: { qualified_at: "2026-09-01", arc_target_id: "id" },
          },
        }),
        "outbound",
      ),
    );
    await check("existing inbound provenance preserved", () =>
      assert.equal(
        dir.leadDirection({
          unified_context: {
            attribution: { direction: "inbound" },
            outreach: { qualified_at: "2026-09-01", arc_target_id: "id" },
          },
        }),
        "inbound",
      ),
    );
    let sent = 0;
    const query = {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: null }),
    };
    function intentRoute(brand, qualified) {
      return load(
        path.join(pro, "core/src/app/api/agent/outreach/intent/route.ts"),
        {
          "next/server": { NextResponse: Response },
          "@/lib/services": {
            getServiceClient: () => ({ from: () => query }),
            logMessage: () => {
              throw Error("Unexpected message write");
            },
          },
          "@/lib/services/whatsappSender": {
            sendWhatsAppText: () => {
              sent++;
              throw Error("Unexpected send");
            },
            sendWhatsAppTemplate: () => {
              sent++;
              throw Error("Unexpected send");
            },
          },
          "@/lib/errorLogger": { errorLogger: { log: async () => {} } },
          "@/configs": { BRAND_ID: brand },
          "@/lib/server/arcQualification": {
            readArcQualification: async () => {
              if (!qualified) throw Error("Not qualified");
              return { phone: "9999999999" };
            },
          },
          "@/lib/leadDirection": dir,
        },
        { process: { env: { INBOUND_API_KEY: "test-only" } } },
      );
    }
    const intentRequest = () =>
      new Request("https://proxe.test", {
        method: "POST",
        headers: {
          "x-api-key": "test-only",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "9999999999",
          source: "arc_outreach",
          template: "test-only",
          dry_run: true,
          arc_target_id: "target",
        }),
      });
    await check(
      "PROXe blocks unqualified WhatsApp before creation or send",
      async () => {
        assert.equal(
          (await intentRoute("proxe", false).POST(intentRequest())).status,
          409,
        );
        assert.equal(sent, 0);
      },
    );
    await check("qualified WhatsApp still needs explicit handoff", async () => {
      assert.equal(
        (await intentRoute("proxe", true).POST(intentRequest())).status,
        409,
      );
      assert.equal(sent, 0);
    });
    await check("other brand dry runs remain unchanged", async () => {
      assert.equal(
        (await intentRoute("windchasers", false).POST(intentRequest())).status,
        200,
      );
      assert.equal(sent, 0);
    });
    const qualify = load(
      path.join(pro, "core/src/lib/server/arcQualification.ts"),
      {},
      {
        process: { env: { INBOUND_API_KEY: "test-only" } },
        fetch: async () => Response.json({ qualified: false, target: {} }),
      },
    );
    await check("PROXe refuses unqualified ARC response", async () =>
      assert.rejects(
        () => qualify.readArcQualification(valid.target_id),
        /not qualified/,
      ),
    );
  }
  console.log(count + " checks passed");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
