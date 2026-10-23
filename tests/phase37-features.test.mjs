import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {cyclingIntervalSteps,stepsSeconds,wattsForStep,recoveryValid,defaultsForRunRecovery,runRecoveryText} from './integration/phase37/intervals.js'
const src=name=>readFileSync(name,'utf8')
test('Rad: 2 x 8 mit vollständig berechneten Pausen und exakt 60 Minuten',()=>{
 const steps=cyclingIntervalSteps({sessionType:'quality',title:'Tempo-Einstieg 2 × 8',durationMin:60})
 assert.ok(steps)
 assert.deepEqual(steps.map(s=>s.seconds),[900,480,300,480,840,600])
 assert.equal(stepsSeconds(steps),3600)
 assert.equal(steps.filter(s=>s.effort==='work').length,2)
 const rest=steps.find(s=>s.effort==='recovery')
 assert.equal(rest.recovery,'active')
 assert.equal(rest.seconds,300)
 assert.equal(wattsForStep(rest,250),'113–138 W (45–55 % FTP)')
 assert.ok(steps.every(s=>s.lowFtp>0&&s.highFtp>0&&s.seconds>0))
})
test('Kein Erfinden ungeklärter Radintervalle oder Überschreiten kurzer Dauern',()=>{
 assert.equal(cyclingIntervalSteps({sessionType:'quality',title:'Intervall Spezial',durationMin:60}),null)
 assert.equal(cyclingIntervalSteps({sessionType:'quality',title:'Tempo-Einstieg 2 × 8',durationMin:40}),null)
 assert.equal(cyclingIntervalSteps({sessionType:'endurance',title:'Tempo-Einstieg 2 × 8',durationMin:60}),null)
})
test('Laufen: drei Pausentypen, HR nicht pauschal festgelegt',()=>{
 assert.equal(defaultsForRunRecovery().mode,'active')
 assert.equal(defaultsForRunRecovery().heartRateLimit,undefined)
 assert.ok(recoveryValid({mode:'passive',seconds:90}))
 assert.ok(recoveryValid({mode:'active',seconds:120,paceMinPerKm:7}))
 assert.ok(recoveryValid({mode:'heart-rate',seconds:0,heartRateLimit:135,maxWaitSeconds:180}))
 assert.ok(!recoveryValid({mode:'heart-rate',seconds:0,maxWaitSeconds:180}))
 assert.match(runRecoveryText({mode:'heart-rate',seconds:0,heartRateLimit:135,maxWaitSeconds:180}),/manuell fortfahren oder abbrechen/gi)
})
test('Garmin-Zuordnung wird nicht ohne User-Zustimmung durchgeführt',()=>{
 const ui=src('src/planning/ReconciliationPanel.tsx'),detail=src('src/phase37/SessionGarminReview.tsx')
 for(const txt of [ui,detail]){assert.match(txt,/✓ Zuordnen/);assert.match(txt,/✕ (?:Nein|Nicht zuordnen)/);assert.match(txt,/gesamt speichern/)}
 assert.match(ui,/window\.confirm/)
 assert.match(src('src/planning/reconcile.ts'),/if\(existing\.some\(x=>x\.plannedSessionId===planId\|\|x\.externalActivityId===activityId\)\)/)
})
test('Kraft, Lauf, Rad: direkte Formulare und optionales Fueling',()=>{
 const detail=src('src/phase36/WorkoutDetail.tsx'),strength=src('src/workouts/StrengthPanel.tsx'),running=src('src/workouts/RunningPanel.tsx')
 for(const txt of [detail,strength,running]){assert.match(txt,/Zwischenspeichern|zwischenspeichern/);assert.match(txt,/abschließen/);assert.match(txt,/FuelingQuick|OptionalFuelingNotes/)}
 assert.match(strength,/SessionGarminReview/);assert.match(running,/runRecoveryText/)
 assert.match(detail,/Schritte/);assert.match(detail,/Durchschnitt|Ø Leistung/)
})
test('Datenschutz und Schichtschutz, Datenbank ohne Migration',()=>{
 const types=src('src/db/types.ts'),app=src('src/App.tsx'),planner=src('src/planning/engine.ts')
 assert.match(types,/DATABASE_VERSION = 1/)
 assert.match(types,/BACKUP_SCHEMA_VERSION = 1/)
 assert.match(app,/V0\.39/)
 assert.match(planner,/type ShiftRecord/)
 assert.match(src('src/planning/TrainingDayPanel.tsx'),/tempo37-date-label/)
})
