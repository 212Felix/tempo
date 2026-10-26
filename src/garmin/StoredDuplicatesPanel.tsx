import {germanDate} from '../phase40c/date'
import {useEffect,useMemo,useState} from 'react'
import {listRecords,saveRecord} from '../db/storage'
import type {GarminActivity} from './csv'
import {findStoredDuplicateGroups} from './stored-duplicates'

/** A soft-archive keeps every original FIT trace and activity fully recoverable. */
export default function StoredDuplicatesPanel({onChanged}:{onChanged:()=>void}){
 const [rows,setRows]=useState<GarminActivity[]>([])
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const refresh=()=>void listRecords<GarminActivity>('externalActivities').then(setRows).catch(e=>setError(String(e)))
 useEffect(()=>{refresh()},[])
 const groups=useMemo(()=>findStoredDuplicateGroups(rows),[rows])
 const archived=rows.filter(x=>x.profileId==='local-primary-profile'&&typeof x.duplicateOf==='string'&&x.duplicateOf)
 async function markDuplicate(alternate:GarminActivity,canonical:GarminActivity){
  if(!window.confirm(`Nur in TEMPO als mögliche Dublette markieren?\n${alternate.title} → ${canonical.title}\nOriginaldaten und FIT-Verlauf bleiben vollständig gespeichert. Dies kann jederzeit rückgängig gemacht werden.`))return
  setBusy(true);setError('')
  try{await saveRecord('externalActivities',{...alternate,duplicateOf:canonical.id,updatedAt:new Date().toISOString()});refresh();onChanged()}
  catch(e){setError('Markierung nicht gespeichert: '+String(e))}finally{setBusy(false)}
 }
 async function restore(x:GarminActivity){setBusy(true);try{const copy={...x};delete copy.duplicateOf;copy.updatedAt=new Date().toISOString();await saveRecord('externalActivities',copy);refresh();onChanged()}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <details className="tempo40b-duplicate-review"><summary><strong>Gespeicherte Garmin-Dopplungen prüfen</strong> · {groups.length} Verdachtsgruppen · {archived.length} ausgeblendet</summary>
  <p>Nur Vorschläge nach Startzeit, Dauer, Sportart oder identischer Garmin-ID. Überprüfe jede Aktivität. „Als Dublette markieren“ blendet sie aus Statistiken aus, löscht aber weder Originaleintrag noch FIT-Daten.</p>
  {groups.length===0&&<p>Keine eindeutigen Verdachtsgruppen in den aktiven Einträgen gefunden.</p>}
  {groups.map(group=><div className="tempo40b-duplicate-group" key={group.canonical.id}><strong>Bevorzugter Originaleintrag: {group.canonical.title}</strong><small>{germanDate(group.canonical.date)} · {group.canonical.source} · {group.canonical.durationMin} min</small>{group.alternates.map(x=><div key={x.id}><span>{x.title} · {x.source} · {x.durationMin} min</span><button type="button" disabled={busy} onClick={()=>void markDuplicate(x,group.canonical)}>Als Dublette markieren</button></div>)}</div>)}
  {archived.length>0&&<div className="tempo40b-duplicate-group"><strong>Markierungen rückgängig machen</strong>{archived.map(x=><div key={x.id}><span>{germanDate(x.date)} · {x.title}</span><button disabled={busy} onClick={()=>void restore(x)}>Wieder einblenden</button></div>)}</div>}
  {error&&<p role="alert">{error}</p>}
 </details>
}
