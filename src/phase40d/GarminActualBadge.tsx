import {useEffect,useState} from 'react'
import {listRecords} from '../db/storage'
import type {TempoRecord} from '../db/types'
import './phase40d.css'
type Link=TempoRecord&{plannedSessionId?:string;date?:string;actual?:{durationMin?:number;distanceKm?:number;elevationM?:number;avgPowerW?:number;avgHrBpm?:number}}
export default function GarminActualBadge({plannedId}:{plannedId:string}){
 const [link,setLink]=useState<Link>()
 useEffect(()=>{let alive=true;const load=()=>void listRecords<Link>('settings').then(all=>{if(alive)setLink(all.find(r=>r.id.startsWith('garmin-match:local-primary-profile:')&&r.plannedSessionId===plannedId))}).catch(()=>undefined);load();window.addEventListener('tempo:garmin-import-change',load);return()=>{alive=false;window.removeEventListener('tempo:garmin-import-change',load)}},[plannedId])
 if(!link?.actual)return null
 const a=link.actual
 return <div className="tempo40d-actual">⌚ Garmin-Aktivität automatisch zugeordnet · Tatsächlich: {Math.round(a.durationMin??0)} min{a.distanceKm!==undefined?` · ${a.distanceKm.toFixed(1)} km`:''}{a.elevationM!==undefined?` · ${Math.round(a.elevationM)} hm`:''}{a.avgPowerW!==undefined?` · Ø ${Math.round(a.avgPowerW)} W`:''}{a.avgHrBpm!==undefined?` · Ø ${Math.round(a.avgHrBpm)} bpm`:''}<small>Zuordnung informiert über das Ergebnis. Geplante Einheit und manuelle Abschlüsse werden nicht überschrieben.</small></div>
}
