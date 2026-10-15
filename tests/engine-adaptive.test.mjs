import test from 'node:test'
import assert from 'node:assert/strict'
import {generatePlan} from './integration/planning/engine.js'
import {mondayUTC} from './integration/phase28/adaptive-planner.js'
const profileId='local-primary-profile'
const mockEvent=(date,name,kind,priority,status='flexibel',vacation='offen')=>({id:'id:'+name,profileId,name,date,kind,sport:'cycling',priority,status,vacation})
const goals=[mockEvent('2027-04-30','Mallorca 312','trainingsblock','B'),mockEvent('2027-08-29','Ötztaler RM','rennen','A','bestaetigt')]
const days=(start,n)=>Array.from({length:n},(_,i)=>{let d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)})
const shift=(dates)=>Object.fromEntries(dates.map(date=>[date,{id:`shift:${date}`,date,profileId,shift:'frei'}]))
test('Manual and completed training days remain protected and unchanged',()=>{
 const range=days('2026-10-19',14)
 const existing=[{id:'own',date:'2026-10-20',profileId,status:'geplant',sessionType:'manual-cycling',title:'Meine Intervalltour',durationMin:90,locked:true,createdBy:'tempo-user'}]
 const completed=[{id:'done',date:'2026-10-19',profileId,sessionType:'manual-strength',title:'Kraft dokumentiert',durationMin:55,rpe:6}]
 const snapshot=JSON.stringify({existing,completed,goals})
 const plan=generatePlan({days:range,shifts:shift(range),existing,completed,events:goals})
 assert.equal(JSON.stringify({existing,completed,goals}),snapshot)
 assert.equal(plan.find(d=>d.date==='2026-10-20').protected,true)
 assert.equal(plan.find(d=>d.date==='2026-10-20').session,undefined)
 assert.equal(plan.find(d=>d.date==='2026-10-19').protected,true)
 assert.ok(plan.filter(d=>d.session).every(d=>!d.protected))
})
test('Tentative Mallorca B event is reserved, not logged as completed or re-planned',()=>{
 const range=days('2027-04-26',7)
 const plan=generatePlan({days:range,shifts:shift(range),existing:[],completed:[],events:goals})
 const b=plan.find(d=>d.date==='2027-04-30')
 assert.equal(b.seasonEvent,'Mallorca 312')
 assert.equal(b.seasonEventTentative,true)
 assert.equal(b.session,undefined)
 assert.equal(plan.filter(d=>d.sessionType==='quality').length,0)
})
test('High work duration and recovery prevent aggressive intervals',()=>{
 const range=days('2027-03-15',14)
 const completed=[{id:'hard',date:'2027-03-14',profileId,sessionType:'manual-cycling',durationMin:330,rpe:9}]
 const plan=generatePlan({days:range,shifts:shift(range),existing:[],completed,events:goals})
 assert.notEqual(plan.find(x=>x.date==='2027-03-15').session?.sessionType,'quality')
 assert.equal(plan.find(x=>x.date==='2027-03-15').recoveryFlag,'recovery')
})
test('Unconfirmed service does not create a workout',()=>{
 const range=days('2027-01-04',7)
 const plan=generatePlan({days:range,shifts:{},existing:[],completed:[],events:goals})
 assert.equal(plan.filter(x=>x.session).length,0)
 assert.ok(plan.every(x=>!x.confirmed))
})
test('Erfasstes Schwellentraining verhindert zweite automatisch erzeugte intensive Einheit',()=>{
 const range=days('2026-10-19',7)
 const existing=[{id:'manual-threshold',date:'2026-10-20',profileId,createdBy:'tempo-user',locked:true,status:'geplant',sessionType:'manual-cycling',title:'Schwellenintervalle Rückfahrt',target:'Schwelle',durationMin:70}]
 const planned=generatePlan({days:range,shifts:shift(range),existing,completed:[],events:goals})
 assert.equal(planned.filter(d=>d.session?.sessionType==='quality').length,0)
 assert.equal(planned.find(d=>d.date==='2026-10-20').protected,true)
})
test('Vorhandene Krafttermine zählen auf das Limit von zwei pro Woche',()=>{
 const range=days('2026-10-19',7)
 const existing=[
 {id:'a',date:'2026-10-19',profileId,createdBy:'tempo-user',locked:true,status:'geplant',sessionType:'manual-strength',title:'Kraft A',durationMin:50},
 {id:'b',date:'2026-10-22',profileId,createdBy:'tempo-user',locked:true,status:'geplant',sessionType:'manual-strength',title:'Kraft B',durationMin:50},
 ]
 const planned=generatePlan({days:range,shifts:shift(range),existing,completed:[],events:goals})
 assert.equal(planned.filter(d=>['strength-a','strength-b'].includes(d.session?.sessionType)).length,0)
})
