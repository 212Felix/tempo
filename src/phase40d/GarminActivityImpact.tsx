import {useEffect,useState} from 'react'
import {listRecords} from '../db/storage'
import type {GarminActivity} from '../garmin/csv'
import {activeGarminActivities} from '../garmin/stored-duplicates'
import {currentKey} from '../planning/engine'
import './phase40d.css'
const format=(n:number,digits=0)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:digits}).format(n)
export default function GarminActivityImpact(){
 const [activities,setActivities]=useState<GarminActivity[]>([])
 useEffect(()=>{let live=true;const load=()=>void listRecords<GarminActivity>('externalActivities').then(x=>{if(live)setActivities(activeGarminActivities(x.filter(a=>a.profileId==='local-primary-profile'&&['cycling','running'].includes(a.sport))))}).catch(()=>undefined);load();window.addEventListener('tempo:garmin-import-change',load);window.addEventListener('tempo:training-change',load);return()=>{live=false;window.removeEventListener('tempo:garmin-import-change',load);window.removeEventListener('tempo:training-change',load)}},[])
 const today=currentKey(),start=new Date(`${today}T12:00:00Z`);start.setUTCDate(start.getUTCDate()-6)
 const last=activities.filter(a=>a.date>=start.toISOString().slice(0,10)&&a.date<=today)
 if(!last.length)return null
 const minutes=last.reduce((n,a)=>n+a.durationMin,0),km=last.reduce((n,a)=>n+(a.distanceKm??0),0),hm=last.reduce((n,a)=>n+(a.elevationM??0),0)
 return <section className="tempo40d-activity-impact"><strong>⌚ Garmin · tatsächliche Belastung (7 Tage)</strong><div><span>{last.length} Einheiten</span><span>{format(minutes)} min</span><span>{format(km,1)} km</span><span>{format(hm)} hm</span></div><small>Nur eindeutig vorhandene und nicht ausgeblendete Garmin-Aktivitäten. Diese Trainingsdaten fließen in die Vorschläge für individuelle Einheiten ein; bestehende Kalendereinträge werden nicht automatisch geändert.</small></section>
}
