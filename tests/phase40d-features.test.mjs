import test from 'node:test'
import assert from 'node:assert/strict'
import {makeSuggestion,referenceRunningPace,suggestionRecord} from './integration/phase40d/prescription.js'
import {assessHybrid,hrvReference} from './integration/phase40d/hybrid-readiness.js'
import {gestureDirection,dragOffset} from './integration/phase40d/gestures.js'
import {proposeIndividualPlacement} from './integration/phase40d/individual-placement.js'
import {suggestedPlanMatch} from './integration/phase40d/garmin-matching.js'
import {fitFromZip} from './integration/phase40d/zip-fit.js'

const sum=steps=>steps.reduce((s,x)=>s+x.seconds,0)
test('Individuelle Radschwelle wird auf exakte Zeit berechnet',()=>{
 const result=makeSuggestion({sport:'cycling',flavor:'threshold',minutes:60,ftp:260,readiness:'gruen',weeklyHardSessions:0})
 assert.ok(result);assert.equal(sum(result.steps),3600);assert.ok(result.steps.filter(x=>x.effort==='work').length>=2)
 assert.ok(result.steps.every(s=>s.seconds>0))
})
test('Keine erfundenen Watt-/Pace-Werte ohne persönliche Referenz',()=>{
 const ride=makeSuggestion({sport:'cycling',flavor:'z2',minutes:45});assert.ok(ride.warning?.includes('FTP'))
 const run=makeSuggestion({sport:'running',flavor:'threshold',minutes:60});assert.ok(run.warning?.includes('Lauf-Referenzzeit'))
 assert.ok(run.steps.every(s=>s.paceMinPerKm===undefined));assert.equal(sum(run.steps),3600)
})
test('Lauftraining aus gemessenem 5-km-Test statt Zielpace',()=>{
 assert.equal(referenceRunningPace({run5kSeconds:1500}),5)
 const run=makeSuggestion({sport:'running',flavor:'vo2',minutes:50,run5kSeconds:1500})
 assert.ok(run);assert.equal(sum(run.steps),3000);assert.ok(run.steps.some(x=>x.effort==='work'&&x.paceMinPerKm))
})
test('ROT und hohe Intensitätsbelastung blockieren neue harte Einheit',()=>{
 assert.equal(makeSuggestion({sport:'cycling',flavor:'threshold',minutes:60,readiness:'rot'}),null)
 assert.equal(makeSuggestion({sport:'cycling',flavor:'vo2',minutes:60,weeklyHardSessions:2}),null)
 assert.ok(makeSuggestion({sport:'cycling',flavor:'z2',minutes:40,readiness:'rot'}))
 assert.equal(makeSuggestion({sport:'cycling',flavor:'z2',minutes:10}),null)
})
test('Neuer Eintrag ist bestätigt/gesperrt und enthält die Intervallphasen',()=>{
 const r=suggestionRecord({sport:'running',flavor:'z2',minutes:40},'2026-10-29','individual:test')
 assert.equal(r.date,'2026-10-29');assert.equal(r.workoutSteps.reduce((s,x)=>s+x.seconds,0),2400)
 assert.equal(r.createdBy,'tempo-user')
})
test('Readiness behält subjektive Fragen bei und ersetzt Schlaf nur bei echten Garmin-Werten',()=>{
 const r={stress:2,fatigue:2,legs:2}
 const w={date:'2026-10-27',fetchedAt:new Date().toISOString(),sleepHours:7.6,bodyBattery:80}
 assert.equal(assessHybrid(r,'nein',w).level,'gruen')
 assert.equal(assessHybrid(r,'nein').level,'offen')
 assert.equal(assessHybrid({...r,stress:5},'nein',{...w,bodyBattery:15}).level,'rot')
 assert.equal(assessHybrid(r,'ja',w).level,'rot')
})
test('HRV erfordert fünf ältere Messwerte vor Schwellenvergleich',()=>{
 const mk=(day,hrvMs)=>({date:`2026-10-${day}`,fetchedAt:new Date().toISOString(),hrvMs})
 assert.equal(hrvReference([mk('20',50),mk('21',52)],'2026-10-27'),undefined)
 assert.equal(hrvReference([mk('20',50),mk('21',52),mk('22',53),mk('23',51),mk('24',54)],'2026-10-27'),52)
})
test('iOS-Wischen folgt Finger und unterscheidet Geste von Scrollen',()=>{
 assert.equal(gestureDirection(-112,8,240,100,390),1)
 assert.equal(gestureDirection(112,8,240,100,390),-1)
 assert.equal(gestureDirection(-20,100,150,100,390),0)
 assert.equal(gestureDirection(-112,8,240,10,390),0)
 assert.ok(dragOffset(130,390)>0)
})
test('Kalendervorschau verschiebt nur ungesperrte automatische Einheit',()=>{
 const session={id:'auto:1',profileId:'local-primary-profile',date:'2026-10-28',status:'geplant',createdBy:'tempo-planner-v1',locked:false,title:'Training'}
 const proposed={...session,id:'individual:preview',title:'Wunschtraining'}
 const result=proposeIndividualPlacement(proposed,[session],[],[])
 assert.deepEqual(result.conflicts,[]);assert.equal(result.moves[0]?.from,'2026-10-28')
 const locked=proposeIndividualPlacement(proposed,[{...session,locked:true}],[],[])
 assert.equal(locked.moves.length,0)
 const blocked=proposeIndividualPlacement(proposed,[],[],['2026-10-28'])
 assert.ok(blocked.conflicts.length)
})
test('Garmin-Zuordnung nur bei einem passenden Training',()=>{
 const a={profileId:'local-primary-profile',date:'2026-10-27',sport:'cycling',durationMin:60}
 const b={id:'plan:a',profileId:'local-primary-profile',date:'2026-10-27',sessionType:'quality',status:'geplant',durationMin:60}
 assert.equal(suggestedPlanMatch(a,[b]),'plan:a')
 assert.equal(suggestedPlanMatch(a,[b,{...b,id:'plan:b'}]),null)
 assert.equal(suggestedPlanMatch(a,[{...b,locked:true,sessionType:'strength-c'}]),null)
})
test('Beschädigtes FIT ZIP wird ohne Seiteneffekte verworfen',async()=>{
 await assert.rejects(fitFromZip(new ArrayBuffer(32)),/ZIP/)
})
