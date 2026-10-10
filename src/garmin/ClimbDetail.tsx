import {useMemo,useState} from 'react'
import type {FitTrace,FitPoint} from './fit'
import type {ClimbCandidate} from './climbs'
import {analyzeClimb} from './climbAnalysis'

type Metric='power'|'hr'|'altitude'
const metrics:{id:Metric;label:string;unit:string;color:string}[]=[
  {id:'power',label:'Watt',unit:'W',color:'#98c9e1'},
  {id:'hr',label:'Puls',unit:'bpm',color:'#e7a78c'},
  {id:'altitude',label:'Höhe',unit:'m',color:'#b7d4ad'}
]
const display=(n:number|undefined,unit:string)=>n===undefined?'–':`${n.toLocaleString('de-DE',{maximumFractionDigits:0})} ${unit}`
const signed=(n:number|undefined,unit:string)=>n===undefined?'–':`${n>0?'+':''}${n.toLocaleString('de-DE')} ${unit}`

function SectionPlot({points,start,end,metric}:{points:FitPoint[];start:number;end:number;metric:Metric}){
  const selected=metrics.find(x=>x.id===metric)!
  const plot=useMemo(()=>{
    const valid=points.filter(p=>typeof p[metric]==='number'&&Number.isFinite(p[metric]))
    if(valid.length<2)return null
    const numbers=valid.map(p=>p[metric] as number)
    const min=Math.min(...numbers),max=Math.max(...numbers)
    const span=Math.max(1,max-min),duration=Math.max(1,end-start)
    const segments:FitPoint[][]=[]
    let active:FitPoint[]=[]
    valid.forEach(p=>{
      if(active.length && p.sec-active[active.length-1].sec>60){segments.push(active);active=[]}
      active.push(p)
    })
    if(active.length)segments.push(active)
    const paths=segments.map(group=>group.map((p,i)=>{
      const x=16+(p.sec-start)/duration*728
      const y=138-((p[metric] as number)-min)/span*115
      return `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' '))
    return {min,max,paths}
  },[points,start,end,metric])
  return <div className="tempo-climb-plot">
    {plot?<>
      <svg role="img" aria-label={`${selected.label} im ausgewählten Anstieg, Werte zwischen ${display(plot.min,selected.unit)} und ${display(plot.max,selected.unit)}`} viewBox="0 0 760 154" preserveAspectRatio="none">
        {[23,61,99,138].map(y=><line key={y} x1="16" y1={y} x2="744" y2={y} stroke="rgba(185,207,224,.14)" />)}
        {plot.paths.map((path,i)=><path key={i} d={path} stroke={selected.color} fill="none" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"/>)}
      </svg>
      <div className="tempo-climb-plot-legend"><span>Abschnittsbeginn</span><span>{display(plot.min,selected.unit)} – {display(plot.max,selected.unit)}</span><span>Abschnittsende</span></div>
    </>:<p className="tempo-fit-insights-note">Für diesen Abschnitt fehlen ausreichende {selected.label}-Messwerte.</p>}
  </div>
}

export default function ClimbDetail({trace,climb}:{trace:FitTrace;climb:ClimbCandidate}){
  const [metric,setMetric]=useState<Metric>('power')
  const analysis=useMemo(()=>analyzeClimb(trace.points,climb),[trace.points,climb])
  if(!analysis)return <p className="tempo-fit-insights-note">Für diesen Anstieg sind nicht genügend gespeicherte FIT-Messpunkte vorhanden.</p>
  return <div className="tempo-climb-expanded">
    <h5>Detailanalyse · km {climb.startKm.toLocaleString('de-DE')}–{climb.endKm.toLocaleString('de-DE')}</h5>
    <div className="tempo-climb-metrics">
      <div><small>Ø Watt</small><strong>{display(analysis.all.powerW,'W')}</strong></div>
      <div><small>Ø Puls</small><strong>{display(analysis.all.heartRateBpm,'bpm')}</strong></div>
      <div><small>Ø Kadenz</small><strong>{display(analysis.all.cadenceRpm,'rpm')}</strong></div>
    </div>
    <div className="tempo-climb-chart-switch" role="group" aria-label="Messwert des Anstiegs wählen">
      {metrics.map(m=><button type="button" key={m.id} className={metric===m.id?'active':''} aria-pressed={metric===m.id} onClick={()=>setMetric(m.id)}>{m.label}</button>)}
    </div>
    <SectionPlot points={analysis.points} start={analysis.startSec} end={analysis.endSec} metric={metric}/>
    <h5>Erste und zweite Zeithälfte</h5>
    <div className="tempo-climb-halves" role="table" aria-label="Vergleich der Anstiegshälften">
      <div role="row"><strong role="columnheader">Messwert</strong><strong role="columnheader">1. Hälfte</strong><strong role="columnheader">2. Hälfte</strong></div>
      <div role="row"><span role="cell">Ø Leistung</span><span role="cell">{display(analysis.firstHalf.powerW,'W')}</span><span role="cell">{display(analysis.secondHalf.powerW,'W')}</span></div>
      <div role="row"><span role="cell">Ø Herzfrequenz</span><span role="cell">{display(analysis.firstHalf.heartRateBpm,'bpm')}</span><span role="cell">{display(analysis.secondHalf.heartRateBpm,'bpm')}</span></div>
    </div>
    <p className="tempo-fit-insights-note">Unterschied zweite gegenüber erster Hälfte: {signed(analysis.powerDifferenceW,'W')} · {signed(analysis.heartRateDifferenceBpm,'bpm')}. Die Teilung erfolgt nach verstrichener Zeit, nicht nach halber Strecke. Steigung und Fahrtempo können sich unterscheiden. Daraus allein lässt sich keine Ermüdung oder Leistungsverbesserung ableiten.</p>
    <p className="tempo-fit-insights-note">Auswertung aus {analysis.all.sampleCount.toLocaleString('de-DE')} gespeicherten 5-Sekunden-Messpunkten. Messlücken werden nicht aufgefüllt; Mittelwerte sind Stichprobenwerte, keine exakte physiologische Leistungsdiagnostik.</p>
    {analysis.warnings.length>0&&<div className="tempo-climb-warnings">{analysis.warnings.map((warning,i)=><p key={i}>{warning}</p>)}</div>}
  </div>
}
