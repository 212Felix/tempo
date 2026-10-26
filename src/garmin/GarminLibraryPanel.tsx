import {durationFor} from '../time/duration'
import { useEffect, useMemo, useState } from 'react'
import { deleteRecord, getRecord, listRecords } from '../db/storage'
import BatchImportPanel from './BatchImportPanel'
import ReconciliationPanel from '../planning/ReconciliationPanel'
import type {LinkedCompleted} from '../planning/reconcile'
import FitChart from './FitChart'
import FitInsights from './FitInsights'
import ClimbLibraryPanel from './ClimbLibraryPanel'
import type { FitTrace } from './fit'
import type { GarminActivity } from './csv'
import './garmin.css'
import HelpDisclosure from '../ui/HelpDisclosure'
import GarminSyncPanel from '../phase39/GarminSyncPanel'
import StoredDuplicatesPanel from './StoredDuplicatesPanel'
import {activeGarminActivities} from './stored-duplicates'

const PROFILE_ID='local-primary-profile'
const formatNumber=(n:number,opts?:Intl.NumberFormatOptions)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1,...opts}).format(n)
const names:Record<GarminActivity['sport'],string>={cycling:'Radfahren',running:'Laufen',strength:'Kraft',swimming:'Schwimmen',other:'Sonstige'}
const formatDate=(s:string)=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s+'T12:00:00'))

