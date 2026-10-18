import TimeFields from '../time/TimeFields'
import {durationFor,parseHms} from '../time/duration'
import {useEffect,useMemo,useRef,useState, type FormEvent, type ReactNode} from 'react'
import {listRecords} from '../db/storage'
import {canMatchPlan} from './reconcile'
import {currentKey, friendlyDate, type CompletedRecord, type ShiftRecord, type TrainingRecord} from './engine'
import {
  defaultForm, deleteManual, kindFor, labelFor, loadManualEntries, saveManualCompleted, saveManualPlanned,
  sports, toForm, type Editable, type ManualForm, type ManualSport,
} from './manual'
import './manual.css'
import HelpDisclosure from '../ui/HelpDisclosure'
import {isRestDay} from '../phase31/rest-days'
import FuelingExperienceForm from '../phase32/FuelingExperienceForm'
import {paceText} from '../events/running'

type Mode = 'planned' | 'completed'
const showMinutes = (entry:{durationMin?:number;durationSec?:number}) => entry.durationMin || entry.durationSec ? durationFor(entry) : 'Dauer offen'
const toLabel=(record:TrainingRecord | CompletedRecord) => labelFor(record.sessionType)
function Field({children}:{children:ReactNode}) {return <label className="tempo-manual-field">{children}</label>}
const numInput = (value:string,set:(v:string)=>void,placeholder:string)=>
  <input type="text" inputMode="decimal" value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}/>

