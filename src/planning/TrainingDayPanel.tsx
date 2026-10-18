import {durationFor} from '../time/duration'
import {useEffect,useState} from 'react'
import {listRecords,deleteRecord} from '../db/storage'
import {isRestDay,type RestDayRecord} from '../phase31/rest-days'
import {currentKey, friendlyDate, PROFILE_ID, type TrainingRecord} from './engine'
import ManualTrainingPanel from './ManualTrainingPanel'
import DayShiftEditor from './DayShiftEditor'
import DailyDecisionPanel from './DailyDecisionPanel'
import { isStrength, isRun } from '../workouts/sessionStore'
import './plan.css'
import HelpDisclosure from '../ui/HelpDisclosure'
import {FuelingQuick} from '../phase30/FuelingPanel'
import WeekReplanner from '../phase30/WeekReplanner'
import {addDays} from '../phase28/calendar-model'

function HomeTrainingCard({onOpen}:{onOpen:()=>void}) {
  const [today,setToday]=useState<TrainingRecord[]>([])
  useEffect(()=>{let live=true
    const load=()=>void listRecords<TrainingRecord>('plannedSessions').then(entries=>{
      if(live)setToday(entries.filter(x=>x.profileId===PROFILE_ID&&x.date===currentKey()))
    }).catch(()=>undefined)
    load();window.addEventListener('tempo:training-change',load)
    return()=>{live=false;window.removeEventListener('tempo:training-change',load)}
  },[])
  const pending=today.filter(x=>x.status==='geplant')
  return <section className="panel status-card"><div className="card-heading"><div className="eyebrow">HEUTIGES TRAINING</div><span className="mini-dot silver"/></div>
    <h3>{pending[0]?.title??(today.length?'Geplantes Training erledigt':'Noch nicht geplant')}</h3>
    <p>{pending.length?`${pending[0].durationMin?durationFor(pending[0]):'Dauer offen'} · ${pending[0].priority}${pending.length>1?` · +${pending.length-1} weitere`:''}`:today.length?'Heute bisher dokumentierte Einheiten abgeschlossen.':'Dienste unter „14 Tage“ bestätigen oder selbst eine Trainingseinheit anlegen.'}</p>
    <button className="text-action" onClick={onOpen}>Tagestraining öffnen →</button></section>
}
export {HomeTrainingCard}

const askAdd=(date:string)=>window.dispatchEvent(new CustomEvent('tempo:manual-add',{detail:date}))
const askEdit=(id:string)=>window.dispatchEvent(new CustomEvent('tempo:manual-edit',{detail:{kind:'planned',id}}))
const askDone=(id:string)=>window.dispatchEvent(new CustomEvent('tempo:manual-finish',{detail:id}))

export default function TrainingDayPanel({onOpenReadiness,onOpenCalendar,onOpenWorkout,initialDate,autoAddDate}:{onOpenReadiness:()=>void;onOpenCalendar:()=>void;onOpenWorkout:(session:TrainingRecord)=>void;initialDate?:string;autoAddDate?:string}){
  const [entries,setEntries]=useState<TrainingRecord[]>([])
  const [selected,setSelected]=useState(initialDate??currentKey())
  const [reschedule,setReschedule]=useState<TrainingRecord|null>(null)
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
  const dates=[...new Set(entries.map(x=>x.date))].sort()
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
  return <div className="tempo-workout tempo-28-daily">
    <section className="panel tempo-workout-head">
      <div className="eyebrow">DEIN TAG · {friendlyDate(selectedDay)}</div>
      <h2>Geplante Einheiten</h2>
      <div className="tempo-workout-nav"><button type="button" onClick={()=>setSelected(previousDate)} aria-label="Vorheriger Kalendertag">‹</button><strong>{friendlyDate(selectedDay)}</strong><button type="button" onClick={()=>setSelected(nextDate)} aria-label="Nächster Kalendertag">›</button></div>
      <label className="tempo-28-day-picker">Anderen Tag öffnen <input type="date" value={selectedDay} onChange={e=>setSelected(e.target.value||today)}/></label>
      {loading&&<p>{notice}</p>}
      {!loading&&atDate.length===0&&<p>Für diesen Tag ist noch keine Einheit geplant. Unter „🌿 Trainingsfreien Tag festlegen“ kannst du den Tag für Erholung reservieren.</p>}
      {!loading&&atDate.map(x=><details key={x.id} className="tempo-28-session-card" open={atDate.length===1}>
        <summary><span>{x.sessionType.includes('strength')?'🏋️':x.sessionType.includes('run')?'🏃':x.sessionType.includes('recovery')?'🧘':'🚴'} <strong>{x.title}</strong></span><small>{x.status==='erledigt'?'✓ Absolviert':x.priority} · {x.durationMin?durationFor(x):'Dauer offen'}</small></summary>
        <div className="tempo-28-session-content"><p>{x.description}</p><p><strong>Ziel:</strong> {x.target}</p>{x.notes&&<p>{x.notes}</p>}{x.commuteLeg&&<p>🚲 Pendeln {x.commuteLeg==='rueck'?'Rückweg':x.commuteLeg==='hin'?'Hinweg':'Hin & Rück'} · diese Fahrt nur einmal zählen</p>}
        <FuelingQuick session={x}/><div className="tempo-manual-entry-actions">{(isStrength(x)||isRun(x))&&<button type="button" onClick={()=>onOpenWorkout(x)}>{isStrength(x)?'Kraftprogramm & Sätze öffnen →':'Laufprogramm öffnen →'}</button>}{x.status!=='erledigt'&&<><button type="button" onClick={()=>setReschedule(x)}>🗓️ Training verschieben</button><button type="button" onClick={()=>askEdit(x.id)}>Bearbeiten</button><button type="button" onClick={()=>askDone(x.id)}>Training abschließen</button></>}</div></div>
      </details>)}
    </section>
    <section className="tempo31-rest-section"><div className="eyebrow">DEINE ENTSCHEIDUNG · ERHOLUNG PLANEN</div><div className="tempo33-rest-title"><h3>🌿 Trainingsfreien Tag festlegen</h3><details className="tempo33-rest-help"><summary aria-label="Erholung planen: Erklärung anzeigen">?</summary><p>Reserviere den Tag für Erholung, Sauna, Familie oder leichte Mobility. TEMPO berechnet passende Trainingstermine neu. Erst nach deiner Bestätigung wird die Änderung gespeichert.</p></details></div>
      {savedRest?<><p><strong>🔒 {savedRest.mode==='free'?'Vollständig trainingsfrei':'Recoverytag'}</strong> · {savedRest.note||'Dieser Tag ist für neue Trainings gesperrt.'}</p><button className="outline" type="button" onClick={()=>void releaseDay()}>Freigabe für diesen Tag aufheben</button></>:<><button type="button" onClick={()=>setRestPreview(true)} disabled={selectedDay<today}>🌿 Ruhetag / Recovery festlegen & Plan anpassen</button></>}
    </section>
    {reschedule&&<WeekReplanner anchor={reschedule} onClose={()=>setReschedule(null)} onSaved={()=>setSelected(selectedDay)}/>}
    {restPreview&&<WeekReplanner restDate={selectedDay} onClose={()=>setRestPreview(false)} onSaved={()=>setSelected(selectedDay)}/>}
    <DayShiftEditor key={selectedDay} date={selectedDay}/>
    {selectedDay===today&&<DailyDecisionPanel onOpenReadiness={onOpenReadiness} onOpenCalendar={onOpenCalendar}/> }
    <ManualTrainingPanel days={[selectedDay]} autoStartDate={autoAddDate}/>
  </div>
}
