import {listRecords,openTempoDatabase} from '../db/storage'
import {PROFILE_ID,type TrainingRecord,type CompletedRecord, type ReadinessRecord,readinessLevel} from '../planning/engine'
import type {TempoRecord} from '../db/types'
import type {StrengthPlace} from '../stats/activity'

export type StrengthSet = TempoRecord & {
  date:string; sessionKey:string; plannedSessionId?:string; exerciseId:string; setIndex:number
  reps?:number; weightKg?:number; holdSeconds?:number; completed?:boolean; rir?:number; note?:string; exerciseVariant?:string; trainingLocation?:StrengthPlace
}
export type StrengthInput = {exerciseId:string;setIndex:number;reps:string;weightKg:string;holdSeconds:string;rir:string}
export const strengthSessionKey=(date:string,kind:'A'|'B'|'C',plannedId?:string)=>plannedId??`free-strength:${date}:${kind}`
export function isStrength(session:TrainingRecord){return ['strength-a','strength-b','strength-c','manual-strength'].includes(session.sessionType)||/^Kraft\s+[ABC]\s*[·:/-]/i.test(session.title)}
export function isRun(session:TrainingRecord){return ['run','manual-running'].includes(session.sessionType)}
export const workoutKind=(session:TrainingRecord)=>session.sessionType==='strength-c'||/\bC\b/i.test(session.title)?'C':session.sessionType==='strength-b'||(/\bB\b/i).test(session.title)?'B':'A'
export function numberField(text:string,label:string,max:number,required=false):number|undefined {
  const v=text.trim().replace(',','.')
  if(!v){if(required)throw Error(`${label} fehlt.`);return undefined}
  const n=Number(v)
  if(!Number.isFinite(n)||n<0||n>max)throw Error(`${label}: ungültiger Wert.`)
  return n
}
export async function loadWorkoutData(){
  const [planned,completed,readiness,sets]=await Promise.all([
    listRecords<TrainingRecord>('plannedSessions'),listRecords<CompletedRecord>('completedSessions'),
    listRecords<ReadinessRecord>('readinessEntries'),listRecords<StrengthSet>('strengthSets'),
  ])
  return {planned:planned.filter(x=>x.profileId===PROFILE_ID),completed:completed.filter(x=>x.profileId===PROFILE_ID),
    readiness:readiness.filter(x=>x.profileId===PROFILE_ID),sets:sets.filter(x=>x.profileId===PROFILE_ID)}
}
export function readinessWarning(date:string,items:ReadinessRecord[]):string {
  const level=readinessLevel(items.find(x=>x.date===date))
  return level==='rot'?'Readiness ROT: Kraft/Laufbelastung heute nicht empfohlen. Bei Krankheit lieber pausieren.':
    level==='gelb'?'Readiness GELB: Umfang reduzieren oder Einheit verlegen.':
    level==='offen'?'Readiness für diesen Tag nicht dokumentiert. Tagesform vor dem Start selbst prüfen.':''
}
export function alreadyDone(planned:TrainingRecord|undefined,completed:CompletedRecord[],freeKey?:string):boolean {
  return Boolean(planned?.status==='erledigt' || (planned && completed.some(x=>x.plannedSessionId===planned.id)) || (freeKey && completed.some(x=>x.id===`workout:${freeKey}`)))
}

type FinalizeInput={
  date:string;title:string;durationMin:number;durationSec?:number;rpe:number;notes:string
  sessionType:'manual-strength'|'manual-running'|'manual-cycling'|'manual-swimming'|'manual-martial'|'manual-mobility'|'manual-yoga'|'manual-stabi'|'manual-sportspiel'|'manual-golf'; planned?:TrainingRecord
  distanceKm?:number;avgHrBpm?:number;avgPowerW?:number;elevationM?:number;strengthVariant?:'A'|'B'|'C';strengthLocation?:StrengthPlace; sets?:StrengthSet[];freeKey:string
}
/** Completed session, planned status and strength sets are written atomically. */
export async function finalizeWorkout(input:FinalizeInput):Promise<void>{
  const {date,planned,freeKey}=input
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Datum fehlt.')
  if(!Number.isFinite(input.durationMin)||input.durationMin<=0||input.durationMin>1440)throw Error('Trainingsdauer ungültig.')
  if(!Number.isInteger(input.rpe)||input.rpe<1||input.rpe>10)throw Error('RPE muss 1–10 sein.')
  if(input.distanceKm!==undefined&&(!Number.isFinite(input.distanceKm)||input.distanceKm<0||input.distanceKm>500))throw Error('Distanz ungültig.')
  if(input.avgHrBpm!==undefined&&(!Number.isInteger(input.avgHrBpm)||input.avgHrBpm<40||input.avgHrBpm>230))throw Error('Puls ungültig.')
  if(input.avgPowerW!==undefined&&(!Number.isFinite(input.avgPowerW)||input.avgPowerW<0||input.avgPowerW>2500))throw Error('Ø Leistung ungültig.')
  if(input.elevationM!==undefined&&(!Number.isFinite(input.elevationM)||input.elevationM<0||input.elevationM>15000))throw Error('Höhenmeter ungültig.')
  const db=await openTempoDatabase()
  const now=new Date().toISOString()
  const completedId=planned?`workout:${planned.id}`:`workout:${freeKey}`
  const completed:CompletedRecord & {avgHrBpm?:number;avgPowerW?:number;strengthVariant?:'A'|'B'|'C';strengthLocation?:StrengthPlace}={
    id:completedId,profileId:PROFILE_ID,date,title:input.title.trim(),durationMin:input.durationMin,durationSec:input.durationSec,
    sessionType:planned?.sessionType??input.sessionType,distanceKm:input.distanceKm,rpe:input.rpe,
    notes:input.notes.trim().slice(0,1500),source:planned?'plan':'manuell',
    plannedSessionId:planned?.id,avgHrBpm:input.avgHrBpm,avgPowerW:input.avgPowerW,elevationM:input.elevationM,strengthVariant:input.strengthVariant,strengthLocation:input.strengthLocation,
    createdAt:now,updatedAt:now,
  }
  return new Promise<void>((resolve,reject)=>{
    const stores:('completedSessions'|'plannedSessions'|'strengthSets')[]=['completedSessions','plannedSessions']
    if(input.sets?.length)stores.push('strengthSets')
    const tx=db.transaction(stores,'readwrite')
    const doneStore=tx.objectStore('completedSessions')
    const check=doneStore.get(completedId)
    check.onsuccess=()=>{
      if(check.result){tx.abort();return}
      doneStore.put(completed)
      if(planned)tx.objectStore('plannedSessions').put({...planned,status:'erledigt',locked:true,updatedAt:now})
      for(const item of input.sets??[])tx.objectStore('strengthSets').put({...item,updatedAt:now})
    }
    check.onerror=()=>tx.abort()
    tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('tempo:training-change'));resolve()}
    tx.onerror=()=>{db.close();reject(tx.error??Error('Trainingsspeicherung fehlgeschlagen.'))}
    tx.onabort=()=>{db.close();reject(Error('Training wurde nicht gespeichert (möglicherweise bereits abgeschlossen).'))}
  })
}
