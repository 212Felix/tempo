import {useEffect,useState} from 'react'
import type {TrainingRecord} from '../planning/engine'
import {getRecord,saveRecord} from '../db/storage'
import {durationFor} from '../time/duration'
import {FuelingQuick} from '../phase30/FuelingPanel'

/** Direct activity entry point. The cycling statistics page is intentionally not used. */
export default function WorkoutDetail({session,onBack}:{session:TrainingRecord|null;onBack:()=>void}) {
  const [environment,setEnvironment]=useState<'indoor'|'outdoor'>('outdoor')
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  const cycling=Boolean(session&&/quality|endurance|long|commute|manual-cycling/.test(session.sessionType))
  useEffect(()=>{setEnvironment(session?.cyclingEnvironment==='indoor'?'indoor':'outdoor');setNotice('')},[session?.id])
  async function setRidePlace(choice:'indoor'|'outdoor'){
    if(!session)return
    setEnvironment(choice)
    if(session.id.startsWith('preview:'))return
    setBusy(true)
    try{
      const latest=await getRecord<TrainingRecord>('plannedSessions',session.id)
      if(!latest||latest.status==='erledigt'){setNotice('Diese Einheit ist inzwischen verändert worden.');return}
      await saveRecord('plannedSessions',{...latest,cyclingEnvironment:choice,updatedAt:new Date().toISOString()})
      window.dispatchEvent(new Event('tempo:training-change'))
      setNotice(`${choice==='indoor'?'Indoor':'Outdoor'} für dieses Training gespeichert.`)
    }catch(e){setNotice(`Auswahl konnte nicht gespeichert werden: ${String(e)}`)}finally{setBusy(false)}
  }
  if(!session)return <section className="panel tempo36-workout-detail"><p>Keine Trainingseinheit ausgewählt.</p><button type="button" onClick={onBack}>Zum Tagestraining</button></section>
  const parts=session.target.split(/\s*·\s*/).filter(Boolean)
  return <section className="panel tempo36-workout-detail">
    <div className="eyebrow">TRAININGSPLAN · {session.date}</div>
    <h2>{session.title}</h2>
    <p>{durationFor(session)} · {session.priority}{session.expectedKm?` · ${session.expectedKm} km`:''}</p>
    {cycling&&<fieldset className="tempo36-environment"><legend>Wie absolvierst du diese Einheit?</legend><div><button type="button" disabled={busy} className={environment==='outdoor'?'active':''} aria-pressed={environment==='outdoor'} onClick={()=>void setRidePlace('outdoor')}>🚴 Outdoor</button><button type="button" disabled={busy} className={environment==='indoor'?'active':''} aria-pressed={environment==='indoor'} onClick={()=>void setRidePlace('indoor')}>🏠 Indoor</button></div></fieldset>}
    <div className="tempo36-workout-prescription"><h3>{cycling&&environment==='indoor'?'Indoor · Schritte für Garmin':'Dein Trainingsprogramm'}</h3>
      <p>{session.description}</p>
      {parts.length>1?<ol>{parts.map((part,i)=><li key={i}>{part}</li>)}</ol>:<p className="tempo36-target">{session.target}</p>}
      {cycling&&environment==='indoor'&&<p className="tempo36-hint">In Garmin Connect als einzelne Schritte in dieser Reihenfolge anlegen. Dauer und Intensität der jeweiligen Phase aus der Vorgabe übernehmen. Bei unvollständigen Angaben keine fehlenden Watt- oder Pausenwerte erfinden.</p>}
      {session.notes&&<p>{session.notes}</p>}
    </div>
    {cycling&&<FuelingQuick session={session}/>}
    <p role="status">{notice}</p>
    <button type="button" className="tempo36-back" onClick={onBack}>← Zurück zum Tagestraining</button>
  </section>
}