/** Gemeinsam auf 14-Tage- und Tagestraining-Seite. Mehrfachbelegung pro Tag erlaubt. */
export default function ManualTrainingPanel({days,autoStartDate}:{days?:string[];autoStartDate?:string}) {
  const [shifts,setShifts]=useState<Record<string,ShiftRecord>>({})
  const [blockedDays,setBlockedDays]=useState<string[]>([])
  const [planned,setPlanned]=useState<TrainingRecord[]>([])
  const [completed,setCompleted]=useState<CompletedRecord[]>([])
  const [selectedDate,setSelectedDate]=useState(days?.[0]??currentKey())
  const [mode,setMode]=useState<Mode>('planned')
  const [draft,setDraft]=useState<ManualForm|null>(null)
  const [editing,setEditing]=useState<Editable|null>(null)
  const [linked,setLinked]=useState<TrainingRecord|null>(null)
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [feedback,setFeedback]=useState('Einheiten werden geladen …')
  const [fuelingReview,setFuelingReview]=useState<{date:string;sessionId?:string;durationMin:number}|null>(null)
  const editorRef=useRef<HTMLDivElement>(null)
  const daysKey=days?.join('|')??''
  useEffect(()=>{
    let active=true
    const load=()=>void listRecords<ShiftRecord>('shifts').then(items=>{
      if(active)setShifts(Object.fromEntries(items.map(x=>[x.date,x])))
    }).catch(()=>undefined)
    load();window.addEventListener('tempo:shift-change',load)
    return()=>{active=false;window.removeEventListener('tempo:shift-change',load)}
  },[])
  useEffect(()=>{let active=true
    const load=()=>void listRecords('settings').then(rows=>{if(active)setBlockedDays(rows.filter(isRestDay).map(x=>x.date))}).catch(()=>undefined)
    load();window.addEventListener('tempo:training-change',load)
    return()=>{active=false;window.removeEventListener('tempo:training-change',load)}
  },[])
  async function refresh() {
    const result=await loadManualEntries()
    setPlanned(result.planned);setCompleted(result.completed)
  }
  useEffect(()=>{
    let live=true
    setLoading(true)
    void loadManualEntries().then(result=>{if(!live)return;setPlanned(result.planned);setCompleted(result.completed);setLoading(false);setFeedback('Einträge werden lokal gespeichert. Automatische Neuplanung überschreibt keine eigenen Einheiten.')})
      .catch(err=>{if(live){setLoading(false);setFeedback(`Datenbankfehler: ${String(err)}`)}})
    const onChange=()=>{void loadManualEntries().then(result=>{if(live){setPlanned(result.planned);setCompleted(result.completed)}}).catch(()=>undefined)}
    window.addEventListener('tempo:training-change',onChange)
    return()=>{live=false;window.removeEventListener('tempo:training-change',onChange)}
  },[])
  useEffect(()=>{if(days?.length) setSelectedDate(days[0])},[daysKey])
  const scroll=()=>window.setTimeout(()=>editorRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),30)
  useEffect(()=>{if(autoStartDate)begin('planned',autoStartDate)},[autoStartDate])
  function begin(which:Mode,date=currentKey()) {
    setEditing(null);setLinked(null);setMode(which);setDraft(defaultForm(date));setSelectedDate(date);setFeedback(which==='planned'?'Neues Training frei planen.':'Absolviertes freies Training protokollieren.');scroll()
  }
  function edit(item:Editable) {
    if(item.kind==='planned' && item.record.status==='erledigt') {setFeedback('Bereits abgeschlossene Trainingseinträge bleiben geschützt.');return}
    setEditing(item);setLinked(null);setMode(item.kind);setDraft(toForm(item));setSelectedDate(item.record.date);scroll()
  }
  function finish(item:TrainingRecord){
    if(completed.some(x=>x.plannedSessionId===item.id)){setFeedback('Diese Einheit ist bereits als absolviert dokumentiert.');return}
    setEditing(null);setLinked(item);setMode('completed');setDraft({...toForm({kind:'planned',record:item}),rpe:''});setSelectedDate(item.date);scroll()
  }
  useEffect(()=>{
    const onAdd=(event:Event)=>begin('planned',(event as CustomEvent<string>).detail||currentKey())
    const onEdit=(event:Event)=>{
      const {kind,id}=(event as CustomEvent<{kind:'planned'|'completed';id:string}>).detail
      const source=kind==='planned'?planned:completed
      const item=source.find(x=>x.id===id)
      if(item) edit({kind,record:item} as Editable)
    }
    const onFinish=(event:Event)=>{
      const id=(event as CustomEvent<string>).detail
      const item=planned.find(x=>x.id===id)
      if(item) finish(item)
    }
    window.addEventListener('tempo:manual-add',onAdd)
    window.addEventListener('tempo:manual-edit',onEdit)
    window.addEventListener('tempo:manual-finish',onFinish)
    return()=>{window.removeEventListener('tempo:manual-add',onAdd);window.removeEventListener('tempo:manual-edit',onEdit);window.removeEventListener('tempo:manual-finish',onFinish)}
  },[planned,completed,selectedDate])
  const entries=useMemo(()=>{
    const filteredPlanned=planned.filter(x=>!days || days.includes(x.date)).map(x=>({kind:'planned' as const,record:x}))
    const filteredCompleted=completed.filter(x=>(!days || days.includes(x.date)) && !(x.plannedSessionId && planned.some(p=>p.id===x.plannedSessionId))).map(x=>({kind:'completed' as const,record:x}))
    return [...filteredPlanned,...filteredCompleted].sort((a,b)=>a.record.date.localeCompare(b.record.date)||a.record.createdAt.localeCompare(b.record.createdAt))
  },[daysKey,planned,completed])
  const visibleDays=days??[]
  const patch=(field:keyof ManualForm,value:string)=>setDraft(d=>d?{...d,[field]:value}:d)
  async function submit(event:FormEvent) {
    event.preventDefault()
    if(!draft || busy) return
    if(mode==='planned'&&blockedDays.includes(draft.date)){setFeedback('Dieser Tag wurde von dir für Erholung gesperrt. Bitte zuerst im Tagestraining die Freigabe aufheben, bevor du neue Einheiten planst.');return}
    if(mode==='planned' && shifts[draft.date]?.shift==='einsatz' && draft.sport!=='mobility' &&
      !window.confirm('Dieser Tag ist als Einsatz bestätigt. TEMPO empfiehlt hier nur Recovery oder Pause. Möchtest du trotzdem selbstständig dieses Training planen?')) return
    setBusy(true)
    try {
      if(mode==='planned') await saveManualPlanned(draft,editing?.kind==='planned'?editing.record:undefined)
      else {
        let target=linked??undefined
        // Bei freiem Abschluss passende Planung ausdrücklich zur Verbindung anbieten.
        if(!target && !editing && !completed.some(x=>x.date===draft.date && x.title===draft.title)){
          const temp={date:draft.date,sessionType:kindFor(draft.sport),durationMin:parseHms(draft.duration,true).minutes}
          const possible=planned.filter(p=>canMatchPlan(p,temp) && p.status!=='nicht-erledigt' && !completed.some(x=>x.plannedSessionId===p.id))
          if(possible.length===1 && window.confirm(`Es gibt bereits „${possible[0].title}“ für diesen Tag. Ist dein freier Eintrag die Durchführung dieser Einheit?\n\nOK = direkt mit dem Plan verknüpfen. Abbrechen = weiterhin getrennt speichern.`))target=possible[0]
        }
        if(!editing && !target && completed.some(x=>x.date===draft.date && x.sessionType===kindFor(draft.sport)) &&
          !window.confirm('Für diesen Tag ist bereits eine absolvierte Einheit dieser Sportart gespeichert. Wirklich ein ZWEITES eigenständiges Training erfassen?'))return
        await saveManualCompleted(draft,editing?.kind==='completed'?editing.record:undefined,target)
      }
      await refresh()
      setFeedback(mode==='planned'?'Training geschützt im Kalender gespeichert ✓':'Absolvierte Einheit in der Trainingshistorie gespeichert ✓')
      if(mode==='completed' && ['cycling','running'].includes(draft.sport))setFuelingReview({date:draft.date,sessionId:linked?.id,durationMin:parseHms(draft.duration,true).minutes})
      setDraft(null);setEditing(null);setLinked(null);setSelectedDate(draft.date)
    } catch(error) {setFeedback(`Nicht gespeichert: ${error instanceof Error?error.message:String(error)}`)}
    finally {setBusy(false)}
  }
  async function remove(item:Editable) {
    if(!window.confirm(`„${item.record.title??'Eintrag'}“ wirklich löschen?\n\nBei automatischen Trainingseinheiten kann eine spätere Neuplanung erneut einen Vorschlag machen.`))return
    setBusy(true)
    try {await deleteManual(item);await refresh();setFeedback('Eintrag gelöscht. Bei erneuter Neuplanung kann TEMPO erneut Trainings vorschlagen.')}
    catch(error){setFeedback(`Löschen fehlgeschlagen: ${error instanceof Error?error.message:String(error)}`)}
    finally{setBusy(false)}
  }
  const completedIds=new Set(completed.map(x=>x.plannedSessionId).filter(Boolean))
  return <section className="panel tempo-manual" id="tempo-own-training">
    <div className="eyebrow">PHASE 6 · DEINE ENTSCHEIDUNG</div>
    <h2>Training selbst gestalten</h2>
    <HelpDisclosure id="calendar-manual-intro"><p>Verabrede dich zum Krafttraining, fahre spontan Rad oder verschiebe ein Workout: <strong>Du kannst jeden Tag selbst gestalten.</strong> Mehrere Einheiten pro Tag sind erlaubt. Eigene Einträge bleiben bei neuen Planvorschlägen geschützt.</p></HelpDisclosure>
    <div className="tempo-manual-actions">
      <button type="button" onClick={()=>begin('planned',currentKey())}>＋ Training planen</button>
      <button type="button" className="outline" onClick={()=>begin('completed',currentKey())}>✓ Freies Training protokollieren</button>
    </div>
    <div className="tempo-manual-range">
      {visibleDays.length>0 && <div className="tempo-manual-day-select">{visibleDays.map(date=><button type="button" key={date} onClick={()=>setSelectedDate(date)} className={selectedDate===date?'selected':''}>{friendlyDate(date).replace(' ', ' ')}</button>)}</div>}
      <label>Datum auswählen <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></label>
    </div>
    <h3>Einträge für {friendlyDate(selectedDate)}</h3>
    {loading?<p className="tempo-manual-muted">Lade Trainings …</p> : <>
      {entries.filter(item=>item.record.date===selectedDate).length===0 && <div className="tempo-manual-empty">Noch kein Training dokumentiert. Ein freier Tag kann auch bewusst trainingsfrei bleiben.</div>}
      <div className="tempo-manual-list">
        {entries.filter(item=>item.record.date===selectedDate).map(item=>{
          const r=item.record
          const info=toLabel(r)
          const isDone=item.kind==='completed'||(item.kind==='planned'&&r.status==='erledigt')
          const marked=isDone||completedIds.has(r.id)
          const actual=item.kind==='planned'?completed.find(x=>x.plannedSessionId===r.id):undefined
          const effective=actual||r;const runPace=r.sessionType?.includes('run')&&((effective as CompletedRecord).distanceKm??(effective as TrainingRecord).expectedKm)?paceText((effective as CompletedRecord).distanceKm??(effective as TrainingRecord).expectedKm,(effective.durationSec??Math.round((effective.durationMin??0)*60))):''
          return <div key={`${item.kind}:${r.id}`} className={`tempo-manual-entry ${marked?'is-done':''}`}>
            <div className="tempo-manual-entry-top"><strong>{info.icon} {r.title}</strong><span>{isDone?'✓ Absolviert':item.kind==='planned'&&r.createdBy==='tempo-user'?'Von dir geplant':'TEMPO-Plan'}</span></div>
            <div className="tempo-manual-meta">{actual?`Ist: ${showMinutes(actual)}${actual.rpe?` · RPE ${actual.rpe}`:''}${actual.distanceKm?` · ${actual.distanceKm} km`:''}`:<>{showMinutes(r)} {item.kind==='planned'? `· ${r.priority}`:r.rpe?`· RPE ${r.rpe}`:''} {item.kind==='planned'?r.expectedKm?`· ${r.expectedKm} km`:null:r.distanceKm?`· ${r.distanceKm} km`:null}</>}{runPace&&<strong> · Ø {runPace}</strong>}</div>
            {(actual?.notes||r.notes)&&<p className="tempo-manual-note">{actual?.notes||r.notes}</p>}
            {actual&&<p className="tempo-manual-note">Mit Ist-Aktivität verknüpft · geplante Vorgabe: {durationFor(r)}{actual.externalActivityId?' · Garmin-Messwerte ✓':''}</p>}
            <div className="tempo-manual-entry-actions">
              {!marked&&<button type="button" disabled={busy} onClick={()=>edit(item)}>Bearbeiten / verschieben</button>}
              {actual&&<button type="button" disabled={busy} onClick={()=>edit({kind:'completed',record:actual})}>Ist-Werte bearbeiten</button>}
              {item.kind==='completed'&&!item.record.plannedSessionId&&<button type="button" disabled={busy} onClick={()=>edit(item)}>Ist-Werte bearbeiten</button>}
              {item.kind==='planned'&&!marked&&<button type="button" disabled={busy} onClick={()=>finish(item.record)}>Absolvieren</button>}
              {(!marked&&item.kind==='planned'||item.kind==='completed'&&!item.record.plannedSessionId)&&<button type="button" className="danger" disabled={busy} onClick={()=>void remove(item)}>Löschen</button>}
            </div>
          </div>
        })}
      </div>
      {entries.length>0&&<div className="tempo-manual-summary">{entries.filter(x=>x.kind==='planned'&&!completedIds.has(x.record.id)&&x.record.status!=='erledigt').length} offene Planungen · {entries.filter(x=>x.kind==='completed').length + entries.filter(x=>x.kind==='planned'&&(completedIds.has(x.record.id)||x.record.status==='erledigt')).length} absolvierte Einträge {days?'im gewählten Zeitraum':'insgesamt'}</div>}
    </>}
    {draft&&<div ref={editorRef} id="tempo-manual-editor" className="tempo-manual-editor">
      <div className="tempo-manual-editor-head"><h3>{linked?'Geplantes Training abschließen':editing?'Eintrag bearbeiten':mode==='planned'?'Training selbst planen':'Freies Training erfassen'}</h3><button type="button" aria-label="Eingabe schließen" onClick={()=>{setDraft(null);setLinked(null);setEditing(null)}}>×</button></div>
      {mode==='planned'&&shifts[draft.date]?.shift==='einsatz'&&draft.sport!=='mobility'&&<div className="tempo-plan-warning">Einsatz-Tag: Recovery oder Pause wird bevorzugt. Du kannst diese Empfehlung bewusst übersteuern.</div>}
      <form onSubmit={e=>void submit(e)}>
        <div className="tempo-manual-fields">
          <Field>Datum<input type="date" required value={draft.date} onChange={e=>patch('date',e.target.value)}/></Field>
          <Field>Sportart<select value={draft.sport} onChange={e=>patch('sport',e.target.value as ManualSport)}>{sports.map(s=><option value={s.value} key={s.value}>{s.label}</option>)}</select></Field>
          {mode==='planned'&&blockedDays.includes(draft.date)&&<p className="tempo-plan-warning">🔒 Trainingsfreier Tag: Zuerst im Tagestraining die Freigabe aufheben, bevor ein neues Training geplant werden kann.</p>}
          {draft.sport==='cycling'&&<div className="tempo-28-commute-select"><strong>Pendeln · nur Kennzeichnung der Radfahrt</strong><div role="group" aria-label="Pendeln" className="tempo-28-commute-choices">{([['none','Kein Pendeln'],['hin','Hinfahrt'],['rueck','Rückfahrt'],['beide','Hin & Rück']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={draft.commuteLeg===key} className={draft.commuteLeg===key?'selected':''} onClick={()=>patch('commuteLeg',key)}>{label}</button>)}</div><small>Eine Trainingsfahrt auf dem Rückweg wird einmal gespeichert und nur als Rückweg markiert – keine zweite Belastung.</small></div>}
          {draft.sport==='cycling'&&<Field>Radtraining: Umgebung<select value={draft.cyclingEnvironment} onChange={e=>patch('cyclingEnvironment',e.target.value)}><option value="unknown">Noch unklar</option><option value="outdoor">Outdoor / draußen</option><option value="indoor">Indoor / Zwift / Rolle</option></select></Field>}
          {draft.sport==='swimming'&&<><Field>Schwimmen: Umgebung<select value={draft.swimEnvironment} onChange={e=>patch('swimEnvironment',e.target.value)}><option value="pool">Schwimmbad</option><option value="openwater">Freiwasser</option></select></Field><Field>Schwimmen: Schwerpunkt<select value={draft.swimFocus} onChange={e=>patch('swimFocus',e.target.value)}><option value="locker">Locker</option><option value="technik">Technik</option><option value="ausdauer">Ausdauer</option><option value="intervalle">Intervalle</option></select></Field></>}
          {draft.sport==='strength'&&<Field>Krafttraining: Ort<select value={draft.strengthLocation} onChange={e=>patch('strengthLocation',e.target.value)}><option value="studio">Fitnessstudio</option><option value="arbeit">Auf Arbeit</option></select></Field>}
          {(draft.sport==='yoga'||draft.sport==='stabi')&&<Field>Herkunft des Trainings<select value={draft.sessionOrigin} onChange={e=>patch('sessionOrigin',e.target.value)}><option value="self">Eigenes / spontanes Training</option><option value="extern">Extern vorgegeben / angeleiteter Kurs</option></select></Field>}
          <Field>Trainingsname<input required maxLength={120} value={draft.title} placeholder="z. B. Gravelrunde mit Freunden" onChange={e=>patch('title',e.target.value)}/></Field>
          <TimeFields label="Trainingsdauer" value={draft.duration} onChange={value=>patch('duration',value)} required/>
          <Field>{draft.sport==='swimming'?'Distanz (km, z. B. 0,75 = 750 m)':'Distanz (km, optional)'}{numInput(draft.distance,v=>patch('distance',v),'z. B. 75')}</Field>
          {draft.sport==='running'&&draft.distance&&Number(draft.distance.replace(',','.'))>0&&<div className="tempo34-running-pace">🏃 Ø-Pace {paceText(Number(draft.distance.replace(',','.')),/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(draft.duration)?parseHms(draft.duration,true).seconds:0)||'–'} · min/km aus tatsächlicher Zeit und Distanz</div>}
          <Field>Höhenmeter (optional){numInput(draft.elevation,v=>patch('elevation',v),'z. B. 800')}</Field>
          {mode==='planned'?<>
            <Field>Priorität<select value={draft.priority} onChange={e=>patch('priority',e.target.value)}><option>MUSS</option><option>SOLL</option><option>KANN</option></select></Field>
            <Field>Ziel / Intensität<input value={draft.target} maxLength={1000} placeholder="z. B. locker Z2, 140–175 W" onChange={e=>patch('target',e.target.value)}/></Field>
          </>:<Field>RPE 1–10 (optional)<select value={draft.rpe} onChange={e=>patch('rpe',e.target.value)}><option value="">Nicht angegeben</option>{Array.from({length:10},(_,i)=><option value={i+1} key={i}>{i+1}</option>)}</select></Field>}
        </div>
        <Field>Notizen<textarea rows={3} maxLength={1500} placeholder="Besonderheiten, Freunde, Gefühl, Bedingungen …" value={draft.notes} onChange={e=>patch('notes',e.target.value)}/></Field>
        {linked&&<p className="tempo-manual-muted">Der Trainingsabschluss wird mit der geplanten Einheit verknüpft und nur einmal als Belastung gezählt.</p>}
        <div className="tempo-manual-form-actions"><button type="submit" disabled={busy}>{busy?'Speichere …':mode==='planned'?'Training fest speichern':'Aktivität speichern'}</button><button type="button" className="outline" onClick={()=>{setDraft(null);setLinked(null);setEditing(null)}}>Abbrechen</button></div>
      </form>
    </div>}
    {fuelingReview&&<FuelingExperienceForm key={`${fuelingReview.date}:${fuelingReview.sessionId||'free'}`} date={fuelingReview.date} sessionId={fuelingReview.sessionId} durationMin={fuelingReview.durationMin}/>}
    <p className="tempo-manual-feedback" role="status">{feedback}</p>
    <HelpDisclosure id="manual-load-help"><p>Eine neue Trainingsbelastung wird erst bei der nächsten <strong>ausdrücklich bestätigten</strong> Neuplanung als Vorbelastung berücksichtigt. Gespeicherte Einheiten ändern sich nicht automatisch. Auf Einsatztagen warnt TEMPO vor Zusatzbelastung; du entscheidest.</p></HelpDisclosure>
  </section>
}
