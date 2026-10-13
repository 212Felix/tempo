import {formatSeconds,parseHms} from '../time/duration'
import TimeFields from '../time/TimeFields'
import { useEffect, useState, type FormEvent } from 'react'
import { deleteRecord, listRecords, saveRecord } from '../db/storage'
import { LOCAL_PROFILE, dateLabel, dayDelta, effectiveDate, routeValues, upcomingEvents, validDate, type EventKind, type EventPriority, type EventStatus, type GoalEvent, type RouteEntry, type Surface, type GoalSport, type RunningDiscipline, type VacationStatus } from './library'
import './events.css'
import HelpDisclosure from '../ui/HelpDisclosure'
import { RUN_LABELS,displayDuration,parseTargetTime,paceText,runDistancePreset, type RunKind } from './running'

const today = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const newId = (prefix:string) => `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2,10)}`
const amount = (value:string): number | undefined => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : undefined
const statusLabel:Record<EventStatus,string> = {offen:'Teilnahme / Startplatz offen',bestaetigt:'Termin bestätigt',flexibel:'Flexibles Zeitfenster',abgeschlossen:'Abgeschlossen'}
const kindLabel:Record<EventKind,string> = {rennen:'Offizielles Event',challenge:'Persönliche Challenge',trainingsblock:'Trainingsblock / Urlaub'}
const blanks = () => ({name:'',sport:'cycling' as GoalSport,runningKind:'funrun' as RunningDiscipline,targetTime:'',kind:'challenge' as EventKind,status:'flexibel' as EventStatus,priority:'B' as EventPriority,date:'',windowStart:'',windowEnd:'',drawingDate:'',vacation:'nicht_noetig' as VacationStatus,routeId:'',distanceKm:'',elevationM:'',expectedHours:'',trainingPhase:'',notes:''})
type FormData = ReturnType<typeof blanks>
function toForm(e:GoalEvent):FormData { return {name:e.name,sport:e.sport??'cycling',runningKind:e.runningKind??'funrun',targetTime:displayDuration(e.targetSeconds),kind:e.kind,status:e.status,priority:e.priority,date:e.date ?? '',windowStart:e.windowStart ?? '',windowEnd:e.windowEnd ?? '',drawingDate:e.drawingDate ?? '',vacation:e.vacation,routeId:e.routeId ?? '',distanceKm:String(e.distanceKm ?? ''),elevationM:String(e.elevationM ?? ''),expectedHours:String(e.expectedHours ?? ''),trainingPhase:e.trainingPhase ?? '',notes:e.notes ?? ''} }

export function EventsHomeCard({onOpen}:{onOpen:()=>void}) {
  const [events,setEvents] = useState<GoalEvent[]>([])
  const [expanded,setExpanded] = useState(false)
  useEffect(()=>{
    let live=true
    const refresh=()=>{void listRecords<GoalEvent>('events').then(rows=>{if(live)setEvents(upcomingEvents(rows,today()))}).catch(()=>{})}
    refresh();window.addEventListener('tempo:events-change',refresh)
    return ()=>{live=false;window.removeEventListener('tempo:events-change',refresh)}
  },[])
  const first=events[0]
  const days=first && effectiveDate(first) ? dayDelta(today(),effectiveDate(first)!) : undefined
  return <section className="panel status-card tempo-next-event">
    <div className="card-heading"><div className="eyebrow">NÄCHSTES ZIEL</div><button type="button" className="tempo-event-arrow" aria-label="Ziele anzeigen" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'⌃':'⌄'}</button></div>
    <h3>{first ? first.name : 'Noch kein Ziel hinterlegt'}</h3>
    <p>{first ? (days !== undefined ? `Noch ${days} Tage · ${first.status==='bestaetigt'?'bestätigt':first.status==='offen'?'Startplatz offen':'Termin flexibel'}` : 'Termin noch offen') : 'Deine Ziele erscheinen hier nach dem Eintragen.'}</p>
    {first?.trainingPhase && <p>Trainingsabschnitt: {first.trainingPhase}</p>}
    {expanded && <div className="tempo-event-expanded">{events.length===0 ? <p>Noch keine geplanten Events</p> : events.map(e => {const date=effectiveDate(e);return <p key={e.id}>{e.name} — {date ? `${dayDelta(today(),date)} Tage` : 'Termin offen'}</p>})}<button className="text-action" type="button" onClick={onOpen}>Ziele verwalten →</button></div>}
  </section>
}

