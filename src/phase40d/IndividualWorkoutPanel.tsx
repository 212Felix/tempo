import {useEffect,useMemo,useState} from 'react'
import {getRecord,listRecords,openTempoDatabase} from '../db/storage'
import type {ProfileRecord,TempoRecord} from '../db/types'
import type {TrainingRecord,ShiftRecord,ReadinessRecord} from '../planning/engine'
import {PROFILE_ID,currentKey} from '../planning/engine'
import {assessHybrid,hrvReference} from './hybrid-readiness'
import {validateWellness,type Wellness} from '../phase40c/wellness'
import type {PerformanceEntry} from '../metrics/library'
import type {TrainingBlock} from '../blocks/library'
import {matchingBlock} from '../blocks/library'
import {makeSuggestion,suggestionRecord,workoutNames,type Sport,type WorkoutFlavor} from './prescription'
import {proposeIndividualPlacement} from './individual-placement'
import type {RestDayRecord} from '../phase31/rest-days'
import {isRestDay} from '../phase31/rest-days'
import type {GarminActivity} from '../garmin/csv'
import {activeGarminActivities} from '../garmin/stored-duplicates'
import WorkoutProfileChart from './WorkoutProfileChart'
import {germanDate} from '../phase40c/date'
import './phase40d.css'

