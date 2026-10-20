import TimeFields from '../time/TimeFields'
import {FuelingQuick} from '../phase30/FuelingPanel'
import {parseHms,durationFor} from '../time/duration'
import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {currentKey,friendlyDate,type TrainingRecord} from '../planning/engine'
import {listRecords} from '../db/storage'
import {type GoalEvent,dateLabel} from '../events/library'
import {upcomingCooper,paceText} from '../events/running'
import {paceLabel,runInstructions} from './catalog'
import {alreadyDone,finalizeWorkout,isRun,loadWorkoutData,numberField,readinessWarning} from './sessionStore'
import './workouts.css'
import HelpDisclosure from '../ui/HelpDisclosure'

type Data=Awaited<ReturnType<typeof loadWorkoutData>>
export default function RunningPanel({focusId,onOpenEvents}:{focusId?:string;onOpenEvents?:()=>void}){
  const [data,setData]=useState<Data>({planned:[],completed:[],readiness:[],sets:[]})
  const [cooper,setCooper]=useState<GoalEvent|undefined>()
  const [plannedId,setPlannedId]=useState('')
  const [date,setDate]=useState(currentKey())
  const [duration,setDuration]=useState('00:30:00')
  const [distance,setDistance]=useState('')
  const [heart,setHeart]=useState('')
  const [rpe,setRpe]=useState('3')
  const [notes,setNotes]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('Lade Laufeinheiten …')
  const planned=data.planned.filter(isRun).sort((a,b)=>a.date.localeCompare(b.date))
  const session=planned.find(x=>x.id===plannedId)
  const actualDate=session?.date??date
  const freeKey=`free-run:${actualDate}`
  const done=alreadyDone(session,data.completed,session?undefined:freeKey)
  const history=useMemo(()=>data.completed.filter(x=>x.sessionType==='run'||x.sessionType==='manual-running').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10),[data.completed])
  useEffect(()=>{let live=true
    const refresh=()=>void loadWorkoutData().then(next=>{if(live){setData(next);setMessage('Lauftraining bereit. Keine harte Pace oder Intervalle erzwingen.')}}).catch(err=>{if(live)setMessage(`Ladefehler: ${String(err)}`)})
    refresh();window.addEventListener('tempo:training-change',refresh)
    return()=>{live=false;window.removeEventListener('tempo:training-change',refresh)}
  },[])
  useEffect(()=>{let live=true
    const reload=()=>void listRecords<GoalEvent>('events').then(rows=>{if(live)setCooper(upcomingCooper(rows))}).catch(()=>undefined)
    reload();window.addEventListener('tempo:events-change',reload)
    return()=>{live=false;window.removeEventListener('tempo:events-change',reload)}
  },[])
  useEffect(()=>{if(!focusId)return
    const found=data.planned.find(x=>x.id===focusId&&isRun(x))
    if(found){setPlannedId(found.id);setDate(found.date);setDuration(durationFor(found))}
  },[focusId,data.planned])
  const warning=readinessWarning(actualDate,data.readiness)
  const pace=(()=>{try{return paceLabel(parseHms(duration,true).minutes,Number(distance))}catch{return '–'}})()
  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true)
    try{
      if(done)throw Error('Diese Laufeinheit ist bereits abgeschlossen.')
      const time=parseHms(duration)
      const durationMin=time.minutes
      const km=numberField(distance,'Strecke',150,true)!
      if(km<=0)throw Error('Bitte die gelaufenen Kilometer eingeben.')
      const avgHrBpm=heart.trim()===''?undefined:numberField(heart,'Ø Herzfrequenz',230)
      const rpeValue=numberField(rpe,'RPE',10,true)!
      await finalizeWorkout({date:actualDate,title:session?.title??runInstructions.title,planned:session,durationMin,durationSec:time.seconds,
        rpe:rpeValue,notes,sessionType:'manual-running',distanceKm:km,avgHrBpm,freeKey})
      setData(await loadWorkoutData());setMessage('Lauf absolviert ✓ · Dauer, Distanz, RPE und optional Puls gespeichert.')
    }catch(err){setMessage(`Nicht gespeichert: ${err instanceof Error?err.message:String(err)}`)}finally{setBusy(false)}
  }
  return <div className="tw-stack">
    {!focusId&&cooper&&<section className="panel tw-panel tempo-running-goal"><div className="eyebrow">LAUFZIEL · COOPER-TEST</div><h2>3.200 Meter in 12:00</h2><p>Zieltempo: <strong>{paceText(3.2,720)}</strong> · {cooper.date?`Testtermin: ${dateLabel(cooper.date)}`:'Testtermin noch offen'}</p><p>Wir bauen zuerst lockere Laufkilometer und Laufverträglichkeit auf. Das Zieltempo ist noch keine Vorgabe für die nächste Einheit.</p>{onOpenEvents&&<button type="button" className="outline" onClick={onOpenEvents}>{cooper.date?'Laufziel bearbeiten':'Testdatum festlegen'} ↗</button>}</section>}

    {!focusId&&<section className="panel tw-panel"><div className="eyebrow">LAUFEN · KONSERVATIVER AUFBAU</div><h2>Locker laufen, konstant aufbauen</h2>
      <HelpDisclosure id="running-intro"><p>Der Laufteil startet bewusst behutsam: erst Umfang und Sehnenverträglichkeit, später gezielte Geschwindigkeit. Aktuell keine harten 800-m- oder 1.000-m-Intervalle.</p></HelpDisclosure>
      <div className="tw-form-grid"><label>Geplante Laufeinheit<select value={plannedId} onChange={e=>{
        setPlannedId(e.target.value);const item=planned.find(x=>x.id===e.target.value);if(item){setDate(item.date);setDuration(durationFor(item))}else setDuration('00:30:00')
      }}><option value="">Freien Lauf erfassen</option>{planned.map(x=><option key={x.id} value={x.id}>{x.date} · {x.title}{x.status==='erledigt'?' ✓':''}</option>)}</select></label>
        {!session&&<label>Datum<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>}
      </div>
      <div className="tw-info"><strong>{session?.title??runInstructions.title} · {friendlyDate(actualDate)}</strong><span>RPE 3–4 · lockere Atmung · Gehpausen erlaubt</span><span>{runInstructions.note}</span></div>
      {warning&&<div className="tw-warning">{warning} Bei Unsicherheit Einheit auslassen oder verschieben.</div>}
      {done&&<div className="tw-success">Diese Einheit ist bereits als absolviert dokumentiert.</div>}
    </section>}
    <section className="panel tw-panel"><div className="eyebrow">LAUFABLAUF</div><h3>{session?.title??"Deine Einheit"}</h3>
      {session&&<div className="tw-info"><strong>{friendlyDate(session.date)} · {durationFor(session)} · {session.priority}</strong><span>{session.target}</span>{session.notes&&<span>{session.notes}</span>}</div>}
      <HelpDisclosure id="running-run-notes"><p>Wähle die Gesamtdauer je nach geplanter Einheit und Tagesform. Steigt die muskuläre Belastung oder treten Schmerzen auf, beende den Lauf.</p></HelpDisclosure>
      {runInstructions.steps.map((step,i)=><div className="tw-run-step" key={step.name}><span className="tw-number">{i+1}</span><div><strong>{step.name}</strong><p>{step.detail}</p></div></div>)}

    </section>
    {focusId&&session&&<FuelingQuick session={session}/>}
    <section className="panel tw-panel"><div className="eyebrow">LAUFFEEDBACK · ABSOLVIERT</div><h3>Ist-Werte eintragen</h3>
      <form onSubmit={e=>void submit(e)}><div className="tw-form-grid">
        <TimeFields label="Laufdauer" value={duration} onChange={setDuration} disabled={Boolean(done)} required/>
        <label>Distanz (km)<input disabled={done} type="number" min="0.01" max="150" step="0.01" required inputMode="decimal" value={distance} onChange={e=>setDistance(e.target.value)} placeholder="z. B. 5,0"/></label>
        <label>Ø Puls (optional)<input disabled={done} type="number" min="40" max="230" step="1" value={heart} onChange={e=>setHeart(e.target.value)} placeholder="z. B. 135"/></label>
        <label>RPE 1–10<select disabled={done} value={rpe} onChange={e=>setRpe(e.target.value)}>{Array.from({length:10},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
      </div><div className="tw-info"><strong>Errechnete Durchschnittspace</strong><span>{pace} · inklusive der von dir eingetragenen Zeit</span></div>
        <label className="tw-notes">Notizen<textarea disabled={done} value={notes} maxLength={1500} onChange={e=>setNotes(e.target.value)} placeholder="Beine, Untergrund, Gehpausen, Wetter, Beschwerden …"/></label>
        <div className="tw-actions"><button type="submit" disabled={busy||done}>{busy?'Speichere …':'Lauf abschließen ✓'}</button></div>
      </form><div className="tw-feedback" role="status">{message}</div>
    </section>
    <section className="panel tw-panel"><div className="eyebrow">LAUFEN · HISTORIE</div><h3>Zuletzt dokumentiert</h3>
      {history.length?history.map(x=><div className="tw-history" key={x.id}><strong>{friendlyDate(x.date)} · {x.title}</strong><span>{x.distanceKm??'–'} km · {durationFor(x)} · {typeof x.durationMin==='number' && typeof x.distanceKm==='number' && x.distanceKm>0 ? paceLabel(x.durationMin,x.distanceKm) : '–'} · RPE {x.rpe??'–'}</span></div>):<p>Noch kein Lauf abgeschlossen. Alte Garmin-CSV-Aktivitäten liegen weiterhin in der separaten Garmin-Bibliothek.</p>}
      <HelpDisclosure id="running-history-help"><p>Passende FIT- oder CSV-Aktivitäten können im Garmin-Datenimport über den Trainingsabgleich nach Bestätigung mit diesem Abschluss verknüpft werden. Keine zweite Trainingseinheit anlegen.</p></HelpDisclosure>
    </section>
  </div>
}
