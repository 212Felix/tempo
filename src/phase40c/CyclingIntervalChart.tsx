import type {TrainingRecord} from '../planning/engine'
import {cyclingIntervalSteps} from '../phase37/intervals'
import {chartSegments} from './interval-chart'
import './phase40c.css'

const tones:Record<string,string>={Z1:'#68a9cb',Z2:'#67bea5',Z3:'#dfba69',Z4:'#e89557','Z5+':'#e27678',offen:'#647b8e'}
export default function CyclingIntervalChart({session,ftp,compact=false}:{session:TrainingRecord;ftp?:number;compact?:boolean}){
 const steps=session.workoutSteps?.length?session.workoutSteps:cyclingIntervalSteps(session)
 if(!steps?.length)return null // Never fabricate watts or intervals from a vague title.
 const segments=chartSegments(steps,ftp)
 if(!segments.length)return null
 const total=segments.at(-1)?.endSeconds??0
 if(total<=0)return null
 const hasWatts=segments.some(s=>s.watts!==null)
 const limit=Math.max(hasWatts?100:1,...segments.map(s=>hasWatts?(s.highW??0):(s.pct??0)))
 const axis=Math.ceil(limit/(hasWatts?50:.25))*(hasWatts?50:.25)
 const W=680,L=47,R=12,H=compact?115:185,T=16,B=26,plotW=W-L-R,plotH=H-T-B
 const y=(v:number)=>T+plotH-Math.max(0,v/axis)*plotH
 return <div className={`tempo40c-interval ${compact?'compact':''}`} data-tempo-no-swipe>
  <div className="tempo40c-interval-heading"><strong>🚴 Belastungsprofil</strong><small>{hasWatts?'Watt · Zeit':'% FTP · Zeit (FTP im Profil fehlt)'}</small></div>
  <div className="tempo40c-interval-scroll"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${segments.length} Trainingsphasen, insgesamt ${Math.round(total/60)} Minuten. ${hasWatts?'Wattwerte aus deiner FTP':'Wattvorgaben ohne hinterlegte FTP nicht berechenbar'}`}>
   {[0,.5,1].map(p=><g key={p}><line x1={L} x2={W-R} y1={y(axis*p)} y2={y(axis*p)} stroke="currentColor" strokeOpacity=".17" strokeDasharray="4 5"/><text x={L-7} y={y(axis*p)+4} fontSize="12" textAnchor="end" fill="currentColor" opacity=".75">{hasWatts?Math.round(axis*p):Math.round(axis*p*100)}</text></g>)}
   {segments.map((seg,i)=>{
    const x=L+(seg.startSeconds/total)*plotW
    const width=Math.max(1,seg.seconds/total*plotW-1.5)
    const value=hasWatts?seg.watts:seg.pct
    const top=value===null?y(axis*.1):y(value)
    return <g key={`${seg.id}-${i}`}><rect x={x} y={top} width={width} height={Math.max(2,T+plotH-top)} rx="2" fill={tones[seg.zone]} opacity={value===null?.4:1}/><title>{seg.title} · {Math.round(seg.seconds/60)} Min · {seg.lowW!==null?`${seg.lowW}–${seg.highW} W`:seg.pct!==null?`${Math.round(seg.pct*100)} % FTP (FTP fehlt)`:'Kein Leistungsziel'} · {seg.zone}</title></g>
   })}
   {[0,.25,.5,.75,1].map(p=><text key={p} x={L+p*plotW} y={H-7} textAnchor="middle" fontSize="12" fill="currentColor" opacity=".75">{Math.round(total/60*p)}′</text>)}
  </svg></div>
  {!compact&&<div className="tempo40c-legend">{Object.entries(tones).map(([zone,color])=><span key={zone}><i style={{background:color}}/>{zone==='offen'?'ohne Ziel':zone}</span>)}</div>}
  <small className="tempo40c-interval-foot">Geplante Abschnitte, keine Ist-Leistungsdaten. Balkenbreite = Dauer.</small>
 </div>
}
