import {useEffect,useMemo,useState} from 'react'
import {getRecord,listRecords,saveRecord} from '../db/storage'
import type {ProfileRecord,TempoRecord} from '../db/types'
import type {GarminActivity} from '../garmin/csv'
import type {DoneWithContext,RideEnvironment,RideWithLocation} from '../stats/activity'
import {deNumber,resolvedEnvironment,rideSummary,unlinkedManualCycling,uniqueImported,emptyStat,addRide} from '../stats/activity'
import {PROFILE_ID} from '../planning/engine'
import {ZONE_SETTINGS_ID,RIDE_SETTINGS_ID,POWER_DEFAULT,HR_DEFAULT,powerZones,heartZones,validUpper,type ZonePreferences} from './zones'
import HelpDisclosure from '../ui/HelpDisclosure'
import './cycling.css'

const minFor=(range:string)=>{
  const today=new Date()
  if(range==='30'){today.setDate(today.getDate()-29);return today.toISOString().slice(0,10)}
  if(range==='year')return `${today.getFullYear()}-01-01`
  return ''
}
const dateDE=(key:string)=>key.split('-').reverse().join('.')
const targetNames=['Aktive Erholung','Grundlage','Tempo','Schwelle','VO₂max','Anaerob','Neuromuskulär']
const hrNames=['Regeneration','Locker','Aerob','Intensiv','Sehr hoch']

