import {useEffect,useState} from 'react'
import {listRecords} from '../db/storage'
import {currentKey, friendlyDate, PROFILE_ID, type TrainingRecord} from './engine'
import ManualTrainingPanel from './ManualTrainingPanel'
import DailyDecisionPanel from './DailyDecisionPanel'
import './plan.css'

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
    <p>{pending.length?`${pending[0].durationMin?pending[0].durationMin+' min':'Dauer offen'} · ${pending[0].priority}${pending.length>1?` · +${pending.length-1} weitere`:''}`:today.length?'Heute bisher dokumentierte Einheiten abgeschlossen.':'Dienste unter „14 Tage“ bestätigen oder selbst eine Trainingseinheit anlegen.'}</p>
    <button className="text-action" onClick={onOpen}>Tagestraining öffnen →</button></section>
}
export {HomeTrainingCard}

const askAdd=(date:string)=>window.dispatchEvent(new CustomEvent('tempo:manual-add',{detail:date}))
const askEdit=(id:string)=>window.dispatchEvent(new CustomEvent('tempo:manual-edit',{detail:{kind:'planned',id}}))
const askDone=(id:string)=>window.dispatchEvent(new CustomEvent('tempo:manual-finish',{detail:id}))

export default function TrainingDayPanel({onOpenReadiness}:{onOpenReadiness:()=>void}){
  const [entries,setEntries]=useState<TrainingRecord[]>([])
  const [selected,setSelected]=useState('')
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
  const dates=[...new Set(entries.map(x=>x.date))].sort()
  const selectedDay=selected||dates.find(x=>x>=today)||dates[dates.length-1]||today
  const atDate=entries.filter(x=>x.date===selectedDay)
  const pos=dates.indexOf(selectedDay)
  return <div className="tempo-workout">
    <DailyDecisionPanel onOpenReadiness={onOpenReadiness}/>
    <section className="panel tempo-workout-head">
      <div className="eyebrow">TAGESTRAINING · DEIN KALENDER</div>
      <h2>Training selbst gestalten</h2>
      <p>Du kannst an jedem Tag eigene Trainings ergänzen und gespeicherte Einheiten bearbeiten oder verschieben – auch an freien Tagen und zusätzlich zu vorgeschlagenen Workouts.</p>
      <div className="tempo-workout-nav"><button disabled={pos<=0} onClick={()=>setSelected(dates[pos-1])}>‹ Vorheriges Training</button><strong>{friendlyDate(selectedDay)}</strong><button disabled={pos<0||pos>=dates.length-1} onClick={()=>setSelected(dates[pos+1])}>Nächstes Training ›</button></div>
      <div className="tempo-manual-actions"><button onClick={()=>askAdd(selectedDay)}>＋ Training ergänzen</button><button className="outline" onClick={()=>document.querySelector('#tempo-own-training')?.scrollIntoView({behavior:'smooth'})}>Freies Training protokollieren ↓</button></div>
    </section>
    {loading?<section className="panel tempo-workout-detail"><p>{notice}</p></section>:atDate.length?atDate.map(x=><section className="panel tempo-workout-detail" key={x.id}>
      <div className="eyebrow">{x.status==='erledigt'?'✓ ABSOLVIERT':x.createdBy==='tempo-user'?'VON DIR GEPLANT':'TEMPO-VORSCHLAG'} · {x.priority}</div>
      <h3>{x.title}</h3><p>{x.durationMin?`${x.durationMin} min · `:''}{x.description}</p>
      <div className="tempo-workout-badges"><span>{x.target}</span>{x.expectedKm?<span>{x.expectedKm} km</span>:null}</div>
      {x.notes&&<p style={{marginTop:12}}>{x.notes}</p>}
      {x.status!=='erledigt'&&<div className="tempo-manual-entry-actions"><button onClick={()=>askEdit(x.id)}>Bearbeiten / verschieben</button><button onClick={()=>askDone(x.id)}>Als absolviert erfassen</button></div>}
    </section>):<section className="panel tempo-workout-detail"><h3>Kein Training für diesen Tag geplant</h3><p>Du kannst selbst ein Training hinzufügen oder unter „14 Tage“ einen Entwurf bestätigen.</p></section>}
    <ManualTrainingPanel/>
  </div>
}
