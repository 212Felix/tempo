import test from 'node:test'
import assert from 'node:assert/strict'
import {compareIntervals,activityStatus,linkedActual,overallAssessment,sportLabel,sampleMetric,intervalDeviationHint} from './integration/phase40e/analysis.js'
import {fitnessTrend,loadProxy,criticalPower,bestRollingPower,powerCurve,durability,aerobicDrift,criticalSpeed,climbSummary} from './integration/phase40e/analysis-metrics.js'
const date='2026-10-27'
const plan={id:'plan:1',profileId:'local-primary-profile',date,status:'geplant',title:'Intervalle',sessionType:'quality',durationMin:45}
const activity={id:'garmin:1',profileId:'local-primary-profile',date,sport:'cycling',source:'garmin-personal',durationMin:45,avgPowerW:200}
const points=Array.from({length:31},(_,i)=>({sec:i*10,power:i<12?180:250,hr:135+i,altitude:200+i*2,distanceKm:i*.08}))
test('Kalender unterscheidet abgeschlossen, teilweise, Garmin-Vorschlag und offen',()=>{
 assert.equal(activityStatus(plan,[]),'offen')
 assert.equal(activityStatus(plan,[],[{id:'link',plannedSessionId:plan.id}]),'garmin-pruefen')
 assert.equal(activityStatus(plan,[{id:'done',plannedSessionId:plan.id,durationMin:43}]),'erledigt')
 assert.equal(activityStatus(plan,[{id:'done',plannedSessionId:plan.id,durationMin:12}]),'teilweise')
 assert.equal(activityStatus({...plan,status:'nicht-erledigt'},[]),'ausgefallen')
})
test('Identische Garmin-Verknüpfung nur durch eindeutige gespeicherte ID',()=>{
 const trace={id:'trace:1',activityId:activity.id,kind:'garmin-fit-trace',points}
 let x=linkedActual(plan,[{id:'done:1',plannedSessionId:plan.id,externalActivityId:activity.id}],[{...activity,fitSeriesId:trace.id}],[],[trace])
 assert.equal(x.activity?.id,activity.id);assert.equal(x.trace?.id,trace.id);assert.equal(x.proposed,false)
 x=linkedActual(plan,[],[activity],[{id:'matching',plannedSessionId:plan.id,garminActivityId:activity.id}],[])
 assert.equal(x.proposed,true)
 x=linkedActual(plan,[],[activity,{...activity,id:'garmin:2'}],[{id:'a',plannedSessionId:plan.id,garminActivityId:activity.id},{id:'b',plannedSessionId:plan.id,garminActivityId:'garmin:2'}],[])
 assert.equal(x.activity,undefined)
})
test('Exakte Wattintervalle markieren große Abweichung',()=>{
 const steps=[{id:'a',title:'Belastung',effort:'work',seconds:300,lowFtp:1.0,highFtp:1.12}]
 const result=compareIntervals(steps,points,'watt',260)
 assert.equal(result.length,1);assert.equal(result[0].source,'fit')
 assert.equal(result[0].quality,'high')
 const assessment=overallAssessment({...plan,workoutSteps:steps},{activity},result)
 assert.ok(assessment.deviant>=1)
})
test('Keine erfundene Zielherzfrequenz, keine Wattwerte ohne FTP',()=>{
 const steps=[{id:'a',title:'Belastung',effort:'work',seconds:300,lowFtp:.75,highFtp:.8}]
 assert.equal(compareIntervals(steps,points,'watt')[0].quality,'unrated')
 assert.equal(compareIntervals(steps,points,'hr',260)[0].targetLow,undefined)
 assert.equal(compareIntervals(steps,undefined,'watt',260)[0].quality,'missing')
})
test('Pace nur aus Distanz- und Zeitstempeln, nicht aus GPS-Schätzung',()=>{
 assert.ok((sampleMetric(points,0,310,'pace')??0)>1)
 assert.equal(sampleMetric(points.map(({distanceKm,...p})=>p),0,310,'pace'),undefined)
 assert.equal(sampleMetric(points,0,20,'pace'),undefined)
})
test('Zielerreichung meldet fehlende Messreihen ohne ein Urteil zu erfinden',()=>{
 const r=overallAssessment(plan,{activity},[])
 assert.match(r.advice,/fehlen|FIT|Intervall/)
})
test('Sportartenbezeichnungen aus Session-Typen',()=>{
 assert.equal(sportLabel('manual-running'),'Laufen')
 assert.equal(sportLabel('strength-a'),'Kraft')
 assert.equal(sportLabel('quality'),'Radfahren')
})
test('Belastungsproxy trennt echte Power-Referenz und Laufdauer',()=>{
 assert.equal(loadProxy(activity,250),Math.round(.75*100*(200/250)**2))
 assert.equal(loadProxy(activity),null)
 assert.ok((loadProxy({...activity,sport:'running'},250)??0)>0)
})
test('Fitnessverlauf ist getrennte Schätzung und überschreibt keine Trainings',()=>{
 const copy={...activity};const rows=fitnessTrend([activity],250,12)
 assert.equal(rows.length,12);assert.equal(copy.avgPowerW,200)
 assert.ok(rows.every(x=>Number.isFinite(x.fatigue)&&Number.isFinite(x.fitness)))
})
test('Critical Power setzt zwei konsistente Bestwerte voraus',()=>{
 assert.deepEqual(criticalPower([{seconds:300,watts:400},{seconds:1200,watts:300}]),{cp:267,wPrimeKj:40})
 assert.equal(criticalPower([{seconds:300,watts:300},{seconds:1200,watts:340}]),null)
})
test('Leistungskurve nicht ohne vollständige FIT-Messreihen',()=>{
 assert.equal(bestRollingPower(points,1200),undefined)
 assert.equal(powerCurve([{points}], [3600])[0].watts,undefined)
})
test('Durability erfordert zwei Stunden; Aerobic-Drift echte Daten',()=>{
 assert.equal(durability(points),null)
 assert.equal(aerobicDrift(points,'cycling'),null)
})
test('Critical Speed benötigt zwei explizite, verschiedene Tests',()=>{
 assert.equal(criticalSpeed([{...activity,sport:'running',title:'lockerer Lauf'}]),null)
 const tests=[{...activity,sport:'running',title:'5km Test',distanceKm:5,durationSeconds:1500},{...activity,sport:'running',title:'10km Wettkampf',distanceKm:10,durationSeconds:3300}]
 assert.ok((criticalSpeed(tests)?.metersPerSecond??0)>0)
})
test('Höhenanalyse setzt Aufzeichnungswerte voraus',()=>{
 assert.ok(climbSummary({points})?.ascent)
 assert.equal(climbSummary({points:[{sec:0},{sec:200}]}),null)
})

