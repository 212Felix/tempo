import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {germanDate,germanDateInLabel} from './integration/phase40c/date.js'
import {swipeDelta} from './integration/phase40c/navigation.js'
import {chartSegments} from './integration/phase40c/interval-chart.js'
import {pendingRows,selectedRows,unresolvedIds} from './integration/phase40c/garmin-review.js'
import {validateWellness,wellnessAdvice} from './integration/phase40c/wellness.js'
import {normalizeWellness} from '../cloudflare/tempo-garmin-worker/worker.mjs'

test('Phase40C dates are display-only and accept strictly real ISO dates',()=>{
 assert.equal(germanDate('2026-10-27'),'27.10.2026')
 assert.equal(germanDate('2027-08-29'),'29.08.2027')
 assert.equal(germanDate('2026-02-30'),'2026-02-30')
 assert.equal(germanDateInLabel('FIT 2026-10-12'), 'FIT 12.10.2026')
})
test('Phase40C swipe navigation protects vertical and iOS edge gestures',()=>{
 assert.equal(swipeDelta(-110,4,100,400),1)
 assert.equal(swipeDelta(130,10,130,400),-1)
 assert.equal(swipeDelta(-100,130,100,400),0)
 assert.equal(swipeDelta(-100,0,10,400),0)
 assert.equal(swipeDelta(-100,0,395,400),0)
 assert.equal(swipeDelta(-20,1,120,400),0)
})
test('Phase40C power bars preserve durations and do not invent watts without FTP',()=>{
 const steps=[{id:'a',title:'Einrollen',seconds:600,effort:'warmup',lowFtp:.5,highFtp:.6},{id:'b',title:'Tempo',seconds:300,effort:'work',lowFtp:.9,highFtp:1},{id:'c',title:'Pause',seconds:300,effort:'recovery',lowFtp:.45,highFtp:.55}]
 const actual=chartSegments(steps,250)
 assert.deepEqual(actual.map(x=>x.startSeconds),[0,600,900])
 assert.deepEqual(actual.map(x=>x.endSeconds),[600,900,1200])
 assert.deepEqual(actual.map(x=>x.watts),[138,238,125])
 assert.equal(actual[1].zone,'Z4')
 assert.deepEqual(chartSegments(steps).map(x=>x.watts),[null,null,null])
 assert.equal(chartSegments([{id:'x',title:'offen',seconds:600,effort:'work'}])[0].pct,null)
})
test('Phase40C Garmin decisions allow partial completion without falsely confirming unresolved ones',()=>{
 const candidates=[{status:'review',activity:{garminActivityId:'12345'}},{status:'review',activity:{garminActivityId:'67890'}},{status:'already',activity:{garminActivityId:'11111'}}]
 assert.deepEqual(unresolvedIds(candidates,{'12345':'skip'}),['67890'])
 assert.deepEqual(selectedRows(candidates,{'12345':'skip'}).map(x=>x.activity.garminActivityId),['12345'])
 assert.deepEqual(pendingRows(candidates,['12345']).map(x=>x.activity.garminActivityId),['67890'])
 assert.equal(readFileSync('src/phase39/GarminSyncPanel.tsx','utf8').includes('const REVIEW_ID='),true)
})
test('Phase40C wellness accepts Garmin measurements but does not forge missing values',()=>{
 const x=normalizeWellness('2026-10-26',{dailySleepDTO:{sleepTimeSeconds:7*3600}},{hrvSummary:{lastNightAvg:48}},[{bodyBatteryValues:[[100,60],[200,80]]}])
 assert.equal(x.sleepHours,7)
 assert.equal(x.hrvMs,48)
 assert.equal(x.bodyBattery,80)
 assert.equal(x.available.length,3)
 const safe=validateWellness(x)
 assert.equal(safe?.bodyBattery,80)
 assert.equal(validateWellness({...x,bodyBattery:800})?.bodyBattery,undefined)
 const absent=normalizeWellness('2026-10-26',null,null,null)
 assert.deepEqual(absent.available,[])
 assert.equal(wellnessAdvice(null),null)
 assert.match(wellnessAdvice({...x,bodyBattery:12})??'',/Body Battery niedrig/)
})
test('Phase40C private worker keeps Garmin secrets outside browser and preserves Phase40B data contracts',()=>{
 const w=readFileSync('cloudflare/tempo-garmin-worker/worker.mjs','utf8')
 assert.match(w,/GARMIN_PERSONAL_API_KEY/)
 assert.match(w,/TEMPO_BRIDGE_TOKEN/)
 assert.match(w,/\/v1\/wellness/)
 assert.match(readFileSync('src/phase39/GarminSyncPanel.tsx','utf8'),/getRecord\('settings'/)
 assert.match(readFileSync('src/db/types.ts','utf8'),/DATABASE_VERSION = 1/)
})

test('Phase40C optional low Garmin recovery lowers only suggested load, not saved sessions',async()=>{
 const {deriveAdaptiveWeeks}=await import('./integration/phase28/adaptive-planner.js')
 const planned=[{id:'ride',profileId:'local-primary-profile',date:'2026-10-26',sessionType:'endurance',durationMin:90,title:'Radeln',status:'geplant'}]
 const baseline=deriveAdaptiveWeeks({start:'2026-10-26',weeks:1,events:[],planned})[0]
 const lower=deriveAdaptiveWeeks({start:'2026-10-26',weeks:1,events:[],planned,wellness:{date:'2026-10-26',fetchedAt:'2026-10-26T19:00:00Z',bodyBattery:21}})[0]
 assert.ok(lower.legSets<=baseline.legSets)
 assert.equal(lower.qualityLimit,0)
 assert.ok(lower.notes.some(n=>n.includes('Garmin Schlaf/Body Battery')))
 assert.equal(planned[0].durationMin,90)
})
