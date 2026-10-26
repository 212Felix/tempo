import {germanDate} from '../phase40c/date'
import {useEffect,useMemo,useState,type ChangeEvent} from 'react'
import {parseGarminCsv,type GarminActivity} from './csv'
import {decodeFitFile,type FitTrace} from './fit'
import {listRecords,openTempoDatabase} from '../db/storage'
import {inspectBatch,type BatchRow,type BatchSource,type Decision} from './batchMatch'
import {prepareWrites} from './batchSave'
import './batch-import.css'

const PROFILE_ID='local-primary-profile'
const sportNames:Record<GarminActivity['sport'],string>={cycling:'Rad',running:'Lauf',strength:'Kraft',swimming:'Schwimmen',other:'Sonstige'}
const fmt=(n:number|undefined)=>n===undefined?'–':new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(n)
function statusLabel(row:BatchRow){return row.decision==='skip'?'Überspringen':row.decision==='merge'?'Zusammenführen':row.decision==='create'?'Neu anlegen':'Entscheidung offen'}
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e)
export default function BatchImportPanel({onSaved}:{onSaved:()=>void}){
  const [rows,setRows]=useState<BatchRow[]>([])
  const [busy,setBusy]=useState(false)
  const [progress,setProgress]=useState('Noch keine Dateien ausgewählt.')
  const [fileErrors,setFileErrors]=useState<string[]>([])
  const [known,setKnown]=useState<GarminActivity[]>([])
  const [traces,setTraces]=useState<FitTrace[]>([])
  const [showNew,setShowNew]=useState(false)
  async function loadLibrary(){
    const [a,t]=await Promise.all([listRecords<GarminActivity>('externalActivities'),listRecords<FitTrace>('performanceEntries')])
    const filtered=a.filter(x=>x.profileId===PROFILE_ID&&(x.source==='garmin-csv'||x.source==='garmin-fit'||x.source==='garmin-personal'))
    const ft=t.filter(x=>x.profileId===PROFILE_ID&&x.kind==='garmin-fit-trace')
    setKnown(filtered);setTraces(ft)
    return {activities:filtered,traces:ft}
  }
  useEffect(()=>{void loadLibrary().catch(e=>setProgress('Bibliothek nicht lesbar: '+errorText(e)))},[])
  async function readFiles(e:ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files??[]);e.target.value='';if(!files.length)return
    setRows([]);setFileErrors([]);setShowNew(false)
    if(files.length>30){setProgress('Bitte höchstens 30 Dateien pro Stapel auswählen.');return}
    if(files.reduce((n,f)=>n+f.size,0)>250_000_000){setProgress('Gesamtauswahl über 250 MB. Bitte in mehrere Stapel aufteilen.');return}
    setBusy(true)
    const sources:{fileName:string;source:BatchSource}[]=[],failures:string[]=[]
    try{
      const library=await loadLibrary()
      for(const [i,file] of files.entries()){
        setProgress(`Datei ${i+1}/${files.length} wird lokal geprüft: ${file.name}`)
        try{
          if(/\.fit$/i.test(file.name)){
            const decoded=await decodeFitFile(file)
            sources.push({fileName:file.name,source:{kind:'fit',fit:decoded}})
          }else if(/\.csv$/i.test(file.name)){
            if(file.size>20_000_000)throw new Error('CSV größer als 20 MB')
            const parsed=parseGarminCsv(await file.text(),`import:garmin:batch:${Date.now()}`)
            if(sources.length+parsed.activities.length>2500)throw new Error('Mehr als 2.500 Aktivitäten. Bitte kleinere CSV-Datei verwenden.')
            for(const activity of parsed.activities)sources.push({fileName:file.name,source:{kind:'csv',activity}})
            if(parsed.skipped)failures.push(`${file.name}: ${parsed.skipped} unlesbare oder wiederholte CSV-Zeilen übersprungen.`)
          }else throw new Error('Nur entpackte .fit- oder Garmin-.csv-Dateien auswählen.')
        }catch(err){failures.push(`${file.name}: ${errorText(err)}`)}
        // Let the iPhone update the progress label between potentially expensive FIT decodes.
        await new Promise<void>(resolve=>setTimeout(resolve,0))
      }
      const inspected=inspectBatch(sources,library.activities,library.traces)
      setRows(inspected);setFileErrors(failures)
      setProgress(`${inspected.length} Aktivitäten geprüft. ${inspected.filter(x=>x.decision==='review').length} benötigen deine Entscheidung.`)
    }catch(err){setProgress('Prüfung fehlgeschlagen: '+errorText(err));setFileErrors(failures)}
    finally{setBusy(false)}
  }
  function updateRow(key:string,decision:Decision,matchId?:string){setRows(prev=>prev.map(x=>x.key===key?{...x,decision,matchId:matchId??x.matchId}:x))}
  async function commit(){
    if(!rows.length ||rows.some(x=>x.decision==='review'))return
    setBusy(true)
    try{
      // Detect concurrent edits since the preview; do not silently overwrite them.
      const current=await listRecords<GarminActivity>('externalActivities')
      const filtered=current.filter(x=>x.profileId===PROFILE_ID&&(x.source==='garmin-csv'||x.source==='garmin-fit'||x.source==='garmin-personal'))
      if(filtered.length!==known.length || filtered.some(a=>known.find(b=>b.id===a.id)?.updatedAt!==a.updatedAt))
        throw new Error('Die Bibliothek wurde seit der Prüfung verändert. Bitte Dateien erneut auswählen.')
      const writes=prepareWrites(rows,filtered)
      if(!writes.activities.length&&!writes.traces.length){setRows([]);setProgress('Alle ausgewählten Aktivitäten waren bereits vorhanden oder wurden übersprungen. Nichts gespeichert.');return}
      const now=new Date().toISOString(),db=await openTempoDatabase()
      await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(['externalActivities','performanceEntries','importBatches'],'readwrite')
        try{
          const ext=tx.objectStore('externalActivities'),perf=tx.objectStore('performanceEntries')
          for(const a of writes.activities)ext.put(a)
          for(const t of writes.traces)perf.add(t) // existing trace ID -> transaction aborts, never overwrite
          tx.objectStore('importBatches').put({id:`import:garmin:batch:${Date.now()}`,profileId:PROFILE_ID,source:'garmin-batch',date:now,
            count:writes.created,merged:writes.merged,skipped:writes.skipped,createdAt:now,updatedAt:now})
        }catch(err){tx.abort();reject(err);return}
        tx.oncomplete=()=>{db.close();resolve()}
        tx.onerror=()=>{db.close();reject(tx.error??new Error('Speichern fehlgeschlagen'))}
        tx.onabort=()=>{db.close();reject(tx.error??new Error('Speichern vollständig abgebrochen'))}
      })
      setRows([]);setFileErrors([])
      setProgress(`Erfolgreich: ${writes.created} neu, ${writes.merged} ergänzt, ${writes.skipped} übersprungen. Bitte danach ein TEMPO-JSON-Backup erstellen.`)
      await loadLibrary();onSaved()
    }catch(err){setProgress(`Nichts übernommen: ${errorText(err)}`)}
    finally{setBusy(false)}
  }
  const counts=useMemo(()=>({new:rows.filter(x=>x.decision==='create').length,
    merge:rows.filter(x=>x.decision==='merge').length,skip:rows.filter(x=>x.decision==='skip').length,
    review:rows.filter(x=>x.decision==='review').length}),[rows])
  const important=rows.filter(x=>x.proposed!=='create')
  const fresh=rows.filter(x=>x.proposed==='create')
  return <section className="tempo-batch-import">
    <div className="eyebrow">PHASE 25 · SICHERER MEHRFACHIMPORT</div>
    <h3>Garmin-Dateien gemeinsam prüfen</h3>
    <p>Wähle mehrere FIT-Dateien und CSV-Übersichten gleichzeitig. TEMPO prüft vor dem Speichern jede Aktivität auf Überschneidungen. Die Dateien bleiben auf diesem Gerät.</p>
    <label className="tempo-garmin-file">FIT und CSV auswählen <input type="file" accept=".fit,.csv" multiple disabled={busy} onChange={e=>void readFiles(e)}/></label>
    <p role="status" className="tempo-batch-status">{progress}</p>
    {!!fileErrors.length&&<details className="tempo-batch-errors"><summary>{fileErrors.length} Datei-/Lesehinweise</summary>{fileErrors.map((x,i)=><p key={i}>{x}</p>)}</details>}
    {!!rows.length&&<>
      <div className="tempo-batch-stats"><span>Neu <strong>{counts.new}</strong></span><span>Zusammenführen <strong>{counts.merge}</strong></span><span>Überspringen <strong>{counts.skip}</strong></span><span>Offen <strong>{counts.review}</strong></span></div>
      <h4>Prüfliste – {important.length} auffällige Einträge</h4>
      {important.length===0&&<p>Keine Überschneidungen gefunden. Die übrigen Aktivitäten sind unten einsehbar.</p>}
      <div className="tempo-batch-list">{important.map(row=><BatchItem key={row.key} row={row} busy={busy} update={updateRow}/>)}</div>
      {!!fresh.length&&<details open={showNew} onToggle={e=>setShowNew(e.currentTarget.open)} className="tempo-batch-new"><summary>{fresh.length} zunächst neue Aktivitäten ansehen</summary>
        <div className="tempo-batch-list">{fresh.map(row=><BatchItem key={row.key} row={row} busy={busy} update={updateRow}/>)}</div></details>}
      <div className="tempo-garmin-actions tempo-batch-actions">
        <button className="tempo-garmin-button" type="button" disabled={busy||counts.review>0} onClick={()=>void commit()}>Geprüfte Auswahl speichern ({counts.new+counts.merge})</button>
        <button className="tempo-garmin-muted-button" type="button" disabled={busy} onClick={()=>{setRows([]);setFileErrors([]);setProgress('Import abgebrochen. Keine Daten gespeichert.')}}>Gesamten Import abbrechen</button>
      </div>
      {counts.review>0&&<p className="tempo-batch-warning">Bitte zuerst für jede auffällige Aktivität „Überspringen“, „Zusammenführen“ oder bewusst „Neu anlegen“ wählen.</p>}
    </>}
  </section>
}
function BatchItem({row,busy,update}:{row:BatchRow;busy:boolean;update:(key:string,action:Decision,matchId?:string)=>void}){
  const hasTarget=Boolean(row.matchId)&&row.matches.some(x=>x.id===row.matchId)
  const canMerge=row.source.kind==='csv'||(hasTarget&&row.source.kind==='fit')
  return <div className={`tempo-batch-row ${row.decision==='review'?'needs-review':''}`}>
    <div className="tempo-batch-row-head"><strong>{germanDate(row.date)} · {sportNames[row.sport]} · {row.label}</strong><span>{statusLabel(row)}</span></div>
    <small>{row.fileName} · {fmt(row.distanceKm)} km · {Math.floor(row.durationSeconds/3600)}:{String(Math.floor(row.durationSeconds/60)%60).padStart(2,'0')}:{String(row.durationSeconds%60).padStart(2,'0')}</small>
    <p>{row.reason}</p>
    {!!row.matches.length&&<label className="tempo-batch-match">Mögliche bestehende Aktivität
      <select disabled={busy} value={row.matchId} onChange={e=>update(row.key,row.decision,e.target.value)}>
        <option value="">Bitte auswählen</option>{row.matches.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
      </select></label>}
    <div className="tempo-batch-decisions">
      <button type="button" disabled={busy} className={row.decision==='skip'?'selected':''} onClick={()=>update(row.key,'skip')}>Überspringen</button>
      {canMerge&&<button type="button" disabled={busy||!hasTarget} className={row.decision==='merge'?'selected':''} onClick={()=>update(row.key,'merge')}>Zusammenführen</button>}
      <button type="button" disabled={busy} className={row.decision==='create'?'selected':''} onClick={()=>update(row.key,'create')}>Als neu übernehmen</button>
    </div>
  </div>
}
