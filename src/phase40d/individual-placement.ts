import type {TrainingRecord,ShiftRecord} from '../planning/engine'
import {weekDates} from '../phase30/weekly-replanner'
/** Conservative preview; move at most one auto-generated, uncompleted, unlocked session. */
export function proposeIndividualPlacement(suggestion:TrainingRecord,records:TrainingRecord[],shifts:ShiftRecord[],blockedDates:string[]=[]):{moves:{id:string;from:string;to:string}[];conflicts:string[];notes:string[]}{
 const here=records.filter(r=>r.profileId===suggestion.profileId&&r.date===suggestion.date&&r.status==='geplant')
 const conflicts:string[]=[],notes:string[]=[],moves:{id:string;from:string;to:string}[]=[]
 const blocked=new Set(blockedDates)
 if(blocked.has(suggestion.date))conflicts.push('Der Tag ist als Ruhetag gesperrt.')
 if(shifts.some(s=>s.date===suggestion.date&&s.shift==='einsatz'))conflicts.push('Am gewünschten Tag ist ein Einsatz vermerkt.')
 const days=weekDates(suggestion.date).filter(day=>day>=suggestion.date&&!blocked.has(day)&&!shifts.some(s=>s.date===day&&s.shift==='einsatz'))
 const taken=new Set(records.filter(r=>r.status==='geplant').map(r=>r.date))
 for(const item of here){
  if(item.locked||item.createdBy==='tempo-user'||item.status!=='geplant'){
   notes.push(`${item.title} bleibt am selben Tag unverändert. Zusätzliche Belastung bitte selbst prüfen.`)
   continue
  }
  const target=days.find(day=>day!==item.date&&!taken.has(day))
  if(!target){conflicts.push(`Für ${item.title} ist in dieser Woche kein freier Ersatztermin vorhanden.`);continue}
  taken.add(target);moves.push({id:item.id,from:item.date,to:target});notes.push(`${item.title}: ${item.date} → ${target} (erst nach Bestätigung).`)
 }
 return {moves,conflicts,notes}
}
