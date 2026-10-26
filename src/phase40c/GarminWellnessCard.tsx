import {useEffect,useState} from 'react'
import {getRecord} from '../db/storage'
import type {TempoRecord} from '../db/types'
import {germanDate} from './date'
import {validateWellness,wellnessAdvice,type Wellness} from './wellness'

type Saved=TempoRecord & {wellness?:Wellness}
const profile='local-primary-profile'
export default function GarminWellnessCard({date,compact=false}:{date:string;compact?:boolean}){
 const [data,setData]=useState<Wellness|null>(null)
 useEffect(()=>{let active=true
  const reload=()=>void getRecord<Saved>('settings',`garmin-wellness:${profile}:${date}`).then(x=>{if(active)setData(validateWellness(x?.wellness))}).catch(()=>undefined)
  reload();window.addEventListener('tempo:garmin-wellness-change',reload)
  return()=>{active=false;window.removeEventListener('tempo:garmin-wellness-change',reload)}
 },[date])
 if(!data)return compact?null:<section className="panel tempo40c-wellness"><h3>⌚ Garmin Erholung</h3><p>Noch keine Garmin-Erholungsdaten auf diesem iPhone geladen. Unter Garmin Synchronisierung nach Anmeldung abrufen.</p><small>Deine selbst eingetragene TEMPO-Readiness bleibt unverändert.</small></section>
 return <section className={`tempo40c-wellness ${compact?'compact':'panel'}`}><h3>⌚ Garmin Erholung · {germanDate(data.date)}</h3>
  <div className="tempo40c-wellness-values"><span>Schlaf <b>{data.sleepHours===undefined?'—':`${data.sleepHours.toFixed(1).replace('.',',')} h`}</b></span><span>HRV <b>{data.hrvMs===undefined?'—':`${Math.round(data.hrvMs)} ms`}</b></span><span>Body Battery <b>{data.bodyBattery===undefined?'—':Math.round(data.bodyBattery)}</b></span></div>
  {wellnessAdvice(data)&&<p>{wellnessAdvice(data)}</p>}
  {!compact&&<small>Erfasst: {new Date(data.fetchedAt).toLocaleString('de-DE')} · Ergänzende Messwerte, keine automatische Änderung am Training oder Check-in.</small>}
 </section>
}