type Environments=TempoRecord & {overrides?:Record<string,RideEnvironment>}
export default function CyclingPanel(){
  const [profile,setProfile]=useState<ProfileRecord>()
  const [activities,setActivities]=useState<RideWithLocation[]>([])
  const [completed,setCompleted]=useState<DoneWithContext[]>([])
  const [overrides,setOverrides]=useState<Record<string,RideEnvironment>>({})
  const [powerPct,setPowerPct]=useState<number[]>(POWER_DEFAULT)
  const [hrPct,setHrPct]=useState<number[]>(HR_DEFAULT)
  const [editing,setEditing]=useState(false)
  const [range,setRange]=useState('all')
  const [notice,setNotice]=useState('Leistungswerte und Fahrten werden geladen …')
  const [busy,setBusy]=useState(false)
  async function reload(){
    const [p,a,c,z,e]=await Promise.all([
      getRecord<ProfileRecord>('profiles',PROFILE_ID),listRecords<RideWithLocation>('externalActivities'),
      listRecords<DoneWithContext>('completedSessions'),getRecord<ZonePreferences>('settings',ZONE_SETTINGS_ID),
      getRecord<Environments>('settings',RIDE_SETTINGS_ID),
    ])
    setProfile(p);setActivities(uniqueImported(a.filter(x=>x.profileId===PROFILE_ID&&x.sport==='cycling'&&(x.source==='garmin-csv'||x.source==='garmin-fit'||x.source==='garmin-personal'))))
    setCompleted(c.filter(x=>x.profileId===PROFILE_ID))
    if(z?.powerUpperPct&&validUpper(z.powerUpperPct,6))setPowerPct(z.powerUpperPct)
    if(z?.hrUpperPct&&validUpper(z.hrUpperPct,4))setHrPct(z.hrUpperPct)
    setOverrides(e?.overrides??{})
    setNotice('Aktivitäten und Zonen lokal geladen.')
  }
  useEffect(()=>{let active=true;void reload().catch(e=>{if(active)setNotice(`Ladefehler: ${String(e)}`)})
    const change=()=>void reload().catch(()=>undefined)
    window.addEventListener('tempo:training-change',change);return()=>{active=false;window.removeEventListener('tempo:training-change',change)}
  },[])
  const since=minFor(range)
  const filtered=useMemo(()=>activities.filter(a=>!since||a.date>=since).sort((a,b)=>b.date.localeCompare(a.date)),[activities,since])
  const totals=useMemo(()=>rideSummary(filtered,overrides),[filtered,overrides])
  const manual=useMemo(()=>unlinkedManualCycling(completed,since),[completed,since])
  const manualTotals=useMemo(()=>{const totals={indoor:emptyStat(),outdoor:emptyStat(),unknown:emptyStat()};for(const item of manual)addRide(totals[item.cyclingEnvironment??'unknown'],item);return totals},[manual])
  const ftp=profile?.ftpWatts
  const maxHr=profile?.maxHeartRateBpm
  async function saveZones(){
    if(!validUpper(powerPct,6)||!validUpper(hrPct,4)||hrPct[3]>100){setNotice('Ungültige Zonengrenzen: Werte müssen aufsteigend sein.');return}
    setBusy(true)
    try{const now=new Date().toISOString();await saveRecord('settings',{id:ZONE_SETTINGS_ID,profileId:PROFILE_ID,createdAt:now,updatedAt:now,powerUpperPct:powerPct,hrUpperPct:hrPct} as ZonePreferences);setEditing(false);setNotice('Zonengrenzen gespeichert ✓ · Werte folgen künftigen FTP-/HFmax-Änderungen.')}
    catch(err){setNotice('Speichern fehlgeschlagen: '+String(err))}finally{setBusy(false)}
  }
  async function saveEnvironment(id:string,kind:RideEnvironment){
    const newOverrides={...overrides,[id]:kind}
    try{const now=new Date().toISOString();await saveRecord('settings',{id:RIDE_SETTINGS_ID,profileId:PROFILE_ID,createdAt:now,updatedAt:now,overrides:newOverrides});setOverrides(newOverrides);setNotice('Indoor-/Outdoor-Zuordnung gespeichert ✓')}
    catch(err){setNotice('Zuordnung fehlgeschlagen: '+String(err))}
  }
  return <div className="cycle-stack">
    <section className="panel cycle-panel">
      <div className="eyebrow">RADFAHREN · DEINE LEISTUNG</div><h2>Watt- & Herzfrequenzzonen</h2>
      <HelpDisclosure id="cycle-zones">Zonengrenzen sind anfangs FTP-/HFmax-basierte Vorschläge und keine Live-Kopie deiner Garmin-Einstellungen. Du kannst die Grenzen in Prozent bearbeiten; FTP- und HFmax-Änderungen im Profil berechnen Watt und Puls automatisch neu. Nutze die angezeigten Werte als Orientierung.</HelpDisclosure>
      <div className="cycle-value-grid"><div><small>FTP aus Profil</small><strong>{ftp?`${ftp} W`:'Fehlt'}</strong></div><div><small>Maximale HF</small><strong>{maxHr?`${maxHr} bpm`:'Fehlt'}</strong></div><div><small>W/kg</small><strong>{ftp&&profile?.weightKg?`${deNumber(ftp/profile.weightKg,2)}`:'–'}</strong></div></div>
      <h3>Leistungszonen</h3>
      {ftp?powerZones(ftp,powerPct).map(zone=><div className="cycle-zone" key={zone.n}><span className="cycle-zone-tag" style={{background:zone.color}}>Z{zone.n}</span><span><strong>{targetNames[zone.n-1]}</strong><small>{zone.pct}</small></span><b>{zone.max===null?`ab ${zone.min} W`:`${zone.min}–${zone.max} W`}</b></div>):<p className="cycle-hint">Bitte zuerst deine FTP unter „Profil & Daten“ speichern.</p>}
      <h3>Herzfrequenzzonen</h3>
      {maxHr?heartZones(maxHr,hrPct).map(zone=><div className="cycle-zone" key={zone.n}><span className="cycle-zone-tag" style={{background:zone.color}}>Z{zone.n}</span><span><strong>{hrNames[zone.n-1]}</strong><small>HFmax-basiert</small></span><b>{zone.min}–{zone.max} bpm</b></div>):<p className="cycle-hint">Bitte zuerst maximale Herzfrequenz im Profil speichern.</p>}
      <button className="cycle-edit" type="button" onClick={()=>setEditing(v=>!v)}>{editing?'Zoneneditor schließen':'Zonengrenzen bearbeiten'}</button>
      {editing&&<div className="cycle-editor"><p>Obergrenzen in Prozent des FTP bzw. der maximalen HF. Änderungen wirken auf die Zonenanzeige, nicht rückwirkend auf abgeschlossene Workouts.</p>
        <div className="cycle-edit-grid"><fieldset><legend>Watt: oberes Zonenende</legend>{powerPct.map((v,i)=><label key={i}>Z{i+1} max. % <input type="number" inputMode="decimal" min="1" max="220" step="0.1" value={v} onChange={e=>setPowerPct(old=>old.map((k,j)=>j===i?Number(e.target.value):k))}/></label>)}</fieldset>
        <fieldset><legend>Puls: oberes Zonenende</legend>{hrPct.map((v,i)=><label key={i}>Z{i+1} max. % <input type="number" inputMode="decimal" min="1" max="100" step="0.1" value={v} onChange={e=>setHrPct(old=>old.map((k,j)=>j===i?Number(e.target.value):k))}/></label>)}</fieldset></div>
        <button type="button" disabled={busy} onClick={()=>void saveZones()}>Zonengrenzen speichern</button>
      </div>}
    </section>
    <section className="panel cycle-panel"><div className="eyebrow">GARMIN & ZWIFT · LOKALE BIBLIOTHEK</div><h2>Indoor und Outdoor</h2>
      <HelpDisclosure id="cycle-stats">Gezählt werden hier importierte Garmin-Radaktivitäten jeweils einmal – FIT ergänzt die zugehörige CSV-Aktivität. Bereits mit TEMPO verknüpfte Abschlüsse werden nicht zusätzlich summiert. Unklare Fahrtypen bleiben vorerst „Unklar“ und können von dir korrigiert werden. Nicht verknüpfte manuelle Fahrten stehen separat darunter.</HelpDisclosure>
      <div className="cycle-filter" role="group" aria-label="Statistik-Zeitraum">{[['30','30 Tage'],['year','Dieses Jahr'],['all','Alle']] .map(([k,v])=><button type="button" key={k} className={range===k?'active':''} onClick={()=>setRange(k)}>{v}</button>)}</div>
      <div className="cycle-stats">{(['outdoor','indoor','unknown'] as const).map(type=><div key={type}><small>{type==='outdoor'?'Outdoor':type==='indoor'?'Indoor':'Unklar'}</small><strong>{totals[type].count} Fahrten</strong><span>{deNumber(totals[type].km)} km</span><span>{deNumber(totals[type].hm,0)} hm</span></div>)}</div>
      <h3>Manuelle Radfahrten – separat</h3><div className="cycle-manual-summary">{(['outdoor','indoor','unknown'] as const).map(k=><span key={k}>{k==='outdoor'?'Draußen':k==='indoor'?'Indoor':'Unklar'}: <strong>{manualTotals[k].count} × · {deNumber(manualTotals[k].km)} km</strong></span>)}</div><p className="cycle-hint">Diese {manual.length} nicht Garmin-verknüpften Abschlüsse werden sicherheitshalber separat ausgewiesen. Verknüpfe passende Aktivitäten im Garmin-Abgleich, damit nichts doppelt gezählt wird.</p>
      <h3>Fahrten zuordnen</h3>
      {!filtered.length?<p className="cycle-hint">In diesem Zeitraum wurden noch keine Garmin-Radfahrten importiert.</p>:<div className="cycle-activity-list">{filtered.slice(0,40).map(a=><div className="cycle-activity" key={a.id}><div><strong>{a.title}</strong><small>{dateDE(a.date)} · {deNumber(a.distanceKm??0)} km · {deNumber(a.elevationM??0,0)} hm</small></div><label>Typ<select aria-label={`Fahrtart für ${a.title} vom ${dateDE(a.date)}`} value={resolvedEnvironment(a,overrides)} onChange={e=>void saveEnvironment(a.id,e.target.value as RideEnvironment)}><option value="unknown">Unklar</option><option value="outdoor">Outdoor</option><option value="indoor">Indoor</option></select></label></div>)}</div>}
      <p className="cycle-hint">Beispiel: Zwift wird meist automatisch als Indoor erkannt. Ein Garmin-Eintrag mit der allgemeinen Bezeichnung „Radfahren“ bleibt ohne weitere Streckeninformation unklar – du kannst ihn hier manuell zuordnen.</p>
    </section>
    <p className="cycle-notice" role="status">{notice}</p>
  </div>
}
