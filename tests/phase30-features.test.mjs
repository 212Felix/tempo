import {test} from 'node:test'
import assert from 'node:assert/strict'
import {calculateFuel,recommendCarbsHour,productIsValid} from './integration/phase30/fueling.js'
import {holidaySaxony,isWeekendOrHoliday} from './integration/phase30/saxon-holidays.js'
import {proposeWeek,weekDates} from './integration/phase30/weekly-replanner.js'
const base={sport:'cycling',durationMin:300,intensity:'hard',temperatureC:19,gutTraining:'trained',bottleMl:750}
const gel={id:'g',name:'Gel 30',kind:'gel',servingGrams:40,carbsGrams:30,sodiumMg:150,waterMl:0}
const powder={id:'p',name:'Drink 90',kind:'powder',servingGrams:100,carbsGrams:90,sodiumMg:400,waterMl:0}
test('Phase30: lange intensive Tour bekommt 90g KH/h, gerechnet nach Dauer und Produkten',()=>{
 assert.equal(recommendCarbsHour(base),90)
 const p=calculateFuel(base,gel,powder)
 assert.equal(p.totalCarbs,450)
 assert.ok(p.gelCount>0)
 assert.ok(p.powderPerBottleGrams>0)
 assert.ok(Math.abs(p.gelCount*30+p.powderCarbsTotal-450)<=1)
 assert.equal(p.events.at(-1).minute,300)
 assert.ok(p.events.every(x=>x.waterMl>=0))
})
test('Phase30: bei 35min ist kein verpflichtendes KH-Ziel gesetzt',()=>{
 assert.equal(recommendCarbsHour({...base,durationMin:35}),0)
 assert.equal(calculateFuel({...base,durationMin:35}).totalCarbs,0)
})
test('Phase30: Produktwerte plausibel validieren',()=>{
 assert.equal(productIsValid(gel),true)
 assert.equal(productIsValid({...gel,servingGrams:20,carbsGrams:70}),false)
})
test('Phase30: Sachsens Buß- und Bettag, Ostermontag und regionaler Feiertag',()=>{
 assert.equal(holidaySaxony('2026-11-18'),'Buß- und Bettag')
 assert.equal(isWeekendOrHoliday('2026-11-18'),true)
 assert.equal(holidaySaxony('2027-03-29'),'Ostermontag')
 assert.equal(isWeekendOrHoliday('2027-05-27'),false)
})
const make=(date,id,sessionType,priority='SOLL')=>({id,date,profileId:'local-primary-profile',sessionType,title:id,priority,target:'',durationMin:60,status:'geplant',updatedAt:'initial'})
test('Phase30: Schwelle auf Samstag verschieben – Umfang, Lauf, Kraft bleiben bestehen',()=>{
 const sessions=[make('2026-10-19','kraft-a','strength-a'),make('2026-10-20','z2','endurance'),make('2026-10-21','schwelle','quality','MUSS'),make('2026-10-23','kraft-b','strength-b'),make('2026-10-24','lang','long','MUSS'),make('2026-10-25','lauf','run')]
 const p=proposeWeek({sessions,completed:[],shifts:[],anchorId:'schwelle',targetDate:'2026-10-24'})
 assert.equal(p.assigned.schwelle,'2026-10-24')
 assert.equal(p.all.length,sessions.length)
 assert.equal(p.all.filter(x=>x.sessionType==='run').length,1)
 assert.equal(p.all.filter(x=>x.sessionType.startsWith('strength')).length,2)
 assert.notEqual(p.assigned.lang,p.assigned.schwelle)
 assert.equal(weekDates('2026-10-21')[0],'2026-10-19')
 assert.deepEqual(sessions.map(x=>x.date),['2026-10-19','2026-10-20','2026-10-21','2026-10-23','2026-10-24','2026-10-25'])
})
test('Phase30: absolvierte Einheit blockiert, kein stummes Überschreiben',()=>{
 const sessions=[make('2026-10-21','quality','quality','MUSS'),make('2026-10-24','long','long','MUSS')]
 const completed=[{id:'done',profileId:'local-primary-profile',date:'2026-10-24',sessionType:'manual-cycling'}]
 const p=proposeWeek({sessions,completed,shifts:[],anchorId:'quality',targetDate:'2026-10-24'})
 assert.ok(p.conflicts.some(x=>/absolviertes/.test(x)))
})


test('Phase30: bereits fixiertes Krafttraining bleibt am gewählten Tag',()=>{
 const sessions=[make('2026-10-21','q','quality','MUSS'),{...make('2026-10-23','kraft-b','strength-b'),'locked':true,'createdBy':'tempo-user'},make('2026-10-24','lang','long','MUSS')]
 const p=proposeWeek({sessions,completed:[],shifts:[],anchorId:'q',targetDate:'2026-10-24'})
 assert.equal(p.assigned['kraft-b'],'2026-10-23')
})
