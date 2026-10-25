/** Garmin Personal API client-side adapter. Never takes a Garmin API key.
 * Private bridge credential is memory-only: no localStorage / IndexedDB persistence.
 * Import only writes externalActivities. It NEVER writes plannedSessions, shifts,
 * readinessEntries, strengthSets, completedSessions, or the planning engine.
 */
import type {GarminActivity} from '../garmin/csv'
import {openTempoDatabase} from '../db/storage'
const PROFILE_ID='local-primary-profile'
export type PersonalSummary={
 garminActivityId:string;date:string;startedAt:string;title:string;sport:'cycling'|'running'|'swimming';
 activityType:string;durationSeconds:number;movingSeconds?:number;elapsedSeconds?:number;
 distanceKm?:number;elevationM?:number;avgHrBpm?:number;maxHrBpm?:number;
 avgPowerW?:number;maxPowerW?:number;normalizedPowerW?:number;avgCadence?:number;
 avgSpeedKmh?:number;maxSpeedKmh?:number;calories?:number
}
const num = (value:unknown,max:number) => typeof value==='number' && Number.isFinite(value) && value>=0 && value<=max ? value : undefined
/** Validate a network payload before it can ever reach local IndexedDB. */
export function validatePersonalSummary(value:unknown):PersonalSummary|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null
 const x=value as Record<string,unknown>
 const id=String(x.garminActivityId??'')
 if(!/^\d{5,20}$/.test(id)||!['cycling','running','swimming'].includes(String(x.sport)))return null
 const date=String(x.date??'')
 if(!/^\d{4}-\d\d-\d\d$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z')))return null
 const durationSeconds=num(x.durationSeconds,172800)
 if(!durationSeconds||typeof x.startedAt!=='string'||x.startedAt.length>45||!x.startedAt.startsWith(date))return null
 const sport=x.sport as PersonalSummary['sport']
 const activity:PersonalSummary={garminActivityId:id,date,startedAt:x.startedAt,title:String(x.title??sport).slice(0,140),sport,
   activityType:String(x.activityType??sport).slice(0,60),durationSeconds}
 const columns:Record<string,number>={movingSeconds:172800,elapsedSeconds:172800,distanceKm:500,elevationM:25000,
   avgHrBpm:260,maxHrBpm:260,avgPowerW:3000,maxPowerW:4000,normalizedPowerW:3000,avgCadence:250,
   avgSpeedKmh:220,maxSpeedKmh:300,calories:20000}
 for(const [k,max] of Object.entries(columns)){
  const v=num(x[k],max)
  if(v!==undefined)(activity as unknown as Record<string,unknown>)[k]=v
 }
 return activity
}
export function localPersonalId(garminId:string){return `garmin:personal:${PROFILE_ID}:${garminId}`}
function closeMatch(a:PersonalSummary,existing:GarminActivity):boolean {
 // Conservative: any same-day, same-sport activity must be reviewed so
 // moving-time vs elapsed-time or CSV locale differences never silently double-count.
 return a.sport===existing.sport && a.date===existing.date
}

export type PersonalCandidate={activity:PersonalSummary; status:'already'|'new'|'review'; matches:GarminActivity[]}
export function classifyPersonal(raw:PersonalSummary[],existing:GarminActivity[]):PersonalCandidate[]{
 const result:PersonalCandidate[]=[],seen=new Set<string>()
 for(const a of raw){
  if(seen.has(a.garminActivityId))continue
  seen.add(a.garminActivityId)
  if(existing.some(x=>x.garminActivityId===a.garminActivityId || x.id===localPersonalId(a.garminActivityId))){
   result.push({activity:a,status:'already',matches:[]});continue
  }
  const matches=existing.filter(x=>closeMatch(a,x))
  result.push({activity:a,status:matches.length?'review':'new',matches})
 }
 return result
}
const values=['movingSeconds','elapsedSeconds','distanceKm','elevationM','avgHrBpm','maxHrBpm','avgPowerW','maxPowerW',
 'normalizedPowerW','avgCadence','avgSpeedKmh','maxSpeedKmh','calories'] as const
