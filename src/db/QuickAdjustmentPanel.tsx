import { useEffect, useState } from 'react'
import { getRecord, listRecords, saveRecord } from './storage'
import type { ProfileRecord } from './types'
import type { CommuteKind, ShiftKind, ShiftRecord, TrainingRecord } from '../planning/engine'
import HelpDisclosure from '../ui/HelpDisclosure'
import './quick-adjust.css'

const PROFILE_ID = 'local-primary-profile'
const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}
const commuteOptions: { value: CommuteKind; label: string }[] = [
  { value: 'nein', label: 'Kein Radpendeln' },
  { value: 'hin', label: 'Nur Hinfahrt' },
  { value: 'zurueck', label: 'Nur Heimfahrt' },
  { value: 'beide', label: 'Hin & zurück' },
]
const shiftOptions: {value:Exclude<ShiftKind,'offen'>;label:string}[] = [
  {value:'frei',label:'Frei'}, {value:'tagdienst',label:'Tagdienst'}, {value:'einsatz',label:'Einsatz'},
]
const displayDate = (key: string) => new Intl.DateTimeFormat('de-DE', {
  weekday:'long',day:'numeric',month:'long',year:'numeric',
}).format(new Date(`${key}T12:00:00`))

/** Kompakter Dienst-/Radpendel-Editor. Keine Trainingsabschlüsse, kein automatisches Löschen. */
export default function QuickAdjustmentPanel({onSaved}:{onSaved:(record:ShiftRecord)=>void}) {
  const [expanded,setExpanded] = useState(false)
  const [date,setDate] = useState(todayKey)
  const [kind,setKind] = useState<Exclude<ShiftKind,'offen'>>('frei')
  const [commute,setCommute] = useState<CommuteKind>('nein')
  const [oneWayKm,setOneWayKm] = useState<number|null>(null)
  const [planned,setPlanned] = useState<TrainingRecord[]>([])
  const [busy,setBusy] = useState(false)
  const [loading,setLoading] = useState(true)
  const [message,setMessage] = useState('Tag auswählen und Verfügbarkeit prüfen.')
  useEffect(()=>{
    let live = true
    setLoading(true)
    void Promise.all([
      getRecord<ShiftRecord>('shifts',`${PROFILE_ID}:${date}`),
      getRecord<ProfileRecord>('profiles',PROFILE_ID),
      listRecords<TrainingRecord>('plannedSessions'),
    ]).then(([entry,profile,sessions])=>{
      if(!live) return
      const savedKind=entry?.shift
      setKind(savedKind==='tagdienst'||savedKind==='einsatz'||savedKind==='frei'?savedKind:'frei')
      setCommute(savedKind==='tagdienst'?entry?.commute??'nein':'nein')
      setOneWayKm(profile?.commuteOneWayKm??null)
      setPlanned(sessions.filter(item=>item.profileId===PROFILE_ID && item.date===date && item.status==='geplant'))
      setLoading(false)
    }).catch(error=>{if(live){setLoading(false);setMessage(`Tag konnte nicht geladen werden: ${String(error)}`)}})
    return()=>{live=false}
  },[date])
  const km = commute==='nein'?0:(oneWayKm??0)*(commute==='beide'?2:1)
  async function save() {
    if(loading||busy||!/\d{4}-\d{2}-\d{2}/.test(date)) return
    if(kind==='einsatz' && planned.length>0 && !window.confirm('Für diesen Tag existiert bereits ein geplantes Training. Der Einsatz wird gespeichert, das Training bleibt zunächst bestehen. Danach bitte den Belastungskonflikt prüfen. Fortfahren?'))return
    if(commute!=='nein' && planned.length>0 && !window.confirm('An diesem Tag stehen bereits Trainingseinheiten im Kalender. Radpendeln wird im Dienstplan vermerkt; bestehende Einheiten bleiben erhalten und müssen auf Doppelbelastung geprüft werden. Fortfahren?'))return
    setBusy(true)
    try {
      const previous = await getRecord<ShiftRecord>('shifts',`${PROFILE_ID}:${date}`)
      const now=new Date().toISOString()
      const record:ShiftRecord = {
        ...previous, id:`${PROFILE_ID}:${date}`, profileId:PROFILE_ID,date,
        shift:kind, commute:kind==='tagdienst'?commute:'nein',
        homeIntervals:kind==='tagdienst' && commute===previous?.commute ? Boolean(previous.homeIntervals) : false,
        workStrength:kind==='tagdienst'?Boolean(previous?.workStrength):false,
        workRun:kind==='tagdienst'?Boolean(previous?.workRun):false,
        afterWorkStrength:kind==='tagdienst'?Boolean(previous?.afterWorkStrength):false,
        afterWorkRun:kind==='tagdienst'?Boolean(previous?.afterWorkRun):false,
        afterWorkCycling:kind==='tagdienst'?Boolean(previous?.afterWorkCycling):false,
        afterWorkRide:kind==='tagdienst'?(previous?.afterWorkRide??'egal'):'egal',
        createdAt:previous?.createdAt??now, updatedAt:now,
      }
      await saveRecord('shifts',record)
      onSaved(record)
      setExpanded(false)
      setMessage(`${displayDate(date)}: ${kind==='tagdienst'?'Tagdienst':kind==='einsatz'?'Einsatz':'Frei'}${record.commute!=='nein'?' mit Radpendeln':''} gespeichert ✓ Nächsten Planvorschlag bewusst prüfen und erst dann übernehmen.`)
    } catch(error) {setMessage(`Nicht gespeichert: ${error instanceof Error?error.message:String(error)}`)}
    finally {setBusy(false)}
  }
  return <section className="panel tempo-quick" aria-label="Schnelle Tagesänderung">
    <div className="eyebrow">WETTER · DIENST · RADPENDELN</div>
    <div className="tempo-quick-head"><h2>Schnell anpassen</h2><button type="button" aria-expanded={expanded} className="tempo-quick-expand" onClick={()=>setExpanded(x=>!x)}>{expanded?'Schließen −':'Änderung eingeben ＋'}</button></div>
    {expanded && <>
    <HelpDisclosure id="quick-change-help"><p>Hier änderst du die Verfügbarkeit für einen Tag und entscheidest wetterabhängig über Radpendeln. Das speichert den Dienstplan, <strong>nicht</strong> automatisch eine absolvierte Fahrt. Für einen neuen Trainingsvorschlag anschließend die Planung unten prüfen. Eigene Trainings werden nicht gelöscht.</p></HelpDisclosure>
    <div className="tempo-quick-date"><label htmlFor="tempo-quick-date">Tag auswählen</label><input id="tempo-quick-date" type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
    <div className="tempo-quick-group"><strong>Dienst / Verfügbarkeit</strong><div className="tempo-quick-options" role="group" aria-label="Dienststatus">{shiftOptions.map(option=><button type="button" key={option.value} disabled={loading||busy} aria-pressed={kind===option.value} className={kind===option.value?'selected':''} onClick={()=>{setKind(option.value);if(option.value!=='tagdienst')setCommute('nein')}}>{option.label}</button>)}</div></div>
    {kind==='tagdienst' && <div className="tempo-quick-group"><strong>Wetterabhängig mit dem Rad zur Arbeit?</strong><div className="tempo-quick-options" role="group" aria-label="Radpendelrichtung">{commuteOptions.map(option=><button type="button" key={option.value} disabled={loading||busy} aria-pressed={commute===option.value} className={commute===option.value?'selected':''} onClick={()=>setCommute(option.value)}>{option.label}</button>)}</div>
      {commute!=='nein' && <p className="tempo-quick-summary">{oneWayKm!=null && oneWayKm>0?`Geplant: ${km.toLocaleString('de-DE')} km (${oneWayKm.toLocaleString('de-DE')} km je Richtung).`:'Kilometer im Profil noch nicht hinterlegt.'} Hinfahrt möglichst locker, keine Intervalle im Straßenverkehr.</p>}
    </div>}
    {planned.length>0 && <div className="tempo-quick-warning"><strong>{planned.length} geplante Einheit{planned.length===1?'':'en'} bereits vorhanden</strong><span>{planned.map(item=>item.title).join(' · ')}</span><span>Bestehende Einheiten werden nicht automatisch gelöscht oder als absolviert gezählt. Bei Pendeln bitte Gesamtbelastung und Überschneidungen prüfen.</span></div>}
    <div className="tempo-quick-actions"><button type="button" disabled={loading||busy} className="tempo-quick-save" onClick={()=>void save()}>{busy?'Speichere …':'Änderung speichern'}</button><button type="button" className="tempo-quick-own" onClick={()=>{setExpanded(false);window.dispatchEvent(new CustomEvent('tempo:manual-add',{detail:date}))}}>＋ Eigenes Training planen</button></div>
    </>}
    <p role="status" className="tempo-quick-feedback">{message}</p>
  </section>
}
