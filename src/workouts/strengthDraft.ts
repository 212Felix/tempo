/** Phase 40: single-device workout recovery, without a schema migration.
 * All information stays in the athlete's browser. No credentials or server calls.
 */
import {deleteRecord,getRecord,saveRecord} from '../db/storage'
import type {StrengthInput} from './sessionStore'
import type {Exercise} from './catalog'
import {validSessionExercises} from './sportExercises'
import type {StrengthPlace} from '../stats/activity'

export type StrengthDraft = {
 version:1; sessionKey:string;profileId:'local-primary-profile';date:string;
 plannedId:string;variant:'A'|'B'|'C';location:StrengthPlace;
 inputs:Record<string,StrengthInput>;completedHolds:Record<string,boolean>;
 equipment?:Record<StrengthPlace,Record<string,string>>;exercises?:Exercise[];durationEdited?:boolean;
 duration:string;rpe:string;notes:string;savedAt:string;
}
const PREFIX='tempo40:strength-draft:'
const POINTER='tempo40:strength-active'
const storageKey=(key:string)=>PREFIX+key
export function isStrengthDraft(raw:unknown):raw is StrengthDraft{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false
 const d=raw as Partial<StrengthDraft>
 return d.version===1&&d.profileId==='local-primary-profile'&&
  typeof d.sessionKey==='string'&&d.sessionKey.length>0&&d.sessionKey.length<250&&
  typeof d.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&
  typeof d.plannedId==='string'&&['A','B','C'].includes(String(d.variant))&&
  (d.location==='studio'||d.location==='arbeit')&&
  !!d.inputs&&typeof d.inputs==='object'&&!Array.isArray(d.inputs)&&
  !!d.completedHolds&&typeof d.completedHolds==='object'&&!Array.isArray(d.completedHolds)&&
  (d.exercises===undefined||validSessionExercises(d.exercises))&&
  typeof d.duration==='string'&&typeof d.rpe==='string'&&typeof d.notes==='string'&&
  typeof d.savedAt==='string'
}
export function readLocalStrengthDraft(sessionKey:string):StrengthDraft|null{
 try{const raw=window.localStorage.getItem(storageKey(sessionKey));if(!raw)return null
  const parsed:unknown=JSON.parse(raw)
  return isStrengthDraft(parsed)&&parsed.sessionKey===sessionKey?parsed:null
 }catch{return null}
}
export function readActiveStrengthDraft():StrengthDraft|null{
 try{const sessionKey=window.localStorage.getItem(POINTER)
  return sessionKey?readLocalStrengthDraft(sessionKey):null
 }catch{return null}
}
/** Synchronous update: survives immediate navigation/visibility changes. */
export function rememberStrengthDraft(draft:StrengthDraft):boolean{
 if(!isStrengthDraft(draft))return false
 try{
  window.localStorage.setItem(storageKey(draft.sessionKey),JSON.stringify(draft))
  window.localStorage.setItem(POINTER,draft.sessionKey)
  return true
 }catch{return false}
}
export async function loadStrengthDraft(sessionKey:string):Promise<StrengthDraft|null>{
 const local=readLocalStrengthDraft(sessionKey)
 if(local)return local
 try{const record=await getRecord('settings',storageKey(sessionKey))
  const value=record?.draft
  return isStrengthDraft(value)&&value.sessionKey===sessionKey?value:null
 }catch{return null}
}
// Serialize IndexedDB writes to avoid a slow earlier snapshot overwriting a newer one.
let queue:Promise<unknown>=Promise.resolve()
export function archiveStrengthDraft(draft:StrengthDraft):Promise<unknown>{
 const snapshot={...draft,inputs:{...draft.inputs},completedHolds:{...draft.completedHolds}}
 queue=queue.catch(()=>undefined).then(()=>saveRecord('settings',{
  id:storageKey(snapshot.sessionKey),profileId:snapshot.profileId,createdAt:snapshot.savedAt,
  updatedAt:snapshot.savedAt,draft:snapshot,
 }))
 return queue
}
export async function clearStrengthDraft(sessionKey:string):Promise<void>{
 try{window.localStorage.removeItem(storageKey(sessionKey))
  if(window.localStorage.getItem(POINTER)===sessionKey)window.localStorage.removeItem(POINTER)
 }catch{/* Safari private browsing */}
 await queue.catch(()=>undefined)
 await deleteRecord('settings',storageKey(sessionKey)).catch(()=>undefined)
}
