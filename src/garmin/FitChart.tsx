import { useMemo, useState } from 'react'
import type { FitPoint,FitTrace } from './fit'

type Metric='power'|'hr'|'altitude'
const fields:{key:Metric;name:string;unit:string;color:string}[]=[
  {key:'power',name:'Leistung',unit:'W',color:'#96c6dd'},
  {key:'hr',name:'Herzfrequenz',unit:'bpm',color:'#e6a38f'},
  {key:'altitude',name:'Höhe',unit:'m',color:'#b3cba0'},
]
const fmt=(n:number)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(n)
export default function FitChart({trace}:{trace:FitTrace}){
  const [metric,setMetric]=useState<Metric>('power')
  const values=useMemo(()=>{
    const arr=trace.points.filter(p=>typeof p[metric]==='number') as FitPoint[]
    const nums=arr.map(p=>p[metric] as number)
    return {arr,min:Math.min(...nums),max:Math.max(...nums)}
  },[metric,trace])
  const valid=values.arr.length>2
  const duration=Math.max(1,trace.elapsedSeconds??0,trace.points[trace.points.length-1]?.sec??1)
  const range=Math.max(1,values.max-values.min)
  // Draw separate SVG segments where the sensor stops recording.
  const paths=useMemo(()=>{
    if(!valid)return []
    const groups:FitPoint[][]=[]
    let group:FitPoint[]=[]
    for(const p of values.arr){
      if(group.length && p.sec-(group[group.length-1].sec)>60){groups.push(group);group=[]}
      group.push(p)
    }
    if(group.length)groups.push(group)
    return groups.map(g=>g.map((p,i)=>{
      const x=16+(p.sec/duration)*768
      const y=164-((p[metric] as number)-values.min)/range*142
      return `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' '))
  },[valid,values,metric,duration,range])
  const field=fields.find(f=>f.key===metric)!
  return <div className="tempo-fit-chart">
    <div className="tempo-fit-chart-header"><h4>Messwerte im Zeitverlauf</h4><span>{trace.recordCount.toLocaleString('de-DE')} Originalpunkte · Grafik alle 5 Sekunden</span></div>
    <div className="tempo-fit-tabs" role="group" aria-label="Messreihe wählen">
      {fields.map(f=><button key={f.key} type="button" className={metric===f.key?'active':''} onClick={()=>setMetric(f.key)}>{f.name}</button>)}
    </div>
    {valid?<>
      <svg className="tempo-fit-svg" role="img" aria-label={`${field.name} über die Aktivitätsdauer, von ${fmt(values.min)} bis ${fmt(values.max)} ${field.unit}`} viewBox="0 0 800 206" preserveAspectRatio="none">
        {[22,69,117,164].map(y=><line key={y} x1="16" y1={y} x2="784" y2={y} stroke="rgba(190,211,226,.13)"/>) }
        {paths.map((d,i)=><path key={i} d={d} fill="none" stroke={field.color} strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round" />)}
      </svg>
      <div className="tempo-fit-legend"><span>0 h</span><span>{fmt(values.min)}–{fmt(values.max)} {field.unit}</span><span>{(duration/3600).toLocaleString('de-DE',{maximumFractionDigits:1})} h Gesamtzeit</span></div>
    </>:<p className="tempo-garmin-empty">Für diese Fahrt sind keine Daten zu {field.name.toLowerCase()} aufgezeichnet.</p>}
    <p className="tempo-fit-note">Die horizontale Achse zeigt die Zeit seit Start, nicht ausschließlich die gefahrene Zeit. Pausen und fehlende Sensorwerte werden nicht ergänzt. Daraus werden noch keine automatischen Trainingsfreigaben abgeleitet.</p>
  </div>
}
