import {useEffect,useState} from 'react'
import {listRecords} from '../db/storage'
import type {ProfileRecord,TempoRecord} from '../db/types'
import type {TrainingRecord} from '../planning/engine'
import type {GarminActivity} from '../garmin/csv'
import type {FitTrace} from '../garmin/fit'
import type {CompletedLink,MatchLink} from './analysis'
import {linkedActual,activityStatus,isBike,isRun,overallAssessment,compareIntervals,sportLabel,intervalDeviationHint} from './analysis'
import {cyclingIntervalSteps} from '../phase37/intervals'
import type {TrainingStep} from '../phase37/intervals'
import {germanDate} from '../phase40c/date'
import FitChart from '../garmin/FitChart'
import FitInsights from '../garmin/FitInsights'
import RoutePreview from './RoutePreview'
import './phase40e.css'

export type SessionData={completed:CompletedLink[];activities:GarminActivity[];links:MatchLink[];traces:FitTrace[]}
const initial:SessionData={completed:[],activities:[],links:[],traces:[]}
export async function loadSessionData():Promise<SessionData>{
 const [completed,activities,settings,traces]=await Promise.all([listRecords<CompletedLink>('completedSessions'),listRecords<GarminActivity>('externalActivities'),listRecords<TempoRecord>('settings'),listRecords<FitTrace>('performanceEntries')])
 return {completed:completed.filter(c=>c.profileId==='local-primary-profile'),activities:activities.filter(a=>a.profileId==='local-primary-profile'),links:settings.filter(s=>s.id.startsWith('garmin-match:local-primary-profile:')) as MatchLink[],traces:traces.filter(t=>t.kind==='garmin-fit-trace')}
}
export function useSessionData(){const [data,setData]=useState<SessionData>(initial)
 useEffect(()=>{let live=true;const load=()=>void loadSessionData().then(rows=>{if(live)setData(rows)}).catch(()=>undefined)
  load();for(const key of ['tempo:training-change','tempo:garmin-import-change','tempo:garmin-change'])window.addEventListener(key,load)
  return()=>{live=false;for(const key of ['tempo:training-change','tempo:garmin-import-change','tempo:garmin-change'])window.removeEventListener(key,load)}},[])
 return data
}
const labels={erledigt:'✓ Abgeschlossen',teilweise:'◐ Teilweise absolviert',offen:'○ Offen',verschoben:'↔ Verschoben',ausgefallen:'× Ausgefallen','garmin-pruefen':'⌚ Garmin-Vorschlag prüfen'} as const
export function SessionStatus({session,data,compact=false}:{session:TrainingRecord;data:SessionData;compact?:boolean}){
 const status=activityStatus(session,data.completed,data.links)
 return <span className={`tempo40e-status tempo40e-${status} ${compact?'small':''}`}>{labels[status]}</span>
}
const fmt=(v:number|undefined,digits=0)=>v===undefined?'—':new Intl.NumberFormat('de-DE',{maximumFractionDigits:digits}).format(v)
const paceFormat=(n:number)=>{const sec=Math.round(n*60);return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
const metricLabel=(m:string)=>m==='watt'?'W':m==='ftp'?'% FTP':m==='hr'?'bpm':'min/km'
export function OverlapTrainingChart({session,steps,trace,ftp,compact=false}:{session:TrainingRecord;steps:TrainingStep[];trace?:FitTrace;ftp?:number;compact?:boolean}){
 const bike=isBike(session),run=isRun(session)
 const metrics=(bike?['watt','ftp','hr']:run?['pace','hr']:['hr']) as ('watt'|'ftp'|'hr'|'pace')[]
 const [metric,setMetric]=useState<'watt'|'ftp'|'hr'|'pace'>(bike?'watt':run?'pace':'hr')
 const [selected,setSelected]=useState<number|null>(null)
 const chosen=metrics.includes(metric)?metric:metrics[0]
 const segments=compareIntervals(steps,trace?.points,chosen,ftp)
 const total=segments.at(-1)?.end??0
 const nums=segments.flatMap(s=>[s.targetLow,s.targetHigh,s.actual]).filter((v):v is number=>v!==undefined&&Number.isFinite(v))
 const min=chosen==='pace'?(nums.length?Math.max(0,Math.min(...nums)-.3):0):0
 const max=nums.length?Math.max(min+1,Math.max(...nums)*(chosen==='pace'?1.07:1.15)):1
 const width=480,height=compact?146:215,left=45,top=16,bottom=31,plotH=height-top-bottom,plotW=width-left-10
 const y=(v:number)=>top+(chosen==='pace'?(v-min)/(max-min):1-(v-min)/(max-min))*plotH
 const chosenSeg=selected===null?undefined:segments[selected]
 if(!steps.length||total<=0)return null
 return <div className={`tempo40e-overlap ${compact?'compact':''}`} data-tempo-no-swipe>
  <div className="tempo40e-chart-top"><strong>{bike?'🚴 Trainingsprofil':run?'🏃 Laufprofil':'Trainingsprofil'}</strong><label>Achse <select value={chosen} onChange={e=>{setMetric(e.target.value as typeof chosen);setSelected(null)}}>{metrics.map(m=><option key={m} value={m}>{m==='watt'?'Watt':m==='ftp'?'% FTP':m==='pace'?'Pace':'Herzfrequenz'}</option>)}</select></label></div>
  <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="group" aria-label="Interaktiver Soll-Ist-Zeitverlauf: Abschnitt antippen, um Daten zu sehen">
   {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={left} x2={width-10} y1={top+t*plotH} y2={top+t*plotH} stroke="currentColor" strokeOpacity=".12" strokeDasharray="3 4"/><text x={left-6} y={top+t*plotH+4} textAnchor="end" fontSize="10" fill="currentColor">{chosen==='pace'?paceFormat(min+(max-min)*t):Math.round(min+(max-min)*(1-t))}</text></g>)}
   {segments.map((s,i)=>{
    const x=left+s.start/total*plotW,w=Math.max(2,(s.end-s.start)/total*plotW-2)
    const target=s.targetLow!==undefined&&s.targetHigh!==undefined?(s.targetLow+s.targetHigh)/2:undefined
    const ty=target!==undefined?Math.min(y(target),top+plotH):top+plotH,ay=s.actual!==undefined?Math.min(y(s.actual),top+plotH):top+plotH
    const tone=s.quality==='high'?'#de9561':s.quality==='warn'?'#e4bf73':'#4bb59e'
    return <g key={s.id}>
      {target!==undefined&&<rect x={x} y={Math.min(ty,top+plotH-2)} width={w} height={Math.max(2,top+plotH-ty)} rx="2" fill="#a8bfd2" fillOpacity=".18" stroke="#91b0c8" strokeWidth="1.4"/>}
      {s.actual!==undefined&&<rect x={x+w*.23} y={Math.min(ay,top+plotH-2)} width={Math.max(2,w*.54)} height={Math.max(2,top+plotH-ay)} rx="2" fill={tone} fillOpacity=".95"/>}
      {s.quality==='high'&&<circle cx={x+w/2} cy={top+6} r="4.5" fill="#de9561"/>}
      <rect x={x} y={top} width={w} height={plotH} fill="transparent" tabIndex={0} role="button" aria-label={`${s.name}: ${target===undefined?'Kein Soll':fmt(target,1)+' '+metricLabel(chosen)}, Ist: ${s.actual===undefined?'nicht verfügbar':fmt(s.actual,1)+' '+metricLabel(chosen)}`} onClick={()=>setSelected(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(i)}}} onMouseEnter={()=>setSelected(i)}><title>{s.name}: Soll {target===undefined?'—':fmt(target,1)} / Ist {s.actual===undefined?'—':fmt(s.actual,1)} {metricLabel(chosen)}</title></rect>
    </g>
   })}
   {[0,.25,.5,.75,1].map(t=><text key={t} x={left+plotW*t} y={height-7} fontSize="11" textAnchor="middle" fill="currentColor">{Math.round(total*t/60)}′</text>)}
  </svg>
  <div className="tempo40e-legend"><span><i className="target"/> Geplant · SOLL</span><span><i className="actual"/> Gemessen · IST</span><span><i className="warning"/> Abweichung</span></div>
  {chosenSeg&&<div className="tempo40e-selected" role="status"><strong>{chosenSeg.name}</strong><span>SOLL: {chosenSeg.targetLow===undefined?'Nicht vorgegeben':`${fmt(chosenSeg.targetLow,1)}${chosenSeg.targetHigh!==chosenSeg.targetLow?'–'+fmt(chosenSeg.targetHigh,1):''} ${metricLabel(chosen)}`}</span><span>IST: {chosenSeg.actual===undefined?'Keine passende FIT-Messreihe':`${chosen==='pace'?paceFormat(chosenSeg.actual):fmt(chosenSeg.actual,1)} ${metricLabel(chosen)}`}</span>{(chosenSeg.quality==='high'||chosenSeg.quality==='warn')&&<strong className="tempo40e-warning">{chosenSeg.quality==='high'?'Deutliche':'Leichte'} Abweichung: {intervalDeviationHint(chosenSeg,chosen)}</strong>}</div>}
  {!trace&&<small>Garmin-Zusammenfassung vorhanden; für einen IST-Verlauf muss die echte FIT-Messreihe verfügbar sein.</small>}
  {chosen==='hr'&&<small>Ohne festgelegten Zielpuls wird nur die gemessene Herzfrequenz dargestellt.</small>}
 </div>
}
export default function SessionAnalysis({session,profile}:{session:TrainingRecord;profile?:ProfileRecord}){
 const data=useSessionData(),linked=linkedActual(session,data.completed,data.activities,data.links,data.traces)
 const steps=session.workoutSteps?.length?session.workoutSteps:cyclingIntervalSteps(session)??[]
 const bike=isBike(session),run=isRun(session)
 const compare=steps.length&&linked.trace?compareIntervals(steps,linked.trace.points,bike?'watt':run?'pace':'hr',profile?.ftpWatts):[]
 const feedback=overallAssessment(session,linked,compare)
 const actual=linked.activity,completed=linked.completed
 return <section className="tempo40e-session-analysis" data-tempo-no-swipe>
  <div className="tempo40e-analysis-title"><div><div className="eyebrow">TRAININGSANALYSE · {germanDate(session.date)}</div><h3>{sportLabel(session.sessionType)} · SOLL / IST</h3></div><SessionStatus session={session} data={data}/></div>
  {steps.length>0&&<OverlapTrainingChart session={session} steps={steps} trace={linked.trace} ftp={profile?.ftpWatts}/>}
  {!steps.length&&<p>Für dieses Training liegt noch kein exakter Zeit-/Intervallplan vor. Die vorhandenen Ist-Daten werden trotzdem angezeigt.</p>}
  {(actual||completed)?<>
   {linked.proposed&&<p className="tempo40e-unconfirmed">⌚ Automatischer Garmin-Vorschlag: Die Zuordnung ist noch kein bestätigter Trainingsabschluss. Bitte im Garmin-Abgleich überprüfen.</p>}
   <div className="tempo40e-metrics">
    <div><small>Geplante Dauer</small><strong>{fmt(session.durationMin)} min</strong></div>
    <div><small>IST-Dauer</small><strong>{fmt(actual?.durationMin??completed?.durationMin)} min</strong></div>
    <div><small>Strecke</small><strong>{fmt(actual?.distanceKm??completed?.distanceKm,2)} km</strong></div>
    <div><small>Höhenmeter</small><strong>{fmt(actual?.elevationM??completed?.elevationM)} hm</strong></div>
    <div><small>Ø Watt</small><strong>{fmt(actual?.avgPowerW)} W</strong></div>
    <div><small>Ø Herzfrequenz</small><strong>{fmt(actual?.avgHrBpm)} bpm</strong></div>
    <div><small>Ø Laufpace</small><strong>{run&&actual?.distanceKm&&actual.distanceKm>0?paceFormat(actual.durationMin/actual.distanceKm)+' min/km':'—'}</strong></div>
   </div>
   <div className="tempo40e-feedback"><strong>{feedback.label}</strong><p>{feedback.advice}</p><small>Dies ist eine Trainingsinterpretation, keine medizinische Aussage. Streckenverlauf, GPS-Aussetzer, Pausen und manuell veränderte Einheiten können Vergleiche beeinflussen.</small></div>
   {linked.trace&&actual&&<details className="tempo40e-fit-details"><summary>⌚ Vollständigen Garmin-Verlauf, Strecke und Intervalldaten öffnen</summary><FitChart trace={linked.trace}/><FitInsights trace={linked.trace} activity={actual}/><RoutePreview trace={linked.trace}/>{linked.trace.points.some(p=>p.lat!==undefined)&&<p>GPS-Positionen sind in der privaten FIT-Aufzeichnung vorhanden. Detaillierte Strecken- und Anstiegsdaten stehen in der Garmin-Aktivitätsbibliothek.</p>}</details>}
  </>:<p>Diese Einheit hat noch keinen bestätigten Abschluss. Garmin-Daten werden erst nach sicherer Zuordnung ausgewertet.</p>}
 </section>
}

/** Shared small chart: the same interactive analysis used inside a day's training card. */
export function InlineSessionProfile({session,ftp}:{session:TrainingRecord;ftp?:number}){
 const data=useSessionData(),actual=linkedActual(session,data.completed,data.activities,data.links,data.traces)
 const steps=session.workoutSteps?.length?session.workoutSteps:cyclingIntervalSteps(session)??[]
 if(!steps.length||(!isBike(session)&&!isRun(session)))return null
 return <OverlapTrainingChart session={session} steps={steps} trace={actual.trace} ftp={ftp} compact/>
}
