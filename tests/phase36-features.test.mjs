import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createLoadCalendar} from './integration/planning/load.js'
import {deriveAdaptiveWeeks} from './integration/phase28/adaptive-planner.js'
const read=path=>readFileSync(path,'utf8')
const app=read('src/App.tsx')
const day=read('src/planning/TrainingDayPanel.tsx')
test('Phase 36: Vier Tabs, Startseite zuerst, Fortschritt nicht mehr unten',()=>{
 assert.match(app,/const primary: PageId\[\] = \['home', 'readiness', 'training', 'calendar'\]/)
 assert.match(app,/name: 'Kalender'/)
})
test('Phase 36: aktive Seite im Header, kleines Hirschlogo, Versionsanzeige nur im Seitenmenü',()=>{
 assert.match(app,/tempo36-current-page/)
 assert.match(app,/tempo36-nav-logo/)
 assert.match(app,/V0\.36 · TEMPO/)
 assert.doesNotMatch(app,/className="topbar-tag"/)
 assert.doesNotMatch(app,/className="page-heading"/)
})
test('Phase 36: Startseite zeigt vollständige Trainingseinheiten vor Dienst und chronologischen Zielen',()=>{
 assert.ok(app.indexOf('<HomeTrainingCard')<app.indexOf('<ShiftHomeCard'))
 assert.ok(app.indexOf('<ShiftHomeCard')<app.indexOf('<EventsHomeCard'))
 assert.match(read('src/planning/TrainingDayPanel.tsx'),/today\.map\(session=>/)
 assert.match(read('src/events/EventsPanel.tsx'),/upcomingEvents\(rows,today\(\)\)/)
})
test('Phase 36: direkte Workoutnavigation, keine Statistikseite bei Radtraining',()=>{
 assert.match(app,/workout-detail/)
 assert.match(day,/onOpenWorkout\(x\)/)
 assert.match(read('src/phase36/WorkoutDetail.tsx'),/Indoor · Schritte für Garmin/)
 assert.match(read('src/phase36/WorkoutDetail.tsx'),/getRecord<TrainingRecord>/)
})
test('Phase 36: Trainingsdatum zwischen Pfeilen; keine doppelte Tagesliste oder Readinesskarte',()=>{
 assert.match(day,/tempo36-date-nav/)
 assert.match(day,/tempo36-daily-workout/)
 assert.match(day,/Ruhetag \/ Recovery festlegen/)
 assert.doesNotMatch(day,/<DailyDecisionPanel/)
 assert.doesNotMatch(day,/<h2>Geplante Einheiten<\/h2>/)
})
test('Phase 36: Sportspiel und Golf vorhanden, beeinflussen Folgeplanung nicht',()=>{
 const manual=read('src/planning/manual.ts')
 assert.match(manual,/value:'sportspiel'/)
 assert.match(manual,/value:'golf'/)
 const days=['2037-11-01','2037-11-02']
 const performed=[{date:'2037-11-01',sessionType:'manual-golf',durationMin:240,rpe:10},{date:'2037-11-01',sessionType:'manual-sportspiel',durationMin:180,rpe:10}]
 assert.equal(createLoadCalendar(days,performed,[])['2037-11-02'].level,'none')
 assert.match(read('src/planning/engine.ts'),/manual-sportspiel','manual-golf/)
})
test('Phase 36: Dienst bleibt am ursprünglichen Datum gespeichert',()=>{
 assert.match(read('src/planning/DayShiftEditor.tsx'),/id:`\$\{PROFILE_ID\}:\$\{date\}`/)
 assert.match(app,/openDuty/)
})

test('Phase 36: Golf/Sportspiel zählen nicht für adaptives Umfangsbudget oder Trainingshistorie',()=>{
 const entry=(sessionType,date='2037-11-02')=>({profileId:'local-primary-profile',id:sessionType,date,sessionType,durationMin:180,rpe:10})
 const common={start:'2037-11-02',weeks:1,events:[]}
 const base=deriveAdaptiveWeeks({...common,completed:[],planned:[]})[0]
 const extra=deriveAdaptiveWeeks({...common,completed:[entry('manual-golf'),entry('manual-sportspiel'),entry('manual-swimming')],planned:[]})[0]
 assert.equal(extra.completedMinutes,base.completedMinutes)
 assert.equal(extra.protectedSessions,base.protectedSessions)
})
test('Phase 36: Direkte Laufansicht blendet generische Einleitung bei ausgewählter Einheit aus',()=>{
 const running=read('src/workouts/RunningPanel.tsx')
 assert.match(running,/!focusId&&cooper&&/)
 assert.match(running,/session\?\.title\?\?"Deine Einheit"/)
 assert.match(running,/FuelingQuick session=\{session\}/)
})

test('Phase 36: Golf und Sportspiel sind direkt im Aktivitätenmenü verfügbar',()=>{
 assert.match(app,/id: 'sportspiel', name: 'Sportspiel'/)
 assert.match(app,/id: 'golf', name: 'Golf'/)
 assert.match(app,/autoStartMode="completed"/)
 assert.match(read('src/planning/ManualTrainingPanel.tsx'),/initialSport/)
})
