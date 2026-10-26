/** Phase 40B – derived read-only display, never overwrites the athlete's saved plan. */
import type {TrainingRecord} from './engine'
import type {ProfileRecord} from '../db/types'
import {wattsForStep} from '../phase37/intervals'
export function prescription(session:TrainingRecord,profile?:ProfileRecord):string[]{
 const type=session.sessionType
 const cycling=['long','quality','endurance','commute','manual-cycling'].includes(type)
 const running=['run','manual-running'].includes(type)
 const result:string[]=[]
 if(Number.isFinite(session.durationMin)&&session.durationMin>0)result.push(`Dauer: ${Math.round(session.durationMin)} min`)
 if(session.expectedKm&&session.expectedKm>0)result.push(`Geplante Strecke: ${session.expectedKm} km`)
 const steps=session.workoutSteps?.filter(s=>Number.isFinite(s.seconds)&&s.seconds>0)??[]
 if(steps.length){
  for(const step of steps.slice(0,12)){
   const mins=step.seconds%60===0?String(step.seconds/60):`${Math.floor(step.seconds/60)}:${String(step.seconds%60).padStart(2,'0')}`
   const p=cycling?wattsForStep(step,profile?.ftpWatts):step.heartRateLimit?`HF ≤ ${step.heartRateLimit} bpm`:step.paceMinPerKm?`${step.paceMinPerKm.toFixed(2)} min/km`:''
   result.push(`${step.title}: ${mins} min${p?' · '+p:''}${step.note?' · '+step.note:''}`)
  }
 }else if(cycling&&['endurance','long','commute'].includes(type)){
  const ftp=profile?.ftpWatts
  result.push(ftp&&ftp>0?`Grundlage Z2: ${Math.round(ftp*.56)}–${Math.round(ftp*.75)} W (56–75 % FTP)`:'Grundlage Z2: 56–75 % FTP · konkrete Watt nach FTP-Eingabe im Profil')
  const max=profile?.maxHeartRateBpm
  result.push(max&&max>0?`Orientierung HF: ca. ${Math.round(max*.65)}–${Math.round(max*.75)} bpm (65–75 % HFmax)`:'HF: nach individuell gespeicherten Zonen; HFmax im Profil noch offen')
  result.push('Gleichmäßig locker fahren, Unterhaltungen möglich (RPE 2–4/10)')
 }else if(cycling&&type==='manual-cycling'&&!steps.length){
  result.push('Intensität offen: für diese selbst angelegte Einheit noch keine feste Watt-/HF-Zone oder Intervallstruktur hinterlegt')
  result.push('Vor Trainingsstart Zielbereich im Tagestraining bearbeiten; keine willkürlichen Wattvorgaben')
 }else if(running&&!steps.length){
  result.push('Lockerer Lauf: Gesprächstempo, RPE 3–4/10; Gehpausen bei Bedarf')
  result.push('Keine Zielpace ohne individuell bestätigte Vorgabe erzwingen')
 }
 if(session.target?.trim())result.push(`Trainingsvorgabe: ${session.target.trim()}`)
 if(session.description?.trim()&&session.description.trim()!==session.target?.trim())result.push(`Ablauf/Ziel: ${session.description.trim()}`)
 if(session.notes?.trim())result.push(`Hinweis: ${session.notes.trim()}`)
 if(cycling&&!steps.length&&type==='quality'&&!session.target?.trim())result.push('Intervallstruktur offen – im Trainingsplan festlegen, keine erfundene Vorgabe')
 return result
}
