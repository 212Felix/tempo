import { useEffect, useState } from 'react'
import { getRecord, saveRecord } from '../db/storage'
import { PROFILE_ID, type ShiftRecord } from './engine'
import {AVAILABILITY_CHOICES,availabilityFlag,type AvailabilityKey} from './availability'

// The calendar tile opens this day-specific editor. Existing unknown/legacy fields
// are preserved by spreading the previous record at commit time.
type Service = 'offen' | 'frei' | 'tagdienst' | 'einsatz'
type Commute = 'nein' | 'hin' | 'zurueck' | 'beide'
type Available = AvailabilityKey
type Values = {
  shift: Service
  commute: Commute
  possibleStrength: boolean
  possibleRun: boolean
  possibleYoga: boolean
  possibleStabi: boolean
  afterWorkCycling: boolean
  homeIntervals: boolean
}
const defaults:Values = {shift:'offen',commute:'nein',possibleStrength:false,possibleRun:false,possibleYoga:false,possibleStabi:false,afterWorkCycling:false,homeIntervals:false}
const fromRecord = (record?: ShiftRecord): Values => ({
  ...defaults,
  shift: record?.shift === 'frei' || record?.shift === 'tagdienst' || record?.shift === 'einsatz' ? record.shift : 'offen',
  commute: record?.commute === 'hin' || record?.commute === 'zurueck' || record?.commute === 'beide' ? record.commute : 'nein',
  possibleStrength: availabilityFlag(record,'possibleStrength'),possibleRun:availabilityFlag(record,'possibleRun'),
  possibleYoga: availabilityFlag(record,'possibleYoga'),possibleStabi:availabilityFlag(record,'possibleStabi'),
  afterWorkCycling:Boolean(record?.afterWorkCycling),homeIntervals:Boolean(record?.homeIntervals),
})
export default function DayShiftEditor({date,openOnMount=false}:{date:string;openOnMount?:boolean}) {
  const [values,setValues] = useState<Values>(defaults)
  const [saved,setSaved] = useState<ShiftRecord | undefined>()
  const [busy,setBusy] = useState(false)
  const [notice,setNotice] = useState('Dienst wird geladen …')
  const [ready,setReady] = useState(false)
  useEffect(()=>{if(!openOnMount)return;const id=window.setTimeout(()=>document.querySelector('.tempo-28-day-shift')?.scrollIntoView({behavior:'smooth',block:'center'}),80);return()=>window.clearTimeout(id)},[openOnMount])
  useEffect(()=>{
    let active=true
    setReady(false)
    void getRecord<ShiftRecord>('shifts',`${PROFILE_ID}:${date}`)
      .then(row=>{if(active){setSaved(row);setValues(fromRecord(row));setReady(true);setNotice('Dienst und Pendeln bei Bedarf ändern.')}})
      .catch(error=>{if(active){setReady(false);setNotice(`Dienst konnte nicht geladen werden: ${String(error)}`)}})
    return()=>{active=false}
  },[date])
  const patch=(update:Partial<Values>)=>setValues(current=>({...current,...update}))
  async function commit(){
    if(!ready||busy)return
    if(values.shift==='offen'){setNotice('Bitte Frei, Tagdienst oder Einsatz wählen.');return}
    setBusy(true)
    try{
      // Read immediately before save to preserve any fields that other Phase-27
      // modules added (e.g. afterWorkRide, date or notes).
      const latest=await getRecord<ShiftRecord>('shifts',`${PROFILE_ID}:${date}`)
      const now=new Date().toISOString()
      const result:ShiftRecord={
        ...latest,id:`${PROFILE_ID}:${date}`,profileId:PROFILE_ID,date,
        createdAt:latest?.createdAt||now,updatedAt:now,shift:values.shift,
        commute:values.shift==='tagdienst'?values.commute:'nein',
        possibleStrength:values.shift==='tagdienst'&&values.possibleStrength,
        possibleRun:values.shift==='tagdienst'&&values.possibleRun,
        possibleYoga:values.shift==='tagdienst'&&values.possibleYoga,
        possibleStabi:values.shift==='tagdienst'&&values.possibleStabi,
        afterWorkCycling:values.shift==='tagdienst'&&values.afterWorkCycling,
        homeIntervals:values.shift==='tagdienst'&&['zurueck','beide'].includes(values.commute)&&values.homeIntervals,
      }
      await saveRecord('shifts',result)
      setSaved(result)
      window.dispatchEvent(new Event('tempo:shift-change'))
      setNotice('Dienst und Pendeln gespeichert ✓ · Bereits geplante Trainings bleiben unverändert.')
    }catch(error){setNotice(`Speichern fehlgeschlagen: ${String(error)}`)}
    finally{setBusy(false)}
  }
  return <details className="panel tempo-28-day-shift" ref={element => {
    // <details> has no React defaultOpen prop. Set the initial state once,
    // then let the user expand or collapse the native element freely.
    if (element && !element.dataset.tempoInitialOpen) {
      element.open = openOnMount
      element.dataset.tempoInitialOpen = '1'
    }
  }}>
    <summary><strong>Dienst, Pendeln & Zeitfenster</strong><span>{saved?.shift==='tagdienst'?' · Tagdienst':saved?.shift==='frei'?' · Frei':saved?.shift==='einsatz'?' · Einsatz':' · Offen'} · bearbeiten</span></summary>
    <div className="tempo-28-shift-body">
      <p>Nur diesen Tag bearbeiten. Bestehende Trainingseinheiten werden nicht verändert.</p>
      <div className="tempo-28-choice-row" role="group" aria-label="Dienst">
        {(['frei','tagdienst','einsatz'] as Service[]).map(service=><button type="button" key={service} disabled={!ready||busy} aria-pressed={values.shift===service} className={values.shift===service?'selected':''} onClick={()=>patch({shift:service})}>{service==='frei'?'Frei':service==='tagdienst'?'Tagdienst':'Einsatz'}</button>)}
      </div>
      {values.shift==='tagdienst'&&<>
        <h3>Was ist trotz Dienst möglich?</h3>
        <div className="tempo-28-choice-row">{AVAILABILITY_CHOICES.map(choice=><button type="button" key={choice.key} disabled={!ready||busy} aria-pressed={values[choice.key]} className={values[choice.key]?'selected':''} onClick={()=>patch({[choice.key]:!values[choice.key]})}>{choice.symbol} {choice.label}</button>)}</div>
        <h3>Radfahren & Pendeln</h3>
        <div className="tempo-28-choice-row"><button type="button" disabled={!ready||busy} aria-pressed={values.afterWorkCycling} className={values.afterWorkCycling?'selected':''} onClick={()=>patch({afterWorkCycling:!values.afterWorkCycling})}>🚴 Rad nach Dienst</button></div>
        <div className="tempo-28-choice-row">{(['nein','hin','zurueck','beide'] as Commute[]).map(kind=><button type="button" key={kind} disabled={!ready||busy} aria-pressed={values.commute===kind} className={values.commute===kind?'selected':''} onClick={()=>patch({commute:kind,homeIntervals:kind==='hin'||kind==='nein'?false:values.homeIntervals})}>{kind==='nein'?'Kein Pendeln':kind==='hin'?'Hinfahrt':kind==='zurueck'?'Rückfahrt':'Hin & Rück'}</button>)}</div>
        {['zurueck','beide'].includes(values.commute)&&<label className="tempo-28-home-intervals"><input type="checkbox" checked={values.homeIntervals} onChange={e=>patch({homeIntervals:e.target.checked})}/> Rückfahrt für Intervalle möglich (nur auf geeigneten sicheren Strecken)</label>}
      </>}
      <button type="button" className="tempo-db-primary" disabled={!ready||busy} onClick={()=>void commit()}>{busy?'Speichert …':'Dienst & Pendeln speichern'}</button>
      <p role="status">{notice}</p>
    </div>
  </details>
}
