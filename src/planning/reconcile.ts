import {listRecords, openTempoDatabase} from '../db/storage'
import {PROFILE_ID, type CompletedRecord, type TrainingRecord} from './engine'
import type {GarminActivity} from '../garmin/csv'

/** Phase 19: Eine reale Trainingseinheit bleibt EIN Datensatz im Abschluss-Store.
 * CSV und FIT sind Messquellen, keine zusätzlichen abgeschlossenen Trainings.
 * Kein Matching schreibt ohne ausdrückliche Bestätigung des Nutzers.
 */
export type LinkedCompleted = CompletedRecord & {
  externalActivityId?:string
  avgHrBpm?:number
  avgPowerW?:number
  normalizedPowerW?:number
  garminStartedAt?:string
  garminDurationMin?:number
  garminDistanceKm?:number
  manualDurationMin?:number
  manualDistanceKm?:number
}
export type ReconcileData = {planned:TrainingRecord[];completed:LinkedCompleted[];garmin:GarminActivity[]}
export async function loadReconcileData():Promise<ReconcileData>{
  const [planned,completed,garmin]=await Promise.all([
    listRecords<TrainingRecord>('plannedSessions'),listRecords<LinkedCompleted>('completedSessions'),listRecords<GarminActivity>('externalActivities'),
  ])
  const mine=<T extends {profileId?:string}>(rows:T[])=>rows.filter(x=>x.profileId===PROFILE_ID)
  return {planned:mine(planned),completed:mine(completed),garmin:mine(garmin).filter(a=>a.source==='garmin-csv'||a.source==='garmin-fit')}
}
export type ReconcileSport='cycling'|'running'|'strength'|'swimming'|'martial'|'mobility'|'other'
export function kindSport(kind?:string):ReconcileSport{
  if(['long','endurance','quality','commute','manual-cycling'].includes(kind??''))return 'cycling'
  if(['run','manual-running'].includes(kind??''))return 'running'
  if(['strength-a','strength-b','manual-strength'].includes(kind??''))return 'strength'
  if(kind==='manual-swimming')return 'swimming'
  if(kind==='manual-martial')return 'martial'
  if(kind==='manual-mobility'||kind==='manual-yoga'||kind==='manual-stabi'||kind==='recovery')return 'mobility'
  return 'other'
}
const relative=(a?:number,b?:number)=>a&&b?Math.abs(a-b)/Math.max(a,b):0
const dateDistance=(a:string,b:string)=>Math.abs((Date.parse(`${a}T12:00:00Z`)-Date.parse(`${b}T12:00:00Z`))/86400000)
/** Candidate only; different sports or activities separated by >1 calendar day never auto-pair. */
export function canMatchPlan(plan:TrainingRecord,done:Pick<CompletedRecord,'date'|'sessionType'|'durationMin'>):boolean{
  return dateDistance(plan.date,done.date)===0 && kindSport(plan.sessionType)===kindSport(done.sessionType)
    && kindSport(plan.sessionType)!=='other' && kindSport(plan.sessionType)!=='mobility'
    && relative(plan.durationMin,done.durationMin)<=.75
}
export function canMatchGarmin(garmin:GarminActivity,done:{date:string;sessionType?:string;durationMin?:number;distanceKm?:number}):boolean{
  return garmin.date===done.date && garmin.sport===kindSport(done.sessionType)
    && garmin.sport!=='other'
    && relative(garmin.durationMin,done.durationMin)<=.6
    && relative(garmin.distanceKm,done.distanceKm)<=.6
}
export const linkedTo=(p:TrainingRecord,completed:LinkedCompleted[])=>completed.find(x=>x.plannedSessionId===p.id)

/** Transactional: link existing real-world completed entry to its planned workout.
 * Leaves RPE, comments and real duration intact; never deletes either entry.
 */
