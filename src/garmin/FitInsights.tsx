import {useMemo} from 'react'
import type {FitTrace} from './fit'
import type {GarminActivity} from './csv'
import {findClimbCandidates} from './climbs'
import './insights.css'

const formatDuration=(seconds:number|undefined)=>{
  if(seconds===undefined||!Number.isFinite(seconds)||seconds<0)return 'Nicht verfügbar'
  const s=Math.round(seconds),h=Math.floor(s/3600),m=Math.floor((s%3600)/60)
  return `${h} h ${String(m).padStart(2,'0')} min`
}
const value=(n:number|undefined,unit:string)=>n===undefined?'–':`${new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(n)} ${unit}`
export default function FitInsights({trace,activity}:{trace:FitTrace;activity?:GarminActivity}){
  const elapsed=trace.elapsedSeconds ?? (trace.points.length>1?trace.points[trace.points.length-1].sec:undefined)
  const timer=trace.timerSeconds
  // CSV "Zeit" is not guaranteed to be precisely the FIT timer-time or moving-time.
  const csvTime=activity?.durationSeconds
  const reference=timer??csvTime
  const gap=elapsed!==undefined&&reference!==undefined&&elapsed>reference ? elapsed-reference:undefined
  const climbs=useMemo(()=>findClimbCandidates(trace.points),[trace.points])
  return <section className="tempo-fit-insights">
    <h4>Fahrzeit und Pausen</h4>
    <div className="tempo-fit-insights-grid">
      <div><small>Gesamtzeit (Start–Ende)</small><strong>{formatDuration(elapsed)}</strong><span>Aus FIT-Zeitstempeln; ältere Dateien ggf. näherungsweise</span></div>
      <div><small>{timer!==undefined?'Timerzeit (FIT)':'Garmin-Zeit (CSV)'}</small><strong>{formatDuration(reference)}</strong><span>{timer!==undefined?'FIT-Sitzungswert':'CSV-Zusammenfassung; nicht sicher Timer- oder Bewegungszeit'}</span></div>
      <div><small>Differenz zur Gesamtzeit</small><strong>{formatDuration(gap)}</strong><span>Pausen und angehaltene Aufzeichnung; nicht als gefahrene Zeit zählen</span></div>
      <div><small>Bewegungszeit (FIT)</small><strong>{formatDuration(trace.movingSeconds)}</strong><span>{trace.movingSeconds===undefined?'Nicht separat im gespeicherten FIT-Datensatz vorhanden':'Nur wenn vom Gerät ausdrücklich erfasst'}</span></div>
    </div>
    <p className="tempo-fit-insights-note">Die Zeitachse der Leistungsgrafik zeigt die <strong>Gesamtzeit</strong>. Bei gestopptem Garmin-Timer können zwischen Messpunkten längere Lücken liegen. TEMPO interpoliert diese Lücken nicht und wertet sie nicht als zusätzliche Trainingsleistung.</p>
    <h4>Mögliche Anstiegsabschnitte</h4>
    {climbs.length? <div className="tempo-climbs-list">{climbs.map((climb,i)=><div className="tempo-climb-item" key={`${climb.startKm}-${i}`}>
      <div className="tempo-climb-head"><strong>Anstiegskandidat {i+1}</strong><small>km {value(climb.startKm,'')} – {value(climb.endKm,'')}</small></div>
      <div className="tempo-climb-details"><span>{value(climb.distanceKm,'km')}</span><span>+{value(climb.riseM,'hm')}</span><span>Ø {value(climb.gradePct,'%')}</span><span>{formatDuration(climb.elapsedSeconds)}</span></div>
      <small>{climb.averagePowerW!==undefined?`Ø ${climb.averagePowerW} W`: 'Keine Wattwerte'} · {climb.averageHrBpm!==undefined?`Ø ${climb.averageHrBpm} bpm`:'kein Puls'} (5-Sekunden-Stichprobe)</small>
    </div>)}</div>:<p className="tempo-fit-insights-note">Keine hinreichend klaren Anstiegskandidaten aus den gespeicherten Höhen- und Distanzpunkten ermittelt.</p>}
    <p className="tempo-fit-insights-note"><strong>Vorläufige Analyse:</strong> Die Erkennung nutzt geglättete Höhenwerte und 5-Sekunden-Stichproben. Steigung und Leistung sind Näherungswerte. Ein Streckenabschnitt gilt damit noch <strong>nicht</strong> als sicherer oder geeigneter Intervallort; GPS, Verkehr, Untergrund und Licht müssen später separat geprüft werden.</p>
  </section>
}
