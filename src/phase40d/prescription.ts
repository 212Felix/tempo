import type {TrainingStep} from '../phase37/intervals'
import type {TrainingRecord} from '../planning/engine'

export type Sport='cycling'|'running'
export type WorkoutFlavor='z2'|'threshold'|'vo2'|'sprint'
export type SuggestionInput={sport:Sport;flavor:WorkoutFlavor;minutes:number;ftp?:number;run5kSeconds?:number;cooperMeters?:number;readiness?:'offen'|'gruen'|'gelb'|'rot';weeklyHardSessions?:number}
export const workoutNames:Record<WorkoutFlavor,string>={z2:'Zone 2 · Grundlage',threshold:'Schwellenintervalle',vo2:'VO₂max-Intervalle',sprint:'Sprint & Schnelligkeit'}

export function referenceRunningPace(input:Pick<SuggestionInput,'run5kSeconds'|'cooperMeters'>):number|undefined{
 if(input.run5kSeconds && input.run5kSeconds>600&&input.run5kSeconds<7200)return input.run5kSeconds/300 // min/km
 if(input.cooperMeters && input.cooperMeters>=1000&&input.cooperMeters<6000)return 720/(input.cooperMeters/1000)/60
 return undefined
}
/** Explicit, complete-duration, conservatively dosed workout. No fake watts/pace. */
export function makeSuggestion(input:SuggestionInput):{steps:TrainingStep[];warning:string|null;title:string}|null{
 const {sport,flavor,minutes}=input
 if(!Number.isInteger(minutes)||minutes<20||minutes>240)return null
 if(flavor!=='z2'&&(input.readiness==='rot'||input.weeklyHardSessions!==undefined&&input.weeklyHardSessions>=2))return null
 const total=minutes*60,steps:TrainingStep[]=[]
 const baseline=referenceRunningPace(input)
 const base=baseline===undefined?undefined:baseline
 const add=(title:string,seconds:number,effort:TrainingStep['effort'],lowFtp?:number,highFtp?:number,paceFactor?:number)=>{
  if(seconds<=0)return
  const step:TrainingStep={id:`suggested-${steps.length}`,title,seconds,effort}
  if(sport==='cycling'){if(lowFtp!==undefined)step.lowFtp=lowFtp;if(highFtp!==undefined)step.highFtp=highFtp}
  else if(base!==undefined&&paceFactor!==undefined)step.paceMinPerKm=Math.round(base*paceFactor*100)/100
  steps.push(step)
 }
 const isBike=sport==='cycling'
 if(flavor==='z2'){
  const warm=Math.min(600,Math.round(total*.18/60)*60),cool=Math.min(480,Math.round(total*.12/60)*60)
  add(isBike?'Einrollen':'Einlaufen',warm,'warmup',.45,.6,1.55)
  add('Gleichmäßige Grundlagenausdauer',total-warm-cool,'endurance',.56,.73,1.30)
  add(isBike?'Ausrollen':'Auslaufen',cool,'cooldown',.40,.55,1.55)
 }else{
  const warm=Math.min(900,Math.max(480,Math.round(total*.25/60)*60))
  const cool=Math.min(600,Math.max(300,Math.round(total*.15/60)*60))
  add(isBike?'Einrollen':'Einlaufen',warm,'warmup',.45,.65,1.50)
  const remaining=total-warm-cool
  const work=flavor==='threshold'? (minutes>=55?480:240):flavor==='vo2'? (minutes>=50?180:120):20
  const rest=flavor==='threshold'?Math.round(work*.6):flavor==='vo2'?work:120
  const targetReps=flavor==='threshold'?3:flavor==='vo2'?5:6
  const reps=Math.min(targetReps,Math.max(1,Math.floor((remaining+rest)/(work+rest))))
  const used=reps*work+(reps-1)*rest
  if(reps<2)return null
  for(let n=0;n<reps;n++){
   const power=flavor==='threshold'?[.91,1.02]:flavor==='vo2'?[1.08,1.17]:[1.35,1.70]
   const pace=flavor==='threshold'?1.04:flavor==='vo2'?.95:.88
   add(`Belastung ${n+1}/${reps}`,work,'work',power[0],power[1],pace)
   if(n<reps-1)add('Lockere aktive Pause',rest,'recovery',.4,.55,1.55)
  }
  if(remaining>used)add('Lockerer Übergang',remaining-used,'endurance',.5,.65,1.4)
  add(isBike?'Ausrollen':'Auslaufen',cool,'cooldown',.4,.55,1.55)
 }
 const resultSeconds=steps.reduce((n,s)=>n+s.seconds,0)
 if(resultSeconds!==total)throw new Error('Zeitbudget konnte nicht eingehalten werden.')
 const missing=isBike?!(input.ftp&&input.ftp>0):base===undefined
 return {steps,title:`${sport==='cycling'?'Rad':'Lauf'} · ${workoutNames[flavor]}`,warning:missing?`${isBike?'FTP':'Lauf-Referenzzeit'} fehlt: Intensität als strukturierte Empfehlung ohne erfundene ${isBike?'Watt':'Pace'}-Werte.`:null}
}
export function suggestionRecord(input:SuggestionInput,date:string,id:string):TrainingRecord{
 const suggestion=makeSuggestion(input)
 if(!suggestion)throw new Error('Intensive Einheit aufgrund der aktuellen Belastung gesperrt oder Zeitbudget zu knapp.')
 const now=new Date().toISOString()
 return {id,profileId:'local-primary-profile',createdAt:now,updatedAt:now,date,sessionType:input.sport==='running'?'run':input.flavor==='z2'?'endurance':'quality',title:suggestion.title,description:'Individuell nach Zeitbudget und verfügbaren TEMPO-Leistungsdaten berechnetes Training.',target:'Watt/Pace laut gespeicherten Phasen; bei fehlenden Referenzdaten nach RPE.',durationMin:input.minutes,priority:'SOLL',status:'geplant',createdBy:'tempo-user',workoutSteps:suggestion.steps,notes:suggestion.warning??'Tempo-Vorschlag; erst nach eigener Entscheidung im Kalender gespeichert.'}
}
