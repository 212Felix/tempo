import TimeFields from '../time/TimeFields'
import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {listRecords} from '../db/storage'
import type {GarminActivity} from '../garmin/csv'
import type {CompletedRecord} from '../planning/engine'
import {currentKey,PROFILE_ID,friendlyDate} from '../planning/engine'
import {defaultForm,saveManualCompleted} from '../planning/manual'
import {parseHms,durationFor} from '../time/duration'
import HelpDisclosure from '../ui/HelpDisclosure'
import '../workouts/workouts.css'
import './swimming.css'

type SwimEnvironment='pool'|'openwater'
type SwimFocus='locker'|'technik'|'ausdauer'|'intervalle'
const focusLabels:Record<SwimFocus,string>={locker:'Locker',technik:'Technik',ausdauer:'Ausdauer',intervalle:'Intervalle'}
export default function SwimmingPanel(){
  const [date,setDate]=useState(currentKey())
  const [duration,setDuration]=useState('00:30:00')
  const [meters,setMeters]=useState('')
  const [environment,setEnvironment]=useState<SwimEnvironment>('pool')
  const [focus,setFocus]=useState<SwimFocus>('locker')
  const [rpe,setRpe]=useState('')
  const [notes,setNotes]=useState('')
  const [completed,setCompleted]=useState<CompletedRecord[]>([])
  const [imports,setImports]=useState<GarminActivity[]>([])
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('Freies Schwimmen – keine Pflichttermine.')
  useEffect(()=>{let live=true
    const load=()=>void Promise.all([listRecords<CompletedRecord>('completedSessions'),listRecords<GarminActivity>('externalActivities')]).then(([c,g])=>{
      if(!live)return
      setCompleted(c.filter(x=>x.profileId===PROFILE_ID&&(x.sessionType==='manual-swimming')))
      setImports(g.filter(x=>x.profileId===PROFILE_ID&&x.sport==='swimming'))
    }).catch(err=>{if(live)setMessage('Datenbankfehler: '+String(err))})
    load();window.addEventListener('tempo:training-change',load)
    return()=>{live=false;window.removeEventListener('tempo:training-change',load)}
  },[])
  const history=useMemo(()=>[...completed.map(a=>({...a,sourceLabel:'TEMPO'})),...imports.map(a=>({...a,sourceLabel:'Garmin'}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8),[completed,imports])
  async function submit(e:FormEvent){
    e.preventDefault();if(busy)return
    setBusy(true)
    try{
      const seconds=parseHms(duration).seconds
      const distanceM=Number(meters.replace(',','.'))
      if(!Number.isFinite(distanceM)||distanceM<=0||distanceM>100000)throw Error('Bitte eine Strecke zwischen 1 und 100.000 Metern eingeben.')
      const km=Math.round(distanceM)/1000
      const previously=[...completed,...imports].filter(a=>a.date===date&&typeof a.distanceKm==='number'&&Math.abs(a.distanceKm-km)<=.05&& Math.abs(((('durationSec' in a && typeof a.durationSec==='number')?a.durationSec:(a.durationMin??0)*60)??0)-seconds)<=90)
      if(previously.length && !window.confirm('TEMPO hat für diesen Tag bereits eine Schwimmeinheit mit nahezu gleicher Dauer und Distanz gefunden (Garmin oder TEMPO). Möchtest du wirklich eine weitere, eigenständige Einheit speichern?'))return
      await saveManualCompleted({...defaultForm(date),date,sport:'swimming',title:'Schwimmen · frei',duration,distance:String(km),elevation:'',rpe,notes,swimEnvironment:environment,swimFocus:focus})
      setMessage('Schwimmen erfolgreich als freie Aktivität gespeichert ✓')
      setMeters('');setNotes('');setRpe('')
    }catch(err){setMessage('Nicht gespeichert: '+String(err instanceof Error?err.message:err))}
    finally{setBusy(false)}
  }
  return <div className="tw-stack tempo-swim-stack">
    <section className="panel tw-panel"><div className="eyebrow">AKTIVITÄTEN · SCHWIMMEN</div><h2>Schwimmen nach Lust & Zeit</h2>
      <p>Keine feste Schwimmplanung: Du erfasst eine Einheit nur dann, wenn du tatsächlich schwimmen gehst. Sie wird im Kalender und in der Statistik berücksichtigt.</p>
      <HelpDisclosure id="swim-help">Die Distanz erfasst du in Metern, zum Beispiel 750 m. TEMPO speichert intern Kilometer. Bereits über Garmin importierte Schwimmeinheiten müssen nicht nochmals von Hand protokolliert werden.</HelpDisclosure>
    </section>
    <section className="panel tw-panel"><div className="eyebrow">FREIE AKTIVITÄT</div><h3>Schwimmen protokollieren</h3>
      <form onSubmit={e=>void submit(e)}><div className="tw-form-grid">
        <label>Datum<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
        <TimeFields label="Schwimmdauer" value={duration} onChange={setDuration} required/>
        <label>Geschwommene Distanz (Meter)<input type="text" inputMode="decimal" required value={meters} placeholder="z. B. 750" onChange={e=>setMeters(e.target.value)}/></label>
        <label>Ort<select value={environment} onChange={e=>setEnvironment(e.target.value as SwimEnvironment)}><option value="pool">Schwimmbad</option><option value="openwater">Freiwasser</option></select></label>
        <label>Schwerpunkt<select value={focus} onChange={e=>setFocus(e.target.value as SwimFocus)}>{Object.entries(focusLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
        <label>RPE 1–10 (optional)<select value={rpe} onChange={e=>setRpe(e.target.value)}><option value="">Nicht erfasst</option>{Array.from({length:10},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
      </div>
      <label className="tw-notes">Notizen (optional)<textarea rows={3} maxLength={1500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Gefühl, Bahn, Technik, Begleitung …"/></label>
      <div className="tw-actions"><button disabled={busy} type="submit">{busy?'Speichere …':'Schwimmen speichern ✓'}</button></div>
      </form><div className="tw-feedback" role="status">{message}</div>
    </section>
    <section className="panel tw-panel"><div className="eyebrow">DEINE SCHWIMMHISTORIE</div><h3>Letzte Einheiten</h3>
      {history.length?history.map(x=><div key={x.id} className="tw-history"><strong>{friendlyDate(x.date)} · {x.sourceLabel}</strong><span>{typeof x.distanceKm==='number'?`${Math.round(x.distanceKm*1000)} m`:'Distanz offen'} · {durationFor(x)}</span></div>):<p>Keine Schwimmeinheit erfasst oder importiert.</p>}
      <p className="tempo-swim-note">Garmin-Originaldaten und freie TEMPO-Einträge bleiben unterscheidbar. Bereits erfasste Einheiten werden nicht als neue Pflichttermine eingeplant.</p>
    </section>
  </div>
}
