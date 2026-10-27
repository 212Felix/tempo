import {durationFor} from '../time/duration'
import WorkoutProfileChart,{hasWorkoutProfile} from '../phase40d/WorkoutProfileChart'
import IndividualWorkoutPanel from '../phase40d/IndividualWorkoutPanel'
import GarminActivityImpact from '../phase40d/GarminActivityImpact'
import GarminActualBadge from '../phase40d/GarminActualBadge'
import {prescription} from './session-prescription'
import type {ProfileRecord} from '../db/types'
import {getRecord} from '../db/storage'
import {activityArt} from '../phase382/activity-art'
import {useEffect,useState} from 'react'
import {listRecords,deleteRecord} from '../db/storage'
import {isRestDay,type RestDayRecord} from '../phase31/rest-days'
import {currentKey, friendlyDate, PROFILE_ID, type TrainingRecord} from './engine'
import ManualTrainingPanel from './ManualTrainingPanel'
import DayShiftEditor from './DayShiftEditor'
import './plan.css'
import WeekReplanner from '../phase30/WeekReplanner'
import {addDays} from '../phase28/calendar-model'
import {germanDate} from '../phase40c/date'
import GarminWellnessCard from '../phase40c/GarminWellnessCard'
import {useSessionData,SessionStatus,InlineSessionProfile} from '../phase40e/SessionAnalysis'

function HomeTrainingCard({onOpen,onOpenWorkout}:{onOpen:()=>void;onOpenWorkout?:(session:TrainingRecord)=>void}) {
  const [today,setToday]=useState<TrainingRecord[]>([])
  const sessionData=useSessionData()
  const [profile,setProfile]=useState<ProfileRecord|undefined>()
  useEffect(()=>{void getRecord<ProfileRecord>('profiles',PROFILE_ID).then(setProfile).catch(()=>undefined)},[])
  useEffect(()=>{let live=true
    const load=()=>void listRecords<TrainingRecord>('plannedSessions').then(entries=>{
      if(live)setToday(entries.filter(x=>x.profileId===PROFILE_ID&&x.date===currentKey()))
    }).catch(()=>undefined)
    load();window.addEventListener('tempo:training-change',load)
    return()=>{live=false;window.removeEventListener('tempo:training-change',load)}
  },[])
  return <section className="panel tempo36-home-train"><div className="eyebrow">HEUTIGES TRAINING</div>
    {today.length===0?<p>Heute noch kein Training gespeichert.</p>:<div className="tempo36-home-sessions">{today.map(session=><div key={session.id} className="tempo40e-home-training"><button className={`tempo36-home-session tempo382-sport-${activityArt(session)}`} type="button" onClick={()=>onOpenWorkout?onOpenWorkout(session):onOpen()}><span className="tempo36-session-icon">{iconForSession(session)}</span><span className="tempo36-session-main"><strong>{session.title}</strong><small><SessionStatus session={session} data={sessionData} compact/> · {durationFor(session)}</small><small className="tempo40b-prescription-small">{prescription(session,profile).slice(1,3).join(' · ')}</small></span><span className="tempo36-chevron">›</span></button>{hasWorkoutProfile(session)&&<InlineSessionProfile session={session} ftp={profile?.ftpWatts}/>}</div>)}</div>}
    {today.length===0&&<button className="text-action" onClick={onOpen}>Training planen →</button>}
  </section>
}
export {HomeTrainingCard}

export const iconForSession=(session:TrainingRecord):string=>/strength/.test(session.sessionType)?'🏋️':/run/.test(session.sessionType)?'🏃':/swimming/.test(session.sessionType)?'🏊':/sportspiel/.test(session.sessionType)?'⚽':/golf/.test(session.sessionType)?'⛳':/yoga|mobility/.test(session.sessionType)?'🧘':/stabi/.test(session.sessionType)?'🤸':/recovery/.test(session.sessionType)?'🌿':'🚴'


