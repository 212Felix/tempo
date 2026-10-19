import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {proposeWeek,proposeRestDay} from './integration/phase30/weekly-replanner.js'
import {rhythmPenalty,rhythmForDate,makeRhythm} from './integration/phase35/weekly-rhythm.js'
const text=path=>readFileSync(path,'utf8')
const make=(date,id,type,title=id,locked=false)=>({id,date,profileId:'local-primary-profile',sessionType:type,title,durationMin:60,target:'',priority:'SOLL',status:'geplant',createdBy:locked?'tempo-user':'tempo-planner-v1',locked,updatedAt:'old'})
const upper=()=>make('2037-10-20','upper','strength-c','Kraft C · Oberkörper')
test('Phase 35: Standardwoche wird gespeichert, aber ist nur eine weiche Trainingspräferenz',()=>{
 const rhythm=makeRhythm(['kraft','ausdauer','ausdauer','kraft','zusatz','ausdauer','recovery'])
 assert.equal(rhythmForDate('2037-10-19',rhythm),'kraft')
 assert.equal(rhythmForDate('2037-10-25',rhythm),'recovery')
 assert.ok(rhythmPenalty(make('2037-10-19','k','strength-a'),'2037-10-19',rhythm)<rhythmPenalty(make('2037-10-19','k','strength-a'),'2037-10-25',rhythm))
 assert.equal(rhythm.id,'tempo-week-rhythm:local-primary-profile')
})
test('Phase 35: Verschieben rechnet auch vorläufige Trainingseinheiten statt leere Wochen',()=>{
 const shifts=[{date:'2037-10-20',shift:'tagdienst',profileId:'local-primary-profile'},{date:'2037-10-22',shift:'frei',profileId:'local-primary-profile'}]
 const originals=structuredClone(shifts)
 const anchor=make('2037-10-20','threshold','quality','Schwelle')
 const suggestions=[make('2037-10-22','preview:run','run','Easy Run'),make('2037-10-23','preview:strength','strength-a','Kraft A'),make('2037-10-25','preview:long','long','Lange Grundlage'),make('2037-10-28','preview:next','endurance','Z2')]
 const out=proposeWeek({sessions:[anchor],completed:[],shifts,anchorId:anchor.id,targetDate:'2037-10-22',suggestions})
 assert.equal(out.all.length,5)
 assert.equal(out.assigned.threshold,'2037-10-22')
 assert.ok(out.assigned['preview:run'])
 assert.ok(out.week.includes('2037-10-28'))
 assert.deepEqual(shifts,originals)
})
test('Phase 35: Kraft C Oberkörper kann mit lockerer Ausdauer am gleichen Tag koexistieren',()=>{
 const upperSession=upper(),easy=make('2037-10-21','easy','endurance','Z2 locker')
 const out=proposeWeek({sessions:[upperSession,easy],completed:[],shifts:[],anchorId:easy.id,targetDate:upperSession.date})
 assert.equal(out.assigned.easy,upperSession.date)
 assert.equal(out.assigned.upper,upperSession.date)
 assert.equal(out.conflicts.length,0)
})
test('Phase 35: Oberkörper erhält acht Übungen / 22 Arbeitssätze ohne Beinübungen',()=>{
 const source=text('src/workouts/catalog.ts')
 const upper=source.split("C: {key:'C'")[1].split('\n  ]},')[0]
 assert.equal((upper.match(/\{id:'c-/g)||[]).length,8)
 assert.equal([...upper.matchAll(/sets:(\d+)/g)].reduce((acc,x)=>acc+Number(x[1]),0),22)
 assert.doesNotMatch(upper,/Kniebeuge|Hip Thrust|Kreuzheben/)
})
test('Phase 35: Unplanbarer freier Tag wird berücksichtigt, keine Dienstmutation',()=>{
 const shifts=[{id:'dienst',date:'2037-10-22',profileId:'local-primary-profile',shift:'tagdienst'}]
 const original=structuredClone(shifts)
 const item=make('2037-10-22','ride','endurance')
 const out=proposeRestDay({sessions:[item],completed:[],shifts,restDate:'2037-10-22',mode:'free'})
 assert.notEqual(out.assigned.ride,'2037-10-22')
 assert.deepEqual(shifts,original)
})
test('Phase 35: Preview-Übernahme berührt nur geplante Einheiten, keine Schichtdaten',()=>{
 const source=text('src/phase30/weekly-replanner.ts')
 assert.match(source,/id\.startsWith\('preview:'\)/)
 assert.match(source,/db\.transaction\(\['plannedSessions','completedSessions','settings'\]/)
 assert.doesNotMatch(source,/objectStore\('shifts'\)/)
 assert.match(text('src/phase30/WeekReplanner.tsx'),/generatePlan\(/)
 assert.match(text('src/db/ShiftCalendarPanel.tsx'),/Meine Standardwoche/)
})