type Source={profile?:ProfileRecord;metrics:PerformanceEntry[];sessions:TrainingRecord[];shifts:ShiftRecord[];rests:RestDayRecord[];blocks:TrainingBlock[];activities:GarminActivity[];readiness:'offen'|'gruen'|'gelb'|'rot'}
const initial:Source={metrics:[],sessions:[],shifts:[],rests:[],blocks:[],activities:[],readiness:'offen'}
const dateToday=currentKey()
export default function IndividualWorkoutPanel({onOpenWorkout}:{onOpenWorkout:(session:TrainingRecord)=>void}){
 const [source,setSource]=useState<Source>(initial),[sport,setSport]=useState<Sport>('cycling'),[flavor,setFlavor]=useState<WorkoutFlavor>('z2'),[minutes,setMinutes]=useState(60),[date,setDate]=useState(dateToday)
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[review,setReview]=useState(false)
 useEffect(()=>{let live=true;const load=()=>void Promise.all([
  getRecord<ProfileRecord>('profiles',PROFILE_ID),listRecords<PerformanceEntry>('performanceEntries'),listRecords<TrainingRecord>('plannedSessions'),listRecords<ShiftRecord>('shifts'),listRecords<TempoRecord>('settings'),listRecords<TrainingBlock>('trainingBlocks'),listRecords<GarminActivity>('externalActivities'),getRecord<ReadinessRecord>('readinessEntries',`${PROFILE_ID}:${dateToday}`)
 ]).then(([profile,metrics,sessions,shifts,settings,blocks,activities,readiness])=>{if(live)setSource({profile,metrics:metrics.filter(m=>m.profileId===PROFILE_ID&&m.kind==='tempo-measured-performance'),sessions:sessions.filter(s=>s.profileId===PROFILE_ID),shifts:shifts.filter(s=>s.profileId===PROFILE_ID),rests:settings.filter(isRestDay),blocks:blocks.filter(b=>b.profileId===PROFILE_ID),activities:activeGarminActivities(activities.filter(a=>a.profileId===PROFILE_ID)),readiness:assessHybrid(readiness?.ratings??{},readiness?.illness??'',validateWellness(settings.find(r=>r.id===`garmin-wellness:${PROFILE_ID}:${dateToday}`)?.wellness),hrvReference(settings.filter(r=>r.id.startsWith(`garmin-wellness:${PROFILE_ID}:`)).map(r=>validateWellness(r.wellness)).filter((x):x is Wellness=>Boolean(x)),dateToday)).level})}).catch(()=>setMessage('Leistungsdaten konnten nicht vollständig geladen werden.'));load();window.addEventListener('tempo:training-change',load);window.addEventListener('tempo:garmin-import-change',load);window.addEventListener('tempo:readiness-change',load);return()=>{live=false;window.removeEventListener('tempo:training-change',load);window.removeEventListener('tempo:garmin-import-change',load);window.removeEventListener('tempo:readiness-change',load)}},[])
 const latest=(code:string)=>source.metrics.filter(m=>m.code===code&&Number.isFinite(m.value)).sort((a,b)=>b.date.localeCompare(a.date))[0]?.value
 const last7=new Date(dateToday+'T12:00:00Z').getTime()-7*86400_000
 const recent=source.activities.filter(a=>Date.parse(a.date+'T12:00:00Z')>=last7)
 const plannedHard=source.sessions.filter(s=>s.status==='geplant'&&Date.parse(s.date+'T12:00:00Z')>=last7&&/quality|interval|schwelle|vo2/i.test(`${s.sessionType} ${s.title}`)).length
 const effortCount=plannedHard+recent.filter(a=>a.avgHrBpm&&source.profile?.maxHeartRateBpm&&(a.avgHrBpm/source.profile.maxHeartRateBpm)>.84).length
 const block=matchingBlock(date,source.blocks)
 const input={sport,flavor,minutes,ftp:source.profile?.ftpWatts??latest('ftp'),run5kSeconds:latest('run5k'),cooperMeters:latest('cooper'),readiness:source.readiness,weeklyHardSessions:effortCount}
 const recipe=useMemo(()=>makeSuggestion(input),[sport,flavor,minutes,source.profile?.ftpWatts,source.readiness,source.metrics,source.activities,source.sessions])
 const temp=recipe?suggestionRecord(input,date,'preview:individual'):undefined
 const plan=temp?proposeIndividualPlacement(temp,source.sessions,source.shifts,source.rests.map(r=>r.date)):undefined
 const warnings=[...(block?.target==='recovery'&&flavor!=='z2'?['Erholungsblock aktiv: Bitte nur lockere Einheiten wählen.']:[]),...(block?.capacity==='reduced'&&minutes>60?['Aktueller Trainingsblock sieht begrenzte Trainingszeit vor.']:[])]
 const allowed=Boolean(recipe&&!warnings.length&&plan&&!plan.conflicts.length)
 const canSave=allowed&&Boolean(temp)
 async function commit(startNow:boolean){
  if(!canSave||!temp||!plan)return
  if(startNow&&date!==currentKey()){setMessage('Für den direkten Start bitte als Datum „Heute“ wählen.');return}
  setBusy(true)
  const now=new Date().toISOString(),session={...temp,id:`individual:${PROFILE_ID}:${crypto.randomUUID()}`,createdAt:now,updatedAt:now,locked:true}
  try{
   const db=await openTempoDatabase()
   await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(['plannedSessions','settings'],'readwrite'),store=tx.objectStore('plannedSessions')
    let reason='Trainingsplan wurde inzwischen geändert; bitte Vorschau neu laden.'
    const rest=tx.objectStore('settings').index('byDate').getAll(date)
    rest.onsuccess=()=>{
     if((rest.result as TempoRecord[]).some(isRestDay)){reason='Der Tag ist inzwischen als Ruhetag markiert.';tx.abort();return}
     const existing=store.index('byDate').getAll(date)
     existing.onsuccess=()=>{
      const active=(existing.result as TrainingRecord[]).filter(r=>r.profileId===PROFILE_ID&&r.status==='geplant')
      if(active.some(r=>!source.sessions.some(x=>x.id===r.id&&x.updatedAt===r.updatedAt))){tx.abort();return}
      for(const move of plan.moves){
       const old=source.sessions.find(x=>x.id===move.id)
       if(!old||old.locked||old.createdBy==='tempo-user'){tx.abort();return}
       const get=store.get(old.id)
       get.onsuccess=()=>{
        const saved=get.result as TrainingRecord|undefined
        if(!saved||saved.updatedAt!==old.updatedAt){tx.abort();return}
        // Move to fresh user-confirmed identity so the automatic planner cannot restore the old day.
        const newId=`rescheduled:${PROFILE_ID}:${crypto.randomUUID()}`
        store.delete(old.id)
        store.put({...saved,id:newId,date:move.to,locked:true,createdBy:'tempo-user',updatedAt:now,originalPlanId:old.id,originalPlanDate:old.date})
       }
      }
      store.add(session)
     }
    }
    tx.oncomplete=()=>{db.close();resolve()}
    tx.onerror=()=>{db.close();reject(tx.error??new Error(reason))}
    tx.onabort=()=>{db.close();reject(new Error(reason))}
   })
   window.dispatchEvent(new Event('tempo:training-change'))
   setReview(false);setMessage(`Training ${germanDate(date)} gespeichert ✓. ${plan.moves.length} andere Einheiten nach Bestätigung verschoben.`)
   if(startNow)onOpenWorkout(session)
  }catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <section className="tempo40d-maker" data-tempo-no-swipe><button type="button" onClick={()=>setOpen(x=>!x)} aria-expanded={open}>✦ Individuelles Wunschtraining {open?'schließen':'erstellen'}</button>
  {open&&<><h3>Dein Wunschtraining</h3><p>Wähle Sportart, Reiz und Zeitbudget. TEMPO verwendet ausschließlich deine gespeicherten Leistungswerte. Änderungen am Wochenplan brauchen deine Freigabe.</p>
   <label>Sportart<select value={sport} onChange={e=>{setSport(e.target.value as Sport);setReview(false)}}><option value="cycling">🚴 Radfahren</option><option value="running">🏃 Laufen</option></select></label>
   <label>Trainingsreiz<select value={flavor} onChange={e=>{setFlavor(e.target.value as WorkoutFlavor);setReview(false)}}>{(Object.keys(workoutNames) as WorkoutFlavor[]).map(k=><option key={k} value={k}>{workoutNames[k]}</option>)}</select></label>
   <label>Zeit (20–240 Minuten)<input type="number" min="20" max="240" step="5" value={minutes} onChange={e=>{setMinutes(Number(e.target.value));setReview(false)}}/></label>
   <label>Wunschtermin<input type="date" min={dateToday} value={date} onChange={e=>{setDate(e.target.value);setReview(false)}}/></label>
   <p>Heutige TEMPO-Readiness: <strong>{source.readiness.toUpperCase()}</strong> · Intensive Einheiten in jüngster Planung/Import: <strong>{effortCount}</strong>{block&&<> · Trainingsblock: <strong>{block.name}</strong></>}</p>
   {!recipe?<p className="tempo40d-warning">Für diese Intensität fehlen Trainingsfreigabe oder Zeitbudget. Bei ROT beziehungsweise hoher Vorbelastung wird kein neues hartes Training erstellt.</p>:<><h3>{recipe.title} · {minutes} min</h3>{recipe.warning&&<p className="tempo40d-warning">{recipe.warning}</p>}{temp&&<WorkoutProfileChart session={temp} ftp={input.ftp} compact={false}/>}</>}
   {warnings.map(w=><p key={w} className="tempo40d-warning">{w}</p>)}
   {plan?.conflicts.map(w=><p key={w} className="tempo40d-warning">⚠ {w}</p>)}
   {plan?.notes.map(w=><p key={w}>ℹ {w}</p>)}
   {!review?<button disabled={!canSave||busy} onClick={()=>setReview(true)}>Kalenderänderungen prüfen</button>:<div className="tempo40d-review"><h3>Deine Bestätigung erforderlich</h3><p>Neues Training am {germanDate(date)}. Andere Änderungen: {plan?.moves.length??0}. Bereits absolvierte und selbst festgelegte Einheiten bleiben unangetastet.</p><button disabled={busy||!canSave} onClick={()=>void commit(false)}>✓ Training und Wochenänderungen bestätigen</button>{date===currentKey()&&<button disabled={busy||!canSave} onClick={()=>void commit(true)}>▶ Jetzt starten & speichern</button>}<button onClick={()=>setReview(false)}>Abbrechen</button></div>}
   <p className="tempo40d-status" role="status">{message}</p>
  </>}
 </section>
}
