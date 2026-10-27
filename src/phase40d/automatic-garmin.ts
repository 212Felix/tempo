import {bridgeRequest,validatePersonalSummary,classifyPersonal,commitPersonalImport} from '../phase39/garmin-sync'
import type {GarminActivity} from '../garmin/csv'
import {activeGarminActivities} from '../garmin/stored-duplicates'
import {listRecords,saveRecord,getRecord} from '../db/storage'
import {validateWellness,type Wellness} from '../phase40c/wellness'
import {addGarminFitDetail} from './garmin-detail'
import {suggestedPlanMatch} from './garmin-matching'
import type {TrainingRecord} from '../planning/engine'

const PROFILE='local-primary-profile'
type AutoState={active:boolean;lastChecked:string|null;imported:number;fitEnriched:number;awaitingReview:number;note:string}
let tokenMemory:{endpoint:string;code:string}|null=null
let timer:ReturnType<typeof setInterval>|null=null
let running:Promise<void>|null=null
let lastWorkerSync=0,lastHistory=0,lastDetail=0
export const autoState:AutoState={active:false,lastChecked:null,imported:0,fitEnriched:0,awaitingReview:0,note:'Noch nicht für diese App-Sitzung angemeldet.'}
const emit=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('tempo:garmin-auto-status'))}
const localDate=(delta=0)=>{const d=new Date();d.setDate(d.getDate()+delta);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function autoGarminStatus(){return {...autoState}}
export function activateAutoGarmin(endpoint:string,code:string){
 tokenMemory={endpoint,code};autoState.active=true;autoState.note='Automatische Synchronisierung aktiv, solange diese App-Sitzung angemeldet ist.';emit()
 if(timer)clearInterval(timer)
 timer=setInterval(()=>{if(document.visibilityState==='visible')void automaticGarminCycle()},120_000)
 const callback=()=>{if(document.visibilityState==='visible')void automaticGarminCycle()}
 // Handler is stable and never duplicates after reconnection.
 document.removeEventListener('visibilitychange',visibilityHandler)
 document.addEventListener('visibilitychange',visibilityHandler)
 void automaticGarminCycle()
 void callback // Ensure no login secrets are ever put into browser storage.
}
function visibilityHandler(){if(document.visibilityState==='visible')void automaticGarminCycle()}
export async function automaticGarminCycle():Promise<void>{
 if(!tokenMemory||running)return running??Promise.resolve()
 running=runCycle(tokenMemory.endpoint,tokenMemory.code).catch(e=>{autoState.note=`Automatischer Abgleich derzeit nicht möglich: ${e instanceof Error?e.message:String(e)}`;emit()}).finally(()=>{running=null})
 return running
}
async function runCycle(endpoint:string,code:string){
 // Garmin Personal API is pull-only; the Worker runs independently on its cron.
 if(Date.now()-lastWorkerSync>15*60_000){
  try{await bridgeRequest(endpoint,code,'/v1/sync','POST');lastWorkerSync=Date.now()}
  catch{/* a failed sync does not prevent reading existing private data */}
 }
 const [raw,stored]=await Promise.all([bridgeRequest(endpoint,code,'/v1/activities') as Promise<{activities:unknown[]}>,listRecords<GarminActivity>('externalActivities')])
 if(!Array.isArray(raw.activities))throw Error('Ungültige Aktivitätsliste.')
 const normalized=raw.activities.map(validatePersonalSummary).filter((a):a is NonNullable<typeof a>=>Boolean(a))
 const local=stored.filter(a=>a.profileId===PROFILE&&['garmin-fit','garmin-csv','garmin-personal'].includes(a.source))
 const candidates=classifyPersonal(normalized,local)
 const fresh=candidates.filter(c=>c.status==='new')
 autoState.awaitingReview=candidates.filter(c=>c.status==='review').length
 let imported=0
 if(fresh.length){const result=await commitPersonalImport(fresh,[],local);imported=result.created;window.dispatchEvent(new Event('tempo:training-change'));window.dispatchEvent(new Event('tempo:garmin-import-change'))}
 autoState.imported+=imported
 const current=imported?await listRecords<GarminActivity>('externalActivities'):stored
 // Associate only one actual Garmin activity with one planned training, never overwrite a completed session.
 if(imported){
  const [plans,linked]=await Promise.all([listRecords<TrainingRecord>('plannedSessions'),listRecords('settings')])
  const occupied=new Set(linked.filter(r=>r.id.startsWith(`garmin-match:${PROFILE}:`) && typeof r.plannedSessionId==='string').map(r=>String(r.plannedSessionId)))
  const proposed=current.filter(a=>a.profileId===PROFILE&&a.source==='garmin-personal').map(a=>({activity:a,target:suggestedPlanMatch(a,plans)})).filter(x=>x.target!==null)
  const counts=new Map<string,number>()
  for(const row of proposed)counts.set(row.target!, (counts.get(row.target!)??0)+1)
  for(const {activity,target} of proposed){
   if(!target||counts.get(target)!==1||occupied.has(target))continue
   const id=`garmin-match:${PROFILE}:${activity.id}`
   if(await getRecord('settings',id))continue
   await saveRecord('settings',{id,profileId:PROFILE,date:activity.date,garminActivityId:activity.id,plannedSessionId:target,actual:{durationMin:activity.durationMin,distanceKm:activity.distanceKm,elevationM:activity.elevationM,avgPowerW:activity.avgPowerW,avgHrBpm:activity.avgHrBpm},createdAt:'',updatedAt:''})
   occupied.add(target)
  }
 }
 const records=activeGarminActivities(current.filter(a=>a.profileId===PROFILE))
 // Browser may not support raw ZIP deflate; fall back to manual FIT import without losing the summary.
 if(Date.now()-lastDetail>60_000){
  lastDetail=Date.now()
  const pending=records.filter(a=>a.source==='garmin-personal'&&!a.fitSeriesId&&a.garminActivityId).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,2)
  for(const activity of pending){
   try{const result=await addGarminFitDetail(endpoint,code,activity);if(result.saved)autoState.fitEnriched++}
   catch{/* Safe fallback: summary stays in externalActivities. */}
  }
 }
 // Today's readings and yesterday's overnight data. Historical archive is filled once per active session.
 const days=Date.now()-lastHistory>12*3600_000?Array.from({length:14},(_,i)=>localDate(-i)):[localDate(0),localDate(-1)]
 if(days.length>2)lastHistory=Date.now()
 let gotWellness=false
 for(const date of days){
  try{const wellness=validateWellness(await bridgeRequest(endpoint,code,`/v1/wellness?date=${date}`))
   if(wellness?.available?.length){
    const id=`garmin-wellness:${PROFILE}:${date}`
    const prior=await getRecord<{wellness?:Wellness;id:string;createdAt:string;updatedAt:string}>('settings',id)
    if(!prior?.wellness||Date.parse(prior.wellness.fetchedAt)<Date.parse(wellness.fetchedAt)){
     await saveRecord('settings',{id,profileId:PROFILE,date,wellness,createdAt:prior?.createdAt??'',updatedAt:''});gotWellness=true
    }
   }
  }catch{/* Absent health data is not an activity sync error. */}
 }
 if(gotWellness)window.dispatchEvent(new Event('tempo:garmin-wellness-change'))
 if(imported){await saveRecord('settings',{id:`garmin-sync-local:${PROFILE}`,profileId:PROFILE,lastLocal:new Date().toISOString(),createdAt:'',updatedAt:''})}
 autoState.lastChecked=new Date().toISOString()
 autoState.note=`Automatischer Abgleich: ${imported} neue Aktivitäten, ${autoState.awaitingReview} Zuordnung(en) zur Prüfung, ${autoState.fitEnriched} FIT-Verläufe ergänzt. Private Garmin-Daten werden nur während der angemeldeten Sitzung auf dieses iPhone übertragen.`
 emit()
}
