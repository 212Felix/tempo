import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { deleteRecord, getRecord, listRecords, openTempoDatabase } from '../db/storage'
import FitImportPanel from './FitImportPanel'
import FitChart from './FitChart'
import FitInsights from './FitInsights'
import ClimbLibraryPanel from './ClimbLibraryPanel'
import type { FitTrace } from './fit'
import { parseGarminCsv, type GarminActivity, type CsvParseResult } from './csv'
import './garmin.css'

const PROFILE_ID='local-primary-profile'
const formatNumber=(n:number,opts?:Intl.NumberFormatOptions)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1,...opts}).format(n)
const names:Record<GarminActivity['sport'],string>={cycling:'Radfahren',running:'Laufen',strength:'Kraft',swimming:'Schwimmen',other:'Sonstige'}
const formatDate=(s:string)=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s+'T12:00:00'))

export default function GarminLibraryPanel(){
  const [stored,setStored]=useState<GarminActivity[]>([])
  const [preview,setPreview]=useState<CsvParseResult|null>(null)
  const [fileName,setFileName]=useState('')
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('Aktivitätsbibliothek wird geladen …')
  const [filter,setFilter]=useState<'all'|GarminActivity['sport']>('all')
  const [showAll,setShowAll]=useState(false)
  const [selected,setSelected]=useState<string|null>(null)
  const [batchId,setBatchId]=useState('')
  const [chosenTrace,setChosenTrace]=useState<FitTrace|null>(null)
  const [fitVersion,setFitVersion]=useState(0)

  async function refresh(){
    const list=(await listRecords<GarminActivity>('externalActivities')).filter(x=>x.profileId===PROFILE_ID&&(x.source==='garmin-csv'||x.source==='garmin-fit'))
      .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
    setStored(list)
    return list
  }
  useEffect(()=>{let live=true;void listRecords<GarminActivity>('externalActivities').then(rows=>{
    if(!live)return
    const data=rows.filter(x=>x.profileId===PROFILE_ID&&(x.source==='garmin-csv'||x.source==='garmin-fit')).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))
    setStored(data);setNotice(data.length?`${data.length} importierte Garmin-Aktivitäten lokal verfügbar.`:'Noch keine Garmin-Aktivitäten importiert.')
  }).catch(error=>{if(live)setNotice('Datenbankfehler: '+String(error))});return()=>{live=false}},[])

  async function readCsv(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.target.value=''
    if(!file)return
    if(!/\.csv$/i.test(file.name)){setNotice('Bitte eine CSV-Datei aus Garmin Connect wählen.');return}
    if(file.size>20_000_000){setNotice('CSV größer als 20 MB. Bitte einen kleineren Export verwenden.');return}
    setBusy(true);setPreview(null)
    try{
      const id=`import:garmin:${new Date().toISOString()}`
      const parsed=parseGarminCsv(await file.text(),id)
      const known=new Set(stored.map(x=>x.id))
      const fresh=parsed.activities.filter(x=>!known.has(x.id))
      setBatchId(id);setPreview({...parsed,activities:fresh})
      setFileName(file.name)
      setNotice(`${parsed.activities.length} CSV-Aktivitäten erkannt; ${fresh.length} neu, ${parsed.activities.length-fresh.length} bereits vorhanden.`)
    }catch(error){setNotice(`Import-Vorschau fehlgeschlagen: ${error instanceof Error?error.message:String(error)}`)}
    finally{setBusy(false)}
  }

  async function storeCsv(){
    if(!preview||!preview.activities.length)return
    setBusy(true)
    try{
      const now=new Date().toISOString(),db=await openTempoDatabase()
      await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(['externalActivities','importBatches'],'readwrite')
        const activities=tx.objectStore('externalActivities')
        for(const entry of preview.activities)activities.put(entry)
        tx.objectStore('importBatches').put({id:batchId,profileId:PROFILE_ID,source:'garmin-csv',fileName,
          count:preview.activities.length,date:now,createdAt:now,updatedAt:now})
        tx.oncomplete=()=>{db.close();resolve()}
        tx.onerror=()=>{db.close();reject(tx.error??new Error('Speichern fehlgeschlagen.'))}
        tx.onabort=()=>{db.close();reject(tx.error??new Error('Transaktion abgebrochen.'))}
      })
      const added=preview.activities.length
      setPreview(null);setFileName('');await refresh()
      setNotice(`${added} Garmin-Aktivitäten lokal gespeichert. Bitte TEMPO-Backup unter Profil & Daten herunterladen.`)
    }catch(error){setNotice(`Speichern fehlgeschlagen: ${error instanceof Error?error.message:String(error)}`)}
    finally{setBusy(false)}
  }
  useEffect(()=>{
    let live=true
    const record=stored.find(x=>x.id===selected)
    if(!record||typeof record.fitSeriesId!=='string'){setChosenTrace(null);return}
    void getRecord<FitTrace>('performanceEntries',record.fitSeriesId).then(x=>{if(live)setChosenTrace(x??null)}).catch(()=>{if(live)setChosenTrace(null)})
    return()=>{live=false}
  },[selected,stored])
  async function remove(id:string){
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
  const totalKm=stored.reduce((sum,x)=>sum+(x.distanceKm??0),0)
  const totalHm=stored.reduce((sum,x)=>sum+(x.elevationM??0),0)
  const chosen=selected?stored.find(x=>x.id===selected):undefined
  return <section className="tempo-garmin-page">
    <div className="tempo-garmin-panel">
      <div className="eyebrow">GARMIN · DATENQUELLEN</div>
      <h2>Aktivitätsbibliothek</h2>
      <p>Importiere deine bisherigen Rad-, Lauf- und anderen Aktivitäten aus Garmin Connect. Die Dateien werden ausschließlich in deinem Browser verarbeitet und lokal gespeichert – nicht zu GitHub hochgeladen.</p>
      <div className="tempo-garmin-stats">
        <div><strong>{stored.length}</strong><small>Aktivitäten</small></div>
        <div><strong>{formatNumber(totalKm)}</strong><small>Kilometer</small></div>
        <div><strong>{formatNumber(totalHm,{maximumFractionDigits:0})}</strong><small>Höhenmeter</small></div>
      </div>
      <div className="tempo-garmin-import">
        <div><h3>1. CSV aus Garmin Connect importieren</h3><p>Garmin Connect → Aktivitäten → Alle Aktivitäten → CSV-Datei exportieren. Mehrere CSV-Dateien nacheinander sind möglich; vorhandene Einträge werden erkannt.</p></div>
        <label className="tempo-garmin-file">CSV-Datei auswählen<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void readCsv(e)}/></label>
      </div>
      {preview&&<div className="tempo-garmin-preview">
        <h3>2. Vorschau: {fileName}</h3>
        <p><strong>{preview.activities.length} neue Aktivitäten</strong> bereit zum Import. {preview.skipped?`${preview.skipped} Zeilen wurden übersprungen. `:''}Die Daten werden erst durch deine Bestätigung gespeichert.</p>
        <div className="tempo-garmin-notes">{preview.notes.map((n,i)=><p key={i}>{n}</p>)}</div>
        <div className="tempo-garmin-preview-rows">{preview.activities.slice(0,5).map(x=><div key={x.id}><span>{formatDate(x.date)} · {x.title}</span><span>{x.distanceKm==null?'–':formatNumber(x.distanceKm)+' km'} · {formatNumber(x.durationMin,{maximumFractionDigits:0})} min</span></div>)}</div>
        <div className="tempo-garmin-actions"><button type="button" className="tempo-garmin-button" disabled={busy||!preview.activities.length} onClick={()=>void storeCsv()}>Nur neue Aktivitäten importieren</button><button type="button" className="tempo-garmin-muted-button" disabled={busy} onClick={()=>setPreview(null)}>Abbrechen</button></div>
      </div>}
      <div className="tempo-garmin-status" role="status">{busy?'TEMPO verarbeitet die Datei …':notice}</div>
      <FitImportPanel onSaved={id=>{void refresh().then(()=>{setSelected(id);setFitVersion(n=>n+1)})}}/>
    </div>
    <ClimbLibraryPanel activities={stored} refreshVersion={fitVersion}/>
    <div className="tempo-garmin-panel">
      <div className="eyebrow">HISTORIE · ALLE SPORTARTEN</div>
      <h2>Gespeicherte Aktivitäten</h2>
      <div className="tempo-garmin-filters">
        {([['all','Alle'],['cycling','Rad'],['running','Lauf'],['strength','Kraft'],['swimming','Schwimmen'],['other','Andere']] as const).map(([k,l])=><button key={k} type="button" className={filter===k?'active':''} onClick={()=>{setFilter(k);setShowAll(false);setSelected(null)}}>{l}</button>)}
      </div>
      {!shown.length?<p className="tempo-garmin-empty">Keine Aktivitäten in dieser Kategorie gespeichert.</p>:
      <div className="tempo-garmin-list">{subset.map(x=><button key={x.id} className={selected===x.id?'selected':''} onClick={()=>setSelected(selected===x.id?null:x.id)}>
        <span><strong>{formatDate(x.date)}</strong><small>{names[x.sport]} · {x.title}{typeof x.fitSeriesId==='string'?' · FIT ✓':''}</small></span>
        <span>{x.distanceKm==null?'–':formatNumber(x.distanceKm)+' km'}<small>{formatNumber(x.durationMin,{maximumFractionDigits:0})} min{x.elevationM!=null?` · ${formatNumber(x.elevationM,{maximumFractionDigits:0})} hm`:''}</small></span>
      </button>)}</div>}
      {!showAll&&shown.length>30&&<button className="tempo-garmin-muted-button" onClick={()=>setShowAll(true)}>Alle {shown.length} anzeigen</button>}
      {chosen&&<div className="tempo-garmin-detail">
        <h3>{chosen.title}</h3><p>{formatDate(chosen.date)} · {names[chosen.sport]} · {chosen.source==='garmin-fit'?'Garmin FIT':'Garmin CSV'}{chosenTrace?' + FIT-Verlauf':''}</p>
        <div className="tempo-garmin-detail-grid">
          <span>Distanz <strong>{chosen.distanceKm==null?'–':formatNumber(chosen.distanceKm)+' km'}</strong></span>
          <span>Dauer <strong>{formatNumber(chosen.durationMin)} min</strong></span>
          <span>Höhenmeter <strong>{chosen.elevationM==null?'–':formatNumber(chosen.elevationM,{maximumFractionDigits:0})+' hm'}</strong></span>
          <span>Ø Leistung <strong>{chosen.avgPowerW==null?'–':formatNumber(chosen.avgPowerW,{maximumFractionDigits:0})+' W'}</strong></span>
          <span>Ø HF <strong>{chosen.avgHrBpm==null?'–':formatNumber(chosen.avgHrBpm,{maximumFractionDigits:0})+' bpm'}</strong></span>
          <span>NP <strong>{chosen.normalizedPowerW==null?'–':formatNumber(chosen.normalizedPowerW,{maximumFractionDigits:0})+' W'}</strong></span>
        </div>
        {chosenTrace&&<FitChart trace={chosenTrace}/>}
        {chosenTrace&&<FitInsights trace={chosenTrace} activity={chosen}/>}
        <button className="tempo-garmin-danger" disabled={busy} onClick={()=>void remove(chosen.id)}>Diesen importierten Eintrag löschen</button>
      </div>}
    </div>
    <div className="tempo-garmin-panel tempo-garmin-info"><h3>Was kommt als Nächstes?</h3><p><strong>FIT-Originaldaten:</strong> Jetzt können Leistung, Puls, Kadenz und Höhenprofil im zeitlichen Verlauf lokal gespeichert und angezeigt werden. Eine erste vorsichtige Anstiegssuche ist verfügbar; eine anstiegsübergreifende Vergleichsbibliothek ist vorhanden; geeignete Intervallorte folgen später.</p><p><strong>Trainingsplanung:</strong> CSV-Einträge werden in dieser Version noch nicht automatisch als zusätzliche Belastung verbucht. Dadurch vermeiden wir Doppelzählungen mit deinen bereits dokumentierten Touren. Vor der automatischen Verknüpfung bauen wir einen Abgleich „Garmin-Aktivität ↔ TEMPO-Training“ ein.</p><p><strong>Datenschutz:</strong> Keine Anmeldung bei Garmin, keine Weitergabe der CSV- oder FIT-Datei, kein TEMPO-Server. FIT enthält gegebenenfalls private GPS-Daten. Das TEMPO-Backup kann die importierte Historie enthalten und sollte privat aufbewahrt werden.</p></div>
  </section>
}
