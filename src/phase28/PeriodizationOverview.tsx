import {useEffect,useMemo,useState,useRef} from 'react'
import {getRecord,listRecords} from '../db/storage'
import type {ProfileRecord} from '../db/types'
import {BLOCK_INFO,adviseStrengthVolume,type BlockKind} from './periodization'
import {deriveAdaptiveWeeks,type AdaptiveKind} from './adaptive-planner'
import {REGULAR_LEG_SETS} from './strength-dose'
import {deriveSeasonPhases,type TrainingBlock} from '../blocks/library'
import type {GoalEvent} from '../events/library'
import {currentKey,PROFILE_ID,type CompletedRecord,type ReadinessRecord,type ShiftRecord,type TrainingRecord} from '../planning/engine'
import './periodization-overview.css'
import {GUIDES,estimateWeek} from '../phase30/block-guides'
import {saveRecord,listRecords as listStore} from '../db/storage'
import type {TempoRecord} from '../db/types'

const kinds:BlockKind[]=['BASE','STRENGTH','MIT','HIT','VOLUME','MOUNTAIN','RUN']
const fmt=(date:string)=>date.split('-').reverse().join('.')
const blockIcon:Record<AdaptiveKind,string>={BASE:'🚴',STRENGTH:'🏋️',MIT:'⚡',HIT:'🔥',VOLUME:'🚲',MOUNTAIN:'⛰️',RUN:'🏃',RECOVERY:'🌿',TAPER:'🏁'}

