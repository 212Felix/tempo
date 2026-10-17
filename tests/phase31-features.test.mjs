import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {proposeRestDay,proposeWeek,replanDates} from './integration/phase30/weekly-replanner.js'
import {makeRestDay,rollingCalendarWeeks} from './integration/phase31/rest-days.js'
const make=(date,id,type='endurance',priority='SOLL',locked=false)=>({id,date,profileId:'local-primary-profile',sessionType:type,title:id,priority,target:'',durationMin:60,status:'geplant',updatedAt:'old',locked,createdBy:locked?'tempo-user':'tempo-planner-v1'})
test('Phase 31: Sonntagtraining darf über die Wochengrenze verschoben werden',()=>{
 const p=proposeWeek({sessions:[make('2037-10-18','lauf','run')],completed:[],shifts:[],anchorId:'lauf',targetDate:'2037-10-21'})
 assert.equal(p.assigned.lauf,'2037-10-21')
 assert.ok(p.week.includes('2037-10-28'))
 assert.equal(p.changed.length,1)
})
test('Phase 31: Ruhetag fixieren erhält alle MUSS, SOLL, Lauf und Kraftreize',()=>{
 const sessions=[make('2037-10-19','intervall','quality','MUSS'),make('2037-10-20','kraft','strength-a'),make('2037-10-21','lauf','run')]
 const p=proposeRestDay({sessions,completed:[],shifts:[],restDate:'2037-10-19',mode:'free',note:'Sauna'})
 assert.equal(p.all.length,3)
 assert.equal(p.restDay?.kind,'fixed-training-rest')
 assert.equal(p.restDay?.note,'Sauna')
 assert.notEqual(p.assigned.intervall,'2037-10-19')
 assert.deepEqual(sessions.map(s=>s.date),['2037-10-19','2037-10-20','2037-10-21'])
})
test('Phase 31: Unverschiebbares Krafttraining auf Ruhetag stoppt ohne Datenverlust',()=>{
 const p=proposeRestDay({sessions:[make('2037-10-19','kraft','strength-a','MUSS',true)],completed:[],shifts:[],restDate:'2037-10-19',mode:'free'})
 assert.ok(p.conflicts.length>0)
 assert.equal(p.assigned.kraft,'2037-10-19')
})
test('Phase 31: Abgeschlossenes Training auf Ruhetag blockiert Speicherung',()=>{
 const p=proposeRestDay({sessions:[],completed:[{id:'done',date:'2037-10-19',profileId:'local-primary-profile'}],shifts:[],restDate:'2037-10-19',mode:'recovery'})
 assert.ok(p.conflicts.some(x=>x.includes('absolviertes Training')))
})
test('Phase 31: Bestehender Ruhetag bleibt bei zukünftiger Umplanung gesperrt',()=>{
 const p=proposeWeek({sessions:[make('2037-10-19','intervall','quality','MUSS')],completed:[],shifts:[],anchorId:'intervall',targetDate:'2037-10-20',restDays:[makeRestDay('2037-10-20','free')]})
 assert.ok(p.conflicts.length)
})
test('Phase 31: 10 Tage Zukunft sind trotz Wochenende im Kalender enthalten',()=>{
 assert.equal(rollingCalendarWeeks('2037-10-17'),3)
 assert.equal(rollingCalendarWeeks('2037-10-19'),2)
})
test('Phase 31: DB stores and backup schema not changed',()=>{
 assert.match(readFileSync('src/db/types.ts','utf8'),/DATABASE_VERSION = 1/)
})
