import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createLoadCalendar} from './integration/planning/load.js'
import {proposeWeek} from './integration/phase30/weekly-replanner.js'
const read=p=>readFileSync(p,'utf8')
const make=(date,id,type)=>({id,date,profileId:'local-primary-profile',sessionType:type,title:id,priority:'SOLL',target:'',durationMin:55,status:'geplant',updatedAt:'original',createdBy:'tempo-planner-v1'})
test('Phase 34: neuer Kalender verbindet 3-3-2 mit achtter Wochenbilanz statt fiktivem Wochentag',()=>{
 const x=read('src/phase34/CalendarBoard.tsx')
 assert.match(x,/weekPattern=\[\[0,1,2\],\[3,4,5\],\[6,7\]\]/)
 assert.match(x,/Wochenübersicht/)
 assert.match(x,/tempo34-floating-day/)
 assert.match(x,/Vorheriger Tag/)
 assert.match(x,/Nächster Tag/)
 assert.match(x,/onAddDay\(date\)/)
})
test('Phase 34: Trainingsdrag, nicht Schichtdrag, mit expliziter zweistufiger Bestätigung',()=>{
 const x=read('src/phase34/CalendarBoard.tsx')
 assert.match(x,/setPointerCapture/)
 assert.match(x,/beginDrag\(e,p\)/)
 assert.match(x,/Training hier platzieren\?/)
 assert.match(x,/WeekReplanner/)
 assert.doesNotMatch(x,/saveRecord\('shifts'/)
 const weekly=read('src/phase30/weekly-replanner.ts')
 assert.match(weekly,/db.transaction\(\['plannedSessions','completedSessions','settings'\]/)
 assert.doesNotMatch(weekly,/objectStore\('shifts'\)/)
})
test('Phase 34: Trainingstermine werden bewegt, Dienstinhalte nicht',()=>{
 const shifts=[{id:'shift:20',profileId:'local-primary-profile',date:'2037-10-20',shift:'tagdienst',possibleStrength:true},{id:'shift:22',profileId:'local-primary-profile',date:'2037-10-22',shift:'frei'}]
 const before=structuredClone(shifts),sessions=[make('2037-10-20','bike','endurance')]
 const proposal=proposeWeek({sessions,completed:[],shifts,anchorId:'bike',targetDate:'2037-10-22'})
 assert.equal(proposal.assigned.bike,'2037-10-22')
 assert.deepEqual(shifts,before)
 assert.deepEqual(sessions.map(s=>s.date),['2037-10-20'])
})
test('Phase 34: kurzer lockerer Lauf führt nicht zu pauschaler Kraftsperre am Folgetag',()=>{
 const days=['2037-10-21','2037-10-22']
 const load=createLoadCalendar(days,[{id:'run',date:'2037-10-21',profileId:'local-primary-profile',sessionType:'manual-running',durationMin:28,distanceKm:5,rpe:4}],[])
 assert.equal(load['2037-10-22'].level,'none')
})
test('Phase 34: 7 und 14 Tage erhalten jetzt auch vorgeschlagene Sessions',()=>{
 const x=read('src/db/ShiftCalendarPanel.tsx')
 assert.doesNotMatch(x,/if\(horizon!=='rolling'\)return/)
 assert.match(x,/generatePlan\(/)
})
test('Phase 34: Live-Fueling und bewusster Nullverbrauch',()=>{
 const fuel=read('src/phase30/FuelingPanel.tsx'),feedback=read('src/phase32/FuelingExperienceForm.tsx')
 assert.match(fuel,/fuel-consumed:/)
 assert.match(fuel,/toggleIntake/)
 assert.match(fuel,/Soll \/ Ist/)
 assert.match(feedback,/Kein Fueling/)
 assert.match(read('src/phase32/MorningFuelingCheck.tsx'),/!x.noFueling/)
})
test('Phase 34: Laufpace, Schwimmen bleibt eigenständige Aktivität ohne automatische Trainingsanpassung',()=>{
 assert.match(read('src/planning/ManualTrainingPanel.tsx'),/paceText\(/)
 assert.match(read('src/planning/manual.ts'),/value:'swimming'/)
})
test('Phase 34: Versions- und Datenbank-Vertrag',()=>{
 const app=read('src/App.tsx')
 assert.match(app,/PHASE 35/);assert.match(app,/V0\.35/)
 assert.equal(JSON.parse(read('package.json')).version,'0.35.0')
 const db=read('src/db/types.ts')
 assert.match(db,/DATABASE_NAME = 'tempo-local'/)
 assert.match(db,/DATABASE_VERSION = 1/)
 assert.match(db,/BACKUP_SCHEMA_VERSION = 1/)
 assert.equal((db.split('STORE_NAMES = [')[1].split('] as const')[0].match(/'[^']+'/g)||[]).length,20)
})
test('Phase 34: expliziter Trainingstausch verändert nur zwei Sessions; Dienst bleibt',()=>{
 const dates=['2037-10-20','2037-10-22'],shifts=dates.map((date,i)=>({id:`dienst-${i}`,date,profileId:'local-primary-profile',shift:i===0?'tagdienst':'frei'}))
 const sessions=[make(dates[0],'kraft','strength-a'),make(dates[1],'rad','endurance')]
 sessions[1].locked=true;sessions[1].createdBy='tempo-user'
 const result=proposeWeek({sessions,completed:[],shifts,anchorId:'kraft',targetDate:dates[1],forced:{rad:dates[0]}})
 assert.equal(result.assigned.kraft,dates[1]);assert.equal(result.assigned.rad,dates[0])
 assert.equal(shifts[0].shift,'tagdienst');assert.equal(shifts[1].shift,'frei')
 assert.deepEqual(sessions.map(x=>x.date),dates)
})