export default function PeriodizationOverview({events,blocks}:{events:GoalEvent[];blocks:TrainingBlock[]}){
 const today=currentKey()
 const [focus,setFocus]=useState<BlockKind>('VOLUME')
 const [expanded,setExpanded]=useState<string|null>(null)
 const region=useRef<HTMLElement|null>(null)
 const [overrides,setOverrides]=useState<Record<string,{hours?:number;bikeKm?:number}>>({})
 const [editHours,setEditHours]=useState(''),[editKm,setEditKm]=useState('')
 const [savedNotice,setSavedNotice]=useState('')
 useEffect(()=>{let live=true;void listStore<TempoRecord & {weekStart:string;hours?:number;bikeKm?:number}>('settings').then(items=>{if(live)setOverrides(Object.fromEntries(items.filter(x=>x.profileId===PROFILE_ID&&x.id.startsWith('phase30-target:')).map(x=>[x.weekStart,{hours:x.hours,bikeKm:x.bikeKm}])))}).catch(()=>undefined);return()=>{live=false}},[])
 useEffect(()=>{const close=(e:PointerEvent)=>{if(region.current&&!region.current.contains(e.target as Node))setExpanded(null)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[])
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
 const budget=week?estimateWeek(week,overrides[week.startDate]):undefined
 const saveTarget=async()=>{if(!week)return;const hours=Number(editHours.replace(',','.')),bikeKm=Number(editKm.replace(',','.'));if(!Number.isFinite(hours)||hours<1||hours>35||!Number.isFinite(bikeKm)||bikeKm<0||bikeKm>800){setSavedNotice('Stunden (1–35) und Kilometer (0–800) prüfen.');return}try{await saveRecord('settings',{id:`phase30-target:${PROFILE_ID}:${week.startDate}`,profileId:PROFILE_ID,weekStart:week.startDate,hours,bikeKm,createdAt:'',updatedAt:''});setOverrides(old=>({...old,[week.startDate]:{hours,bikeKm}}));setSavedNotice('Individueller Zielkorridor gespeichert. Änderungen an bereits geplanten Einheiten erfolgen nur nach Bestätigung.')}catch(error){setSavedNotice(String(error))}}
 const toggle=(key:string)=>setExpanded(old=>old===key?null:key)
 const current=blocks.find(b=>b.enabled&&b.startDate<=today&&b.endDate>=today)
 const cycle=(w:number)=>Math.floor(w/4)+1
 return <section ref={region} className="panel tempo-28-period">
  <div className="eyebrow">SAISON 2026/27 · MAKRO / MESO / MIKRO</div>
  <h2>Adaptive Blockperiodisierung</h2>
  <p className="tempo-28-period-muted">Der Saisonkalender leitet Trainingsschwerpunkte aus deinen lokal gespeicherten Rennzielen ab. Deine Dienstplanung, Bereitschaft, Trainingstagebuch und eigenständig angelegten Blöcke begrenzen die Tagesvorschläge. <strong>Keine automatische Überschreibung.</strong></p>
  <div className="tempo-28-period-track"><button type="button" onClick={()=>document.getElementById('tempo30-season')?.scrollIntoView({behavior:'smooth'})}>Jahresziele ↓</button><button type="button" onClick={()=>document.getElementById('tempo30-block-types')?.scrollIntoView({behavior:'smooth'})}>4-Wochen-Blöcke ↓</button><button type="button" onClick={()=>document.getElementById('tempo30-week-details')?.scrollIntoView({behavior:'smooth'})}>7-Tage-Plan ↓</button></div>
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
  {week&&<div id="tempo30-week-details" className="tempo-28-current-week" aria-live="polite">
   <div className="tempo-28-current-head"><div><small>WOCHE {week.number} · MESO {cycle(chosen)}</small><h3>{blockIcon[week.kind]} {week.title} {week.deload&&week.kind!=='TAPER'&&week.kind!=='RECOVERY'?'· Entlastung':''}</h3></div><span>{fmt(week.startDate)} – {fmt(week.endDate)}</span></div>
   {week.goal&&<p className="tempo-28-goal">Ziel: <strong>{week.goal}</strong> {week.goalDate&&`· ${fmt(week.goalDate)}`}{week.goalTentative?' · Termin vorläufig':''}</p>}
   <div className="tempo-28-week-metrics">
    <div><small>Gezielte intensive Rad-Einheiten (zusätzlich zu lockerem Radtraining)</small><strong>{week.qualityLimit} × / Woche</strong></div>
    <div><small>Alle Radeinheiten / Woche (Richtwert)</small><strong>{budget?.guide.bikeSessions[0]}–{budget?.guide.bikeSessions[1]} ×</strong></div>
    <div><small>Laufeinheiten / Woche</small><strong>{budget?.guide.runSessions[0]}–{budget?.guide.runSessions[1]} ×</strong></div>
    <div><small>Krafttermine, wenn möglich</small><strong>{week.strengthSlots} × / Woche</strong></div>
    <div><small>Unterkörper-Arbeitssätze</small><strong>ca. {week.legSets} / Woche</strong></div>
    <div><small>Belastung bereits erfasst</small><strong>{((week.plannedMinutes+week.completedMinutes)/60).toFixed(1).replace('.',',')} h</strong></div>
   </div>
   {budget&&<div className="tempo30-block-budget"><h4>Wochenziel · Radfokus und Cooper-Ergänzung</h4><div className="tempo30-budget-line"><span>Trainingszeit: <strong>{budget.hours} h</strong></span><span>Rad: <strong>ca. {budget.bikeKm} km</strong></span><span>Lauf: <strong>ca. {budget.runMin} Min</strong></span></div><small>{budget.manual?'Manuell hinterlegter Zielwert.':budget.fromHistory?'Aus Training und Blockheuristik geschätzt.':'Illustrativer Ausgangsrahmen – noch kein individuell belastbarer Stundennachweis.'} Radkilometer sind abhängig von Strecke, Wind, Indoor/Outdoor und Geschwindigkeit.</small><div className="tempo30-target-edit"><label>Stunden-Ziel<input type="number" min="1" max="35" step="0.5" value={editHours} placeholder={String(budget.hours)} onChange={e=>setEditHours(e.target.value)}/></label><label>Rad-km-Ziel<input type="number" min="0" max="800" step="5" value={editKm} placeholder={String(budget.bikeKm)} onChange={e=>setEditKm(e.target.value)}/></label><button type="button" onClick={()=>{setEditHours(String(budget.hours));setEditKm(String(budget.bikeKm));setSavedNotice('Zielwerte übernommen – jetzt auf Speichern tippen.')}}>Vorschlag übernehmen</button><button type="button" onClick={()=>void saveTarget()}>Zielwerte speichern</button></div>{savedNotice&&<small role="status">{savedNotice}</small>}</div>}
   <div className="tempo-28-week-prescription"><strong>Empfohlene Wochenstruktur</strong><p>{week.kind==='RECOVERY'?'Erholung und leichte Mobilisation; Wiedereinstieg abhängig von Befinden.':week.kind==='TAPER'?'Kurze lockere Radausfahrten; Ermüdung reduzieren. Keine zusätzliche harte Einheit.':`Bis zu ${week.qualityLimit} Radqualität, eine längere Z2-Fahrt${week.longRideMinutes?` (Obergrenze aus Trainingshistorie etwa ${week.longRideMinutes} min)`:''}, ${week.strengthSlots} Krafttermine, ein ruhiger Lauf als ergänzendes Cooper-Training, optional Mobility. Nicht jeder Baustein muss in jede Dienstwoche passen.`}</p>
    {week.hoursRange?<p>Orientierungsrahmen aus dokumentierten Vorwochen: {week.hoursRange[0]}–{week.hoursRange[1]} Stunden (inklusive vorhandener Trainings).</p>:<p>Kein verbindliches Stundenbudget: Bisher reichen die aktuellen Daten nicht für eine belastbare individuelle Wochenstundenzahl.</p>}
    {week.notes.map(note=><p key={note}>• {note}</p>)}
    {week.safeguards.map(note=><p key={note} className="tempo-28-safeguard">⚠ {note}</p>)}
   </div>
   <p className="tempo-28-period-muted">Die tatsächlichen Wochentage werden unter „7-/14-Tage-Plan“ aus Dienst, Verfügbarkeit, Erholung und bestehenden Trainings abgeleitet. Nur explizit bestätigte Vorschläge können leere Tage ergänzen; gespeicherte Einheiten werden nicht verändert.</p>
  </div>}
  {loadError&&<p role="alert" className="tempo-28-safeguard">{loadError}</p>}
  <h3 id="tempo30-block-types">Blockschwerpunkte · antippen für Workouts und Umfang</h3>
  <div className="tempo30-guide-list">{kinds.map(kind=>{
    const guide=GUIDES[kind],isOpen=expanded===`kind:${kind}`,exampleHours=kind==='VOLUME'||kind==='MOUNTAIN'?8:6
    return <div key={kind} className="tempo30-guide-item"><button type="button" aria-expanded={isOpen} onClick={()=>{setFocus(kind);toggle(`kind:${kind}`)}}><span><strong>{kind}</strong> · {BLOCK_INFO[kind].title}</span><span>{isOpen?'⌃':'⌄'}</span></button>{isOpen&&<div className="tempo30-guide-content"><p>{guide.character}</p><div className="tempo30-budget-line"><span>🚴 {guide.bikeSessions[0]}–{guide.bikeSessions[1]} Rad/Woche</span><span>🏃 {guide.runSessions[0]}–{guide.runSessions[1]} Lauf/Woche</span><span>🏋️ {guide.strengthSessions[0]} Kraft/Woche</span></div><p><strong>Beispiel 4-Wochen-Block:</strong> ca. {exampleHours*4} h Trainingszeit, davon etwa {Math.round((exampleHours-2)*4*24)} Rad-km und {guide.runSessions[0]*4}–{guide.runSessions[1]*4} Laufeinheiten; tatsächliche Summen aus Wochenplanung addieren.</p><strong>Rad-Workouts</strong><ul>{guide.exampleRides.map(x=><li key={x}>{x}</li>)}</ul><strong>Lauf-Workouts</strong><ul>{guide.exampleRuns.map(x=><li key={x}>{x}</li>)}</ul></div>}</div>
  })}</div>
  <div className="tempo-28-period-sets"><h3>Beinkraft an Radbelastung anpassen</h3><label>Übliche Bein-Arbeitssätze / Woche <input type="number" inputMode="numeric" min="0" max="40" value={legSets} onChange={event=>setLegSets(Math.max(0,Math.min(40,Math.round(Number(event.target.value)||0))))}/></label><div className="tempo-28-period-result"><span>Bei {focus} empfohlen</span><strong>{advice.suggestedLegSets} statt {advice.regularLegSets}</strong><small>{advice.reductionPercent} % weniger Bein-Arbeitssätze · vorsichtige Planungsheuristik</small></div><p>In umfangreichen Radwochen bleiben Kraft A/B möglichst als Routine erhalten; nur die Bein-Arbeitssätze werden reduziert. Die Empfehlung ändert keine gespeicherten Sätze oder Trainings.</p></div>
  <h3 id="tempo30-season">Saisonphasen nach deinen gespeicherten Events</h3>
  {stage.length===0?<p className="tempo-28-period-muted">Ohne datiertes Ziel werden vorsichtige BASE-Wochen angezeigt.</p>:<div className="tempo30-guide-list">{stage.map(part=>{
   const isOpen=expanded===`season:${part.id}`
   const matching=weeks.filter(w=>w.startDate<=part.endDate&&w.endDate>=part.startDate)
   const hourSum=matching.reduce((sum,w)=>sum+estimateWeek(w,overrides[w.startDate]).hours,0)
   const bikeSum=matching.reduce((sum,w)=>sum+estimateWeek(w,overrides[w.startDate]).bikeKm,0)
   const bikeUnits=matching.reduce((sum,w)=>sum+GUIDES[w.kind].bikeSessions[0],0)
   const runUnits=matching.reduce((sum,w)=>sum+GUIDES[w.kind].runSessions[0],0)
   return <div key={part.id} className="tempo30-guide-item"><button type="button" aria-expanded={isOpen} onClick={()=>toggle(`season:${part.id}`)}><span><strong>{part.title}</strong><small> {fmt(part.startDate)} – {fmt(part.endDate)}{part.tentative?' · vorläufig':''}</small></span><span>{isOpen?'⌃':'⌄'}</span></button>{isOpen&&<div className="tempo30-guide-content"><p>{part.detail}</p><p><strong>Voraussichtlicher Umfang im sichtbaren 52-Wochen-Horizont:</strong> {matching.length} Wochen · ca. {hourSum} Stunden · etwa {bikeSum} Rad-km · mindestens {bikeUnits} Rad- und {runUnits} Laufeinheiten.</p><p>Die Werte ergeben sich aus den hinterlegten oder illustrierten Wochenbudgets. Für frühere oder spätere Phasen außerhalb des angezeigten Horizonts ist dies keine vollständige Blocksumme.</p><ul>{matching.slice(0,4).map(w=><li key={w.startDate}>{fmt(w.startDate)}: {w.kind} · {estimateWeek(w,overrides[w.startDate]).hours} h / {estimateWeek(w,overrides[w.startDate]).bikeKm} Rad-km · {GUIDES[w.kind].exampleRides[0]}</li>)}</ul></div>}</div>
  })}</div>}

 </section>
}
