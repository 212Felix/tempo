import {useCallback,useEffect,useMemo,useState} from 'react'
import {getRecord,listRecords,saveRecord} from '../db/storage'
import type {GarminActivity} from '../garmin/csv'
import {bridgeRequest,classifyPersonal,commitPersonalImport,validateBridgeUrl,validatePersonalSummary,
 type PersonalCandidate,type PersonalDecision} from './garmin-sync'
import './garmin-sync.css'

const CONFIG_ID='garmin-personal-bridge:local-primary-profile'
const PROFILE='local-primary-profile'
// Deliberately never persisted: this is NOT the Garmin API key, but a separate
// private bridge access code. Browser reload / app termination clears it.
let activeBridgeCode=''
const dates=(x:string)=>new Date(x+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})

export default function GarminSyncPanel({onSaved}:{onSaved:()=>void}){
 const [endpoint,setEndpoint]=useState('')
 const [accessCode,setAccessCode]=useState(activeBridgeCode)
 const [connected,setConnected]=useState(false)
 const [lastSuccess,setLastSuccess]=useState<string|null>(null)
 const [remoteCount,setRemoteCount]=useState(0)
 const [rows,setRows]=useState<PersonalCandidate[]>([])
 const [existing,setExisting]=useState<GarminActivity[]>([])
 const [choices,setChoices]=useState<Record<string,string>>({})
 const [loading,setLoading]=useState(false)
 const [notice,setNotice]=useState('Dein persönlicher Garmin-Schlüssel bleibt ausschließlich im privaten Cloudflare Worker.')
 const [newlyImported,setNewlyImported]=useState(0)
 useEffect(()=>{let live=true
  void getRecord('settings',CONFIG_ID).then(r=>{if(live&&typeof r?.endpoint==='string')setEndpoint(r.endpoint)})
  return()=>{live=false}
 },[])
 const refresh=useCallback(async(url:string,code:string)=>{
  const [status,raw,known]=await Promise.all([
   bridgeRequest(url,code,'/v1/status') as Promise<{connected:boolean;lastSuccess:string|null;stored:number}>,
   bridgeRequest(url,code,'/v1/activities') as Promise<{activities:unknown[]}>,
   listRecords<GarminActivity>('externalActivities')])
  if(!Array.isArray(raw.activities))throw Error('Ungültige Antwort des Synchronisierungsdienstes.')
  const safe=raw.activities.map(validatePersonalSummary).filter((a):a is NonNullable<typeof a>=>a!==null)
  const local=known.filter(x=>x.profileId===PROFILE&&(x.source==='garmin-personal'||x.source==='garmin-fit'||x.source==='garmin-csv'))
  const preliminary=classifyPersonal(safe,local)
  const fresh=preliminary.filter(r=>r.status==='new')
  let imported=0
  if(fresh.length){
    const importedResult=await commitPersonalImport(fresh,[],local)
    imported=importedResult.created
    // Read again: transaction is complete and we must classify against actual storage.
    const updated=(await listRecords<GarminActivity>('externalActivities'))
      .filter(x=>x.profileId===PROFILE&&(x.source==='garmin-personal'||x.source==='garmin-fit'||x.source==='garmin-csv'))
    setExisting(updated);setRows(classifyPersonal(safe,updated))
    setNewlyImported(imported)
    onSaved()
  }else{
    setExisting(local);setRows(preliminary)
  }
  setConnected(status.connected)
  setLastSuccess(status.lastSuccess);setRemoteCount(status.stored);setChoices({})
  activeBridgeCode=code
  setNotice(`${safe.length} unterstützte Garmin-Aktivitäten gefunden. ${imported} eindeutige neue Aktivitäten direkt übernommen. Überschneidungen bitte prüfen.`)
 },[onSaved])
 const pending=useMemo(()=>rows.filter(x=>x.status!=='already'),[rows])
 const visiblePending=pending.slice(0,40)
 const unclear=visiblePending.filter(x=>x.status==='review'&&!choices[x.activity.garminActivityId])
 async function authorize(){
  setLoading(true)
  try{
   const url=validateBridgeUrl(endpoint)
   if(!url)throw Error('Nur die HTTPS-Adresse deines eigenen Cloudflare Workers ist zulässig.')
   await saveRecord('settings',{id:CONFIG_ID,profileId:PROFILE,createdAt:'',updatedAt:'',endpoint:url})
   await refresh(url,accessCode)
  }catch(e){setNotice(`Verbindung nicht möglich: ${e instanceof Error?e.message:'Unbekannter Fehler'}`)}
  finally{setLoading(false)}
 }
 async function syncNow(){
  setLoading(true)
  try{
   const reply=await bridgeRequest(endpoint,accessCode,'/v1/sync','POST') as {newStored?:number}
   await refresh(endpoint,accessCode)
   setNotice(`Garmin-Abfrage beendet. ${reply.newStored??0} neue Aktivitäten auf dem privaten Server erkannt. Eindeutige neue Einträge wurden lokal übernommen.`)
  }catch(e){setNotice(`Synchronisierung fehlgeschlagen: ${e instanceof Error?e.message:'Unbekannter Fehler'}`)}
  finally{setLoading(false)}
 }
 async function save(){
  if(unclear.length){setNotice('Bitte alle möglichen Doppelungen einzeln prüfen.');return}
  setLoading(true)
  try{
   const decisions:PersonalDecision[]=visiblePending.map(r=>({garminActivityId:r.activity.garminActivityId,targetId:choices[r.activity.garminActivityId]??'new'}))
   const result=await commitPersonalImport(rows.filter(r=>r.status==='already'||visiblePending.includes(r)),decisions,existing)
   setNewlyImported(result.created+result.linked)
   setNotice(`${result.created} neue Aktivitäten importiert, ${result.linked} vorhandenen zugeordnet, ${result.skipped} bereits vorhanden oder übersprungen. Dein Trainingsplan blieb unverändert.`)
   onSaved()
   await refresh(endpoint,accessCode)
   setNotice(`${result.created} neu importiert · ${result.linked} zugeordnet · ${result.skipped} übersprungen. Keine automatische Planänderung.`)
  }catch(e){setNotice(`Lokaler Import fehlgeschlagen: ${e instanceof Error?e.message:'Unbekannter Fehler'}`)}
  finally{setLoading(false)}
 }
 return <section className="tempo39-sync-panel" aria-label="Garmin Synchronisierung">
   <div className="tempo39-heading"><div><div className="eyebrow">GARMIN CONNECT · PERSONAL API</div><h2>Garmin Synchronisierung</h2></div><span className={`tempo39-connection ${connected?'online':''}`}>{connected?'● Bereit':'○ Noch nicht verbunden'}</span></div>
   <p className="tempo39-intro">Trainings werden aus der offiziellen Garmin Personal API abgerufen. Der Garmin-API-Schlüssel bleibt im Cloudflare-Secret. TEMPO erhält nur Aktivitätsdaten, keine Zugangsdaten.</p>
   <div className="tempo39-sync-stats"><div><strong>{lastSuccess?new Date(lastSuccess).toLocaleString('de-DE'):'—'}</strong><span>Letzte Server-Synchronisierung</span></div><div><strong>{remoteCount}</strong><span>Privat verfügbar</span></div><div><strong>{newlyImported}</strong><span>Zuletzt in TEMPO übernommen</span></div></div>
   <div className="tempo39-form">
     <label>Private Cloudflare-Worker-Adresse
       <input type="url" inputMode="url" autoComplete="url" placeholder="https://tempo-garmin-private.….workers.dev" value={endpoint} onChange={e=>setEndpoint(e.target.value)} disabled={loading}/>
     </label>
     <label>Separater TEMPO-Zugangscode (nicht der Garmin-API-Schlüssel!)
       <input type="password" autoComplete="off" spellCheck={false} placeholder="Privaten Worker-Zugangscode eingeben" value={accessCode} onChange={e=>setAccessCode(e.target.value)} disabled={loading}/>
     </label>
     <div className="tempo39-buttons"><button type="button" onClick={()=>void authorize()} disabled={loading||!endpoint||!accessCode}>{loading?'Bitte warten…':'Verbindung prüfen & Aktivitäten laden'}</button><button type="button" onClick={()=>void syncNow()} disabled={loading||!connected}>Jetzt synchronisieren</button></div>
   </div>
   <p className="tempo39-small">Der Zugangscode wird aus Sicherheitsgründen nicht dauerhaft gespeichert. Die Worker-Adresse merkt sich TEMPO lokal. Die automatische Server-Abfrage läuft unabhängig davon im Hintergrund; für den Abruf aufs iPhone musst du dich erneut legitimieren, nachdem die App geschlossen wurde.</p>
   <p className="tempo39-notice" role="status">{notice}</p>
   {rows.length>0&&<section className="tempo39-candidates"><h3>Aktivitäten abgleichen</h3>
     <p>{rows.filter(r=>r.status==='already').length} bereits bekannt · {pending.filter(r=>r.status==='new').length} neu · {pending.filter(r=>r.status==='review').length} bitte prüfen</p>
     {visiblePending.map(r=><div key={r.activity.garminActivityId} className="tempo39-item">
       <div><strong>{r.activity.title}</strong><small>{dates(r.activity.date)} · {r.activity.sport==='cycling'?'🚴 Rad':r.activity.sport==='running'?'🏃 Lauf':'🏊 Schwimmen'} · {Math.round(r.activity.durationSeconds/60)} min · {r.activity.distanceKm?.toFixed(1)??'—'} km</small></div>
       {r.status==='review'?<><label className="tempo39-select-label">Möglicherweise bereits gespeichert
         <select value={choices[r.activity.garminActivityId]??''} onChange={e=>setChoices(prev=>({...prev,[r.activity.garminActivityId]:e.target.value}))}>
           <option value="">Bitte entscheiden</option><option value="skip">Nicht importieren</option><option value="new">Trotzdem als neue Aktivität speichern</option>
           {r.matches.map(m=><option value={m.id} key={m.id}>Mit {m.date} · {m.title} verknüpfen</option>)}
         </select></label></>:<span className="tempo39-new">Neu ✓</span>}
     </div>)}
     {pending.length>40&&<p>Es werden zunächst 40 Einträge angezeigt. Nach dem ersten Import erneut laden.</p>}
     <button type="button" className="tempo39-import" disabled={loading||visiblePending.length===0||unclear.length>0} onClick={()=>void save()}>Geprüfte Aktivitäten lokal übernehmen ({visiblePending.length})</button>
     <p className="tempo39-small">Bestehende Datensätze werden nicht überschrieben. Zusammenführen ergänzt fehlende Garmin-Werte. Der Trainingsplan und die Tagesreadiness werden niemals automatisch verändert.</p>
   </section>}
   <details className="tempo39-privacy"><summary>Datenschutz & Einrichtung</summary><p>Dein Garmin-Key liegt ausschließlich in einem Worker-Secret, Aktivitäten nur in deiner privaten D1-Datenbank und lokal in TEMPO. Weder Schlüssel noch GPS-Daten werden im öffentlichen GitHub-Repository gespeichert. Nur Rad, Lauf und Schwimmen werden synchronisiert; FIT-Dateien kannst du weiterhin manuell importieren.</p><p>Zum Einrichten: siehe <strong>docs/PHASE39-GARMIN-EINRICHTUNG.md</strong> im Upload-Paket. Ohne eingerichteten Worker bleibt der vorhandene manuelle Import verfügbar.</p></details>
 </section>
}
