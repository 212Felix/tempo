import { useEffect, useState,type ChangeEvent } from 'react'
import { decodeFitFile,fitMatches,type FitDecoded,type FitTrace } from './fit'
import FitChart from './FitChart'
import FitInsights from './FitInsights'
import { listRecords,openTempoDatabase,saveRecord } from '../db/storage'
import type { GarminActivity } from './csv'
import './fit.css'
import HelpDisclosure from '../ui/HelpDisclosure'

const PROFILE_ID='local-primary-profile'
const n=(x:number|undefined,unit='')=>x===undefined?'–':new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(x)+unit
export default function FitImportPanel({onSaved}:{onSaved:(id:string)=>void}){
  const [preview,setPreview]=useState<FitDecoded|null>(null)
  const [candidate,setCandidate]=useState<string>('new')
  const [matches,setMatches]=useState<GarminActivity[]>([])
  const [known,setKnown]=useState<GarminActivity[]>([])
  const [existingTraces,setExistingTraces]=useState<FitTrace[]>([])
  const [refreshTrace,setRefreshTrace]=useState<FitTrace|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('Wähle eine Original-FIT-Datei. TEMPO prüft anschließend vorhandene CSV-Fahrten.')
  useEffect(()=>{let live=true;void Promise.all([
    listRecords<GarminActivity>('externalActivities'),listRecords<FitTrace>('performanceEntries')
  ]).then(([activities,traces])=>{if(!live)return;setKnown(activities.filter(x=>x.profileId===PROFILE_ID));setExistingTraces(traces.filter(x=>x.profileId===PROFILE_ID&&x.kind==='garmin-fit-trace'))}).catch(e=>{if(live)setMessage('Lesefehler: '+String(e))});return()=>{live=false}},[])
  async function openFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.target.value='';if(!file)return
    setBusy(true);setPreview(null);setRefreshTrace(null)
    try{
      const decoded=await decodeFitFile(file)
      const previous=existingTraces.find(t=>t.sha256===decoded.fingerprint)
      if(previous){
        setPreview(decoded);setRefreshTrace(previous);setCandidate(previous.activityId)
        setMessage('Diese FIT-Datei ist bereits zugeordnet. Du kannst ihre Zeitmetadaten ergänzen, ohne eine weitere Aktivität anzulegen oder den Messverlauf zu duplizieren.')
        return
      }
      const candidates=fitMatches(decoded,known.filter(x=>typeof x.fitSeriesId!=='string'))
      setPreview(decoded);setMatches(candidates)
      setCandidate(candidates.length===1?candidates[0].id:'new')
      setMessage(candidates.length===1?'Passende CSV-Aktivität erkannt. Bitte die Zuordnung vor dem Speichern prüfen.':
        candidates.length>1?'Mehrere mögliche CSV-Aktivitäten gefunden. Bitte bewusst eine auswählen.':
          'Keine eindeutige CSV-Zuordnung gefunden. Du kannst eine neue FIT-Aktivität speichern oder eine vorhandene CSV-Aktivität auswählen.')
    }catch(err){setMessage(err instanceof Error?err.message:String(err))}
    finally{setBusy(false)}
  }
  async function save(){
    if(!preview)return
    setBusy(true)
    const p=preview,now=new Date().toISOString()
    if(refreshTrace){
      try{
        const updated:FitTrace={...refreshTrace,updatedAt:now,
          ...(p.elapsedSeconds!==undefined?{elapsedSeconds:p.elapsedSeconds}:{}),
          ...(p.timerSeconds!==undefined?{timerSeconds:p.timerSeconds}:{}),
          ...(p.movingSeconds!==undefined?{movingSeconds:p.movingSeconds}:{})}
        await saveRecord('performanceEntries',updated)
        setExistingTraces(x=>x.map(t=>t.id===updated.id?updated:t));setPreview(null);setRefreshTrace(null)
        setMessage('FIT-Zeitmetadaten aktualisiert. Die Aktivitätszahl und alle Messpunkte bleiben unverändert.')
        onSaved(updated.activityId)
      }catch(err){setMessage('Aktualisierung fehlgeschlagen: '+(err instanceof Error?err.message:String(err)))}
      finally{setBusy(false)}
      return
    }
    const activityId=candidate==='new'?`garmin:fit:${PROFILE_ID}:${p.fingerprint.slice(0,32)}`:candidate
    const traceId=`garmin:fit-trace:${PROFILE_ID}:${p.fingerprint.slice(0,32)}`
    const trace:FitTrace={id:traceId,kind:'garmin-fit-trace',profileId:PROFILE_ID,createdAt:now,updatedAt:now,
      activityId,sha256:p.fingerprint,fileName:p.fileName,startedAt:p.startedAt,recordCount:p.recordCount,
      sampleIntervalSeconds:5,points:p.records,
      ...(p.elapsedSeconds!==undefined?{elapsedSeconds:p.elapsedSeconds}:{}),
      ...(p.timerSeconds!==undefined?{timerSeconds:p.timerSeconds}:{}),
      ...(p.movingSeconds!==undefined?{movingSeconds:p.movingSeconds}:{}),}
    const newActivity:GarminActivity={id:activityId,createdAt:now,updatedAt:now,profileId:PROFILE_ID,
      source:'garmin-fit',date:p.date,startedAt:p.startedAt,title:`FIT · ${p.fileName.replace(/\.fit$/i,'')}`,
      sport:p.sport,activityType:p.sport,durationMin:Math.round(p.durationSeconds/6)/10,durationSeconds:p.durationSeconds,
      ...(p.distanceKm!==undefined?{distanceKm:p.distanceKm}:{}),
      ...(p.elevationM!==undefined?{elevationM:p.elevationM}:{}),
      ...(p.avgPowerW!==undefined?{avgPowerW:p.avgPowerW}:{}),
      ...(p.maxPowerW!==undefined?{maxPowerW:p.maxPowerW}:{}),
      ...(p.avgHrBpm!==undefined?{avgHrBpm:p.avgHrBpm}:{}),
      ...(p.maxHrBpm!==undefined?{maxHrBpm:p.maxHrBpm}:{}),
      ...(p.avgCadence!==undefined?{avgCadence:p.avgCadence}:{}),importBatchId:traceId}
    try{
      // Atomic write: either summary/CSV link AND data points persist, or neither does.
      const db=await openTempoDatabase()
      await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(['externalActivities','performanceEntries'],'readwrite')
        const external=tx.objectStore('externalActivities')
        const performance=tx.objectStore('performanceEntries')
        performance.put(trace)
        if(candidate==='new')external.add({...newActivity,fitSeriesId:traceId})
        else{
          const original=known.find(x=>x.id===candidate)
          if(!original || typeof original.fitSeriesId==='string'){tx.abort();return}
          external.put({...original,fitSeriesId:traceId,updatedAt:now})
        }
        tx.oncomplete=()=>{db.close();resolve()}
        tx.onerror=()=>{db.close();reject(tx.error??new Error('Importfehler'))}
        tx.onabort=()=>{db.close();reject(tx.error??new Error('Import abgebrochen – bitte erneut versuchen.'))}
      })
      setKnown(x=>candidate==='new'?[...x,newActivity]:x.map(a=>a.id===candidate?{...a,fitSeriesId:traceId}:a))
      setExistingTraces(x=>[...x,trace]);setPreview(null)
      setMessage(candidate==='new'?'Neue FIT-Aktivität und Messverlauf lokal gespeichert.':'FIT-Messverlauf mit vorhandener CSV-Aktivität verknüpft – keine neue Aktivität gezählt.')
      onSaved(activityId)
    }catch(err){setMessage('Speichern fehlgeschlagen: '+(err instanceof Error?err.message:String(err)))}
    finally{setBusy(false)}
  }
  const tempTrace:FitTrace|undefined=preview?{id:'preview',profileId:PROFILE_ID,kind:'garmin-fit-trace',
    createdAt:'',updatedAt:'',activityId:'preview',sha256:preview.fingerprint,fileName:preview.fileName,
    startedAt:preview.startedAt,recordCount:preview.recordCount,sampleIntervalSeconds:5,points:preview.records,
    elapsedSeconds:preview.elapsedSeconds,timerSeconds:preview.timerSeconds,movingSeconds:preview.movingSeconds}:undefined
  return <div className="tempo-fit-import">
    <div className="tempo-garmin-import"><div><h3>2. Original-FIT-Datei einlesen</h3>
      <HelpDisclosure id="garmin-fit-help"><p>Garmin Connect → Aktivität → Zahnrad → Datei exportieren → ZIP entpacken → <strong>.fit</strong> auswählen. Verarbeitung nur auf diesem Gerät; auch GPS-Verläufe bleiben lokal.</p></HelpDisclosure></div>
      <label className="tempo-garmin-file">FIT-Datei auswählen<input type="file" accept=".fit,application/octet-stream" disabled={busy} onChange={e=>void openFile(e)}/></label>
    </div>
    <div className="tempo-garmin-status" role="status">{busy?'FIT-Datei wird verarbeitet …':message}</div>
    {preview&&<div className="tempo-garmin-preview">
      <h3>FIT-Vorschau: {preview.fileName}</h3>
      <div className="tempo-fit-metrics">
        <span><small>Start</small><strong>{new Date(preview.startedAt).toLocaleString('de-DE')}</strong></span>
        <span><small>Distanz</small><strong>{n(preview.distanceKm,' km')}</strong></span>
        <span><small>Dauer</small><strong>{n(preview.durationSeconds/3600,' h')}</strong></span>
        <span><small>Ø Watt</small><strong>{n(preview.avgPowerW,' W')}</strong></span>
        <span><small>Ø Puls</small><strong>{n(preview.avgHrBpm,' bpm')}</strong></span>
        <span><small>Höhenmeter</small><strong>{n(preview.elevationM,' hm')}</strong></span>
      </div>
      {preview.warnings.map((w,i)=><p key={i} className="tempo-fit-warning">{w}</p>)}
      {tempTrace&&<FitChart trace={tempTrace}/>}
      {tempTrace&&<FitInsights trace={tempTrace} activity={known.find(a=>a.id===candidate)}/>}
      <div className="tempo-fit-match"><label htmlFor="tempo-fit-link">Zuordnung zu deiner Aktivitätsbibliothek</label>
        <select id="tempo-fit-link" value={candidate} disabled={Boolean(refreshTrace)} onChange={e=>setCandidate(e.target.value)}>
          {refreshTrace&&<option value={refreshTrace.activityId}>Bereits verknüpft: {known.find(a=>a.id===refreshTrace.activityId)?.title??refreshTrace.activityId}</option>}
          <option value="new">Als neue Aktivität anlegen (nur falls noch nicht vorhanden)</option>
          {known.filter(a=>(a.source==='garmin-csv'||a.source==='garmin-personal') && typeof a.fitSeriesId!=='string' && Math.abs(Date.parse(a.date+'T12:00:00Z')-Date.parse(preview.date+'T12:00:00Z'))<=86400000)
            .map(a=><option key={a.id} value={a.id}>{a.date} · {a.title} · {n(a.distanceKm,' km')}{matches.some(m=>m.id===a.id)?' ✓ passend':''}</option>)}
        </select>
        <small>{refreshTrace?'Die Originaldatei wurde schon importiert. Jetzt werden nur ergänzende Zeitangaben aus dem FIT-Sitzungsdatensatz gesichert.': 'Bei einer bereits als CSV gespeicherten Fahrt unbedingt diese Aktivität auswählen. TEMPO hängt dann nur die FIT-Messwerte an; die Gesamtzahl bleibt unverändert.'}</small>
      </div>
      <div className="tempo-garmin-actions"><button type="button" className="tempo-garmin-button" disabled={busy} onClick={()=>void save()}>{refreshTrace?'FIT-Zeitangaben aktualisieren':'Zuordnung bestätigen & FIT speichern'}</button><button type="button" className="tempo-garmin-muted-button" disabled={busy} onClick={()=>setPreview(null)}>Abbrechen</button></div>
    </div>}
  </div>
}
