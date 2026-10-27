import {useEffect,useMemo,useState} from 'react'
import type {GarminActivity} from '../garmin/csv'
import type {FitTrace} from '../garmin/fit'
import {listRecords} from '../db/storage'
import type {ProfileRecord} from '../db/types'
import {activeGarminActivities} from '../garmin/stored-duplicates'
import {fitnessTrend,powerCurve,criticalPower,durability,aerobicDrift,criticalSpeed,climbSummary} from './analysis-metrics'
import {germanDate} from '../phase40c/date'
import './phase40e.css'
const fmt=(v:number|undefined,d=0)=>v===undefined?'—':new Intl.NumberFormat('de-DE',{maximumFractionDigits:d}).format(v)
function TrendPlot({lines}:{lines:{label:string;values:(number|null)[];color:string}[]}){
 const valid=lines.flatMap(l=>l.values).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v))
 if(!valid.length)return null
 const mn=Math.min(0,...valid),mx=Math.max(...valid),range=Math.max(1,mx-mn)
 return <div><svg className="tempo40e-plot" viewBox="0 0 470 150" role="img" aria-label={lines.map(x=>x.label).join(', ')+' als Wochenverlauf'}>
 {[0,.5,1].map(f=><line key={f} x1="30" x2="465" y1={12+f*116} y2={12+f*116} stroke="currentColor" strokeOpacity=".17" strokeDasharray="4 4"/>)}
 {lines.map(l=>{const groups:string[]=[];let path='';l.values.forEach((v,i)=>{if(v===null){if(path)groups.push(path);path='';return}const x=30+i/Math.max(1,l.values.length-1)*430,y=128-(v-mn)/range*116;path+=`${path?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)} `});if(path)groups.push(path);return groups.map((p,i)=><path key={l.label+i} d={p} stroke={l.color} strokeWidth="2.4" fill="none"/>)})}
 </svg><div className="tempo40e-legend">{lines.map(l=><span key={l.label}><i style={{background:l.color}}/>{l.label}</span>)}</div></div>
}
export default function PerformanceAnalysis(){
 const [activities,setActivities]=useState<GarminActivity[]>([]),[traces,setTraces]=useState<FitTrace[]>([]),[profile,setProfile]=useState<ProfileRecord>()
 useEffect(()=>{let live=true;const refresh=()=>void Promise.all([listRecords<GarminActivity>('externalActivities'),listRecords<FitTrace>('performanceEntries'),listRecords<ProfileRecord>('profiles')]).then(([a,t,p])=>{if(!live)return;setActivities(activeGarminActivities(a.filter(x=>x.profileId==='local-primary-profile')));setTraces(t.filter(x=>x.kind==='garmin-fit-trace'));setProfile(p.find(x=>x.id==='local-primary-profile'))}).catch(()=>undefined)
 refresh();window.addEventListener('tempo:garmin-import-change',refresh);return()=>{live=false;window.removeEventListener('tempo:garmin-import-change',refresh)}},[])
 const trend=useMemo(()=>fitnessTrend(activities,profile?.ftpWatts),[activities,profile?.ftpWatts]);const last=trend.at(-1)
 const rides=activities.filter(a=>a.sport==='cycling'),runs=activities.filter(a=>a.sport==='running')
 const cyclingTraces=traces.filter(t=>rides.some(a=>a.id===t.activityId)),runningTraces=traces.filter(t=>runs.some(a=>a.id===t.activityId))
 const curve=useMemo(()=>powerCurve(cyclingTraces),[cyclingTraces]),cp=criticalPower(curve)
 const longRide=cyclingTraces.filter(t=>(t.elapsedSeconds??t.points.at(-1)?.sec??0)>=7200).sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0]
 const durable=longRide?durability(longRide.points):null
 const bikeDrift=cyclingTraces.map(t=>({date:t.startedAt.slice(0,10),drift:aerobicDrift(t.points,'cycling')})).filter(x=>x.drift).sort((a,b)=>b.date.localeCompare(a.date))[0]
 const runDrift=runningTraces.map(t=>({date:t.startedAt.slice(0,10),drift:aerobicDrift(t.points,'running')})).filter(x=>x.drift).sort((a,b)=>b.date.localeCompare(a.date))[0]
 const speed=criticalSpeed(runs)
 const climbs=cyclingTraces.map(t=>({trace:t,climb:climbSummary(t)})).filter(x=>x.climb).sort((a,b)=>b.climb!.ascent-a.climb!.ascent).slice(0,5)
 return <section className="panel tempo40e-panel tempo40e-performance"><div className="eyebrow">PHASE 40E · LEISTUNGSANALYSE</div><h2>Belastung & Leistungsentwicklung</h2>
  <p>Aus den auf diesem iPhone vorhandenen Garmin-Aktivitäten und FIT-Messreihen. Bei unvollständigen Daten bleiben Werte offen. Historische Vergleiche setzen mehrere geeignete Aufzeichnungen voraus.</p>
  <details open><summary><strong>Fitness · Ermüdung · Form</strong></summary><div className="tempo40e-kpi"><div><small>Belastungstrend (42 Tage)</small><strong>{fmt(last?.fitness,1)}</strong></div><div><small>Ermüdungstrend (7 Tage)</small><strong>{fmt(last?.fatigue,1)}</strong></div><div><small>Form-Tendenz</small><strong>{fmt(last?.form,1)}</strong></div></div>
   <TrendPlot lines={[{label:'Fitness-Proxy',values:trend.map(x=>x.fitness),color:'#5faecb'},{label:'Ermüdungs-Proxy',values:trend.map(x=>x.fatigue),color:'#e0a365'},{label:'Form-Proxy',values:trend.map(x=>x.form),color:'#66b8a1'}]}/>
   <small>Orientierende, modellierte Kennzahlen (42-/7-Tage-EMA), **keine Garmin Training Load und keine medizinische Readiness**. Radbelastung aus tatsächlicher Dauer und Ø-Watt/FTP, Laufbelastung vorerst nur aus Dauer. Der Verlauf ist auf die lokal vorhandene Historie begrenzt.</small>
  </details>
  <details><summary><strong>Rad · Leistungskurve & Critical Power</strong></summary>
   <div className="tempo40e-kpi">{curve.map(c=><div key={c.seconds}><small>Beste {c.seconds<3600?c.seconds/60+' Min.':'60 Min.'}</small><strong>{c.watts===undefined?'—':fmt(c.watts)+' W'}</strong></div>)}</div>
   <TrendPlot lines={[{label:'Watt-Zeit-Kurve (gemessen)',values:curve.map(c=>c.watts??null),color:'#79c5d4'}]}/>
   <p>{cp?`Zweipunkt-Schätzung: Critical Power ≈ ${fmt(cp.cp)} W · W′ ≈ ${fmt(cp.wPrimeKj,1)} kJ.`:'Für Critical Power fehlen geeignete gemessene 5- und 20-Minuten-Bestwerte mit abfallender Leistungskurve.'}</p><small>Bestwerte sind rollende FIT-Mittelwerte; die CP-Schätzung aus zwei Zeitpunkten ist kein formaler Maximaltest. W′ nur orientierend.</small>
  </details>
  <details><summary><strong>Durability · längere Radbelastung</strong></summary>
   {durable&&longRide?<p>{germanDate(longRide.startedAt.slice(0,10))}: Vergleich zwischen frühem und spätem 30-Minuten-Abschnitt: {durable.first} W → {durable.late} W ({durable.changePct>0?'+':''}{durable.changePct} %).</p>:<p>Für diesen Vergleich wird eine Rad-FIT-Messreihe von mindestens zwei Stunden mit Wattdaten benötigt.</p>}
   <small>Deskriptiver Verlauf einer Fahrt, kein kausaler Ermüdungsnachweis. Unterschiedliche Intervalle oder Strecken können das Ergebnis stark verändern.</small>
  </details>
  <details><summary><strong>Aerobe Effizienz / HF-Drift</strong></summary>
   <p>Rad: {bikeDrift?.drift?`${germanDate(bikeDrift.date)} · Änderung Leistung/HF ${bikeDrift.drift.driftPct} %`:'Noch kein geeigneter Radverlauf.'}</p>
   <p>Laufen: {runDrift?.drift?`${germanDate(runDrift.date)} · Änderung Geschwindigkeit/HF ${runDrift.drift.driftPct} %`:'Noch kein geeigneter Laufverlauf.'}</p>
   <small>Nur Messreihen über mindestens 40 Minuten mit Puls und Leistung bzw. Distanz. Ohne konstanten Belastungsabschnitt ist dies lediglich ein Effizienzvergleich, keine validierte Herzfrequenz-Entkopplung.</small>
  </details>
  <details><summary><strong>Laufanalyse / Critical Speed</strong></summary>
   {speed?<p>Orientierende Critical Speed aus zwei unterschiedlichen Test-/Wettkampfleistungen: {fmt(speed.metersPerSecond,2)} m/s · {Math.floor(speed.paceSecondsKm/60)}:{String(speed.paceSecondsKm%60).padStart(2,'0')} min/km.</p>:<p>Für Critical Speed fehlen zwei eindeutig als Tests/Wettkämpfe bezeichnete Leistungen mit ausreichend unterschiedlichen Distanzen.</p>}
   <small>Weitere Laufdynamik (z. B. Bodenkontaktzeit) wird nicht erfunden, wenn die FIT-Aufzeichnung sie nicht enthält. Grundlage sind nur passende tatsächliche Trainingsdaten.</small>
  </details>
  <details><summary><strong>Berg- und Anstiegsanalyse</strong></summary>
   {climbs.length?<div>{climbs.map(c=><p key={c.trace.id}>{germanDate(c.trace.startedAt.slice(0,10))}: gemessener kumulierter Anstieg ≈ {c.climb!.ascent} hm · {c.climb!.gainPerHour} hm/h über den Gesamtverlauf.</p>)}</div>:<p>Für die Analyse sind Rad-FIT-Dateien mit Höhenmessungen erforderlich.</p>}
   <small>Die Werte sind aus gefilterten Höhenpunkten errechnet. Einzelne Anstiege, echte Segmentbestleistungen und wattbezogene Klettervergleiche benötigen zusätzliche Segmentdefinitionen. Unter Garmin → Anstiegsbibliothek kannst du vorhandene erkannte Anstiege prüfen.</small>
  </details>
 </section>
}