export default function TrainingDayPanel({onOpenWorkout,initialDate,autoAddDate,autoOpenShift=false}:{onOpenReadiness:()=>void;onOpenCalendar:()=>void;onOpenWorkout:(session:TrainingRecord)=>void;initialDate?:string;autoAddDate?:string;autoOpenShift?:boolean}){
  const [entries,setEntries]=useState<TrainingRecord[]>([])
  const sessionData=useSessionData()
  const [profile,setProfile]=useState<ProfileRecord|undefined>()
  useEffect(()=>{void getRecord<ProfileRecord>('profiles',PROFILE_ID).then(setProfile).catch(()=>undefined)},[])
  const [selected,setSelected]=useState(initialDate??currentKey())
  const [manualOpen,setManualOpen]=useState(Boolean(autoAddDate))
  const [restPreview,setRestPreview]=useState(false),[fixedRest,setFixedRest]=useState<RestDayRecord[]>([])
  const [loading,setLoading]=useState(true)
  const [notice,setNotice]=useState('Gespeicherte Einheiten werden geladen …')
  const today=currentKey()
  useEffect(()=>{let live=true
    const load=()=>void listRecords<TrainingRecord>('plannedSessions').then(records=>{
      if(!live)return
      setEntries(records.filter(x=>x.profileId===PROFILE_ID).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)))
      setLoading(false)
      setNotice('')
    }).catch(err=>{if(live){setLoading(false);setNotice(`Datenbankfehler: ${String(err)}`)}})
    load();window.addEventListener('tempo:training-change',load)
    return()=>{live=false;window.removeEventListener('tempo:training-change',load)}
  },[])
  useEffect(()=>{let active=true
    const load=()=>void listRecords('settings').then(records=>{if(active)setFixedRest(records.filter(isRestDay))}).catch(()=>undefined)
    load();window.addEventListener('tempo:training-change',load)
    return()=>{active=false;window.removeEventListener('tempo:training-change',load)}
  },[])
  const selectedDay=selected||today
  const atDate=entries.filter(x=>x.date===selectedDay)
  const savedRest=fixedRest.find(x=>x.date===selectedDay)
  async function releaseDay(){
    if(!savedRest||!window.confirm('Den selbst festgelegten Ruhetag wieder für die Planung freigeben? Bereits gespeicherte Trainingseinheiten werden dadurch nicht automatisch ergänzt.'))return
    await deleteRecord('settings',savedRest.id)
    window.dispatchEvent(new Event('tempo:training-change'))
  }
  const previousDate=addDays(selectedDay,-1)
  const nextDate=addDays(selectedDay,1)
  return <div className="tempo-workout tempo-28-daily tempo36-day">
    <GarminWellnessCard date={selectedDay} compact/>
    <GarminActivityImpact/>
    <section className="panel tempo-workout-head tempo36-daily-main">
      <div className="tempo-workout-nav tempo36-date-nav"><button type="button" onClick={()=>setSelected(previousDate)} aria-label="Vorheriger Kalendertag">‹</button><label className="tempo37-date-label"><span>{friendlyDate(selectedDay)}</span><input aria-label="Datum auswählen" type="date" value={selectedDay} onChange={e=>setSelected(e.target.value||today)}/></label><button type="button" onClick={()=>setSelected(nextDate)} aria-label="Nächster Kalendertag">›</button></div>
      {loading&&<p>{notice}</p>}
      {!loading&&atDate.length===0&&<p>Heute keine fest gespeicherte Einheit. Über „Training hinzufügen“ kannst du selbst planen.</p>}
      {!loading&&atDate.map(x=><div key={x.id} className="tempo40d-training-card"><button type="button" className={`tempo36-daily-workout tempo382-sport-${activityArt(x)}`} onClick={()=>onOpenWorkout(x)} aria-label={`${x.title} öffnen`}><span className="tempo36-daily-workout-icon">{iconForSession(x)}</span><span className="tempo36-daily-workout-content"><strong>{x.title}</strong><small><SessionStatus session={x} data={sessionData} compact/> · {x.durationMin?durationFor(x):'Dauer offen'}{x.expectedKm?` · ${x.expectedKm} km`:''}</small><span className="tempo40b-training-preview">{prescription(x,profile).slice(1,4).map((line,i)=><span key={i}>{line}</span>)}</span></span><span className="tempo36-chevron">›</span></button>{hasWorkoutProfile(x)&&<InlineSessionProfile session={x} ftp={profile?.ftpWatts}/>}<GarminActualBadge plannedId={x.id}/></div>)}
      <button className="tempo36-add-training" type="button" onClick={()=>setManualOpen(true)}>＋ Training hinzufügen</button>
      <IndividualWorkoutPanel onOpenWorkout={onOpenWorkout}/>
    </section>
    <section className="tempo36-rest"><button className="tempo36-rest-trigger" type="button" onClick={()=>setRestPreview(true)} disabled={selectedDay<today&&!savedRest}><span>🌿</span><strong>{savedRest?'🔒 '+(savedRest.mode==='free'?'Trainingsfrei':'Recoverytag'):'Ruhetag / Recovery festlegen'}</strong><span>›</span></button>{savedRest&&<button type="button" className="outline" onClick={()=>void releaseDay()}>Ruhetag wieder freigeben</button>}</section>
    {restPreview&&<WeekReplanner restDate={selectedDay} onClose={()=>setRestPreview(false)} onSaved={()=>setSelected(selectedDay)}/>}
    <DayShiftEditor key={selectedDay} date={selectedDay} openOnMount={autoOpenShift}/>
    {manualOpen&&<div className="tempo36-manual-host"><button type="button" className="outline" onClick={()=>setManualOpen(false)}>Eingabe schließen ×</button><ManualTrainingPanel days={[selectedDay]} autoStartDate={selectedDay}/></div>}
  </div>
}