export async function joinPlanAndCompleted(planId:string,completedId:string):Promise<void>{
  const db=await openTempoDatabase();const now=new Date().toISOString()
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(['plannedSessions','completedSessions'],'readwrite')
    const ps=tx.objectStore('plannedSessions'),cs=tx.objectStore('completedSessions')
    const req=cs.getAll()
    req.onsuccess=()=>{
      const completed=req.result as LinkedCompleted[]
      const record=completed.find(x=>x.id===completedId && x.profileId===PROFILE_ID)
      if(!record || (record.plannedSessionId && record.plannedSessionId!==planId) ||
        completed.some(x=>x.id!==completedId&&x.plannedSessionId===planId)) {tx.abort();return}
      const get=ps.get(planId)
      get.onsuccess=()=>{
        const plan=get.result as TrainingRecord|undefined
        if(!plan||plan.profileId!==PROFILE_ID||!canMatchPlan(plan,record)||plan.status==='nicht-erledigt'){tx.abort();return}
        cs.put({...record,plannedSessionId:plan.id,source:record.source==='import'?'import':'plan',updatedAt:now})
        ps.put({...plan,status:'erledigt',locked:true,updatedAt:now})
      }
    }
    tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('tempo:training-change'));resolve()}
    tx.onerror=()=>{db.close();reject(tx.error??new Error('Zuordnung fehlgeschlagen.'))}
    tx.onabort=()=>{db.close();reject(new Error('Zuordnung nicht möglich oder Einheit inzwischen bereits zugeordnet.'))}
  })
}

/** Garmin data enriches an existing real workout; do not append a second completed record.
 * Existing subjective feedback stays unchanged. Imported sensor measures become the actual values.
 */
export async function attachGarminToCompleted(activityId:string,completedId:string):Promise<void>{
  const db=await openTempoDatabase();const now=new Date().toISOString()
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(['externalActivities','completedSessions'],'readwrite')
    const cs=tx.objectStore('completedSessions'),as=tx.objectStore('externalActivities')
    const records=cs.getAll()
    records.onsuccess=()=>{
      const all=records.result as LinkedCompleted[]
      const done=all.find(x=>x.id===completedId&&x.profileId===PROFILE_ID)
      if(!done || (done.externalActivityId && done.externalActivityId!==activityId) ||
        all.some(x=>x.id!==completedId&&x.externalActivityId===activityId)){tx.abort();return}
      const get=as.get(activityId)
      get.onsuccess=()=>{
        const activity=get.result as GarminActivity|undefined
        if(!activity||activity.profileId!==PROFILE_ID||!canMatchGarmin(activity,done)){tx.abort();return}
        cs.put({...done,externalActivityId:activity.id,
          manualDurationMin:done.manualDurationMin??done.durationMin,manualDistanceKm:done.manualDistanceKm??done.distanceKm,
          durationMin:activity.durationMin||done.durationMin,durationSec:activity.durationSeconds??done.durationSec,distanceKm:activity.distanceKm??done.distanceKm,
          elevationM:activity.elevationM??done.elevationM,
          avgHrBpm:activity.avgHrBpm??done.avgHrBpm,avgPowerW:activity.avgPowerW??done.avgPowerW,
          normalizedPowerW:activity.normalizedPowerW??done.normalizedPowerW,
          garminStartedAt:activity.startedAt,garminDurationMin:activity.durationMin,
          garminDistanceKm:activity.distanceKm,updatedAt:now})
      }
    }
    tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('tempo:training-change'));resolve()}
    tx.onerror=()=>{db.close();reject(tx.error??new Error('Garmin-Zuordnung fehlgeschlagen.'))}
    tx.onabort=()=>{db.close();reject(new Error('Garmin-Aktivität bereits verknüpft oder Daten passen nicht.'))}
  })
}

