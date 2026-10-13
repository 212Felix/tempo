import TimeFields from '../time/TimeFields'
import {formatSeconds,parseHms} from '../time/duration'
import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {listRecords,saveRecord} from '../db/storage'
import type {ProfileRecord} from '../db/types'
import {dateLabel,plusDays,type RouteEntry} from '../events/library'
import {PROFILE_ID} from '../planning/engine'
import {buildClimbLibrary,type LibraryClimb} from '../garmin/climbLibrary'
import type {GarminActivity} from '../garmin/csv'
import type {FitTrace} from '../garmin/fit'
import {dayKindLabels,effortLabels,dropBlockDay,isTrainingFree,itineraryDates,planDayValid,putBlockDay,safeBlockDays,type BlockDayEffort,type BlockDayKind,type BlockDayPlan} from './days'
import type {TrainingBlock} from './library'
import {chosenIntervals,routeWorkout,climbEffortNames,type ClimbInterval,type ClimbEffort} from './intervals'

const labels:Record<string,string>={garmin:'Garmin-Aufzeichnung',route:'Gespeicherte Strecke'}
const fmt=(date:string)=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(date+'T12:00:00Z'))
const emptyPlan=(date:string):BlockDayPlan=>({date,kind:'group-ride',effort:'easy'})
const looksRide=(d:BlockDayKind)=>d==='group-ride'||d==='ride-training'||d==='challenge'
export default function BlockDaysPanel({block,onSaved}:{block:TrainingBlock;onSaved:()=>Promise<void>} ){
  const [open,setOpen]=useState(false)
  const [picked,setPicked]=useState(block.startDate)
  const [form,setForm]=useState<BlockDayPlan>(emptyPlan(block.startDate))
  const [activities,setActivities]=useState<GarminActivity[]>([])
  const [routes,setRoutes]=useState<RouteEntry[]>([])
  const [climbs,setClimbs]=useState<LibraryClimb[]>([])
  const [profile,setProfile]=useState<ProfileRecord|undefined>()
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const days=useMemo(()=>safeBlockDays(block),[block])
  const dates=useMemo(()=>itineraryDates(block),[block])
  useEffect(()=>{
    if(!open)return
    let live=true
    Promise.all([listRecords<GarminActivity>('externalActivities'),listRecords<RouteEntry>('routes'),listRecords<FitTrace>('performanceEntries'),listRecords<ProfileRecord>('profiles')]).then(([a,r,t,p])=>{
      if(!live)return
      const sports=a.filter(x=>x.profileId===PROFILE_ID&&x.sport==='cycling'&&(x.source==='garmin-csv'||x.source==='garmin-fit'))
      setActivities(sports.sort((x,y)=>y.date.localeCompare(x.date)))
      setRoutes(r.filter(x=>x.profileId===PROFILE_ID))
      setClimbs(buildClimbLibrary(t.filter(x=>x.profileId===PROFILE_ID&&x.kind==='garmin-fit-trace'),sports))
      setProfile(p.find(x=>x.id===PROFILE_ID))
    }).catch(e=>{if(live)setMessage('Routenbibliothek konnte nicht geladen werden: '+String(e))})
    return()=>{live=false}
  },[open])
  useEffect(()=>{
    if(!dates.includes(picked)){setPicked(block.startDate);setForm(days.find(d=>d.date===block.startDate)??emptyPlan(block.startDate))}
  },[block.startDate,block.endDate]) // eslint-disable-line react-hooks/exhaustive-deps
  const update=(values:Partial<BlockDayPlan>)=>setForm(old=>({...old,...values}))
  const chooseDay=(date:string)=>{setPicked(date);setForm(days.find(d=>d.date===date)??emptyPlan(date));setMessage('')}
  const selectedRoute = form.routeId ? form.routeSource==='garmin' ? activities.find(a=>a.id===form.routeId) : routes.find(r=>r.id===form.routeId) : undefined
  const matchedClimbs=useMemo(()=>form.routeSource==='garmin'&&form.routeId?climbs.filter(x=>x.activityId===form.routeId):[],[climbs,form.routeSource,form.routeId])
  const watt=profile?.ftpWatts
  /* Legacy single-climb choices remain visible until this day is edited. */
  const selectedIntervals:ClimbInterval[]=form.climbIntervals??(form.climbKey?[{climbKey:form.climbKey,effort:form.effort==='threshold'?'threshold':form.effort==='tempo'?'tempo':'steady'}]:[])
  const selectedClimbs=chosenIntervals(selectedIntervals,matchedClimbs)
  const workout=routeWorkout(selectedIntervals,matchedClimbs,watt)
  const workoutNote=workout.text
  const toggleClimb=(key:string)=>{
    const next=selectedIntervals.some(x=>x.climbKey===key)?selectedIntervals.filter(x=>x.climbKey!==key):[...selectedIntervals,{climbKey:key,effort:'steady' as ClimbEffort}]
    update({climbIntervals:next,climbKey:undefined})
  }
  const setClimbEffort=(key:string,effort:ClimbEffort)=>{
    update({climbIntervals:selectedIntervals.map(x=>x.climbKey===key?{...x,effort}:x),climbKey:undefined})
  }
  const save=async(e:FormEvent)=>{
    e.preventDefault();if(busy)return
    if(selectedIntervals.length>0){
      if(selectedClimbs.length!==selectedIntervals.length){setMessage('Ein gewählter Anstieg ist nicht mehr mit dieser Route verknüpft. Bitte Auswahl kontrollieren.');return}
      if(workout.hardCount>2){setMessage('Bitte höchstens zwei intensive Anstiege wählen; weitere Abschnitte können locker gefahren werden.');return}
      if(workout.warnings.length>0&&!window.confirm('Einige Bergabschnitte sind wegen ihrer Dauer oder Messqualität nicht als sichere Intervalle geeignet. Trotzdem als optionalen Tourenplan speichern?'))return
    }
    const chosen={...form,date:picked,climbIntervals:looksRide(form.kind)&&form.routeSource==='garmin'&&form.routeId&&selectedIntervals.length?selectedIntervals:undefined,climbKey:undefined,routeName:looksRide(form.kind)?(form.routeSource==='garmin'?activities.find(a=>a.id===form.routeId)?.title:routes.find(r=>r.id===form.routeId)?.name):undefined,routeDistanceKm:looksRide(form.kind)?selectedRoute?.distanceKm:undefined,routeId:looksRide(form.kind)?form.routeId:undefined,routeSource:looksRide(form.kind)?form.routeSource:undefined,effort:looksRide(form.kind)?form.effort:undefined}
    if(!planDayValid(block,chosen)){setMessage('Bitte Eingaben oder Datum prüfen.');return}
    const plannedDays=safeBlockDays(block)
    const before=plannedDays.find(d=>d.date===plusDays(picked,-1))
    const next=plannedDays.find(d=>d.date===plusDays(picked,1))
    const collision=(chosen.kind==='challenge'&&before&&!isTrainingFree(before.kind))||(next?.kind==='challenge'&&!isTrainingFree(chosen.kind))
    if(collision&&!window.confirm('Am Tag vor einer Challenge ist bereits eine sportliche Aktivität vorgesehen. Für die geplante 312-km-Fahrt wird ein Ruhetag empfohlen. Trotzdem speichern?'))return
    setBusy(true)
    try{
      const revised=putBlockDay(block,chosen)
      await saveRecord('trainingBlocks',revised);await onSaved()
      window.dispatchEvent(new Event('tempo:blocks-change'))
      setMessage(`${fmt(picked)} gespeichert ✓ · Noch keine Trainingseinheit als absolviert verbucht.`)
    }catch(error){setMessage('Speichern fehlgeschlagen: '+String(error))}finally{setBusy(false)}
  }
  const remove=async()=>{
    if(!days.some(d=>d.date===picked)||busy)return
    if(!window.confirm(`Tagesentscheidung am ${dateLabel(picked)} entfernen? Trainingshistorie bleibt unverändert.`))return
    setBusy(true)
    try{await saveRecord('trainingBlocks',dropBlockDay(block,picked));await onSaved();window.dispatchEvent(new Event('tempo:blocks-change'));setForm(emptyPlan(picked));setMessage('Tagesentscheidung entfernt.')}catch(e){setMessage(String(e))}finally{setBusy(false)}
  }
  return <div className="tempo-day-plan">
    <div className="tempo-block-heading"><strong>Urlaubstage & Touren</strong><button type="button" className="tempo-day-toggle" onClick={()=>setOpen(x=>!x)} aria-expanded={open}>{open?'Schließen −':'Tage einteilen +'}</button></div>
    <p className="tempo-day-caption">{days.length} von {dates.length} Tagen geplant · Freizeit und Ruhetage sind echte trainingsfreie Tage.</p>
    {days.length>0&&<div className="tempo-day-overview">{days.map(day=><button type="button" key={day.date} className="tempo-day-chip" onClick={()=>{chooseDay(day.date);setOpen(true)}}><strong>{fmt(day.date)}</strong><span>{dayKindLabels[day.kind]}{day.title?` · ${day.title}`:''}</span></button>)}</div>}
    {open&&<form onSubmit={e=>void save(e)} className="tempo-day-form">
      <label>Tag auswählen<select value={picked} onChange={e=>chooseDay(e.target.value)}>{dates.map(d=><option key={d} value={d}>{fmt(d)} · {days.find(x=>x.date===d)?'bereits eingeteilt':'noch offen'}</option>)}</select></label>
      <div className="tempo-day-kinds" role="group" aria-label="Tagesart">
        {(Object.entries(dayKindLabels) as [BlockDayKind,string][]).map(([key,label])=><button type="button" key={key} className={form.kind===key?'chosen':''} aria-pressed={form.kind===key} onClick={()=>update({kind:key,effort:key==='group-ride'?'easy':form.effort})}>{label}</button>)}
      </div>
      <label>Bezeichnung (optional)<input maxLength={100} value={form.title??''} onChange={e=>update({title:e.target.value})} placeholder={form.kind==='leisure'?'z. B. Strandtag mit Freunden':'z. B. Küstenrunde / Sa Calobra'}/></label>
      {looksRide(form.kind)&&<>
        <label>Bekannte Route / vorherige Fahrt (optional)<select value={form.routeId?`${form.routeSource}:${form.routeId}`:''} onChange={e=>{const v=e.target.value;const index=v.indexOf(':');update({routeSource:index<0?undefined:v.slice(0,index) as 'garmin'|'route',routeId:index<0?undefined:v.slice(index+1),climbKey:undefined,climbIntervals:[]})}}><option value="">Noch keine Route auswählen</option>
          <optgroup label="Eigene gespeicherte Routen">{routes.map(r=><option key={r.id} value={`route:${r.id}`}>{r.name}{r.distanceKm?` · ${r.distanceKm} km`:''}</option>)}</optgroup>
          <optgroup label="Vergangene Garmin-Radfahrten">{activities.map(a=><option key={a.id} value={`garmin:${a.id}`}>{a.date} · {a.title} · {a.distanceKm?.toLocaleString('de-DE')??'?'} km</option>)}</optgroup>
        </select></label>
        {selectedRoute&&<p className="tempo-day-route-info">{labels[form.routeSource??'']}: {form.routeSource==='garmin'?activities.find(a=>a.id===form.routeId)?.title:routes.find(r=>r.id===form.routeId)?.name} · {selectedRoute.distanceKm?.toLocaleString('de-DE')??'?'} km · {'elevationM' in selectedRoute&&selectedRoute.elevationM!==undefined?`${selectedRoute.elevationM} hm`: 'Höhenmeter offen'}.</p>}
        <label>Trainingscharakter<select value={form.effort??'easy'} onChange={e=>update({effort:e.target.value as BlockDayEffort})}>{(Object.entries(effortLabels) as [BlockDayEffort,string][]).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
        {matchedClimbs.length>0&&<div className="tempo-multi-climbs"><strong>Mehrere Anstiege für die Tour auswählen (optional)</strong>
          <p className="tempo-day-caption">In Streckenreihenfolge; maximal zwei intensive Abschnitte. Du kannst zusätzlich lockere Anstiege markieren.</p>
          {matchedClimbs.map(c=>{const selected=selectedIntervals.find(x=>x.climbKey===c.key);return <div className={`tempo-climb-row ${selected?'selected':''}`} key={c.key}>
            <label className="tempo-climb-check"><input type="checkbox" checked={!!selected} onChange={()=>toggleClimb(c.key)}/><span>km {c.climb.startKm.toLocaleString('de-DE')}–{c.climb.endKm.toLocaleString('de-DE')} · {Math.round(c.climb.elapsedSeconds/60)} min · +{c.climb.riseM} hm</span></label>
            {selected&&<><label>Reiz auf diesem Anstieg<select aria-label={`Trainingsreiz bei Kilometer ${c.climb.startKm}`} value={selected.effort} onChange={e=>setClimbEffort(c.key,e.target.value as ClimbEffort)}>{(Object.entries(climbEffortNames) as [ClimbEffort,string][]).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
              <small>Historisch: Ø {c.climb.averagePowerW??'–'} W · Ø {c.climb.averageHrBpm??'–'} bpm · Ø {c.climb.gradePct}% Steigung</small></>}
          </div>})}
          <span className="tempo-day-caption">Ausgewählt: {selectedClimbs.length} · intensiv: {workout.hardCount}/2</span>
        </div>}
        {selectedClimbs.length>0&&<div className="tempo-day-preview"><strong>Optionaler Ablauf für Garmin · {selectedClimbs.length} Anstiege</strong><p className="tempo-workout-notes">{workoutNote}</p>
          {workout.warnings.map((warning,i)=><p className="tempo-climb-warning" key={i}>Hinweis: {warning}</p>)}
          <button type="button" onClick={()=>{if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(workoutNote).then(()=>setMessage('Ablauf kopiert ✓')).catch(()=>setMessage('Kopieren im Browser nicht verfügbar.'));else setMessage('Kopieren im Browser nicht verfügbar.')}}>Ablauf kopieren</button></div>}
        <TimeFields label="Geschätzte Fahrzeit" allowEmpty maxHours={24} value={form.durationMin===undefined?'':formatSeconds(Math.round(form.durationMin*60))} onChange={v=>update({durationMin:v?parseHms(v,true).minutes:undefined})}/>
      </>}
      {isTrainingFree(form.kind)&&<p className="tempo-day-rest">Dieser Tag bleibt im nächsten Planvorschlag sportfrei. Bereits gespeicherte Trainings oder Dienstpendeln werden nicht gelöscht; solche Konflikte müssen separat geprüft werden.</p>}
      {form.kind==='challenge'&&<p className="tempo-day-rest">TEMPO empfiehlt automatisch den unmittelbar vorherigen Tag als Ruhetag, sofern dort keine andere Tagesentscheidung hinterlegt ist. Datum und Durchführung der Challenge bleiben freiwillig.</p>}
      <label>Notizen / Treffpunkt / Alternativen<textarea rows={2} maxLength={600} value={form.notes??''} onChange={e=>update({notes:e.target.value})} placeholder="z. B. Gruppentour, Start 9 Uhr, Intervalle nur wenn alle einverstanden sind"/></label>
      <div className="tempo-block-actions"><button type="submit" disabled={busy}>{busy?'Speichern …':'Tag speichern'}</button>{days.some(d=>d.date===picked)&&<button className="outline" type="button" disabled={busy} onClick={()=>void remove()}>Tageswahl entfernen</button>}</div>
      <p className="tempo-day-caption">Routen und FIT-Kurven bleiben lokal. TEMPO kann aus alten FIT-Daten Anstiegskandidaten ableiten, erkennt aber noch keine neu geplante Strecke automatisch anhand ihrer GPS-Geometrie und überträgt noch keine Workouts direkt an Garmin.</p>
    </form>}
    {message&&<p role="status" className="tempo-block-status">{message}</p>}
  </div>
}