export default function GarminLibraryPanel(){
  const [stored,setStored]=useState<GarminActivity[]>([])
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('Aktivitätsbibliothek wird geladen …')
  const [filter,setFilter]=useState<'all'|GarminActivity['sport']>('all')
  const [showAll,setShowAll]=useState(false)
  const [selected,setSelected]=useState<string|null>(null)
  const [chosenTrace,setChosenTrace]=useState<FitTrace|null>(null)
  const [fitVersion,setFitVersion]=useState(0)

  async function refresh(){
    const list=(await listRecords<GarminActivity>('externalActivities')).filter(x=>x.profileId===PROFILE_ID&&(x.source==='garmin-csv'||x.source==='garmin-fit'||x.source==='garmin-personal'))
      .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
    setStored(list)
    return list
  }
  useEffect(()=>{let live=true;void listRecords<GarminActivity>('externalActivities').then(rows=>{
    if(!live)return
    const data=rows.filter(x=>x.profileId===PROFILE_ID&&(x.source==='garmin-csv'||x.source==='garmin-fit'||x.source==='garmin-personal')).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
    setStored(data);setNotice(data.length?`${data.length} importierte Garmin-Aktivitäten lokal verfügbar.`:'Noch keine Garmin-Aktivitäten importiert.')
  }).catch(error=>{if(live)setNotice('Datenbankfehler: '+String(error))});return()=>{live=false}},[])

  useEffect(()=>{
    let live=true
    const record=stored.find(x=>x.id===selected)
    if(!record||typeof record.fitSeriesId!=='string'){setChosenTrace(null);return}
    void getRecord<FitTrace>('performanceEntries',record.fitSeriesId).then(x=>{if(live)setChosenTrace(x??null)}).catch(()=>{if(live)setChosenTrace(null)})
    return()=>{live=false}
  },[selected,stored])
  async function remove(id:string){
    const linked=(await listRecords<LinkedCompleted>('completedSessions')).some(x=>x.externalActivityId===id)
    if(linked){setNotice('Diese Garmin-Aktivität ist einem Training zugeordnet und kann nicht einzeln gelöscht werden. Zuerst die Verbindung im Trainingsabgleich aufheben.');return}
    if(!window.confirm('Nur diesen importierten Garmin-Eintrag aus TEMPO löschen? Garmin Connect bleibt unverändert.'))return
    setBusy(true)
    try{
      const record=stored.find(x=>x.id===id)
      if(record && typeof record.fitSeriesId==='string')await deleteRecord('performanceEntries',record.fitSeriesId)
      await deleteRecord('externalActivities',id);await refresh();setFitVersion(n=>n+1);setSelected(null);setChosenTrace(null);setNotice('Eintrag samt FIT-Verlauf aus TEMPO entfernt. Garmin Connect bleibt unverändert.')
    }
    catch(error){setNotice('Löschen fehlgeschlagen: '+String(error))}
    finally{setBusy(false)}
  }
  const shown=useMemo(()=>stored.filter(x=>filter==='all'||x.sport===filter),[stored,filter])
  const subset=showAll?shown:shown.slice(0,30)
  const totalKm=activeGarminActivities(stored).reduce((sum,x)=>sum+(x.distanceKm??0),0)
  const totalHm=activeGarminActivities(stored).reduce((sum,x)=>sum+(x.elevationM??0),0)
  const chosen=selected?stored.find(x=>x.id===selected):undefined
  return <section className="tempo-garmin-page">
    <GarminSyncPanel onSaved={()=>{void refresh().then(()=>setFitVersion(n=>n+1))}}/>
    <StoredDuplicatesPanel onChanged={()=>{void refresh().then(()=>setFitVersion(n=>n+1))}}/>
    <div className="tempo-garmin-panel">
      <div className="eyebrow">GARMIN · DATENQUELLEN</div>
      <h2>Aktivitätsbibliothek</h2>
      <HelpDisclosure id="garmin-intro"><p>Importiere deine bisherigen Rad-, Lauf- und anderen Aktivitäten aus Garmin Connect. CSV- und FIT-Dateien werden ausschließlich in deinem Browser verarbeitet und lokal gespeichert. Die optionale Personal-API-Synchronisierung läuft über deinen privaten Cloudflare Worker.</p></HelpDisclosure>
      <div className="tempo-garmin-stats">
        <div><strong>{stored.length}</strong><small>Aktivitäten</small></div>
        <div><strong>{formatNumber(totalKm)}</strong><small>Kilometer</small></div>
        <div><strong>{formatNumber(totalHm,{maximumFractionDigits:0})}</strong><small>Höhenmeter</small></div>
      </div>
      <BatchImportPanel onSaved={()=>{void refresh().then(()=>setFitVersion(n=>n+1))}}/>
    </div>
    <ReconciliationPanel context="garmin" key={`${stored.length}-${fitVersion}`}/>
    <ClimbLibraryPanel activities={activeGarminActivities(stored)} refreshVersion={fitVersion}/>
    <div className="tempo-garmin-panel">
      <div className="eyebrow">HISTORIE · ALLE SPORTARTEN</div>
      <h2>Gespeicherte Aktivitäten</h2>
      <div className="tempo-garmin-filters">
        {([['all','Alle'],['cycling','Rad'],['running','Lauf'],['strength','Kraft'],['swimming','Schwimmen'],['other','Andere']] as const).map(([k,l])=><button key={k} type="button" className={filter===k?'active':''} onClick={()=>{setFilter(k);setShowAll(false);setSelected(null)}}>{l}</button>)}
      </div>
      {!shown.length?<p className="tempo-garmin-empty">Keine Aktivitäten in dieser Kategorie gespeichert.</p>:
      <div className="tempo-garmin-list">{subset.map(x=><button key={x.id} className={selected===x.id?'selected':''} onClick={()=>setSelected(selected===x.id?null:x.id)}>
        <span><strong>{formatDate(x.date)}</strong><small>{names[x.sport]} · {x.title}{x.duplicateOf?' · Dublette (aus Auswertungen ausgeblendet)':''}{typeof x.fitSeriesId==='string'?' · FIT ✓':''}</small></span>
        <span>{x.distanceKm==null?'–':formatNumber(x.distanceKm)+' km'}<small>{durationFor(x)}{x.elevationM!=null?` · ${formatNumber(x.elevationM,{maximumFractionDigits:0})} hm`:''}</small></span>
      </button>)}</div>}
      {!showAll&&shown.length>30&&<button className="tempo-garmin-muted-button" onClick={()=>setShowAll(true)}>Alle {shown.length} anzeigen</button>}
      {chosen&&<div className="tempo-garmin-detail">
        <h3>{chosen.title}</h3><p>{formatDate(chosen.date)} · {names[chosen.sport]} · {chosen.source==='garmin-fit'?'Garmin FIT':chosen.source==='garmin-personal'?'Garmin Personal API':'Garmin CSV'}{chosenTrace?' + FIT-Verlauf':''}</p>
        <div className="tempo-garmin-detail-grid">
          <span>Distanz <strong>{chosen.distanceKm==null?'–':formatNumber(chosen.distanceKm)+' km'}</strong></span>
          <span>Dauer <strong>{durationFor(chosen)}</strong></span>
          <span>Höhenmeter <strong>{chosen.elevationM==null?'–':formatNumber(chosen.elevationM,{maximumFractionDigits:0})+' hm'}</strong></span>
          <span>Ø Leistung <strong>{chosen.avgPowerW==null?'–':formatNumber(chosen.avgPowerW,{maximumFractionDigits:0})+' W'}</strong></span>
          <span>Ø HF <strong>{chosen.avgHrBpm==null?'–':formatNumber(chosen.avgHrBpm,{maximumFractionDigits:0})+' bpm'}</strong></span>
          <span>NP <strong>{chosen.normalizedPowerW==null?'–':formatNumber(chosen.normalizedPowerW,{maximumFractionDigits:0})+' W'}</strong></span>
          <span>Max. HF <strong>{chosen.maxHrBpm==null?'–':formatNumber(chosen.maxHrBpm,{maximumFractionDigits:0})+' bpm'}</strong></span>
          <span>Max. Leistung <strong>{chosen.maxPowerW==null?'–':formatNumber(chosen.maxPowerW,{maximumFractionDigits:0})+' W'}</strong></span>
          <span>Kadenz <strong>{chosen.avgCadence==null?'–':formatNumber(chosen.avgCadence,{maximumFractionDigits:0})+' /min'}</strong></span>
          <span>Tempo Ø <strong>{chosen.avgSpeedKmh==null?'–':formatNumber(chosen.avgSpeedKmh)+' km/h'}</strong></span>
          <span>Bewegungszeit <strong>{typeof chosen.movingSeconds==='number'?Math.round(chosen.movingSeconds/60)+' min':'–'}</strong></span>
          <span>Garmin-ID <strong>{typeof chosen.garminActivityId==='string'?chosen.garminActivityId:'–'}</strong></span>
        </div>
        {chosenTrace&&<FitChart trace={chosenTrace}/>}
        {chosenTrace&&<FitInsights trace={chosenTrace} activity={chosen}/>}
        <button className="tempo-garmin-danger" disabled={busy} onClick={()=>void remove(chosen.id)}>Diesen importierten Eintrag löschen</button>
      </div>}
    </div>
    <div className="tempo-garmin-panel tempo-garmin-info"><h3>Hintergründe & Datenschutz</h3><HelpDisclosure id="garmin-future"><p><strong>FIT-Originaldaten:</strong> Jetzt können Leistung, Puls, Kadenz und Höhenprofil im zeitlichen Verlauf lokal gespeichert und angezeigt werden. Eine erste vorsichtige Anstiegssuche ist verfügbar; eine anstiegsübergreifende Vergleichsbibliothek ist vorhanden; geeignete Intervallorte folgen später.</p><p><strong>Trainingsplanung:</strong> Garmin-Aktivitäten werden nicht ungeprüft als zweite absolvierte Einheit gezählt. Über „Garmin mit TEMPO verbinden“ kannst du vorhandene Trainingseinträge nach Bestätigung zuordnen. Erst dann fließt diese Aktivität als tatsächliche Belastung in neue Planvorschläge ein.</p><p><strong>Datenschutz:</strong> Kein Garmin-Passwort-Login. CSV-/FIT-Dateien bleiben lokal; bei aktivierter Personal API werden Aktivitätszusammenfassungen über deinen geschützten Cloudflare Worker synchronisiert. FIT enthält gegebenenfalls private GPS-Daten. Das TEMPO-Backup kann die importierte Historie enthalten und sollte privat aufbewahrt werden.</p></HelpDisclosure></div>
  </section>
}
