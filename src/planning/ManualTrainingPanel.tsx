import {useEffect,useMemo,useRef,useState, type FormEvent, type ReactNode} from 'react'
import {listRecords} from '../db/storage'
import {currentKey, friendlyDate, type CompletedRecord, type ShiftRecord, type TrainingRecord} from './engine'
import {
  defaultForm, deleteManual, kindFor, labelFor, loadManualEntries, saveManualCompleted, saveManualPlanned,
  sports, toForm, type Editable, type ManualForm, type ManualSport,
} from './manual'
import './manual.css'
import HelpDisclosure from '../ui/HelpDisclosure'

type Mode = 'planned' | 'completed'
const showMinutes = (n?:number) => n ? `${n} min` : 'Dauer offen'
const toLabel=(record:TrainingRecord | CompletedRecord) => labelFor(record.sessionType)
function Field({children}:{children:ReactNode}) {return <label className="tempo-manual-field">{children}</label>}
const numInput = (value:string,set:(v:string)=>void,placeholder:string)=>
  <input type="text" inputMode="decimal" value={value} onChange={e=>set(e.target.value)} placeholder={placeholder}/>

/** Gemeinsam auf 14-Tage- und Tagestraining-Seite. Mehrfachbelegung pro Tag erlaubt. */
export default function ManualTrainingPanel({days}:{days?:string[]}) {
  const [shifts,setShifts]=useState<Record<string,ShiftRecord>>({})
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
  function begin(which:Mode,date=selectedDate) {
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
    const filteredCompleted=completed.filter(x=>!days || days.includes(x.date)).map(x=>({kind:'completed' as const,record:x}))
    return [...filteredPlanned,...filteredCompleted].sort((a,b)=>a.record.date.localeCompare(b.record.date)||a.record.createdAt.localeCompare(b.record.createdAt))
  },[daysKey,planned,completed])
  const visibleDays=days??[]
  const patch=(field:keyof ManualForm,value:string)=>setDraft(d=>d?{...d,[field]:value}:d)
  async function submit(event:FormEvent) {
    event.preventDefault()
    if(!draft || busy) return
    if(mode==='planned' && shifts[draft.date]?.shift==='einsatz' && draft.sport!=='mobility' &&
      !window.confirm('Dieser Tag ist als Einsatz bestätigt. TEMPO empfiehlt hier nur Recovery oder Pause. Möchtest du trotzdem selbstständig dieses Training planen?')) return
    setBusy(true)
    try {
      if(mode==='planned') await saveManualPlanned(draft,editing?.kind==='planned'?editing.record:undefined)
      else await saveManualCompleted(draft,editing?.kind==='completed'?editing.record:undefined,linked??undefined)
      await refresh()
      setFeedback(mode==='planned'?'Training geschützt im Kalender gespeichert ✓':'Absolvierte Einheit in der Trainingshistorie gespeichert ✓')
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
    <h2>Eigenes Training & freie Aktivitäten</h2>
    <HelpDisclosure id="calendar-manual-intro"><p>Verabrede dich zum Krafttraining, fahre spontan Rad oder verschiebe ein Workout: <strong>Du kannst jeden Tag selbst gestalten.</strong> Mehrere Einheiten pro Tag sind erlaubt. Eigene Einträge bleiben bei neuen Planvorschlägen geschützt.</p></HelpDisclosure>
    <div className="tempo-manual-actions">
      <button type="button" onClick={()=>begin('planned')}>＋ Training planen</button>
      <button type="button" className="outline" onClick={()=>begin('completed')}>✓ Freies Training protokollieren</button>
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
          return <div key={`${item.kind}:${r.id}`} className={`tempo-manual-entry ${marked?'is-done':''}`}>
            <div className="tempo-manual-entry-top"><strong>{info.icon} {r.title}</strong><span>{isDone?'✓ Absolviert':item.kind==='planned'&&r.createdBy==='tempo-user'?'Von dir geplant':'TEMPO-Plan'}</span></div>
            <div className="tempo-manual-meta">{showMinutes(r.durationMin)} {item.kind==='planned'? `· ${r.priority}`:r.rpe?`· RPE ${r.rpe}`:''} {item.kind==='planned'?r.expectedKm?`· ${r.expectedKm} km`:null:r.distanceKm?`· ${r.distanceKm} km`:null}</div>
            {r.notes&&<p className="tempo-manual-note">{r.notes}</p>}
            <div className="tempo-manual-entry-actions">
              {!marked&&<button type="button" disabled={busy} onClick={()=>edit(item)}>Bearbeiten / verschieben</button>}
              {item.kind==='completed'&&!item.record.plannedSessionId&&<button type="button" disabled={busy} onClick={()=>edit(item)}>Ist-Werte bearbeiten</button>}
              {item.kind==='planned'&&!marked&&<button type="button" disabled={busy} onClick={()=>finish(item.record)}>Absolvieren</button>}
              {(!marked&&item.kind==='planned'||item.kind==='completed'&&!item.record.plannedSessionId)&&<button type="button" className="danger" disabled={busy} onClick={()=>void remove(item)}>Löschen</button>}
            </div>
          </div>
        })}
      </div>
      {entries.length>0&&<div className="tempo-manual-summary">{entries.filter(x=>x.kind==='planned').length} geplante · {entries.filter(x=>x.kind==='completed').length} absolvierte Einträge {days?'im gewählten Zeitraum':'insgesamt'}</div>}
    </>}
    {draft&&<div ref={editorRef} id="tempo-manual-editor" className="tempo-manual-editor">
      <div className="tempo-manual-editor-head"><h3>{linked?'Geplantes Training abschließen':editing?'Eintrag bearbeiten':mode==='planned'?'Training selbst planen':'Freies Training erfassen'}</h3><button type="button" aria-label="Eingabe schließen" onClick={()=>{setDraft(null);setLinked(null);setEditing(null)}}>×</button></div>
      {mode==='planned'&&shifts[draft.date]?.shift==='einsatz'&&draft.sport!=='mobility'&&<div className="tempo-plan-warning">Einsatz-Tag: Recovery oder Pause wird bevorzugt. Du kannst diese Empfehlung bewusst übersteuern.</div>}
      <form onSubmit={e=>void submit(e)}>
        <div className="tempo-manual-fields">
          <Field>Datum<input type="date" required value={draft.date} onChange={e=>patch('date',e.target.value)}/></Field>
          <Field>Sportart<select value={draft.sport} onChange={e=>patch('sport',e.target.value as ManualSport)}>{sports.map(s=><option value={s.value} key={s.value}>{s.label}</option>)}</select></Field>
          <Field>Trainingsname<input required maxLength={120} value={draft.title} placeholder="z. B. Gravelrunde mit Freunden" onChange={e=>patch('title',e.target.value)}/></Field>
          <Field>Dauer (Minuten){numInput(draft.duration,v=>patch('duration',v),'z. B. 90')}</Field>
          <Field>Distanz (km, optional){numInput(draft.distance,v=>patch('distance',v),'z. B. 75')}</Field>
          <Field>Höhenmeter (optional){numInput(draft.elevation,v=>patch('elevation',v),'z. B. 800')}</Field>
          {mode==='planned'?<>
            <Field>Priorität<select value={draft.priority} onChange={e=>patch('priority',e.target.value)}><option>MUSS</option><option>SOLL</option><option>KANN</option></select></Field>
            <Field>Ziel / Intensität<input value={draft.target} maxLength={1000} placeholder="z. B. locker Z2, 140–175 W" onChange={e=>patch('target',e.target.value)}/></Field>
          </>:<Field>RPE 1–10 (optional)<select value={draft.rpe} onChange={e=>patch('rpe',e.target.value)}><option value="">Nicht angegeben</option>{Array.from({length:10},(_,i)=><option value={i+1} key={i}>{i+1}</option>)}</select></Field>}
        </div>
        <Field>Notizen<textarea rows={3} maxLength={1500} placeholder="Besonderheiten, Freunde, Gefühl, Bedingungen …" value={draft.notes} onChange={e=>patch('notes',e.target.value)}/></Field>
        {linked&&<p className="tempo-manual-muted">Die geplante Einheit bleibt als „erledigt“ erhalten, deine Ist-Werte werden separat dokumentiert.</p>}
        <div className="tempo-manual-form-actions"><button type="submit" disabled={busy}>{busy?'Speichere …':mode==='planned'?'Training fest speichern':'Aktivität speichern'}</button><button type="button" className="outline" onClick={()=>{setDraft(null);setLinked(null);setEditing(null)}}>Abbrechen</button></div>
      </form>
    </div>}
    <p className="tempo-manual-feedback" role="status">{feedback}</p>
    <HelpDisclosure id="manual-load-help"><p>Eine neue Trainingsbelastung wird erst bei der nächsten <strong>ausdrücklich bestätigten</strong> Neuplanung als Vorbelastung berücksichtigt. Gespeicherte Einheiten ändern sich nicht automatisch. Auf Einsatztagen warnt TEMPO vor Zusatzbelastung; du entscheidest.</p></HelpDisclosure>
  </section>
}
