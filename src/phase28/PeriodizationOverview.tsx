import {useEffect,useMemo,useState} from 'react'
import {getRecord,listRecords} from '../db/storage'
import type {ProfileRecord} from '../db/types'
import {BLOCK_INFO,adviseStrengthVolume,type BlockKind} from './periodization'
import {deriveAdaptiveWeeks,type AdaptiveKind} from './adaptive-planner'
import {REGULAR_LEG_SETS} from './strength-dose'
import {deriveSeasonPhases,type TrainingBlock} from '../blocks/library'
import type {GoalEvent} from '../events/library'
import {currentKey,PROFILE_ID,type CompletedRecord,type ReadinessRecord,type ShiftRecord,type TrainingRecord} from '../planning/engine'
import './periodization-overview.css'

const kinds:BlockKind[]=['BASE','STRENGTH','MIT','HIT','VOLUME','MOUNTAIN','RUN']
const fmt=(date:string)=>date.split('-').reverse().join('.')
const blockIcon:Record<AdaptiveKind,string>={BASE:'🚴',STRENGTH:'🏋️',MIT:'⚡',HIT:'🔥',VOLUME:'🚲',MOUNTAIN:'⛰️',RUN:'🏃',RECOVERY:'🌿',TAPER:'🏁'}

export default function PeriodizationOverview({events,blocks}:{events:GoalEvent[];blocks:TrainingBlock[]}){
 const today=currentKey()
 const [focus,setFocus]=useState<BlockKind>('VOLUME')
 const [legSets,setLegSets]=useState(REGULAR_LEG_SETS)
 const [chosen,setChosen]=useState(0)
 const [completed,setCompleted]=useState<CompletedRecord[]>([])
 const [planned,setPlanned]=useState<TrainingRecord[]>([])
 const [shifts,setShifts]=useState<Record<string,ShiftRecord>>({})
 const [readiness,setReadiness]=useState<ReadinessRecord|undefined>()
 const [profile,setProfile]=useState<ProfileRecord|undefined>()
 const [loadError,setLoadError]=useState('')
 const [revision,setRevision]=useState(0)
 useEffect(()=>{
  const changed=()=>setRevision(n=>n+1)
  for(const name of ['tempo:training-change','tempo:shift-change','tempo:readiness-change','tempo:blocks-change','tempo:events-change'])window.addEventListener(name,changed)
  return()=>{for(const name of ['tempo:training-change','tempo:shift-change','tempo:readiness-change','tempo:blocks-change','tempo:events-change'])window.removeEventListener(name,changed)}
 },[])
 useEffect(()=>{
  let live=true
  void Promise.all([
   listRecords<CompletedRecord>('completedSessions'),listRecords<TrainingRecord>('plannedSessions'),
   listRecords<ShiftRecord>('shifts'),getRecord<ReadinessRecord>('readinessEntries',`${PROFILE_ID}:${today}`),
   getRecord<ProfileRecord>('profiles',PROFILE_ID),
  ]).then(([done,existing,duties,ready,personal])=>{
   if(!live)return
   setCompleted(done);setPlanned(existing);setShifts(Object.fromEntries(duties.map(d=>[d.date,d])));setReadiness(ready);setProfile(personal);setLoadError('')
  }).catch(err=>{if(live)setLoadError(`Trainingsdaten nicht verfügbar: ${String(err)}`)})
  return()=>{live=false}
 },[revision,today])
 const stage=useMemo(()=>deriveSeasonPhases(events,today),[events,today])
 const weeks=useMemo(()=>deriveAdaptiveWeeks({start:today,weeks:52,events,blocks,completed,planned,shifts,readiness,regularLegSets:legSets,ftpWatts:profile?.ftpWatts}),
  [today,events,blocks,completed,planned,shifts,readiness,legSets,profile?.ftpWatts])
 const week=weeks[chosen]??weeks[0]
 const advice=adviseStrengthVolume(focus,legSets)
 const current=blocks.find(b=>b.enabled&&b.startDate<=today&&b.endDate>=today)
 const cycle=(w:number)=>Math.floor(w/4)+1
 return <section className="panel tempo-28-period">
  <div className="eyebrow">SAISON 2026/27 · MAKRO / MESO / MIKRO</div>
  <h2>Adaptive Blockperiodisierung</h2>
  <p className="tempo-28-period-muted">Der Saisonkalender leitet Trainingsschwerpunkte aus deinen lokal gespeicherten Rennzielen ab. Deine Dienstplanung, Bereitschaft, Trainingstagebuch und eigenständig angelegten Blöcke begrenzen die Tagesvorschläge. <strong>Keine automatische Überschreibung.</strong></p>
  <div className="tempo-28-period-track"><span>Jahresziele</span><span>4-Wochen-Blöcke</span><span>7-Tage-Plan</span></div>
  <div className="tempo-28-planner-overview" aria-label="Saisonübersicht">
   <div className="tempo-28-planner-header"><h3>Die nächsten 52 Trainingswochen</h3><small>Wochen anklicken, Details darunter ansehen · beginnend Montag</small></div>
   <div className="tempo-28-week-list">
    {weeks.map((w,i)=><button key={w.startDate} type="button" className={`tempo-28-week ${i===chosen?'selected':''} ${w.deload?'deload':''}`} onClick={()=>setChosen(i)} aria-pressed={i===chosen}>
      <span className="tempo-28-week-heading"><strong>W{String(i+1).padStart(2,'0')}</strong><span>{blockIcon[w.kind]} {w.kind}</span></span>
      <small>{fmt(w.startDate)}–{fmt(w.endDate)}</small>
      <small>{w.kind==='TAPER'?'Formspitze':w.kind==='RECOVERY'?'Entlastung':w.deload?'Entlastungswoche':`Meso ${cycle(i)}`}</small>
    </button>)}
   </div>
  </div>
  {week&&<div className="tempo-28-current-week" aria-live="polite">
   <div className="tempo-28-current-head"><div><small>WOCHE {week.number} · MESO {cycle(chosen)}</small><h3>{blockIcon[week.kind]} {week.title} {week.deload&&week.kind!=='TAPER'&&week.kind!=='RECOVERY'?'· Entlastung':''}</h3></div><span>{fmt(week.startDate)} – {fmt(week.endDate)}</span></div>
   {week.goal&&<p className="tempo-28-goal">Ziel: <strong>{week.goal}</strong> {week.goalDate&&`· ${fmt(week.goalDate)}`}{week.goalTentative?' · Termin vorläufig':''}</p>}
   <div className="tempo-28-week-metrics">
    <div><small>Gezielte Radintensität</small><strong>{week.qualityLimit} × / Woche</strong></div>
    <div><small>Krafttermine, wenn möglich</small><strong>{week.strengthSlots} × / Woche</strong></div>
    <div><small>Unterkörper-Arbeitssätze</small><strong>ca. {week.legSets} / Woche</strong></div>
    <div><small>Belastung bereits erfasst</small><strong>{((week.plannedMinutes+week.completedMinutes)/60).toFixed(1).replace('.',',')} h</strong></div>
   </div>
   <div className="tempo-28-week-prescription"><strong>Empfohlene Wochenstruktur</strong><p>{week.kind==='RECOVERY'?'Erholung und leichte Mobilisation; Wiedereinstieg abhängig von Befinden.':week.kind==='TAPER'?'Kurze lockere Radausfahrten; Ermüdung reduzieren. Keine zusätzliche harte Einheit.':`Bis zu ${week.qualityLimit} Radqualität, eine längere Z2-Fahrt${week.longRideMinutes?` (Obergrenze aus Trainingshistorie etwa ${week.longRideMinutes} min)`:''}, ${week.strengthSlots} Krafttermine, ein ruhiger Lauf als ergänzendes Cooper-Training, optional Mobility. Nicht jeder Baustein muss in jede Dienstwoche passen.`}</p>
    {week.hoursRange?<p>Orientierungsrahmen aus dokumentierten Vorwochen: {week.hoursRange[0]}–{week.hoursRange[1]} Stunden (inklusive vorhandener Trainings).</p>:<p>Kein verbindliches Stundenbudget: Bisher reichen die aktuellen Daten nicht für eine belastbare individuelle Wochenstundenzahl.</p>}
    {week.notes.map(note=><p key={note}>• {note}</p>)}
    {week.safeguards.map(note=><p key={note} className="tempo-28-safeguard">⚠ {note}</p>)}
   </div>
   <p className="tempo-28-period-muted">Die tatsächlichen Wochentage werden unter „7-/14-Tage-Plan“ aus Dienst, Verfügbarkeit, Erholung und bestehenden Trainings abgeleitet. Nur explizit bestätigte Vorschläge können leere Tage ergänzen; gespeicherte Einheiten werden nicht verändert.</p>
  </div>}
  {loadError&&<p role="alert" className="tempo-28-safeguard">{loadError}</p>}
  <h3>Blockschwerpunkte verstehen</h3>
  <div className="tempo-28-period-types">{kinds.map(kind=><button type="button" key={kind} className={focus===kind?'active':''} aria-pressed={focus===kind} onClick={()=>setFocus(kind)}><strong>{kind}</strong><small>{BLOCK_INFO[kind].title}</small></button>)}</div>
  <div className="tempo-28-period-detail"><strong>{BLOCK_INFO[focus].focus}</strong><p>{BLOCK_INFO[focus].note}</p>{current&&<p>Aktueller eigener Trainingsblock: <strong>{current.name}</strong></p>}</div>
  <div className="tempo-28-period-sets"><h3>Beinkraft an Radbelastung anpassen</h3><label>Übliche Bein-Arbeitssätze / Woche <input type="number" inputMode="numeric" min="0" max="40" value={legSets} onChange={event=>setLegSets(Math.max(0,Math.min(40,Math.round(Number(event.target.value)||0))))}/></label><div className="tempo-28-period-result"><span>Bei {focus} empfohlen</span><strong>{advice.suggestedLegSets} statt {advice.regularLegSets}</strong><small>{advice.reductionPercent} % weniger Bein-Arbeitssätze · vorsichtige Planungsheuristik</small></div><p>In umfangreichen Radwochen bleiben Kraft A/B möglichst als Routine erhalten; nur die Bein-Arbeitssätze werden reduziert. Die Empfehlung ändert keine gespeicherten Sätze oder Trainings.</p></div>
  <h3>Saisonphasen nach deinen gespeicherten Events</h3>
  {stage.length===0?<p className="tempo-28-period-muted">Ohne datiertes Ziel werden vorsichtige BASE-Wochen angezeigt.</p>:<div className="tempo-28-season-list">{stage.map(part=><div key={part.id} className={part.startDate<=today&&part.endDate>=today?'is-current':''}><strong>{part.title}</strong><span>{fmt(part.startDate)} – {fmt(part.endDate)}</span><small>{part.detail}{part.tentative?' · Termin vorläufig':''}</small></div>)}</div>}
 </section>
}
