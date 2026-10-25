import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {normalizeActivity} from '../cloudflare/tempo-garmin-worker/worker.mjs'
import {validatePersonalSummary,classifyPersonal,localPersonalId,mergePersonal,personalRecord,validateBridgeUrl} from './integration/phase39/garmin-sync.js'
const sample={activityId:123456789,activityName:'Lockere Grundlagenausfahrt',startTimeGMT:'2026-10-23T07:05:00.000Z',activityType:{typeKey:'road_biking'},duration:3680,movingDuration:3490,distance:30125,elevationGain:281,averageHR:133,maxHR:156,averagePower:172,maxPower:399,normPower:190,averageBikingCadence:82,averageSpeed:7.2,calories:789}

test('Phase39: documented Garmin cycling data normalized with correct units',()=>{
 const x=normalizeActivity(sample)
 assert.equal(x?.garminActivityId,'123456789')
 assert.equal(x?.distanceKm,30.125)
 assert.equal(x?.avgSpeedKmh,25.92)
 assert.equal(x?.movingSeconds,3490)
 assert.equal(x?.normalizedPowerW,190)
 assert.equal(validatePersonalSummary(x)?.avgCadence,82)
})
test('Phase39: running and swimming supported, unrelated sports ignored',()=>{
 assert.equal(normalizeActivity({...sample,activityType:{typeKey:'running'}})?.sport,'running')
 assert.equal(normalizeActivity({...sample,activityType:{typeKey:'lap_swimming'}})?.sport,'swimming')
 assert.equal(normalizeActivity({...sample,activityType:{typeKey:'strength_training'}}),null)
})
test('Phase39: invalid/oversized data refused, not stored',()=>{
 assert.equal(validatePersonalSummary({garminActivityId:'invalid'}),null)
 assert.equal(validatePersonalSummary({...normalizeActivity(sample),durationSeconds:-10}),null)
 assert.equal(normalizeActivity({...sample,activityId:'abc'}),null)
})
test('Phase39: Garmin IDs are stable across repeated pulls; duplication filtered',()=>{
 const a=validatePersonalSummary(normalizeActivity(sample))
 const prev=[personalRecord(a)]
 assert.equal(classifyPersonal([a,a],prev).length,1)
 assert.equal(classifyPersonal([a],prev)[0].status,'already')
 assert.equal(localPersonalId(a.garminActivityId),prev[0].id)
})
test('Phase39: older FIT/CSV close match requires manual review, link keeps trace',()=>{
 const a=validatePersonalSummary(normalizeActivity(sample))
 const existing=[{...personalRecord(a),id:'garmin:fit:local-primary-profile:a123',source:'garmin-fit',fitSeriesId:'private-fit-trace',garminActivityId:undefined}]
 assert.equal(classifyPersonal([a],existing)[0].status,'review')
 const merged=mergePersonal(existing[0],a)
 assert.equal(merged.fitSeriesId,'private-fit-trace')
 assert.equal(merged.id,existing[0].id)
 assert.equal(merged.garminActivityId,a.garminActivityId)
})
test('Phase39: first import is new, wrong sport does not count as possible match',()=>{
 const a=validatePersonalSummary(normalizeActivity(sample))
 assert.equal(classifyPersonal([a],[])[0].status,'new')
 assert.equal(classifyPersonal([a],[{...personalRecord(a),id:'x',garminActivityId:undefined,sport:'running'}])[0].status,'new')
})
test('Phase39: bridge origin must be explicit HTTPS Cloudflare endpoint',()=>{
 assert.equal(validateBridgeUrl('https://tempo-garmin-private.example.workers.dev'),'https://tempo-garmin-private.example.workers.dev')
 for(const value of ['http://example.workers.dev','https://evil.example','https://a.workers.dev/private','https://a.workers.dev/?token=1'])assert.equal(validateBridgeUrl(value),null)
})
test('Phase39: worker requires access code and uses no plaintext log/export',()=>{
 const worker=readFileSync('cloudflare/tempo-garmin-worker/worker.mjs','utf8')
 assert.match(worker,/secureEqual\(/)
 assert.match(worker,/GARMIN_PERSONAL_API_KEY/)
 assert.match(worker,/\bAuthorization:/)
 assert.doesNotMatch(worker,/console\.(log|error|warn)/)
 const client=readFileSync('src/phase39/GarminSyncPanel.tsx','utf8')
 assert.doesNotMatch(client,/localStorage|sessionStorage/)
})
test('Phase39: syncing cannot mutate planned sessions or readiness',()=>{
 const sync=readFileSync('src/phase39/garmin-sync.ts','utf8')
 assert.match(sync,/transaction\(\['externalActivities'\]/)
 assert.doesNotMatch(sync,/saveRecord\('plannedSessions'|saveRecord\('readinessEntries'/)
})

test('Phase39: private bridge denies unauthenticated cross-origin requests',async()=>{
 const {default:worker}=await import('../cloudflare/tempo-garmin-worker/worker.mjs')
 const env={TEMPO_ALLOWED_ORIGIN:'https://212felix.github.io',TEMPO_BRIDGE_TOKEN:'a'.repeat(48),DB:{prepare(){throw Error('Database should not be touched')}}}
 const noAuth=await worker.fetch(new Request('https://private.workers.dev/v1/activities',{headers:{Origin:'https://212felix.github.io'}}),env)
 assert.equal(noAuth.status,401)
 const badOrigin=await worker.fetch(new Request('https://private.workers.dev/v1/status',{headers:{Origin:'https://attacker.invalid',Authorization:'Bearer '+'a'.repeat(48)}}),env)
 assert.equal(badOrigin.status,403)
})
test('Phase39: private bridge never publishes data on unknown routes',async()=>{
 const {default:worker}=await import('../cloudflare/tempo-garmin-worker/worker.mjs')
 const env={TEMPO_ALLOWED_ORIGIN:'https://212felix.github.io',TEMPO_BRIDGE_TOKEN:'a'.repeat(48)}
 const response=await worker.fetch(new Request('https://private.workers.dev/'),env)
 assert.equal(response.status,404)
 assert.equal(response.headers.get('Cache-Control'),'no-store')
})

test('Phase39: end-to-end mock uses official token/list/detail and stores private summaries only',async()=>{
 const {default:worker}=await import('../cloudflare/tempo-garmin-worker/worker.mjs')
 const storage=new Map()
 const meta=new Map()
 const d1={
  prepare(statement){
   const impl=(values=[])=>({
    async first(){if(statement.includes('sync_meta'))return {value:meta.get(values[0])};if(statement.includes('COUNT'))return {total:storage.size};return null},
    async all(){return {results:statement.includes('SELECT id FROM activities')?[...storage.keys()].map(id=>({id})):[...storage.values()].map(payload=>({payload}))}},
    async run(){if(statement.includes('sync_meta'))meta.set(values[0],values[1]);else if(statement.includes('INSERT'))storage.set(values[0],values[2]);return {success:true}},
   })
   return {...impl(),bind(...values){return impl(values)}}
  },
  async batch(stmts){for(const statement of stmts)await statement.run();return []}
 }

 const originalFetch=globalThis.fetch
 let tokenCount=0
 globalThis.fetch=async(url, options)=>{
  if(String(url).includes('personal-api-key/token')){
   tokenCount++
   assert.equal(options.headers.Accept,'*/*')
   assert.equal(options.redirect,'manual')
   return new Response('header.payload.signature\n',{headers:{'Content-Type':'text/plain'}})
  }
  if(String(url).includes('activities/search')){
   assert.equal(options.headers.Authorization,'Bearer header.payload.signature')
   return Response.json([sample])
  }
  if(String(url).includes('/activity-service/activity/'))return Response.json(sample)
  throw Error('unexpected network route')
 }
 try{
  const env={TEMPO_ALLOWED_ORIGIN:'https://212felix.github.io',TEMPO_BRIDGE_TOKEN:'a'.repeat(48),GARMIN_PERSONAL_API_KEY:'mock private key',DB:d1}
  const req=()=>new Request('https://private.workers.dev/v1/sync',{method:'POST',headers:{Origin:'https://212felix.github.io',Authorization:`Bearer ${'a'.repeat(48)}`}})
  const first=await worker.fetch(req(),env)
  assert.equal(first.status,200)
  assert.equal((await first.json()).newStored,1)
  const second=await worker.fetch(req(),env)
  assert.equal((await second.json()).newStored,0)
  assert.equal(storage.size,1)
  assert.equal(tokenCount,2)
  const record=JSON.parse([...storage.values()][0])
  assert.equal(record.avgPowerW,172)
  assert.equal(record.garminActivityId,'123456789')
  assert.equal('gps' in record,false)
  assert.equal('latitude' in record,false)
 } finally {globalThis.fetch=originalFetch}
})
