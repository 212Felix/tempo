import {useEffect,useState,type FormEvent} from 'react'
import type {TrainingRecord} from '../planning/engine'
import {PROFILE_ID,type CompletedRecord} from '../planning/engine'
import {getRecord,listRecords,saveRecord} from '../db/storage'
import type {ProfileRecord,TempoRecord} from '../db/types'
import {durationFor,parseHms} from '../time/duration'
import TimeFields from '../time/TimeFields'
import {FuelingQuick} from '../phase30/FuelingPanel'
import {alreadyDone,finalizeWorkout} from '../workouts/sessionStore'
import {cyclingIntervalSteps,formatStepTime,stepsSeconds,wattsForStep,type TrainingStep} from '../phase37/intervals'
import SessionGarminReview from '../phase37/SessionGarminReview'
import CyclingIntervalChart from '../phase40c/CyclingIntervalChart'
import {germanDate} from '../phase40c/date'
import '../phase37/phase37.css'

/** One directly executable detail view; saved plan ≠ saved actual, Garmin linking is always reviewed. */
export default function WorkoutDetail({session,onBack}:{session:TrainingRecord|null;onBack:()=>void}) {
 const [environment,setEnvironment]=useState<'indoor'|'outdoor'>('outdoor')
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const [ftp,setFtp]=useState<number|undefined>()
 const [steps,setSteps]=useState<TrainingStep[]|null>(null)
 const [duration,setDuration]=useState('01:00:00'),[distance,setDistance]=useState(''),[elevation,setElevation]=useState(''),[heart,setHeart]=useState(''),[power,setPower]=useState(''),[rpe,setRpe]=useState('5'),[notes,setNotes]=useState('')
 const [completed,setCompleted]=useState(false)
 const cycling=Boolean(session&&['quality','endurance','long','commute','manual-cycling'].includes(session.sessionType))
 const draftId=session?`tempo37:session-draft:${session.id}`:''
 useEffect(()=>{if(!session)return;let active=true
   setEnvironment(session.cyclingEnvironment==='indoor'?'indoor':'outdoor');setNotice('');setSteps(session.workoutSteps??cyclingIntervalSteps(session));setDuration(durationFor(session));setDistance('');setElevation('');setHeart('');setPower('');setRpe('5');setNotes('');setCompleted(session.status==='erledigt')
   void Promise.all([listRecords<ProfileRecord>('profiles'),getRecord<TempoRecord&{duration?:string;distance?:string;elevation?:string;heart?:string;power?:string;rpe?:string;notes?:string}>('settings',draftId),listRecords<CompletedRecord>('completedSessions')]).then(([profiles,draft,records])=>{if(!active)return
    setFtp(profiles.find(p=>p.profileId===PROFILE_ID)?.ftpWatts)
    setCompleted(alreadyDone(session,records))
    if(draft){setDuration(draft.duration??durationFor(session));setDistance(draft.distance??'');setElevation(draft.elevation??'');setHeart(draft.heart??'');setPower(draft.power??'');setRpe(draft.rpe??'5');setNotes(draft.notes??'')}
   }).catch(e=>{if(active)setNotice('Lokale Daten konnten nicht vollständig geladen werden: '+String(e))})
   return()=>{active=false}
 },[session?.id])
 async function setRidePlace(choice:'indoor'|'outdoor'){
  if(!session)return;setEnvironment(choice)
  if(session.id.startsWith('preview:'))return
  setBusy(true);try{const latest=await getRecord<TrainingRecord>('plannedSessions',session.id)
   if(!latest||latest.status==='erledigt')throw Error('Einheit ist nicht mehr bearbeitbar.')
   await saveRecord('plannedSessions',{...latest,cyclingEnvironment:choice,updatedAt:new Date().toISOString()});window.dispatchEvent(new Event('tempo:training-change'))
  }catch(e){setNotice(String(e))}finally{setBusy(false)}
 }
 const patchStep=(i:number,part:Partial<TrainingStep>)=>setSteps(old=>old?.map((x,index)=>index===i?{...x,...part}:x)??null)
 async function saveSteps(){if(!session||!steps)return;setBusy(true)
  try{if(steps.some(s=>!s.title.trim()||!Number.isFinite(s.seconds)||s.seconds<30||s.seconds>7200||s.lowFtp===undefined||s.highFtp===undefined||s.lowFtp<.3||s.highFtp>1.5||s.lowFtp>s.highFtp))throw Error('Alle Phasen benötigen gültige Zeiten und Leistungsbereiche. Auch die Pause hat eine Wattvorgabe.')
   const latest=await getRecord<TrainingRecord>('plannedSessions',session.id)
   if(!latest||latest.status==='erledigt'||latest.locked)throw Error('Geplantes Training ist nicht mehr veränderbar.')
   await saveRecord('plannedSessions',{...latest,workoutSteps:steps,durationMin:stepsSeconds(steps)/60,durationSec:stepsSeconds(steps),updatedAt:new Date().toISOString()});setDuration(durationFor({durationSec:stepsSeconds(steps)}));
   window.dispatchEvent(new Event('tempo:training-change'));setNotice('Intervallplan einschließlich Erholungsphasen gespeichert.')
  }catch(e){setNotice(String(e))}finally{setBusy(false)}}
 async function saveDraft(){if(!session||completed)return;setBusy(true)
  try{await saveRecord('settings',{id:draftId,profileId:PROFILE_ID,date:session.date,sessionId:session.id,kind:'training-draft',duration,distance,elevation,heart,power,rpe,notes,createdAt:'',updatedAt:''});setNotice('Ist-Werte zwischengespeichert. Training ist noch nicht abgeschlossen.')}
  catch(e){setNotice('Entwurf nicht gespeichert: '+String(e))}finally{setBusy(false)}}
 async function finish(e:FormEvent){e.preventDefault();if(!session||completed)return;setBusy(true)
  try{const latest=await getRecord<TrainingRecord>('plannedSessions',session.id)
   if(!latest||latest.status==='erledigt')throw Error('Einheit ist schon abgeschlossen oder wurde verschoben.')
   const time=parseHms(duration)
   const num=(value:string,max:number,label:string,integer=false)=>{if(!value.trim())return undefined;const v=Number(value.replace(',','.'));if(!Number.isFinite(v)||v<0||v>max||(integer&&!Number.isInteger(v)))throw Error(`${label}: ungültiger Wert.`);return v}
   await finalizeWorkout({date:latest.date,planned:latest,title:latest.title,durationMin:time.minutes,durationSec:time.seconds,sessionType:cycling?'manual-cycling':session.sessionType==='recovery'?'manual-mobility':session.sessionType==='manual-swimming'?'manual-swimming':session.sessionType==='manual-sportspiel'?'manual-sportspiel':session.sessionType==='manual-golf'?'manual-golf':session.sessionType==='manual-martial'?'manual-martial':session.sessionType==='manual-yoga'?'manual-yoga':session.sessionType==='manual-stabi'?'manual-stabi':'manual-mobility',distanceKm:num(distance,500,'Distanz'),elevationM:num(elevation,15000,'Höhenmeter'),avgHrBpm:num(heart,230,'Herzfrequenz',true),avgPowerW:num(power,2500,'Ø Watt'),rpe:Number(rpe),notes,freeKey:latest.id})
   setCompleted(true);setNotice('Training abgeschlossen ✓. Für einen späteren Garmin-Import bleibt der Datensatz eindeutig verknüpfbar.')
  }catch(err){setNotice('Nicht abgeschlossen: '+String(err))}finally{setBusy(false)}}
 if(!session)return <section className="panel tempo36-workout-detail"><p>Keine Trainingseinheit ausgewählt.</p><button type="button" onClick={onBack}>Zum Tagestraining</button></section>
 const visibleSteps=steps
 return <div className="tempo37-workout-stack"><section className="panel tempo36-workout-detail">
    <div className="eyebrow">TRAININGSPLAN · {germanDate(session.date)}</div><h2>{session.title}</h2><p>{durationFor(session)} · {session.priority}{session.expectedKm?` · ${session.expectedKm} km`:''}</p>
    {cycling&&<fieldset className="tempo36-environment"><legend>Wie absolvierst du diese Einheit?</legend><div><button type="button" disabled={busy||completed} className={environment==='outdoor'?'active':''} aria-pressed={environment==='outdoor'} onClick={()=>void setRidePlace('outdoor')}>🚴 Outdoor</button><button type="button" disabled={busy||completed} className={environment==='indoor'?'active':''} aria-pressed={environment==='indoor'} onClick={()=>void setRidePlace('indoor')}>🏠 Indoor</button></div></fieldset>}
    {cycling&&<CyclingIntervalChart session={{...session,workoutSteps:visibleSteps??undefined}} ftp={ftp}/>}
    <div className="tempo36-workout-prescription"><h3>{cycling&&environment==='indoor'?'Indoor · vollständige Garmin-Schritte':'Dein Trainingsprogramm'}</h3>
     {session.description&&<p>{session.description}</p>}
     {visibleSteps?<><ol className="tempo37-steps">{visibleSteps.map(step=><li key={step.id}><strong>{step.title}</strong><span>{formatStepTime(step.seconds)} · {wattsForStep(step,ftp)}</span>{step.effort==='recovery'&&<small>Aktive Pause – nicht anhalten.</small>}</li>)}</ol><p className="tempo37-step-sum">Gesamt: {durationFor({durationSec:stepsSeconds(visibleSteps)})} · einschließlich aller Pausen</p></>:<><p>{session.target}</p><p className="tempo36-hint">Für diese Einheit sind noch keine vollständigen Intervallphasen mit Zeiten und Intensitäten hinterlegt. TEMPO ergänzt fehlende Watt- oder Pausenwerte nicht durch Schätzungen.</p></>}
     {cycling&&environment==='indoor'&&<p className="tempo36-hint">Alle Schritte der Reihe nach in Garmin Connect anlegen. Wattbereiche nur aus deiner gespeicherten FTP ableiten; Wattangaben sind Zielbereiche, kein automatisch übertragener Workout-Export.</p>}
     {session.notes&&<p>{session.notes}</p>}
    </div>
    {cycling&&!completed&&<details className="tempo37-plan-editor"><summary>✎ {visibleSteps?'Intervallphasen und Pausen bearbeiten':'Individuellen Intervallplan ergänzen'}</summary><p>Ändert nach dem Speichern nur den geplanten Ablauf. Die tatsächliche Ausführung wird unten getrennt erfasst.</p>{(visibleSteps??[]).map((st,i)=><div className="tempo37-step-inputs" key={st.id}><label className="tempo37-step-name">Phase<input type="text" maxLength={65} value={st.title} onChange={e=>patchStep(i,{title:e.target.value})}/></label><label>Art<select value={st.effort} onChange={e=>patchStep(i,{effort:e.target.value as TrainingStep['effort'],recovery:e.target.value==='recovery'?'active':undefined})}><option value="warmup">Einrollen</option><option value="work">Belastung</option><option value="recovery">Aktive Pause</option><option value="endurance">Lockeres Fahren</option><option value="cooldown">Ausrollen</option></select></label><label>Dauer (Sekunden)<input type="number" min="30" max="7200" step="15" value={st.seconds} onChange={e=>patchStep(i,{seconds:Number(e.target.value)})}/></label><label>Von (% FTP)<input type="number" min="30" max="150" step="1" value={st.lowFtp===undefined?'':Math.round(st.lowFtp*100)} onChange={e=>patchStep(i,{lowFtp:Number(e.target.value)/100})}/></label><label>Bis (% FTP)<input type="number" min="30" max="150" step="1" value={st.highFtp===undefined?'':Math.round(st.highFtp*100)} onChange={e=>patchStep(i,{highFtp:Number(e.target.value)/100})}/></label><button type="button" className="tempo37-remove-step" onClick={()=>setSteps(old=>old?.filter((_,index)=>index!==i)??null)}>Schritt entfernen</button></div>)}<button type="button" className="tempo37-add-step" onClick={()=>setSteps(old=>[...(old??[]),{id:`manual-${(old??[]).length+1}-${Date.now()}`,title:'Neue Trainingsphase',effort:'recovery',recovery:'active',seconds:0}])}>+ Phase / Pause ergänzen</button>{visibleSteps&&<p>Neue Gesamtdauer: {durationFor({durationSec:stepsSeconds(visibleSteps)})}</p>}<button type="button" disabled={busy||!steps?.length} onClick={()=>void saveSteps()}>Geänderten Trainingsplan speichern</button></details>}
    {cycling&&<FuelingQuick session={session}/>}
    <p role="status">{notice}</p>
    <button type="button" className="tempo36-back" onClick={onBack}>← Zurück zum Tagestraining</button>
 </section>
 <section className="panel tempo37-finish"><div className="eyebrow">ABSCHLUSS · TATSÄCHLICHE DATEN</div><h3>Training dokumentieren</h3>
 {completed?<p className="tempo37-done">✓ Training ist bereits abgeschlossen. Ein zweiter Abschluss wird verhindert.</p>:<form onSubmit={e=>void finish(e)}>
 <div className="tempo37-fields"><TimeFields label="Tatsächliche Trainingsdauer" value={duration} onChange={setDuration} required/>
 <label>Distanz (km, optional)<input type="number" inputMode="decimal" min="0" max="500" step="0.01" value={distance} onChange={e=>setDistance(e.target.value)}/></label>
 <label>Höhenmeter (optional)<input type="number" inputMode="numeric" min="0" max="15000" step="1" value={elevation} onChange={e=>setElevation(e.target.value)}/></label>
 <label>Ø Herzfrequenz (optional)<input type="number" inputMode="numeric" min="40" max="230" step="1" value={heart} onChange={e=>setHeart(e.target.value)}/></label>
 {cycling&&<label>Ø Leistung (Watt, optional)<input type="number" inputMode="numeric" min="0" max="2500" step="1" value={power} onChange={e=>setPower(e.target.value)}/></label>}
 <label>RPE (Anstrengung)<select value={rpe} onChange={e=>setRpe(e.target.value)}>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label></div>
 <label className="tempo37-notes">Notizen<textarea value={notes} maxLength={1500} onChange={e=>setNotes(e.target.value)}/></label>
 <div className="tempo37-actions"><button type="button" disabled={busy} onClick={()=>void saveDraft()}>Zwischenspeichern</button><button type="submit" disabled={busy}>Training abschließen ✓</button></div>
 <small>Fueling ist optional. Garmin-Daten können später nach Bestätigung zugeordnet werden. Kein doppelter Trainingseintrag.</small>
 </form>}
 </section>
 <SessionGarminReview session={session}/>
 </div>
}
