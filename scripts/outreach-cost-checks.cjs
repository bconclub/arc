const fs = require('fs'), ts = require('typescript'), vm = require('vm'), assert = require('node:assert/strict');
function load(file, globals={}) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports, ...globals}); return exports; }
const {callCosts} = load('src/lib/outreach-costs.ts');
const {matchVobiz, elevenBilling, vobizBilling} = load('.outreach-goproxe/app/lib/bdrCosts.ts', {process:{env:{}},URLSearchParams,AbortSignal});
let n=0; function test(name,fn){fn();n++;console.log('PASS '+name);}
const usage={input:{tokens:10},output_total:{tokens:2},input_cache_read:{tokens:4},input_cache_write:{tokens:1}};
const m={cost:888,cost_fiat:0.1603,charging:{platform_price:0.155,llm_price:0.0053,llm_usage:{initiated_generation:{model_usage:{model:usage},detailed_model_usage:[{usage}]},irreversible_generation:{model_usage:{model:usage}}}}};
test('provider dollars and credits stay separate',()=>{const c=callCosts({metadata:m});assert.equal(c.elevenlabs_usd,0.1603);assert.equal(c.elevenlabs_credits,888);});
test('tokens count initiated work once, including caches',()=>assert.equal(callCosts({metadata:m}).tokens.total,17));
test('missing billing never becomes zero',()=>{const c=callCosts(null);assert.equal(c.elevenlabs_usd,null);assert.equal(c.tokens,null);assert.equal(c.vobiz.amount,null);});
test('reported zero retained',()=>assert.equal(callCosts({metadata:{cost_fiat:0,cost:0}}).elevenlabs_usd,0));
test('negative costs rejected',()=>assert.equal(callCosts({metadata:{cost_fiat:-1}}).elevenlabs_usd,null));
test('incomplete token categories remain unavailable',()=>assert.equal(callCosts({metadata:{charging:{llm_usage:{initiated_generation:{model_usage:{model:{input:{tokens:4}}}}}}}}).tokens,null));
test('billing bridge retains required figures',()=>assert.equal(callCosts({metadata:elevenBilling(m)}).tokens.total,17));
const row={sip_call_id:'sid',call_direction:'outbound',destination_number:'+919000000000',total_cost:0.6,currency:'INR',billsec:30};
test('Vobiz exact call matches with original currency',()=>assert.equal(matchVobiz([row],'sid','+919000000000').amount,0.6));
test('different call ID rejected',()=>assert.equal(matchVobiz([row],'other','+919000000000'),null));
test('different destination rejected',()=>assert.equal(matchVobiz([row],'sid','+919000000001'),null));
test('ambiguous call legs rejected',()=>assert.equal(matchVobiz([row,row],'sid','+919000000000'),null));
test('currency cannot be guessed',()=>assert.equal(matchVobiz([{...row,currency:null}],'sid','+919000000000'),null));
test('zero Vobiz charge retained',()=>assert.equal(matchVobiz([{...row,total_cost:0}],'sid','+919000000000').amount,0));
vobizBilling({}).then(v=>{assert.equal(v.status,'not_configured');console.log('PASS absent Vobiz configuration reported');console.log((n+1)+' cost checks passed');});