export default function EventsPanel() {
  const [events,setEvents]=useState<GoalEvent[]>([])
  const [routes,setRoutes]=useState<RouteEntry[]>([])
  const [form,setForm]=useState<FormData>(blanks)
  const [editing,setEditing]=useState<GoalEvent | null>(null)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  const refresh = async () => {
    const [e,r]=await Promise.all([listRecords<GoalEvent>('events'),listRecords<RouteEntry>('routes')])
    setEvents(e.filter(x=>x.profileId===LOCAL_PROFILE).sort((a,b)=>(effectiveDate(a)??'9999').localeCompare(effectiveDate(b)??'9999')))
    setRoutes(r.filter(x=>x.profileId===LOCAL_PROFILE))
  }
  useEffect(()=>{let mounted=true;void Promise.all([listRecords<GoalEvent>('events'),listRecords<RouteEntry>('routes')]).then(([e,r])=>{if(mounted){setEvents(e.filter(x=>x.profileId===LOCAL_PROFILE));setRoutes(r.filter(x=>x.profileId===LOCAL_PROFILE))}}).catch(err=>{if(mounted)setMessage(String(err))});return()=>{mounted=false}},[])
  const patch=(update:Partial<FormData>)=>setForm(old=>({...old,...update}))
  const linked=routes.find(r=>r.id===form.routeId)
  const save=async(ev:FormEvent)=>{
    ev.preventDefault()
    if(!form.name.trim()){setMessage('Bitte einen Eventnamen eintragen.');return}
    for(const v of [form.date,form.windowStart,form.windowEnd,form.drawingDate])if(v && !validDate(v)){setMessage('Ein Datum ist ungültig.');return}
    if(form.windowStart && form.windowEnd && form.windowEnd<form.windowStart){setMessage('Das Zeitfenster endet vor seinem Beginn.');return}
    const targetSeconds=parseTargetTime(form.targetTime)
    if(Number.isNaN(targetSeconds)){setMessage('Bitte Stunden, Minuten und Sekunden getrennt eingeben.');return}
    if(form.sport==='running' && form.runningKind==='cooper' && (amount(form.distanceKm)!==3.2 || targetSeconds!==720)){setMessage('Cooper-Ziel: 3,2 km in 00:12:00. Für andere Distanzen „Anderer Lauf“ auswählen.');return}
    if(form.status==='bestaetigt' && !form.date){setMessage('Für einen bestätigten Höhepunkt wird ein konkretes Datum benötigt.');return}
    setSaving(true)
    try {
      const now=new Date().toISOString()
      const record:GoalEvent={id:editing?.id??newId('goal'),createdAt:editing?.createdAt??now,updatedAt:now,profileId:LOCAL_PROFILE,
        name:form.name.trim(),sport:form.sport,runningKind:form.sport==='running'?form.runningKind:undefined,targetSeconds:form.sport==='running'?targetSeconds:undefined,kind:form.kind,status:form.status,priority:form.priority,vacation:form.vacation,
        date:form.date||undefined,windowStart:form.windowStart||undefined,windowEnd:form.windowEnd||undefined,
        drawingDate:form.drawingDate||undefined,routeId:form.routeId||undefined,
        distanceKm:amount(form.distanceKm),elevationM:amount(form.elevationM),expectedHours:amount(form.expectedHours),
        trainingPhase:form.trainingPhase.trim()||undefined,notes:form.notes.trim()||undefined}
      await saveRecord('events',record);await refresh();window.dispatchEvent(new Event('tempo:events-change'))
      setForm(blanks());setEditing(null);setMessage('Ziel gespeichert ✓ · Änderungen am Trainingsplan erst nach deiner Bestätigung.')
    } catch(error){setMessage(`Speichern fehlgeschlagen: ${String(error)}`)}
    finally{setSaving(false)}
  }
  const remove=async(item:GoalEvent)=>{
    if(!window.confirm(`„${item.name}“ aus der persönlichen Eventbibliothek löschen? Bisherige Trainingshistorie bleibt bestehen.`))return
    try{await deleteRecord('events',item.id);await refresh();window.dispatchEvent(new Event('tempo:events-change'));setMessage('Eintrag entfernt ✓')}catch(err){setMessage(`Löschen fehlgeschlagen: ${String(err)}`)}
  }
  return <div className="tempo-event-module">
    <section className="panel tempo-event-hero"><div className="eyebrow">DEINE ZIELE · NEUTRAL GESPEICHERT</div><h2>Rennen, Urlaube und persönliche Challenges</h2><HelpDisclosure id="events-intro"><p>Die Ziele können geplante und bestätigte Rennen, private Challenges oder Urlaubsfenster sein. Ein vorläufiges A-Ziel mit Datum kann die Jahresplanung bereits beeinflussen. Der 14-Tage-Plan wird nie ohne deine Bestätigung überschrieben.</p></HelpDisclosure></section>
    <section className="panel tempo-event-list"><h3>Deine Ziele</h3>{events.length===0?<p className="tempo-event-muted">Noch kein Ziel eingetragen. Die App startet bewusst ohne persönliche Standard-Events.</p>:events.map(e=>{const m=routeValues(e,routes);return <article className="tempo-event-entry" key={e.id}>
      <div className="tempo-event-entry-top"><strong>{e.name}</strong><span>{e.priority}-Ziel</span></div>
      <p>{kindLabel[e.kind]} · {statusLabel[e.status]}</p>
      <p>{e.date ? dateLabel(e.date) : e.windowStart ? `${dateLabel(e.windowStart)} – ${dateLabel(e.windowEnd)}` : 'Termin offen'} · {e.vacation==='offen'?'Urlaub offen':e.vacation==='bestaetigt'?'Urlaub bestätigt':'Kein Urlaub erforderlich'}</p>
      <p>{e.sport==='running'?'🏃 Laufen':e.sport==='other'?'Weitere Sportart':'🚴 Radfahren'}{e.sport==='running'&&e.runningKind?` · ${RUN_LABELS[e.runningKind]}`:''}</p>
      {(m.km||m.hm||m.hours)&&<p>{m.km?`${m.km} km`:'Distanz offen'}{m.hm?` · ${m.hm} hm`:''}{m.hours?` · ca. ${m.hours} h`:''}</p>}
      {e.sport==='running' && e.targetSeconds && <p>Zielzeit {displayDuration(e.targetSeconds)} · {paceText(m.km,e.targetSeconds)}</p>}
      {e.drawingDate&&<p>Auslosung: {dateLabel(e.drawingDate)}</p>}
      <div className="tempo-event-actions"><button type="button" onClick={()=>{setForm(toForm(e));setEditing(e);setMessage('Eintrag wird bearbeitet.');window.scrollTo({top:0,behavior:'smooth'})}}>Bearbeiten</button><button type="button" onClick={()=>void remove(e)}>Löschen</button></div>
    </article>})}</section>
    <section className="panel tempo-event-form"><div className="eyebrow">{editing?'EINTRAG BEARBEITEN':'NEUES ZIEL'}</div><h3>{editing?'Ziel aktualisieren':'Ziel / Event anlegen'}</h3>
      <div className="tempo-event-preset"><button type="button" onClick={()=>{const saved=events.find(e=>e.status!=='abgeschlossen'&&(e.runningKind==='cooper'||/cooper/i.test(e.name)));if(saved){setEditing(saved);setForm(toForm(saved));setMessage('Bestehendes Cooper-Ziel bearbeiten, statt doppelt anzulegen.');return}setEditing(null);setForm({...blanks(),name:'Cooper-Test · 3.200 m in 12 Minuten',sport:'running',runningKind:'cooper',kind:'challenge',priority:'B',status:'offen',distanceKm:'3.2',targetTime:'00:12:00'});setMessage('Cooper-Ziel vorbereitet – Termin eintragen, wenn bekannt.');}}>🏃 Cooper-Test 3.200 m</button><span>Weitere Lauf-Events sind frei anlegbar.</span></div>
      <form onSubmit={ev=>void save(ev)}>
        <label>Eventname<input value={form.name} maxLength={90} onChange={e=>patch({name:e.target.value})} placeholder="z. B. persönliche Gravel-Challenge" required/></label>
        <div className="tempo-event-group-title">1 · Sportart und Einordnung</div>
        <div className="tempo-event-sport" role="group" aria-label="Sportart">{([['cycling','🚴 Radfahren'],['running','🏃 Laufen'],['other','Weitere']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={form.sport===key} className={form.sport===key?'selected':''} onClick={()=>patch({sport:key,routeId:''})}>{label}</button>)}</div>
        {form.sport==='running'&&<><label>Laufveranstaltung<select value={form.runningKind} onChange={e=>{const runningKind=e.target.value as RunKind;const km=runDistancePreset(runningKind);patch({runningKind,distanceKm:km!==undefined?String(km):form.distanceKm,targetTime:runningKind==='cooper'?'00:12:00':'',name:form.runningKind==='cooper'&&runningKind!=='cooper'?RUN_LABELS[runningKind]:form.name})}}>{Object.entries(RUN_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><div className="tempo-event-fields"><TimeFields label="Zielzeit" value={form.targetTime} onChange={value=>patch({targetTime:value})} allowEmpty maxHours={47}/><div className="tempo-event-pace"><span>Zieltempo</span><strong>{paceText(amount(form.distanceKm),parseTargetTime(form.targetTime))||'Noch offen'}</strong></div></div></>}
        <div className="tempo-event-fields"><label>Art<select value={form.kind} onChange={e=>patch({kind:e.target.value as EventKind})}><option value="rennen">Offizielles Rennen</option><option value="challenge">Eigene Challenge</option><option value="trainingsblock">Trainingsblock / Urlaub</option></select></label>
        <label>Priorität<select value={form.priority} onChange={e=>patch({priority:e.target.value as EventPriority})}><option value="A">A – Haupthöhepunkt</option><option value="B">B – wichtiger Reiz</option><option value="C">C – Training / optional</option></select></label></div>
        <div className="tempo-event-fields"><label>Status<select value={form.status} onChange={e=>patch({status:e.target.value as EventStatus})}><option value="offen">Startplatz / Teilnahme offen</option><option value="flexibel">Flexibel – eigener Zeitraum</option><option value="bestaetigt">Termin bestätigt</option><option value="abgeschlossen">Abgeschlossen</option></select></label>
        <label>Urlaub<select value={form.vacation} onChange={e=>patch({vacation:e.target.value as VacationStatus})}><option value="nicht_noetig">Nicht erforderlich</option><option value="offen">Noch offen</option><option value="bestaetigt">Bestätigt</option></select></label></div>
        <div className="tempo-event-group-title">2 · Zieldatum und Zeitfenster <HelpDisclosure id="events-date-help"><p>Für ein A-Ziel mit offenem Startplatz das voraussichtliche Datum eintragen; TEMPO erstellt einen vorläufigen Jahresrahmen. Das Zeitfenster ist für wetterabhängige private Challenges gedacht.</p></HelpDisclosure></div>
        <div className="tempo-event-fields"><label>Zieltag (wenn bekannt)<input type="date" value={form.date} onChange={e=>patch({date:e.target.value})}/></label><label>Auslosung (optional)<input type="date" value={form.drawingDate} onChange={e=>patch({drawingDate:e.target.value})}/></label></div>
        <div className="tempo-event-fields"><label>Zeitraum von<input type="date" value={form.windowStart} onChange={e=>patch({windowStart:e.target.value})}/></label><label>Zeitraum bis<input type="date" value={form.windowEnd} onChange={e=>patch({windowEnd:e.target.value})}/></label></div>
        <div className="tempo-event-group-title">3 · Strecke und Ziele</div>
        <label>Gespeicherte {form.sport==='running'?'Laufstrecke':'Strecke'}<select value={form.routeId} onChange={e=>patch({routeId:e.target.value})}><option value="">Keine Strecke verknüpft</option>{routes.filter(r=>(r.sport??'cycling')===form.sport).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        {linked&&<p className="tempo-event-hint">Streckenvorgabe: {linked.distanceKm??'–'} km · {linked.elevationM??'–'} hm. Abweichende Werte unten sind möglich.</p>}
        <div className="tempo-event-fields triple"><label>Distanz km<input type="number" min="0" step="any" value={form.distanceKm} onChange={e=>patch({distanceKm:e.target.value})}/></label><label>Höhenmeter<input type="number" min="0" step="1" value={form.elevationM} onChange={e=>patch({elevationM:e.target.value})}/></label>{form.sport!=='running'&&<TimeFields label="Voraussichtliche Dauer" maxHours={24} allowEmpty value={form.expectedHours?formatSeconds(Math.round(Number(form.expectedHours)*3600)):""} onChange={value=>patch({expectedHours:value?String(parseHms(value,true).seconds/3600):""})}/>}</div>
        <div className="tempo-event-group-title">4 · Hinweise (optional)</div>
        <label>Aktueller Trainingsabschnitt (optional)<input value={form.trainingPhase} maxLength={60} onChange={e=>patch({trainingPhase:e.target.value})} placeholder="z. B. Grundlagenaufbau"/></label>
        <label>Notiz<textarea rows={2} value={form.notes} onChange={e=>patch({notes:e.target.value})} placeholder="Urlaub, Losverfahren, Trainingsblock, Ruhetag vor der Challenge …"/></label>
        <div className="tempo-event-actions"><button type="submit" disabled={saving}>{saving?'Speichere …':editing?'Änderungen speichern':'Ziel speichern'}</button>{editing&&<button type="button" onClick={()=>{setForm(blanks());setEditing(null)}}>Abbrechen</button>}</div>
      </form><p role="status" className="tempo-event-muted">{message || 'Alle Einträge werden ausschließlich in deiner lokalen TEMPO-Datenbank gespeichert.'}</p>
    </section>
  </div>
}

export function RoutesPanel(){
  const [items,setItems]=useState<RouteEntry[]>([])
  const [editing,setEditing]=useState<RouteEntry|null>(null)
  const [name,setName]=useState('');const [sport,setSport]=useState<GoalSport>('cycling');const [surface,setSurface]=useState<Surface>('gravel')
  const [distance,setDistance]=useState('');const [hm,setHm]=useState('');const [hours,setHours]=useState('')
  const [url,setUrl]=useState('');const [description,setDescription]=useState('');const [message,setMessage]=useState('')
  const refresh=async()=>setItems((await listRecords<RouteEntry>('routes')).filter(r=>r.profileId===LOCAL_PROFILE).sort((a,b)=>a.name.localeCompare(b.name)))
  useEffect(()=>{let live=true;void listRecords<RouteEntry>('routes').then(x=>{if(live)setItems(x.filter(r=>r.profileId===LOCAL_PROFILE))}).catch(err=>{if(live)setMessage(String(err))});return()=>{live=false}},[])
  const reset=()=>{setEditing(null);setName('');setSport('cycling');setSurface('gravel');setDistance('');setHm('');setHours('');setUrl('');setDescription('')}
  const save=async(e:FormEvent)=>{e.preventDefault();if(!name.trim()){setMessage('Bitte Streckennamen eingeben.');return}
    const trimmed=url.trim();if(trimmed&&!(trimmed.startsWith('https://')||trimmed.startsWith('http://'))){setMessage('Bitte eine vollständige http(s)-Adresse verwenden.');return}
    try{const now=new Date().toISOString();await saveRecord('routes',{id:editing?.id??newId('route'),createdAt:editing?.createdAt??now,updatedAt:now,profileId:LOCAL_PROFILE,name:name.trim(),sport,surface,distanceKm:amount(distance),elevationM:amount(hm),expectedHours:amount(hours),sourceUrl:trimmed||undefined,description:description.trim()||undefined} as RouteEntry);await refresh();window.dispatchEvent(new Event('tempo:events-change'));reset();setMessage('Strecke gespeichert ✓')}catch(err){setMessage(`Speichern fehlgeschlagen: ${String(err)}`)}
  }
  return <div className="tempo-event-module"><section className="panel tempo-event-hero"><div className="eyebrow">PERSÖNLICHE STRECKENBIBLIOTHEK</div><h2>Strecken & Challenges</h2><p>Speichere Orbit-, Stoneman- oder andere Routen mit Distanz, Höhenmetern und GPX-/Komoot-Link. Diese Daten kannst du anschließend einem Event zuordnen. Ein automatischer GPX-Import ist für eine spätere Version vorgesehen.</p></section>
    <section className="panel tempo-event-list"><h3>Gespeicherte Strecken</h3>{items.length===0?<p className="tempo-event-muted">Noch keine Strecke angelegt.</p>:items.map(item=><article className="tempo-event-entry" key={item.id}><div className="tempo-event-entry-top"><strong>{item.name}</strong><span>{item.sport==='running'?'Laufen':'Radfahren'} · {item.surface}</span></div><p>{item.distanceKm??'–'} km · {item.elevationM??'–'} hm{item.expectedHours?` · ca. ${item.expectedHours} h`:''}</p>{item.description&&<p>{item.description}</p>}{item.sourceUrl&&<a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Streckenlink öffnen ↗</a>}<div className="tempo-event-actions"><button type="button" onClick={()=>{setEditing(item);setName(item.name);setSport(item.sport??'cycling');setSurface(item.surface);setDistance(String(item.distanceKm??''));setHm(String(item.elevationM??''));setHours(String(item.expectedHours??''));setUrl(item.sourceUrl??'');setDescription(item.description??'');window.scrollTo({top:0,behavior:'smooth'})}}>Bearbeiten</button><button type="button" onClick={()=>{if(window.confirm(`Strecke „${item.name}“ löschen?`))void deleteRecord('routes',item.id).then(()=>{void refresh();window.dispatchEvent(new Event('tempo:events-change'))}).catch(err=>setMessage(String(err)))}}>Löschen</button></div></article>)}</section>
    <section className="panel tempo-event-form"><div className="eyebrow">{editing?'STRECKE BEARBEITEN':'NEUE STRECKE'}</div><h3>Streckenprofil</h3><form onSubmit={ev=>void save(ev)}>
      <label>Name<input required maxLength={90} value={name} onChange={e=>setName(e.target.value)} placeholder="z. B. Lieblings-Gravelrunde"/></label>
      <label>Sportart<select value={sport} onChange={e=>{const next=e.target.value as GoalSport;setSport(next);setSurface(next==='running'?'strasse':'rennrad')}}><option value="cycling">Radfahren</option><option value="running">Laufen</option></select></label>
      <label>Streckenart<select value={surface} onChange={e=>setSurface(e.target.value as Surface)}>{(sport==='running'?[['strasse','Straße / Park'],['trail','Trail'],['bahn','Laufbahn'],['gemischt','Gemischt']]:[['rennrad','Rennrad'],['gravel','Gravel'],['mtb','MTB'],['gemischt','Gemischt']]).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <div className="tempo-event-fields triple"><label>Kilometer<input type="number" min="0" step="0.1" value={distance} onChange={e=>setDistance(e.target.value)}/></label><label>Höhenmeter<input type="number" min="0" step="1" value={hm} onChange={e=>setHm(e.target.value)}/></label><TimeFields label="Erwartete Fahr-/Laufzeit" maxHours={24} allowEmpty value={hours?formatSeconds(Math.round(Number(hours)*3600)):""} onChange={value=>setHours(value?String(parseHms(value,true).seconds/3600):"")}/></div>
      <label>GPX-/Komoot-/Routenlink (optional)<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label>
      <label>Notiz<textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <div className="tempo-event-actions"><button type="submit">{editing?'Änderungen speichern':'Strecke speichern'}</button>{editing&&<button type="button" onClick={reset}>Abbrechen</button>}</div></form><p role="status" className="tempo-event-muted">{message || 'Streckendaten bleiben lokal. Die öffentliche TEMPO-App enthält keine persönlichen Touren.'}</p>
    </section>
  </div>
}