/** Confirmed Garmin-only completion. Keep the planned record for history, use Garmin once as actual load. */
export async function completePlanFromGarmin(activityId:string,planId:string):Promise<void>{
  const db=await openTempoDatabase();const now=new Date().toISOString()
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(['externalActivities','completedSessions','plannedSessions'],'readwrite')
    const ps=tx.objectStore('plannedSessions'),cs=tx.objectStore('completedSessions'),as=tx.objectStore('externalActivities')
    const records=cs.getAll()
    records.onsuccess=()=>{
      const existing=records.result as LinkedCompleted[]
      if(existing.some(x=>x.plannedSessionId===planId||x.externalActivityId===activityId)){tx.abort();return}
      const gp=ps.get(planId)
      gp.onsuccess=()=>{
        const planned=gp.result as TrainingRecord|undefined
        if(!planned||planned.profileId!==PROFILE_ID||planned.status==='nicht-erledigt'){tx.abort();return}
        const ga=as.get(activityId)
        ga.onsuccess=()=>{
          const a=ga.result as GarminActivity|undefined
          if(!a||a.profileId!==PROFILE_ID||!canMatchGarmin(a,{date:planned.date,sessionType:planned.sessionType,durationMin:planned.durationMin,distanceKm:planned.expectedKm})){tx.abort();return}
          const id=`garmin-completed:${activityId}`
          cs.put({id,profileId:PROFILE_ID,date:planned.date,plannedSessionId:planned.id,
            sessionType:planned.sessionType,title:planned.title,source:'import',externalActivityId:a.id,
            durationMin:a.durationMin,durationSec:a.durationSeconds,distanceKm:a.distanceKm,elevationM:a.elevationM,
            avgHrBpm:a.avgHrBpm,avgPowerW:a.avgPowerW,normalizedPowerW:a.normalizedPowerW,
            garminStartedAt:a.startedAt,garminDurationMin:a.durationMin,garminDistanceKm:a.distanceKm,
            createdAt:now,updatedAt:now} as LinkedCompleted)
          ps.put({...planned,status:'erledigt',locked:true,updatedAt:now})
        }
      }
    }
    tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('tempo:training-change'));resolve()}
    tx.onerror=()=>{db.close();reject(tx.error??new Error('Garmin-Abschluss fehlgeschlagen.'))}
    tx.onabort=()=>{db.close();reject(new Error('Training wurde bereits zugeordnet oder Messwerte passen nicht.'))}
  })
}

/** Only flag likely duplicate completions when one is already linked to the plan.
 * Two separate free workouts on one day remain independent by default.
 */
export function canMatchTwoCompletions(keeper:LinkedCompleted,extra:LinkedCompleted):boolean{
  return Boolean(keeper.plannedSessionId) && !extra.plannedSessionId &&
    keeper.date===extra.date && kindSport(keeper.sessionType)===kindSport(extra.sessionType) &&
    kindSport(keeper.sessionType)!=='other' && relative(keeper.durationMin,extra.durationMin)<=.4 &&
    relative(keeper.distanceKm,extra.distanceKm)<=.35 &&
    (!keeper.externalActivityId || !extra.externalActivityId || keeper.externalActivityId===extra.externalActivityId)
}
/** Explicitly confirmed cleanup for two completed records of the *same* physical workout.
 * The discarded duplicate is archived in the already-backed-up settings store. */
export async function mergeDuplicateCompletions(keeperId:string,extraId:string):Promise<void>{
  if(keeperId===extraId)throw new Error('Identische Datensatz-IDs.')
  const db=await openTempoDatabase(); const now=new Date().toISOString()
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(['completedSessions','settings'],'readwrite')
    const completed=tx.objectStore('completedSessions')
    const req=completed.getAll()
    req.onsuccess=()=>{
      const all=req.result as LinkedCompleted[]
      const keeper=all.find(x=>x.id===keeperId&&x.profileId===PROFILE_ID)
      const extra=all.find(x=>x.id===extraId&&x.profileId===PROFILE_ID)
      if(!keeper||!extra||!canMatchTwoCompletions(keeper,extra)){tx.abort();return}
      const backupId=`tempo:merged-backup:${extra.id}`
      // Preserve notes and subjective feedback. Existing measured values take priority.
      const notes=[keeper.notes?.trim(),extra.notes?.trim()].filter(Boolean)
      const updated:LinkedCompleted={...keeper,
        rpe:extra.rpe??keeper.rpe,notes:[...new Set(notes)].join(' · '),
        avgHrBpm:keeper.avgHrBpm??extra.avgHrBpm,
        avgPowerW:keeper.avgPowerW??extra.avgPowerW,
        distanceKm:keeper.distanceKm??extra.distanceKm,
        externalActivityId:keeper.externalActivityId??extra.externalActivityId,
        updatedAt:now}
      tx.objectStore('settings').put({id:backupId,profileId:PROFILE_ID,kind:'merged-completion-archive',
        mergedInto:keeper.id,original:extra,date:extra.date,createdAt:now,updatedAt:now})
      completed.put(updated)
      completed.delete(extra.id)
    }
    tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('tempo:training-change'));resolve()}
    tx.onerror=()=>{db.close();reject(tx.error??new Error('Doppelabschluss konnte nicht zusammengeführt werden.'))}
    tx.onabort=()=>{db.close();reject(new Error('Abgleich nicht mehr eindeutig. Es wurde nichts verändert.'))}
  })
}
