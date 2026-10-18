import {useEffect,useState} from 'react'
import {listRecords} from '../db/storage'
import type {TempoRecord} from '../db/types'
import {followingDay,type TrafficLight,type FuelExperience} from './fuel-model'
import {loadExperiences,saveExperience} from './fuel-storage'
import './phase32.css'
const dateKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export default function MorningFuelingCheck(){
 const [pending,setPending]=useState<FuelExperience[]>([]),[message,setMessage]=useState('')
 const [ratings,setRatings]=useState<Record<string,TrafficLight>>({})
 useEffect(()=>{let live=true;void loadExperiences().then(async items=>{
   // Only show when a completed workout exists, never from a scheduled future workout.
   const today=dateKey();const yesterday=items.filter(x=>followingDay(x.date)===today&&x.tolerance&&!x.nextMorning)
   const completed=await listRecords<TempoRecord>('completedSessions')
   const filtered=yesterday.filter(e=>completed.some(done=>done.date===e.date&&(!e.sessionId||done.plannedSessionId===e.sessionId||done.id===e.sessionId)))
   if(live)setPending(filtered)
 }).catch(()=>undefined);return()=>{live=false}},[])
 async function save(e:FuelExperience){const tone=ratings[e.id];if(!tone)return;try{await saveExperience({...e,nextMorning:tone});setPending(p=>p.filter(x=>x.id!==e.id));setMessage('Verträglichkeit am Folgemorgen gespeichert ✓')}catch(error){setMessage(String(error))}}
 if(!pending.length&&!message)return null
 return <section className="panel tempo-ready-panel tempo32-morning"><div className="eyebrow">NUR NACH EINER BELASTUNG MIT FUELING</div><h2>🧃 Ernährung – Verträglichkeit über Nacht</h2><p>Wie hast du die Verpflegung von gestern nach dem Training und während der Nacht vertragen?</p>
 {pending.map(entry=><div key={entry.id}><strong>Training vom {entry.date}</strong><div className="tempo32-bubbles">{([['green','🟢 Sehr gut'],['yellow','🟡 Okay'],['red','🔴 Beschwerden']] as const).map(([value,text])=><button type="button" key={value} className={`tempo32-bubble ${value} ${ratings[entry.id]===value?'selected':''}`} onClick={()=>setRatings(old=>({...old,[entry.id]:value}))} aria-pressed={ratings[entry.id]===value}>{text}</button>)}</div><button type="button" className="tempo32-save" disabled={!ratings[entry.id]} onClick={()=>void save(entry)}>Morgen-Feedback speichern</button></div>)}
 {message&&<p role="status">{message}</p>}</section>
}
