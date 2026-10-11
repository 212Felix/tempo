import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {currentKey,friendlyDate,type TrainingRecord} from '../planning/engine'
import {paceLabel,runInstructions} from './catalog'
import {alreadyDone,finalizeWorkout,isRun,loadWorkoutData,numberField,readinessWarning} from './sessionStore'
import './workouts.css'

type Data=Awaited<ReturnType<typeof loadWorkoutData>>
export default function RunningPanel({focusId}:{focusId?:string}){
  const [data,setData]=useState<Data>({planned:[],completed:[],readiness:[],sets:[]})
  const [plannedId,setPlannedId]=useState('')
  const [date,setDate]=useState(currentKey())
  const [duration,setDuration]=useState('30')
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
  useEffect(()=>{if(!focusId)return
    const found=data.planned.find(x=>x.id===focusId&&isRun(x))
    if(found){setPlannedId(found.id);setDate(found.date);setDuration(String(found.durationMin||30))}
  },[focusId,data.planned])
  const warning=readinessWarning(actualDate,data.readiness)
  const pace=paceLabel(Number(duration),Number(distance))
  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true)
    try{
      if(done)throw Error('Diese Laufeinheit ist bereits abgeschlossen.')
      const durationMin=numberField(duration,'Dauer',600,true)!
      const km=numberField(distance,'Strecke',150,true)!
      if(km<=0)throw Error('Bitte die gelaufenen Kilometer eingeben.')
      const avgHrBpm=heart.trim()===''?undefined:numberField(heart,'Ø Herzfrequenz',230)
      const rpeValue=numberField(rpe,'RPE',10,true)!
      await finalizeWorkout({date:actualDate,title:session?.title??runInstructions.title,planned:session,durationMin,
        rpe:rpeValue,notes,sessionType:'manual-running',distanceKm:km,avgHrBpm,freeKey})
      setData(await loadWorkoutData());setMessage('Lauf absolviert ✓ · Dauer, Distanz, RPE und optional Puls gespeichert.')
    }catch(err){setMessage(`Nicht gespeichert: ${err instanceof Error?err.message:String(err)}`)}finally{setBusy(false)}
  }
  return <div className="tw-stack">
    <section className="panel tw-panel"><div className="eyebrow">LAUFEN · KONSERVATIVER AUFBAU</div><h2>Locker laufen, konstant aufbauen</h2>
      <p>Der Laufteil startet bewusst behutsam: erst Umfang und Sehnenverträglichkeit, später gezielte Geschwindigkeit. Aktuell keine harten 800-m- oder 1.000-m-Intervalle.</p>
      <div className="tw-form-grid"><label>Geplante Laufeinheit<select value={plannedId} onChange={e=>{
        setPlannedId(e.target.value);const item=planned.find(x=>x.id===e.target.value);if(item){setDate(item.date);setDuration(String(item.durationMin||30))}else setDuration('30')
      }}><option value="">Freien Lauf erfassen</option>{planned.map(x=><option key={x.id} value={x.id}>{x.date} · {x.title}{x.status==='erledigt'?' ✓':''}</option>)}</select></label>
        {!session&&<label>Datum<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>}
      </div>
      <div className="tw-info"><strong>{session?.title??runInstructions.title} · {friendlyDate(actualDate)}</strong><span>RPE 3–4 · lockere Atmung · Gehpausen erlaubt</span><span>{runInstructions.note}</span></div>
      {warning&&<div className="tw-warning">{warning} Bei Unsicherheit Einheit auslassen oder verschieben.</div>}
      {done&&<div className="tw-success">Diese Einheit ist bereits als absolviert dokumentiert.</div>}
    </section>
    <section className="panel tw-panel"><div className="eyebrow">LAUFABLAUF · KEIN TEMPOZWANG</div><h3>Deine Einheit</h3>
      {runInstructions.steps.map((step,i)=><div className="tw-run-step" key={step.name}><span className="tw-number">{i+1}</span><div><strong>{step.name}</strong><p>{step.detail}</p></div></div>)}
      <p className="tw-footnote">Wähle die Gesamtdauer je nach geplanter Einheit und Tagesform. Steigt die muskuläre Belastung oder treten Schmerzen auf, beende den Lauf.</p>
    </section>
    <section className="panel tw-panel"><div className="eyebrow">LAUFFEEDBACK · ABSOLVIERT</div><h3>Ist-Werte eintragen</h3>
      <form onSubmit={e=>void submit(e)}><div className="tw-form-grid">
        <label>Dauer (Minuten)<input disabled={done} type="number" min="1" max="600" required value={duration} onChange={e=>setDuration(e.target.value)}/></label>
        <label>Distanz (km)<input disabled={done} type="number" min="0.01" max="150" step="0.01" required inputMode="decimal" value={distance} onChange={e=>setDistance(e.target.value)} placeholder="z. B. 5,0"/></label>
        <label>Ø Puls (optional)<input disabled={done} type="number" min="40" max="230" step="1" value={heart} onChange={e=>setHeart(e.target.value)} placeholder="z. B. 135"/></label>
        <label>RPE 1–10<select disabled={done} value={rpe} onChange={e=>setRpe(e.target.value)}>{Array.from({length:10},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
      </div><div className="tw-info"><strong>Errechnete Durchschnittspace</strong><span>{pace} · inklusive der von dir eingetragenen Zeit</span></div>
        <label className="tw-notes">Notizen<textarea disabled={done} value={notes} maxLength={1500} onChange={e=>setNotes(e.target.value)} placeholder="Beine, Untergrund, Gehpausen, Wetter, Beschwerden …"/></label>
        <div className="tw-actions"><button type="submit" disabled={busy||done}>{busy?'Speichere …':'Lauf abschließen ✓'}</button></div>
      </form><div className="tw-feedback" role="status">{message}</div>
    </section>
    <section className="panel tw-panel"><div className="eyebrow">LAUFEN · HISTORIE</div><h3>Zuletzt dokumentiert</h3>
      {history.length?history.map(x=><div className="tw-history" key={x.id}><strong>{friendlyDate(x.date)} · {x.title}</strong><span>{x.distanceKm??'–'} km · {x.durationMin??'–'} min · {typeof x.durationMin==='number' && typeof x.distanceKm==='number' && x.distanceKm>0 ? paceLabel(x.durationMin,x.distanceKm) : '–'} · RPE {x.rpe??'–'}</span></div>):<p>Noch kein Lauf abgeschlossen. Alte Garmin-CSV-Aktivitäten liegen weiterhin in der separaten Garmin-Bibliothek.</p>}
      <p className="tw-footnote">Läufe aus Garmin-FIT/CSV werden noch nicht automatisch mit manuell protokollierten Läufen zusammengeführt. Bitte dieselbe Aktivität nicht doppelt abschließen.</p>
    </section>
  </div>
}
