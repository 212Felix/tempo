import {activeGarminActivities} from '../garmin/stored-duplicates'
import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {deleteRecord,getRecord,listRecords,saveRecord} from '../db/storage'
import type {ProfileRecord} from '../db/types'
import type {GarminActivity} from '../garmin/csv'
import type {GoalEvent} from '../events/library'
import {PROFILE_ID,currentKey} from '../planning/engine'
import {STRENGTH} from '../workouts/catalog'
import type {StrengthSet} from '../workouts/sessionStore'
import {METRIC_OPTIONS,latestPerMetric,validPerformanceValue,type MetricCode,type MetricSport,type PerformanceEntry} from './library'
import {displayDuration,paceText} from '../events/running'
import {formatSeconds,parseHms} from '../time/duration'
import TimeFields from '../time/TimeFields'
import HelpDisclosure from '../ui/HelpDisclosure'
import './metrics.css'

const format=(n:number,decimals=1)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:decimals}).format(n)
const sportLabels:Record<MetricSport,string>={cycling:'Radfahren',running:'Laufen',strength:'Krafttraining'}
export default function MetricsPanel(){
  const [profile,setProfile]=useState<ProfileRecord>()
  const [activities,setActivities]=useState<GarminActivity[]>([])
  const [events,setEvents]=useState<GoalEvent[]>([])
  const [sets,setSets]=useState<StrengthSet[]>([])
  const [metrics,setMetrics]=useState<PerformanceEntry[]>([])
  const [sport,setSport]=useState<MetricSport>('cycling')
  const [code,setCode]=useState<MetricCode>('ftp')
  const [date,setDate]=useState(currentKey)
  const [value,setValue]=useState('')
  const [testTime,setTestTime]=useState('00:20:00')
  const [notes,setNotes]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('Lade Leistungsbibliothek …')
  async function reload(){
    const [p,a,e,strength,perfs]=await Promise.all([
      getRecord<ProfileRecord>('profiles',PROFILE_ID),listRecords<GarminActivity>('externalActivities').then(activeGarminActivities),
      listRecords<GoalEvent>('events'),listRecords<StrengthSet>('strengthSets'),listRecords<PerformanceEntry>('performanceEntries')])
    setProfile(p)
    setActivities(a.filter(r=>r.profileId===PROFILE_ID && (r.source==='garmin-csv'||r.source==='garmin-fit'||r.source==='garmin-personal')))
    setEvents(e.filter(r=>r.profileId===PROFILE_ID))
    setSets(strength.filter(r=>r.profileId===PROFILE_ID))
    setMetrics(perfs.filter(r=>r.profileId===PROFILE_ID && r.kind==='tempo-measured-performance'))
    setMessage('Gespeicherte Leistungsdaten geladen. Garmin-Trainingswerte sind keine automatischen FTP-Tests.')
  }
  useEffect(()=>{let active=true
    const load=()=>void Promise.all([
      getRecord<ProfileRecord>('profiles',PROFILE_ID),listRecords<GarminActivity>('externalActivities').then(activeGarminActivities),
      listRecords<GoalEvent>('events'),listRecords<StrengthSet>('strengthSets'),listRecords<PerformanceEntry>('performanceEntries')
    ]).then(([p,a,e,strength,perfs])=>{
      if(!active)return
      setProfile(p);setActivities(a.filter(r=>r.profileId===PROFILE_ID));setEvents(e.filter(r=>r.profileId===PROFILE_ID))
      setSets(strength.filter(r=>r.profileId===PROFILE_ID));setMetrics(perfs.filter(r=>r.profileId===PROFILE_ID&&r.kind==='tempo-measured-performance'))
      setMessage('Daten geladen. Neue Messungen kannst du unten protokollieren.')
    }).catch(error=>{if(active)setMessage('Fehler beim Laden: '+String(error))})
    load();window.addEventListener('tempo:training-change',load);window.addEventListener('tempo:events-change',load)
    return()=>{active=false;window.removeEventListener('tempo:training-change',load);window.removeEventListener('tempo:events-change',load)}
  },[])
  const latest=useMemo(()=>latestPerMetric(metrics),[metrics])
  const available=(Object.entries(METRIC_OPTIONS) as [MetricCode,typeof METRIC_OPTIONS[MetricCode]][]).filter(([,m])=>m.sport===sport)
  const cfg=METRIC_OPTIONS[code]
  const cycling=activities.filter(a=>a.sport==='cycling')
  const running=activities.filter(a=>a.sport==='running')
  const garminWithPower=cycling.filter(a=>typeof a.avgPowerW==='number')
  const strengthValues=sets.filter(r=>typeof r.weightKg==='number' && r.weightKg>0)
  const maxStrength=useMemo(()=>{
    const out:Record<string,StrengthSet>={}
    for(const row of strengthValues){
      const key=[row.exerciseId,row.exerciseVariant??'',row.trainingLocation??''].join(':')
      if(!out[key]||(out[key].weightKg??0)<(row.weightKg??0))out[key]=row
    }
    return Object.values(out).sort((a,b)=>(b.date.localeCompare(a.date))).slice(0,8)
  },[sets])
  const exerciseNames=Object.values(STRENGTH).flatMap(t=>t.exercises)
  const cooper=events.find(e=>e.runningKind==='cooper'&&e.status!=='abgeschlossen')
  async function submit(ev:FormEvent){
    ev.preventDefault();if(busy)return
    const number=cfg.kind==='time'?(()=>{try{return parseHms(testTime).seconds}catch{return NaN}})():Number(value.replace(',','.'))
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(`${date}T12:00:00`).getTime())){setMessage('Datum ungültig.');return}
    if(!validPerformanceValue(code,number)){setMessage('Bitte einen gültigen Messwert eintragen. Für Laufzeiten alle drei Felder verwenden.');return}
    setBusy(true)
    try{
      const now=new Date().toISOString()
      await saveRecord('performanceEntries',{id:`metric:${PROFILE_ID}:${now}:${Math.random().toString(36).slice(2)}`,profileId:PROFILE_ID,createdAt:now,updatedAt:now,kind:'tempo-measured-performance',date,code,value:number,notes:notes.slice(0,500)} as PerformanceEntry)
      await reload();setNotes('');setValue('');setMessage('Leistungswert gespeichert ✓ · Bestehende Trainings und Garmin-Messkurven bleiben unverändert.')
    }catch(error){setMessage('Speichern fehlgeschlagen: '+String(error))}finally{setBusy(false)}
  }
  const remove=async(row:PerformanceEntry)=>{
    if(!window.confirm('Diesen selbst eingetragenen Leistungswert löschen? Historische Trainings bleiben erhalten.'))return
    try{await deleteRecord('performanceEntries',row.id);await reload()}catch(e){setMessage('Löschen fehlgeschlagen: '+String(e))}
  }
  return <div className="tempo-metrics">
    <section className="panel tempo-metrics-panel">
      <div className="eyebrow">LEISTUNG · DEIN DATENSTAND</div><h2>Deine Leistungswerte</h2>
      <HelpDisclosure id="metrics-basics">Die Werte stammen aus deinem Profil, tatsächlich importierten Garmin-Aktivitäten und manuell protokollierten Tests. Eine einzelne Tour oder eine maximale Sekunde ist kein FTP-Test. TEMPO erfindet keine Leistungswerte.</HelpDisclosure>
      <div className="tempo-metrics-grid">
        <div><small>FTP (Profil)</small><strong>{profile?.ftpWatts?`${profile.ftpWatts} W`:'Nicht erfasst'}</strong></div>
        <div><small>Watt pro kg</small><strong>{profile?.ftpWatts&&profile?.weightKg?format(profile.ftpWatts/profile.weightKg,2):'–'}</strong></div>
        <div><small>Max. Herzfrequenz</small><strong>{profile?.maxHeartRateBpm?`${profile.maxHeartRateBpm} bpm`:'Nicht erfasst'}</strong></div>
        <div><small>Körpergewicht</small><strong>{profile?.weightKg?`${format(profile.weightKg)} kg`:'Nicht erfasst'}</strong></div>
      </div>
      <p className="tempo-metrics-note">FTP, Gewicht und HFmax bearbeitest du wie bisher unter „Profil & Daten“. Ein hier dokumentierter FTP-Test ändert deine Wattzonen nicht automatisch; die Profil-FTP musst du bewusst aktualisieren.</p>
    </section>
    <section className="panel tempo-metrics-panel">
      <div className="eyebrow">DEINE DATEN · GARMIN & TRAINING</div><h2>Aktivitäten als Grundlage</h2>
      <div className="tempo-metrics-grid"><div><small>Garmin-Radfahrten</small><strong>{cycling.length}</strong></div><div><small>Garmin-Läufe</small><strong>{running.length}</strong></div><div><small>Radfahrten mit Ø Watt</small><strong>{garminWithPower.length}</strong></div><div><small>Gespeicherte Krafteinzelsätze</small><strong>{sets.length}</strong></div></div>
      <HelpDisclosure id="metrics-data-note">Die Aktivitätszahlen sind Bibliothekseinträge, keine deduplizierte Trainingsstatistik. Für aggregierte Kilometer und Indoor-/Outdoorfahrten bitte „Fortschritt“ verwenden. Garmin-Schnittwerte ersetzen keine Leistungsdiagnostik.</HelpDisclosure>
      {maxStrength.length>0&&<><h3>Bisherige Satzgewichte</h3><div className="tempo-metrics-list">{maxStrength.map(r=><div key={r.id}><strong>{r.exerciseVariant??exerciseNames.find(x=>x.id===r.exerciseId)?.name??r.exerciseId}</strong><span>{format(r.weightKg??0)} kg · {r.reps??'–'} Wdh. · {r.trainingLocation==='studio'?'Studio':r.trainingLocation==='arbeit'?'Arbeit':'Ort offen'}</span></div>)}</div><p className="tempo-metrics-note">Höchstes gespeichertes Satzgewicht je Übung, Gerätevariante und Trainingsort; kein berechnetes 1RM.</p></>}
      {cooper&&<div className="tempo-metrics-highlight"><strong>Cooper-Ziel · {format((cooper.distanceKm??3.2)*1000,0)} m in {displayDuration(cooper.targetSeconds??720)}</strong><span>{paceText(cooper.distanceKm,cooper.targetSeconds)} · {cooper.date?`Test am ${cooper.date}`:'Datum noch offen'}</span></div>}
    </section>
    <section className="panel tempo-metrics-panel">
      <div className="eyebrow">TESTS & BESTLEISTUNGEN</div><h2>Leistungswert hinzufügen</h2>
      <div className="tempo-metrics-bubbles" role="group" aria-label="Sportart für Messwert">{(['cycling','running','strength'] as const).map(s=><button type="button" key={s} className={sport===s?'active':''} aria-pressed={sport===s} onClick={()=>{setSport(s);setCode(s==='cycling'?'ftp':s==='running'?'run5k':'squat');setValue('')}}>{sportLabels[s]}</button>)}</div>
      <form onSubmit={e=>void submit(e)}>
        <label>Messwertart<select value={code} onChange={e=>{setCode(e.target.value as MetricCode);setValue('')}}>{available.map(([id,item])=><option key={id} value={id}>{item.name}</option>)}</select></label>
        <label>Datum<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
        {cfg.kind==='time'?<TimeFields label="Tatsächliche Zeit" value={testTime} onChange={setTestTime} required maxHours={10}/>:<label>Gemessener Wert ({cfg.unit})<input type="number" required min="0" max={cfg.max} step="any" inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></label>}
        <label>Notiz / Testbedingungen (optional)<textarea rows={2} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Gerät, Strecke, Testart …"/></label>
        <button type="submit" disabled={busy}>{busy?'Speichere …':'Leistungswert speichern'}</button>
      </form><p role="status" className="tempo-metrics-note">{message}</p>
      {metrics.length>0&&<><h3>Deine protokollierten Bestwerte</h3><div className="tempo-metrics-list">{(Object.keys(METRIC_OPTIONS) as MetricCode[]).filter(id=>latest[id]).map(id=>{const item=latest[id]!;const option=METRIC_OPTIONS[id];return <div key={id}><div><strong>{option.name}</strong><span>{item.date} · {option.kind==='time'?formatSeconds(item.value):`${format(item.value)} ${option.unit}`}</span></div><button type="button" onClick={()=>void remove(item)} aria-label={`${option.name} löschen`}>Löschen</button></div>})}</div></>}
    </section>
  </div>
}
