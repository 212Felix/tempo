import MovementPreview from './MovementPreview'
import {useEffect,useMemo,useRef,useState} from 'react'
import {listRecords,openTempoDatabase} from '../db/storage'
import type {TempoRecord} from '../db/types'
import {buildRoutine,focusLabels,routineAt,type RecoveryFocus} from './routines'
import {formatSeconds} from '../time/duration'
import HelpDisclosure from '../ui/HelpDisclosure'
import './recovery.css'

const PROFILE_ID='local-primary-profile'
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
type RecoveryEntry=TempoRecord & {date:string;focus:RecoveryFocus;plannedSeconds:number;actualSeconds:number;completed:boolean;notes:string;title:string;durationMin:number;durationSec:number}
export default function RecoveryPanel(){
 const [focus,setFocus]=useState<RecoveryFocus>('full')
 const [duration,setDuration]=useState<5|10|15|20>(10)
 const [elapsed,setElapsed]=useState(0)
 const [running,setRunning]=useState(false)
 const [notes,setNotes]=useState('')
 const [history,setHistory]=useState<RecoveryEntry[]>([])
 const [notice,setNotice]=useState('Bereit für deine Mobility-Routine.')
 const [saving,setSaving]=useState(false)
 const tickAt=useRef<number|null>(null)
 const elapsedWhenStarted=useRef(0)
 const steps=useMemo(()=>buildRoutine(focus,duration),[focus,duration])
 const plannedSeconds=duration*60
 const shown=Math.min(elapsed,plannedSeconds)
 const current=routineAt(steps,shown)
 const percentage=100*shown/plannedSeconds
 const syncHistory=()=>listRecords<RecoveryEntry>('recoverySessions').then(rows=>setHistory(rows.filter(x=>x.profileId===PROFILE_ID).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10)))
 useEffect(()=>{void syncHistory().catch(e=>setNotice(String(e)))},[])
 useEffect(()=>{
   if(!running || tickAt.current===null)return
   const update=()=>setElapsed(Math.min(plannedSeconds,elapsedWhenStarted.current+Math.floor((Date.now()-tickAt.current!)/1000)))
   const interval=window.setInterval(update,250)
   const onHide=()=>{
     if(document.hidden){update();setRunning(false);tickAt.current=null;setNotice('Timer beim Verlassen der App pausiert. Du kannst fortsetzen.')}
   }
   document.addEventListener('visibilitychange',onHide)
   return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',onHide)}
 },[running,plannedSeconds])
 useEffect(()=>{if(elapsed>=plannedSeconds && running){setRunning(false);tickAt.current=null;setNotice('Routine abgeschlossen. Du kannst sie jetzt protokollieren.')}},[elapsed,plannedSeconds,running])
 function pause(){if(tickAt.current!==null)setElapsed(Math.min(plannedSeconds,elapsedWhenStarted.current+Math.floor((Date.now()-tickAt.current)/1000)));tickAt.current=null;setRunning(false)}
 function reset(){pause();setElapsed(0);setNotice('Routine zurückgesetzt. Noch nichts gespeichert.')}
 function changeFocus(next:RecoveryFocus){pause();setElapsed(0);setFocus(next)}
 function changeDuration(next:5|10|15|20){pause();setElapsed(0);setDuration(next)}
 function begin(){if(elapsed>=plannedSeconds)return;elapsedWhenStarted.current=elapsed;tickAt.current=Date.now();setRunning(true)}
 function jump(offset:number){pause();setElapsed(Math.max(0,Math.min(plannedSeconds,offset)))}
 const cumulative=steps.reduce<number[]>((acc,x,i)=>{acc.push((acc[i-1]??0)+x.seconds);return acc},[])
 async function save(){
   pause();if(saving)return
   const actual=Math.min(plannedSeconds,elapsed)
   if(actual<60){setNotice('Bitte mindestens eine Minute Mobility absolvieren, bevor du den Abschluss speicherst.');return}
   setSaving(true)
   const now=new Date().toISOString(),id=`recovery:${PROFILE_ID}:${crypto.randomUUID()}`
   const rec:RecoveryEntry={id,profileId:PROFILE_ID,date:today(),focus,title:`Mobility · ${focusLabels[focus]}`,plannedSeconds,
     actualSeconds:actual,completed:actual===plannedSeconds,notes:notes.trim().slice(0,700),durationMin:actual/60,durationSec:actual,createdAt:now,updatedAt:now}
   try{
     const db=await openTempoDatabase()
     await new Promise<void>((resolve,reject)=>{
       const tx=db.transaction(['recoverySessions','completedSessions'],'readwrite')
       tx.objectStore('recoverySessions').add(rec)
       tx.objectStore('completedSessions').add({id,profileId:PROFILE_ID,date:rec.date,sessionType:'manual-mobility',title:rec.title,
         durationMin:actual/60,durationSec:actual,source:'manuell',notes:rec.notes,createdAt:now,updatedAt:now})
       tx.oncomplete=()=>{db.close();resolve()}
       tx.onerror=()=>{db.close();reject(tx.error??Error('Speichern fehlgeschlagen'))}
       tx.onabort=()=>{db.close();reject(tx.error??Error('Keine Daten gespeichert'))}
     })
     await syncHistory();setNotice(`Mobility mit ${formatSeconds(actual)} gespeichert und in deinem Trainingstagebuch dokumentiert.`)
     setElapsed(0);setNotes('');window.dispatchEvent(new Event('tempo:training-change'))
   }catch(e){setNotice('Speichern fehlgeschlagen: '+(e instanceof Error?e.message:String(e)))}
   finally{setSaving(false)}
 }
 return <div className="tempo-recovery-page">
   <section className="tempo-recovery-panel">
     <div className="eyebrow">RECOVERY · MOBILITY · DEIN TEMPO</div>
     <h2>Beweglichkeit & Erholung</h2>
     <HelpDisclosure id="recovery-intro"><p>Sanfte Mobilität für 5 bis 20 Minuten, passend zu deiner Tagesform. Kein Leistungstest und keine automatische Trainingsfreigabe. Übung auslassen, wenn sie Schmerzen verursacht; bei Verletzung oder Krankheit Belastung medizinisch abklären.</p></HelpDisclosure>
     <h3>Wie viel Zeit hast du?</h3>
     <div className="tempo-recovery-bubbles">{([5,10,15,20] as const).map(n=><button type="button" key={n} className={duration===n?'active':''} onClick={()=>changeDuration(n)}>{n} min</button>)}</div>
     <h3>Dein Schwerpunkt</h3>
     <div className="tempo-recovery-bubbles">{(Object.keys(focusLabels) as RecoveryFocus[]).map(k=><button type="button" key={k} className={focus===k?'active':''} onClick={()=>changeFocus(k)}>{focusLabels[k]}</button>)}</div>
   </section>
   <section className="tempo-recovery-panel">
     <div className="eyebrow">DEINE ROUTINE · {duration} MINUTEN</div>
     <div className="tempo-recovery-timer-head"><h2>{current?.step.name??'Geschafft!'}</h2><strong>{formatSeconds(Math.max(0,plannedSeconds-shown))}</strong></div>
     <p className="tempo-recovery-instruction">{current?.step.instructions??'Routine geschafft! Speichere deinen Abschluss, damit TEMPO die Erholung dokumentiert.'}</p>
     {current?.step.kind==='movement'&&<MovementPreview name={current.step.name}/> }
     <div className="tempo-recovery-progress" role="progressbar" aria-valuenow={shown} aria-valuemin={0} aria-valuemax={plannedSeconds} aria-label="Fortschritt der Routine"><span style={{width:`${percentage}%`}}/></div>
     <p className="tempo-recovery-step">{current?.step.kind==='transition'?'10 Sekunden Wechselpause':`${Math.max(1,Math.ceil((current?.remaining??0)))} Sekunden für diese Übung`} · {formatSeconds(shown)} vergangen</p>
     <div className="tempo-recovery-controls">
       {running?<button type="button" onClick={pause} className="primary">Pause</button>:<button type="button" onClick={begin} className="primary" disabled={shown>=plannedSeconds}>{shown?'Fortsetzen':'Starten'}</button>}
       <button type="button" onClick={reset}>Zurücksetzen</button>
       {current&&<button type="button" onClick={()=>jump(cumulative[current.index]??plannedSeconds)}>Nächster Schritt</button>}
     </div>
     <h3>Übungen</h3>
     <ol className="tempo-recovery-steps">{steps.filter(x=>x.kind==='movement').map((x,i)=><li key={i}>{x.name}</li>)}</ol>
     <label className="tempo-recovery-notes">Notiz (optional)<textarea maxLength={700} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Wie fühlten sich Beine, Hüfte oder Schultern an?"/></label>
     <button type="button" className="tempo-recovery-save" onClick={()=>void save()} disabled={saving||shown<60}>{saving?'Wird gespeichert …':shown===plannedSeconds?'Routine als erledigt speichern':'Bisherige Zeit protokollieren'}</button>
     <p className="tempo-recovery-status" role="status">{notice}</p>
   </section>
   <section className="tempo-recovery-panel">
     <div className="eyebrow">LOKAL GESPEICHERT</div><h2>Deine letzten Routinen</h2>
     {!history.length?<p>Noch keine Recovery-Einheit dokumentiert.</p>:<div className="tempo-recovery-history">{history.map(x=><div key={x.id}><strong>{x.date} · {focusLabels[x.focus]??'Recovery'}</strong><span>{formatSeconds(x.actualSeconds)}</span></div>)}</div>}
   </section>
 </div>
}
