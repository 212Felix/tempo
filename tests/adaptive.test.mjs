import {test} from 'node:test'
import assert from 'node:assert/strict'
import {deriveAdaptiveWeeks,adjustSuggestedSession,mondayUTC,plannedEvents} from './generated/adaptive-planner.js'
const goals=[
 {id:'b1',profileId:'local-primary-profile',name:'Mallorca 312',sport:'cycling',kind:'trainingsblock',priority:'B',status:'flexibel',vacation:'offen',date:'2027-04-30',distanceKm:312},
 {id:'a1',profileId:'local-primary-profile',name:'Ötztaler RM',sport:'cycling',kind:'rennen',priority:'A',status:'bestaetigt',vacation:'offen',date:'2027-08-29',distanceKm:227},
 {id:'cooper',profileId:'local-primary-profile',name:'Cooper 3200',sport:'running',kind:'challenge',priority:'B',status:'offen',vacation:'nicht_noetig'},
]
const base={start:'2026-10-15',weeks:52,events:goals,shifts:{}}
test('Wochen starten Montag und enthalten Mallorca als vorläufigen B-Meilenstein',()=>{
 assert.equal(mondayUTC('2026-10-15'),'2026-10-12')
 const blocks=plannedEvents(goals)
 assert.equal(blocks.length,2)
 assert.deepEqual(blocks.map(x=>x.name),['Mallorca 312','Ötztaler RM'])
 const w=deriveAdaptiveWeeks(base)
 assert.equal(w.length,52)
 assert.equal(w[0].startDate,'2026-10-12')
 const mallorca=w.find(x=>x.startDate<='2027-04-30'&&x.endDate>='2027-04-30')
 assert.equal(mallorca.kind,'TAPER')
 assert.equal(mallorca.goalTentative,true)
 assert.equal(mallorca.qualityLimit,0)
 const oetztaler=w.find(x=>x.startDate<='2027-08-29'&&x.endDate>='2027-08-29')
 assert.equal(oetztaler.kind,'TAPER')
 assert.equal(oetztaler.qualityLimit,0)
})
test('In jeder vierten Belastungswoche entfällt Pflichtqualität',()=>{
 const w=deriveAdaptiveWeeks(base)
 assert.equal(w[3].deload,true)
 assert.equal(w[3].qualityLimit,0)
})
test('VOLUME reduziert Bein-Sätze, nie Trainingstagebuch',()=>{
 const completed=[{id:'doneA',date:'2026-10-08',profileId:'local-primary-profile',durationMin:55,sessionType:'manual-cycling'}]
 const planned=[{id:'fixed',date:'2026-10-16',profileId:'local-primary-profile',status:'geplant',createdBy:'tempo-user',durationMin:60,sessionType:'manual-strength'}]
 const before=JSON.stringify({goals,completed,planned})
 const w=deriveAdaptiveWeeks({...base,planned,completed,regularLegSets:12})
 assert.equal(w[0].protectedSessions,1)
 assert.equal(JSON.stringify({goals,completed,planned}),before)
 const volume=deriveAdaptiveWeeks({...base,start:'2027-03-15',weeks:8,regularLegSets:12}).find(x=>x.kind==='VOLUME')
 assert.ok(volume,'Ein VOLUME-Wochenblock muss erkannt werden')
 assert.equal(volume.legSets,6)
 assert.equal(volume.strengthSlots,2)
})
test('HIT benötigt nachgewiesene jüngere Radtrainings und wird bei Unsicherheit abgewertet',()=>{
 const w=deriveAdaptiveWeeks({...base,start:'2027-02-15',weeks:8})
 assert.ok(w.every(x=>x.kind!=='HIT'))
})
test('Ohne 3 dokumentierte Wochen keine fingierten Stundenziele',()=>{
 const w=deriveAdaptiveWeeks(base)
 assert.equal(w[0].hoursRange,undefined)
 assert.match(w[0].safeguards.join(' '),/Zu wenige aktuelle Wochen/)
})
test('Trainingsanpassung nur an Kopie, Gesamt-Kraftrahmen bleibt wöchentlich',()=>{
 const w=deriveAdaptiveWeeks({...base,start:'2027-03-15',weeks:8})
 const volume=w.find(x=>x.kind==='VOLUME')
 assert.ok(volume)
 const strength={sessionType:'strength-a',title:'Kraft A',durationMin:55,target:'RIR 2–3',description:'Technik',priority:'SOLL',notes:'Original'}
 const copy=JSON.stringify(strength)
 const result=adjustSuggestedSession(strength,volume,254)
 assert.equal(JSON.stringify(strength),copy)
 assert.match(result.notes,/ca. 10 Arbeitssätze\/Woche/)
 const quality={sessionType:'quality',title:'Tempo',durationMin:60,target:'',description:'',priority:'MUSS'}
 const easy=adjustSuggestedSession(quality,{...volume,qualityLimit:0},254)
 assert.equal(easy.sessionType,'endurance')
 assert.equal(quality.sessionType,'quality')
})
test('Taper und Erholung erlauben keine intensive neue Radplanung',()=>{
 const w=deriveAdaptiveWeeks(base)
 for(const week of w.filter(x=>x.kind==='TAPER'||x.kind==='RECOVERY')){
  assert.equal(week.qualityLimit,0)
 }
})
