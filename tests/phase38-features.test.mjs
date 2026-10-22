import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {makeActivityRhythm,getRhythmActivities,rhythmPenalty,makeRhythm} from './integration/phase35/weekly-rhythm.js'
import {strengthProposal,targetReps} from './integration/phase38/strength-progression.js'
const source=f=>readFileSync(f,'utf8')
const entry=(date,type,title)=>({date,sessionType:type,title})
test('Phase 38: Mehrfachwahl A/B/C und Rad je Tag bleibt eine weiche, persistierbare Präferenz',()=>{
 const original=makeRhythm(['flexibel','kraft','ausdauer','flexibel','flexibel','flexibel','recovery'])
 const selections=getRhythmActivities(original)
 assert.ok(selections[1].includes('strength-a'))
 selections[1]=['bike','strength-c','run']
 const next=makeActivityRhythm(selections,original)
 assert.deepEqual(next.activityDays[1],['bike','strength-c','run'])
 assert.equal(next.id,original.id)
 assert.ok(rhythmPenalty(entry('2026-10-20','strength-c','Kraft C'),'2026-10-20',next)<0)
 assert.ok(rhythmPenalty(entry('2026-10-20','run','Laufen'),'2026-10-20',next)<0)
 assert.equal(rhythmPenalty(entry('2026-10-20','manual-golf','Golf'),'2026-10-20',next),0)
})
test('Phase 38: Kraft-Pflichtvorgaben sind Zahlen statt Platzhalter',()=>{
 const exercise={id:'c-bench',sets:3,reps:'6–10',hold:false}
 assert.equal(targetReps(exercise.reps),6)
 const fresh=strengthProposal(exercise,[],'studio','Flachbank','2026-10-20')
 assert.equal(fresh.reps,8);assert.equal(fresh.rir,2);assert.equal(fresh.weightKg,undefined)
})
test('Phase 38: Progression nach oberem Wiederholungsziel und RIR >= 2; nicht bei zu wenig Leistung',()=>{
 const exercise={id:'c-bench',sets:3,reps:'6–10',hold:false}
 const completed=[1,2,3].map(i=>({date:'2026-10-15',sessionKey:'done',exerciseId:'c-bench',setIndex:i,exerciseVariant:'Flachbank',trainingLocation:'studio',reps:10,weightKg:80,rir:2}))
 const more=strengthProposal(exercise,completed,'studio','Flachbank','2026-10-20')
 assert.equal(more.previousWeight,80);assert.equal(more.weightKg,82.5);assert.equal(more.increased,true)
 assert.equal(strengthProposal(exercise,completed,'arbeit','Flachbank','2026-10-20').weightKg,undefined)
 assert.equal(strengthProposal(exercise,completed,'studio','Andere Maschine','2026-10-20').weightKg,undefined)
 const poor=completed.map(row=>({...row,reps:6,rir:1}))
 assert.equal(strengthProposal(exercise,poor,'studio','Flachbank','2026-10-20').weightKg,80)
})
test('Phase 38: Readiness-Reihenfolge und Heart-Neustart am Tageswechsel',()=>{
 const r=source('src/db/ReadinessPanel.tsx'),app=source('src/App.tsx')
 assert.ok(r.indexOf('tempo38-ratings')<r.indexOf('tempo38-illness'))
 assert.ok(r.indexOf('tempo38-illness')<r.indexOf('tempo-ready-result-${assessment.level}'))
 assert.ok(r.indexOf('tempo-ready-result-${assessment.level}')<r.indexOf('tempo38-other'))
 assert.match(app,/tempo38-heart-/);assert.match(app,/const rollover=/);assert.match(app,/tempo:readiness-change/)
})
test('Phase 38: Kalender rollierend ab heute, nur 10 Tage und mit direktem Start',()=>{
 const calendar=source('src/db/ShiftCalendarPanel.tsx'),board=source('src/phase34/CalendarBoard.tsx')
 assert.match(calendar,/horizon==='rolling'\?0:-mondayOffset/)
 assert.match(calendar,/horizon==='rolling'\?10:horizon/)
 assert.match(board,/onStart\(p\)/)
 assert.match(board,/Übernehmen & Start/)
 assert.doesNotMatch(board,/<h2>Dein Trainingskalender<\/h2>/)
})
test('Phase 38: keine DB Migration und keine privaten Dateien',()=>{
 const types=source('src/db/types.ts')
 assert.match(types,/DATABASE_VERSION = 1/)
 assert.match(types,/BACKUP_SCHEMA_VERSION = 1/)
 assert.match(source('src/workouts/StrengthPanel.tsx'),/data\.completed\.some/)
 assert.match(source('src/workouts/StrengthPanel.tsx'),/dirtyInputs\.current\.has\(key\)/)
})