test('Frontend verwendet eine gemeinsame Analyse für Kalender und Training',async()=>{
 const {readFile}=await import('node:fs/promises')
 const calendar=await readFile('src/phase34/CalendarBoard.tsx','utf8')
 const detail=await readFile('src/phase36/WorkoutDetail.tsx','utf8')
 const day=await readFile('src/planning/TrainingDayPanel.tsx','utf8')
 assert.match(calendar,/SessionAnalysis/)
 assert.match(detail,/SessionAnalysis/)
 assert.match(day,/InlineSessionProfile/)
})
test('Worker bietet explizite Diagnose statt Body Battery zu schätzen',async()=>{
 const {normalizeWellness}=await import('../cloudflare/tempo-garmin-worker/worker.mjs')
 const absent=normalizeWellness('2026-10-27',null,null,null)
 assert.equal(absent.bodyBattery,undefined)
 const measurement=normalizeWellness('2026-10-27',null,null,{reports:[{bodyBatteryValuesArray:[[0,72],[1,69]]}]})
 assert.equal(measurement.bodyBattery,69)
})

test('Intervallhinweise unterscheiden beim Laufen zu schnell / zu langsam',()=>{
 const seg={actual:4.1,targetLow:4.6,targetHigh:4.9}
 assert.match(intervalDeviationHint(seg,'pace'),/Schneller/)
 assert.match(intervalDeviationHint({...seg,actual:5.5},'pace'),/Langsamer/)
 assert.match(intervalDeviationHint({...seg,actual:5.5},'watt'),/Oberhalb/)
})
