import {useEffect,useMemo,useState} from 'react'
import {listRecords,getRecord} from '../db/storage'
import type {ProfileRecord,TempoRecord} from '../db/types'
import type {GarminActivity} from '../garmin/csv'
import {PROFILE_ID} from '../planning/engine'
import {deNumber,rideSummary,unlinkedManualCycling,strengthSummary,uniqueImported,emptyStat,addRide,type DoneWithContext,type RideEnvironment,type RideWithLocation} from './activity'
import {RIDE_SETTINGS_ID} from '../cycling/zones'
import HelpDisclosure from '../ui/HelpDisclosure'
import './stats.css'

type RideEnvSettings=TempoRecord & {overrides?:Record<string,RideEnvironment>}
export default function ProgressPanel(){
 const [profile,setProfile]=useState<ProfileRecord>()
 const [garmin,setGarmin]=useState<RideWithLocation[]>([])
 const [completed,setCompleted]=useState<DoneWithContext[]>([])
 const [overrides,setOverrides]=useState<Record<string,RideEnvironment>>({})
 const [range,setRange]=useState('all')
 const [notice,setNotice]=useState('Statistik wird geladen …')
 useEffect(()=>{let mounted=true
   const load=()=>void Promise.all([getRecord<ProfileRecord>('profiles',PROFILE_ID),listRecords<GarminActivity>('externalActivities'),listRecords<DoneWithContext>('completedSessions'),getRecord<RideEnvSettings>('settings',RIDE_SETTINGS_ID)])
     .then(([p,a,c,o])=>{if(!mounted)return;setProfile(p);setGarmin(uniqueImported(a.filter(x=>x.profileId===PROFILE_ID&&(x.source==='garmin-csv'||x.source==='garmin-fit'))));setCompleted(c.filter(x=>x.profileId===PROFILE_ID));setOverrides(o?.overrides??{});setNotice('Lokale Trainingsstatistik geladen ✓')})
     .catch(e=>{if(mounted)setNotice('Ladefehler: '+String(e))})
   load();window.addEventListener('tempo:training-change',load);return()=>{mounted=false;window.removeEventListener('tempo:training-change',load)}
 },[])
 const since=useMemo(()=>{if(range==='all')return '';const today=new Date();if(range==='year')return `${today.getFullYear()}-01-01`;today.setDate(today.getDate()-29);return today.toISOString().slice(0,10)},[range])
 const sums=useMemo(()=>rideSummary(garmin.filter(x=>x.sport==='cycling'),overrides,since),[garmin,overrides,since])
 const strength=useMemo(()=>strengthSummary(completed,since),[completed,since])
 const separate=useMemo(()=>unlinkedManualCycling(completed,since),[completed,since])
 const separateStats=useMemo(()=>{const totals={indoor:emptyStat(),outdoor:emptyStat(),unknown:emptyStat()};for(const item of separate)addRide(totals[item.cyclingEnvironment??'unknown'],item);return totals},[separate])
 const runs=useMemo(()=>garmin.filter(x=>x.sport==='running'&&(!since||x.date>=since)),[garmin,since])
 const format=(number:number)=>deNumber(number)
 return <div className="tempo-stats-stack">
   <section className="panel tempo-stats-panel"><div className="eyebrow">FORTSCHRITT · LEISTUNGSWERTE</div><h2>Deine Entwicklung</h2>
     <div className="tempo-stats-grid"><div><small>FTP</small><strong>{profile?.ftpWatts?`${profile.ftpWatts} W`:'–'}</strong></div><div><small>W/kg</small><strong>{profile?.ftpWatts&&profile.weightKg?deNumber(profile.ftpWatts/profile.weightKg,2):'–'}</strong></div><div><small>Max. Puls</small><strong>{profile?.maxHeartRateBpm?`${profile.maxHeartRateBpm} bpm`:'–'}</strong></div></div>
     <HelpDisclosure id="stats-data">Die Statistik trennt Garmin-Importe und nicht verknüpfte manuelle Abschlüsse. So werden Fahrten aus CSV/FIT nicht blind doppelt summiert. Die Anzeigen beziehen sich nur auf Daten, die auf diesem Gerät in TEMPO vorhanden sind.</HelpDisclosure>
   </section>
   <section className="panel tempo-stats-panel"><div className="eyebrow">RAD · GARMIN-BIBLIOTHEK</div><h2>Indoor / Outdoor</h2>
     <div className="tempo-stats-tabs">{[['30','30 Tage'],['year','Dieses Jahr'],['all','Gesamt']].map(([v,name])=><button key={v} type="button" className={range===v?'selected':''} onClick={()=>setRange(v)}>{name}</button>)}</div>
     <div className="tempo-stats-grid">{([['outdoor','Outdoor'],['indoor','Indoor'],['unknown','Unklar']] as const).map(([value,label])=><div key={value}><small>{label}</small><strong>{sums[value].count} ×</strong><span>{format(sums[value].km)} km</span><span>{deNumber(sums[value].hm,0)} hm</span></div>)}</div>
     <p className="tempo-stats-muted">Zusätzlich {separate.length} nicht mit Garmin verknüpfte Radabschlüsse: {deNumber(separateStats.outdoor.km)} km Outdoor, {deNumber(separateStats.indoor.km)} km Indoor und {deNumber(separateStats.unknown.km)} km unklar. Diese Werte bleiben getrennt, bis ein Abgleich erfolgt.</p>
   </section>
   <section className="panel tempo-stats-panel"><div className="eyebrow">KRAFT · DEINE TRAININGSORTE</div><h2>Studio & Arbeit</h2>
     <div className="tempo-stats-grid"><div><small>Fitnessstudio</small><strong>{strength.studio} ×</strong></div><div><small>Auf Arbeit</small><strong>{strength.arbeit} ×</strong></div><div><small>Ort offen</small><strong>{strength.unknown} ×</strong></div></div>
     <p className="tempo-stats-muted">Nur tatsächlich abgeschlossene Krafttrainings. Historische Einheiten ohne Ortsangabe werden bewusst nicht nachträglich einem Ort zugewiesen.</p>
   </section>
   <section className="panel tempo-stats-panel"><div className="eyebrow">LAUFEN · IMPORTIERTE AKTIVITÄTEN</div><h2>Garmin-Läufe</h2><div className="tempo-stats-grid"><div><small>Läufe</small><strong>{runs.length}</strong></div><div><small>Distanz</small><strong>{format(runs.reduce((sum,x)=>sum+(x.distanceKm??0),0))} km</strong></div><div><small>Bewegungszeit</small><strong>{format(runs.reduce((sum,x)=>sum+x.durationMin,0)/60)} h</strong></div></div><p className="tempo-stats-muted">Garmin-Läufe ohne manuell doppelt angelegte zusätzliche Abschlüsse. Die übrige Laufhistorie bleibt unter „Laufen“ und im Kalender verfügbar.</p></section>
   <p className="tempo-stats-feedback" role="status">{notice}</p>
 </div>
}
