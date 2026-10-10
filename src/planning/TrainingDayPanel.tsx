import {useEffect,useMemo,useState} from 'react'
import {listRecords} from '../db/storage'
import {currentKey, friendlyDate, PROFILE_ID, type TrainingRecord} from './engine'
import './plan.css'

function HomeTrainingCard({onOpen}:{onOpen:()=>void}) {
  const [today,setToday] = useState<TrainingRecord | null>(null)
  useEffect(() => {let live = true; void listRecords<TrainingRecord>('plannedSessions').then(entries=>{
    if (!live) return
    setToday(entries.find(x=>x.profileId===PROFILE_ID && x.date===currentKey())??null)
  }).catch(()=>undefined);return()=>{live=false}},[])
  return <section className="panel status-card"><div className="card-heading"><div className="eyebrow">HEUTIGES TRAINING</div><span className="mini-dot silver"/></div><h3>{today?.title??'Noch nicht geplant'}</h3><p>{today ? `${today.durationMin ? today.durationMin+' min' : 'Dauer offen'} · ${today.priority} · ${today.target}` : 'Dienste unter „14 Tage“ bestätigen und Trainingsvorschläge übernehmen.'}</p><button className="text-action" onClick={onOpen}>Tagestraining öffnen →</button></section>
}
export { HomeTrainingCard }

export default function TrainingDayPanel() {
  const [entries,setEntries] = useState<TrainingRecord[]>([])
  const [pos,setPos] = useState(0)
  const [notice,setNotice] = useState('Gespeicherte Einheiten werden geladen …')
  const today = currentKey()
  useEffect(()=>{let live=true;void listRecords<TrainingRecord>('plannedSessions').then(records=>{
    if(!live)return
    const filtered=records.filter(x=>x.profileId===PROFILE_ID && x.status==='geplant').sort((a,b)=>a.date.localeCompare(b.date))
    setEntries(filtered);setPos(Math.max(0,filtered.findIndex(x=>x.date>=today)));setNotice(filtered.length?'':'Noch kein Trainingsplan gespeichert. Bitte unter „14 Tage“ einen Plan übernehmen.')
  }).catch(err=>{if(live)setNotice(`Datenbankfehler: ${String(err)}`)});return()=>{live=false}},[today])
  const item = entries[pos]
  const allUpcoming = useMemo(()=>entries.filter(x=>x.date>=today).length,[entries,today])
  return <div className="tempo-workout">
    {item ? <>
      <section className="panel tempo-workout-head"><div className="eyebrow">TAGES­TRAINING · GESPEICHERTER PLAN</div>
        <div className="tempo-workout-nav"><button disabled={pos===0} onClick={()=>setPos(pos-1)}>‹ Vorheriges</button><strong>{friendlyDate(item.date)}</strong><button disabled={pos===entries.length-1} onClick={()=>setPos(pos+1)}>Nächstes ›</button></div>
        <div className="tempo-workout-badges"><span>{item.priority}</span><span>{item.durationMin ? item.durationMin+' Minuten' : 'Dauer offen'}</span>{item.expectedKm?<span>{item.expectedKm} km</span>:null}</div>
        <h2>{item.title}</h2><p>{item.description}</p>
      </section>
      <section className="panel tempo-workout-detail"><div className="eyebrow">TRAININGSVORGABE</div><h3>{item.target}</h3><p>{item.notes||'Training kontrolliert nach aktueller Tagesform durchführen.'}</p></section>
      <section className="panel tempo-workout-detail"><div className="eyebrow">WICHTIG</div><p>Dies ist der erste gespeicherte Planungsentwurf. Der Abgleich mit Readiness, das Verschieben einzelner Einheiten und die vollständige Erledigt-/RPE-/Fueling-Erfassung folgen in den nächsten Ausbaustufen. Bei Krankheit oder ungewöhnlicher Ermüdung keine harte Einheit erzwingen.</p><p>Es gibt derzeit {allUpcoming} zukünftige geplante Einheiten.</p></section>
    </> : <section className="panel tempo-workout-detail"><h2>Kein Training gespeichert</h2><p>{notice}</p></section>}
  </div>
}
