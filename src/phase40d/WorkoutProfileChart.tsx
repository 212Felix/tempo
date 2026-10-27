import type {TrainingRecord} from '../planning/engine'
import {cyclingIntervalSteps,formatPace,type TrainingStep} from '../phase37/intervals'
import {chartSegments} from '../phase40c/interval-chart'
import './phase40d.css'

const tones:Record<TrainingStep['effort'],string>={warmup:'#78a8be',work:'#e3ad5c',recovery:'#70b5d6',endurance:'#65bba5',cooldown:'#819aac'}
export function hasWorkoutProfile(session:TrainingRecord):boolean{
 if(session.workoutSteps?.length)return true
 return Boolean(cyclingIntervalSteps(session))
}
/** No synthetic intervals, speed or pace. Bar width represents real scheduled time. */
export default function WorkoutProfileChart({session,ftp,compact=true}:{session:TrainingRecord;ftp?:number;compact?:boolean}){
 const steps=session.workoutSteps?.length?session.workoutSteps:cyclingIntervalSteps(session)
 if(!steps?.length)return null
 const bike=session.sessionType!=='run'&&session.sessionType!=='manual-running'
 const segments=chartSegments(steps,bike?ftp:undefined),total=segments.at(-1)?.endSeconds??0
 if(!total)return null
 const values=steps.map(s=>bike?(typeof ftp==='number'&&ftp>0&&s.lowFtp!==undefined&&s.highFtp!==undefined?ftp*(s.lowFtp+s.highFtp)/2:undefined):s.paceMinPerKm)
 const hasValues=values.some(v=>typeof v==='number'&&v>0)
 const scale=hasValues?Math.max(...values.filter((v):v is number=>typeof v==='number'&&v>0)):1
 const width=460,left=35,right=10,top=10,bottom=25,height=compact?115:170,plotW=width-left-right,plotH=height-top-bottom
 const y=(index:number)=>{
  const value=values[index]
  if(value===undefined)return plotH*.16
  // Running: faster pace (smaller min/km) is a taller bar.
  const ratio=bike?value/scale:Math.min(1,Math.max(.1,(1/value)/(1/Math.min(...values.filter((v):v is number=>typeof v==='number'&&v>0)))) )
  return Math.max(plotH*.1,ratio*plotH*.9)
 }
 return <div className={`tempo40d-profile ${compact?'compact':''}`} data-tempo-no-swipe>
  <div className="tempo40d-chart-head"><strong>{bike?'🚴 Watt-Zeit-Profil':'🏃 Pace-Zeit-Profil'}</strong><small>{hasValues?(bike?'Watt · Minuten':'min/km · Minuten'):'Trainingsabschnitte · Minuten'}</small></div>
  <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${steps.length} Trainingsphasen, insgesamt ${Math.round(total/60)} Minuten. ${hasValues?'Mit gespeicherten Intensitätswerten':'Keine konkreten Leistungswerte hinterlegt'}`}>
    {[0,.5,1].map(f=><line key={f} x1={left} x2={width-right} y1={top+plotH*(1-f)} y2={top+plotH*(1-f)} stroke="currentColor" strokeOpacity=".14" strokeDasharray="4 5"/>) }
    {steps.map((s,i)=>{const seg=segments[i],w=seg.seconds/total*plotW,x=left+seg.startSeconds/total*plotW,h=y(i),label=bike?(values[i]!==undefined?`${Math.round(values[i]!)} W`:'Ohne Wattziel'):(values[i]!==undefined?formatPace(values[i]!):'Ohne Paceziel');return <g key={s.id}><rect x={x} y={top+plotH-h} width={Math.max(1,w-1)} height={h} rx="2" fill={tones[s.effort]} opacity={values[i]===undefined?.55:1}/><title>{s.title} · {Math.round(s.seconds/60)} Min. · {label}</title></g>})}
    {[0,.25,.5,.75,1].map(f=><text key={f} x={left+f*plotW} y={height-6} textAnchor="middle" fontSize="11" fill="currentColor" opacity=".78">{Math.round(total*f/60)}′</text>)}
  </svg>
  {!compact&&<div className="tempo40d-profile-legend">{(Object.keys(tones) as TrainingStep['effort'][]).map(k=><span key={k}><i style={{background:tones[k]}}/>{({warmup:'Einlaufen / Einfahren',work:'Intervall',recovery:'Erholung',endurance:'Grundlage',cooldown:'Auslaufen / Ausfahren'})[k]}</span>)}</div>}
  <small>Geplante Abschnitte · keine gemessene Ist-Leistung. Für Einzelwerte Abschnitt antippen.</small>
 </div>
}