export function personalRecord(a:PersonalSummary):GarminActivity {
 const now=new Date().toISOString()
 const item:GarminActivity={id:localPersonalId(a.garminActivityId),profileId:PROFILE_ID,source:'garmin-personal',
  date:a.date,startedAt:a.startedAt,title:a.title,sport:a.sport,activityType:a.activityType,
  durationSeconds:a.durationSeconds,durationMin:Math.round(a.durationSeconds/6)/10,garminActivityId:a.garminActivityId,
  importBatchId:`garmin:personal:${a.garminActivityId}`,createdAt:now,updatedAt:now}
 for(const k of values)if(a[k]!==undefined)(item as Record<string,unknown>)[k]=a[k]
 return item
}
/** Link without overwriting FIT traces or user-maintained workout information. */
export function mergePersonal(existing:GarminActivity,a:PersonalSummary):GarminActivity {
 if(existing.sport!==a.sport)throw Error('Sportart stimmt nicht überein.')
 if(existing.garminActivityId && existing.garminActivityId!==a.garminActivityId)throw Error('Bereits mit anderer Garmin-ID verknüpft.')
 const next:GarminActivity={...existing,garminActivityId:a.garminActivityId,updatedAt:new Date().toISOString()}
 for(const k of values)if(next[k]===undefined&&a[k]!==undefined)(next as Record<string,unknown>)[k]=a[k]
 if(!next.startedAt)next.startedAt=a.startedAt
 return next
}
export type PersonalDecision={garminActivityId:string;targetId:string|'new'|'skip'}
/** Atomic commit limited to externalActivities; no automatic planned-training reconciliation. */
export async function commitPersonalImport(candidates:PersonalCandidate[],decisions:PersonalDecision[],existing:GarminActivity[]){
 const byId=new Map(decisions.map(d=>[d.garminActivityId,d.targetId]))
 const operations:GarminActivity[]=[],claimed=new Set<string>(),claimedTarget=new Set<string>()
 let created=0,linked=0,skipped=0
 for(const candidate of candidates){
  const {activity:a,status,matches}=candidate
  if(status==='already'){skipped++;continue}
  const choice=byId.get(a.garminActivityId)??(status==='new'?'new':undefined)
  if(!choice)throw Error(`Bitte die Zuordnung für ${a.title} prüfen.`)
  if(choice==='skip'){skipped++;continue}
  if(claimed.has(a.garminActivityId))throw Error('Doppelte Garmin-ID in einer Auswahl.')
  claimed.add(a.garminActivityId)
  if(choice==='new'){
   // A suspicious activity may be created only after an explicit user choice.
   operations.push(personalRecord(a));created++
  } else {
   if(!matches.some(x=>x.id===choice))throw Error('Ungültiges Zuordnungsziel.')
   if(claimedTarget.has(choice))throw Error(`Die FIT-/TEMPO-Aktivität ${existing.find(x=>x.id===choice)?.title??choice} ist mehrfach ausgewählt. Bitte die markierten Zuordnungen korrigieren.`)
   claimedTarget.add(choice)
   const old=existing.find(x=>x.id===choice)
   if(!old)throw Error('Zielaktivität wurde nicht gefunden.')
   operations.push(mergePersonal(old,a));linked++
  }
 }
 if(operations.length){
  const db=await openTempoDatabase()
  await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(['externalActivities'],'readwrite')
   const store=tx.objectStore('externalActivities')
   for(const record of operations){if(record.source==='garmin-personal')store.add(record);else store.put(record)}
   tx.oncomplete=()=>{db.close();resolve()}
   tx.onerror=()=>{db.close();reject(tx.error??Error('Import fehlgeschlagen.'))}
   tx.onabort=()=>{db.close();reject(tx.error??Error('Import abgebrochen.'))}
  })
 }
 return {created,linked,skipped}
}
export function validateBridgeUrl(input:string){
 try{const u=new URL(input.trim());if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')return null
   if(!u.hostname.endsWith('.workers.dev') && u.hostname!=='localhost')return null
   return u.origin
 }catch{return null}
}
export async function bridgeRequest(endpoint:string,credential:string,path:string,method:'GET'|'POST'='GET'){
 const origin=validateBridgeUrl(endpoint)
 if(!origin)throw Error('Bitte eine gültige HTTPS-Worker-Adresse eingeben (…workers.dev).')
 if(!credential||credential.length<24)throw Error('Bitte den privaten TEMPO-Zugangscode eingeben.')
 const controller=new AbortController()
 const timeout=setTimeout(()=>controller.abort(),method==='POST'?90_000:25_000)
 try {
  const response=await fetch(`${origin}${path}`,{method,headers:{Authorization:`Bearer ${credential}`,Accept:'application/json'},cache:'no-store',signal:controller.signal})
  const body=await response.json()
  if(!response.ok)throw Error(body?.error||`HTTP ${response.status}`)
  return body as unknown
 }finally{clearTimeout(timeout)}
}
