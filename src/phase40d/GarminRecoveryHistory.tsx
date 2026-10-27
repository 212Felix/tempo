import {useEffect,useState} from 'react'
import {listRecords} from '../db/storage'
import type {TempoRecord} from '../db/types'
import {validateWellness,type Wellness} from '../phase40c/wellness'
import {germanDate} from '../phase40c/date'
import './phase40d.css'
export default function GarminRecoveryHistory(){
 const [days,setDays]=useState<Wellness[]>([])
 useEffect(()=>{let live=true;const load=()=>void listRecords<TempoRecord&{wellness?:Wellness}>('settings').then(rows=>{if(live)setDays(rows.filter(r=>r.id.startsWith('garmin-wellness:local-primary-profile:')).map(r=>validateWellness(r.wellness)).filter((x):x is Wellness=>Boolean(x)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30))}).catch(()=>undefined);load();window.addEventListener('tempo:garmin-wellness-change',load);return()=>{live=false;window.removeEventListener('tempo:garmin-wellness-change',load)}},[])
 return <section className="panel tempo40d-health-history"><details><summary>⌚ Garmin · Schlaf- & Erholungshistorie ({days.length} Tage)</summary>
 {days.length?<><p>Nur tatsächlich von Garmin gelieferte Werte. Kein ersetzter Schlaf- oder HRV-Wert.</p><div className="tempo40d-health-scroll"><table><thead><tr><th>Datum</th><th>Schlaf</th><th>HRV</th><th>Body Battery</th></tr></thead><tbody>{days.map(d=><tr key={d.date}><td>{germanDate(d.date)}</td><td>{d.sleepHours===undefined?'—':`${d.sleepHours.toFixed(1)} h`}</td><td>{d.hrvMs===undefined?'—':`${Math.round(d.hrvMs)} ms`}</td><td>{d.bodyBattery===undefined?'—':Math.round(d.bodyBattery)}</td></tr>)}</tbody></table></div></>:<p>Noch keine Garmin-Erholungsdaten auf diesem iPhone. Unter Garmin Synchronisierung anmelden.</p>}
 </details></section>
}
