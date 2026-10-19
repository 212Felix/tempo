import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getRecord, listRecords, saveRecord } from './storage'
import type { ProfileRecord, TempoRecord } from './types'
import './shift-calendar.css'
import PlanPreview from '../planning/PlanPreview'
import HelpDisclosure from '../ui/HelpDisclosure'
import ReconciliationPanel from '../planning/ReconciliationPanel'
import QuickAdjustmentPanel from './QuickAdjustmentPanel'
import CalendarBoard from '../phase34/CalendarBoard'
import {currentKey,generatePlan,type TrainingRecord,type CompletedRecord,type ReadinessRecord} from '../planning/engine'
import {deriveAdaptiveWeeks} from '../phase28/adaptive-planner'
import {rollingCalendarWeeks,isRestDay,type RestDayRecord} from '../phase31/rest-days'
import type {GoalEvent,RouteEntry} from '../events/library'
import type {TrainingBlock} from '../blocks/library'
import {AVAILABILITY_CHOICES,availabilityFlag} from '../planning/availability'
import {RHYTHM_ID,RHYTHM_DAYS,RHYTHM_CHOICES,EMPTY_RHYTHM,makeRhythm,validRhythm,type DayFocus,type WeekRhythm} from '../phase35/weekly-rhythm'
import '../phase35/weekly-rhythm.css'

const PROFILE_ID = 'local-primary-profile'
type ShiftKind = 'offen' | 'frei' | 'tagdienst' | 'einsatz'
type CommuteKind = 'nein' | 'hin' | 'zurueck' | 'beide'
type AfterWorkRide = 'egal' | 'indoor' | 'outdoor'
type ShiftEntry = TempoRecord & {
  date: string
  shift?: ShiftKind
  possibleStrength?:boolean
  possibleRun?:boolean
  possibleYoga?:boolean
  possibleStabi?:boolean
  workStrength?: boolean
  workRun?: boolean
  afterWorkStrength?: boolean
  afterWorkRun?: boolean
  afterWorkCycling?: boolean
  afterWorkRide?: AfterWorkRide
  commute?: CommuteKind
  homeIntervals?: boolean
}
type ShiftValues = {
  shift: ShiftKind
  possibleStrength:boolean
  possibleRun:boolean
  possibleYoga:boolean
  possibleStabi:boolean
  workStrength: boolean
  workRun: boolean
  afterWorkStrength: boolean
  afterWorkRun: boolean
  afterWorkCycling: boolean
  afterWorkRide: AfterWorkRide
  commute: CommuteKind
  homeIntervals: boolean
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const shiftName: Record<ShiftKind, string> = { offen: 'Offen', frei: 'Frei', tagdienst: 'Tagdienst', einsatz: 'Einsatz' }
const emptyValues = (date: string): ShiftValues => ({
  shift: isWeekend(date) ? 'frei' : 'offen',
  possibleStrength:false,possibleRun:false,possibleYoga:false,possibleStabi:false,
  workStrength: false, workRun: false, afterWorkStrength:false, afterWorkRun:false, afterWorkCycling: false, afterWorkRide: 'egal',
  commute: 'nein', homeIntervals: false,
})
function formatKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12)
}
function isWeekend(key: string) { return [0, 6].includes(parseKey(key).getDay()) }
function displayDate(key: string, withWeekday = false): string {
  const date = parseKey(key)
  return `${withWeekday ? `${WEEKDAYS[date.getDay()]} ` : ''}${new Intl.DateTimeFormat('de-DE', {day:'2-digit',month:'2-digit'}).format(date)}`
}
function toValues(entry: ShiftEntry | undefined, date: string): ShiftValues {
  return { ...emptyValues(date),
    ...entry,
    shift: entry?.shift && entry.shift !== 'offen' ? entry.shift : (isWeekend(date) ? 'frei' : 'offen'),
    possibleStrength:availabilityFlag(entry,'possibleStrength'),possibleRun:availabilityFlag(entry,'possibleRun'),possibleYoga:availabilityFlag(entry,'possibleYoga'),possibleStabi:availabilityFlag(entry,'possibleStabi'),
    workStrength: Boolean(entry?.workStrength), workRun: Boolean(entry?.workRun),
    afterWorkStrength: Boolean(entry?.afterWorkStrength), afterWorkRun: Boolean(entry?.afterWorkRun),
    afterWorkCycling: Boolean(entry?.afterWorkCycling), afterWorkRide: entry?.afterWorkRide ?? 'egal',
    commute: entry?.commute ?? 'nein', homeIntervals: Boolean(entry?.homeIntervals),
  }
}
function isConfirmed(entry?: ShiftEntry): boolean { return !!entry && !!entry.shift && entry.shift !== 'offen' }
function Choice({ selected, onClick, children }: {selected: boolean; onClick: () => void; children: ReactNode}) {
  return <button type="button" className={`tempo-shift-choice ${selected ? 'selected' : ''}`} onClick={onClick} aria-pressed={selected}>{children}</button>
}
function makeEntry(date: string, values: ShiftValues, previous?: ShiftEntry): ShiftEntry {
  return {
    ...previous,
    id: `${PROFILE_ID}:${date}`, date, profileId: PROFILE_ID,
    createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
    shift: values.shift,
    possibleStrength:values.shift==='tagdienst'&&values.possibleStrength,
    possibleRun:values.shift==='tagdienst'&&values.possibleRun,
    possibleYoga:values.shift==='tagdienst'&&values.possibleYoga,
    possibleStabi:values.shift==='tagdienst'&&values.possibleStabi,
    workStrength: values.shift === 'tagdienst' && values.workStrength,
    workRun: values.shift === 'tagdienst' && values.workRun,
    afterWorkStrength: values.shift === 'tagdienst' && values.afterWorkStrength,
    afterWorkRun: values.shift === 'tagdienst' && values.afterWorkRun,
    afterWorkCycling: values.shift === 'tagdienst' && values.afterWorkCycling,
    afterWorkRide: values.shift === 'tagdienst' ? values.afterWorkRide : 'egal',
    commute: values.shift === 'tagdienst' ? values.commute : 'nein',
    homeIntervals: values.shift === 'tagdienst' && ['beide', 'zurueck'].includes(values.commute) && values.homeIntervals,
  }
}

export function ShiftHomeCard({ onOpen }: {onOpen: () => void}) {
  const [state, setState] = useState<{confirmed: number; loading: boolean; error: boolean}>({confirmed: 0, loading:true, error:false})
  useEffect(() => {
    let live = true
    const now = new Date(); now.setHours(12, 0, 0, 0)
    const keys = new Set(Array.from({length: 14}, (_, i) => formatKey(addDays(now, i))))
    void listRecords<ShiftEntry>('shifts').then(entries => {
      if (!live) return
      setState({ confirmed: entries.filter(e => keys.has(e.date) && e.profileId === PROFILE_ID && isConfirmed(e)).length, loading:false, error:false })
    }).catch(() => { if (live) setState({confirmed:0, loading:false, error:true}) })
    return () => { live = false }
  }, [])
  return <section className={`panel status-card ${state.confirmed === 14 ? 'tempo-shift-home-complete' : 'amber-card'}`}>
    <div className="card-heading"><div className="eyebrow">DIENSTPLANUNG</div><span className={`mini-dot ${state.confirmed === 14 ? 'good-dot' : 'amber'}`}/></div>
    <h3>{state.loading ? 'Wird geladen …' : state.error ? 'Nicht verfügbar' : state.confirmed === 14 ? '14 Tage vorbereitet' : `${state.confirmed} von 14 Tagen geplant`}</h3>
    <p>{state.error ? 'Dienstplanung konnte nicht gelesen werden.' : 'Wochenenden sind zunächst als Frei vorgeschlagen, bis du sie bestätigst. Nutze die 14-Tage-Ansicht, um anschließend einen Trainingsvorschlag zu erstellen.'}</p>
    <button type="button" className="text-action" onClick={onOpen}>Dienste eintragen →</button>
  </section>
}

export default function ShiftCalendarPanel({onOpenDay,onAddDay}:{onOpenDay:(date:string)=>void;onAddDay:(date:string)=>void}) {
  const [rangeOffset, setRangeOffset] = useState(0)
  const [horizon, setHorizon] = useState<7 | 14 | 'rolling'>('rolling')
  const [entries, setEntries] = useState<Record<string, ShiftEntry>>({})
  const [profileKm, setProfileKm] = useState<number | null>(null)
  const [profile,setProfile]=useState<ProfileRecord | undefined>()
  const [readiness,setReadiness]=useState<ReadinessRecord|undefined>()
  const [eventGoals,setEventGoals]=useState<GoalEvent[]>([])
  const [routes,setRoutes]=useState<RouteEntry[]>([])
  const [blocks,setBlocks]=useState<TrainingBlock[]>([])
  const [restDays,setRestDays]=useState<RestDayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [planRefresh, setPlanRefresh] = useState(0)
  const [savedPlans,setSavedPlans]=useState<TrainingRecord[]>([])
  const [completedTrainings,setCompletedTrainings]=useState<CompletedRecord[]>([])
  const [feedback, setFeedback] = useState('Dienste werden geladen …')
  const [rhythm,setRhythm]=useState<WeekRhythm|undefined>()
  const [rhythmDraft,setRhythmDraft]=useState<DayFocus[]>([...EMPTY_RHYTHM])
  const [rhythmMessage,setRhythmMessage]=useState('')
  const start = useMemo(() => { const now = new Date(); const mondayOffset=(now.getDay()+6)%7; return addDays(now,-mondayOffset+rangeOffset) }, [rangeOffset])
  const days = useMemo(() => Array.from({length:horizon==='rolling'?rollingCalendarWeeks(currentKey())*7:horizon}, (_, i) => formatKey(addDays(start, i))), [start, horizon])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [draft, setDraft] = useState<ShiftValues | null>(null)

  useEffect(()=>{let active=true
    void getRecord<WeekRhythm>('settings',RHYTHM_ID).then(saved=>{if(active&&saved&&validRhythm(saved.days)){setRhythm(saved);setRhythmDraft([...saved.days])}}).catch(()=>undefined)
    return()=>{active=false}
  },[])
  async function saveRhythm(){
    try{const value=makeRhythm(rhythmDraft,rhythm);await saveRecord('settings',value);setRhythm(value);setRhythmMessage('Standardwoche gespeichert. Folgevorschläge werden an deinen Rhythmus angepasst.');window.dispatchEvent(new Event('tempo:training-change'))}
    catch(error){setRhythmMessage(`Konnte Standardwoche nicht speichern: ${String(error)}`)}
  }
  useEffect(() => {
    let active = true
    setLoading(true)
    void Promise.all([listRecords<ShiftEntry>('shifts'), getRecord<ProfileRecord>('profiles', PROFILE_ID)])
      .then(([shiftEntries, profile]) => {
        if (!active) return
        const map: Record<string, ShiftEntry> = {}
        shiftEntries.filter(entry => entry.profileId === PROFILE_ID && entry.date).forEach(entry => { map[entry.date] = entry })
        setEntries(map)
        setProfileKm(profile?.commuteOneWayKm ?? null)
        setProfile(profile)
        setFeedback('Wähle einen Tag und bestätige den Dienst.')
        setLoading(false)
      })
      .catch(error => { if (active) {setLoading(false);setFeedback(`Datenbankfehler: ${String(error)}`)} })
    return () => { active = false }
  }, [])

  useEffect(()=>{let live=true
    const reload=()=>void Promise.all([listRecords<TrainingRecord>('plannedSessions'),listRecords<CompletedRecord>('completedSessions'),listRecords('settings'),listRecords<GoalEvent>('events'),listRecords<RouteEntry>('routes'),listRecords<TrainingBlock>('trainingBlocks'),getRecord<ReadinessRecord>('readinessEntries',`${PROFILE_ID}:${currentKey()}`)]).then(([plans,done,settings,goals,rt,bl,ready])=>{if(live){setSavedPlans(plans.filter(x=>x.profileId===PROFILE_ID));setCompletedTrainings(done.filter(x=>x.profileId===PROFILE_ID));setRestDays(settings.filter(isRestDay));setEventGoals(goals);setRoutes(rt);setBlocks(bl);setReadiness(ready)}}).catch(()=>undefined)
    reload();window.addEventListener('tempo:training-change',reload);window.addEventListener('tempo:blocks-change',reload)
    return()=>{live=false;window.removeEventListener('tempo:training-change',reload);window.removeEventListener('tempo:blocks-change',reload)}
  },[])
  const tentativePlan=useMemo(()=>{
    // All horizons show future workouts; previously only 'rolling' displayed proposals.
    return generatePlan({days,shifts:entries,profile,readiness,existing:savedPlans,completed:completedTrainings,events:eventGoals,routes,blocks,restDays,provisionalUnconfirmed:true,rhythm})
      .filter(day=>day.date>=currentKey()&&day.session&&!savedPlans.some(s=>s.date===day.date)&&!completedTrainings.some(s=>s.date===day.date))
      .map(day=>({...day.session!,id:`preview:${day.session!.id}`,title:`Vorschlag · ${day.session!.title}`,status:'geplant' as const}))
  },[horizon,days,entries,profile,readiness,savedPlans,completedTrainings,eventGoals,routes,blocks,restDays,rhythm])
  const weeklyKinds=useMemo(()=>deriveAdaptiveWeeks({start:days[0],weeks:Math.ceil(days.length/7),events:eventGoals,blocks,planned:savedPlans,completed:completedTrainings,shifts:entries,readiness,ftpWatts:profile?.ftpWatts}),[days,eventGoals,blocks,savedPlans,completedTrainings,entries,readiness,profile])
  const blockKinds=Object.fromEntries(weeklyKinds.flatMap(w=>days.filter(d=>d>=w.startDate&&d<=w.endDate).map(d=>[d,w.kind] as const)))
  const confirmed = days.filter(date => isConfirmed(entries[date])).length
  const proposedWeekends = days.filter(date => isWeekend(date) && !isConfirmed(entries[date]))
  const totalKm = draft?.commute === 'beide' ? (profileKm ?? 0) * 2 : draft?.commute === 'nein' ? 0 : profileKm ?? 0

  function selectDay(date: string) {
    if (saving) return
    setSelectedDate(date)
    setDraft(toValues(entries[date], date))
    setFeedback(`Dienst für ${displayDate(date, true)} bearbeiten.`)
  }
  function update(patch: Partial<ShiftValues>) { setDraft(prev => prev ? { ...prev, ...patch } : prev) }
  async function saveDay() {
    if (!selectedDate || !draft || saving) return
    if (draft.shift === 'offen') {
      setFeedback('Bitte Frei, Tagdienst oder Einsatz wählen. „Offen“ ist noch nicht bestätigt.')
      return
    }
    setSaving(true)
    try {
      const previous = await getRecord<ShiftEntry>('shifts', `${PROFILE_ID}:${selectedDate}`)
      const record = makeEntry(selectedDate, draft, previous)
      await saveRecord('shifts', record)
      setEntries(old => ({ ...old, [selectedDate]: record }))
      setPlanRefresh(n => n + 1)
      window.dispatchEvent(new Event('tempo:shift-change'))
      setFeedback(`${displayDate(selectedDate, true)} · ${shiftName[draft.shift]} gespeichert ✓`)
    } catch (err) { setFeedback(`Speichern fehlgeschlagen: ${String(err)}`) }
    finally { setSaving(false) }
  }
  async function confirmWeekends() {
    if (saving || proposedWeekends.length === 0) return
    setSaving(true)
    try {
      const updates: Record<string, ShiftEntry> = {}
      for (const date of proposedWeekends) {
        // Bereits bestätigte Tage niemals überschreiben; unbestätigte Readiness-Schichteinträge erhalten.
        const previous = await getRecord<ShiftEntry>('shifts', `${PROFILE_ID}:${date}`)
        if (isConfirmed(previous)) continue
        const record = makeEntry(date, emptyValues(date), previous)
        await saveRecord('shifts', record)
        updates[date] = record
      }
      setEntries(old => ({ ...old, ...updates }))
      setPlanRefresh(n => n + 1)
      window.dispatchEvent(new Event('tempo:shift-change'))
      setFeedback(`${Object.keys(updates).length} freie Wochenendtage bestätigt ✓`)
    } catch (err) { setFeedback(`Speichern fehlgeschlagen: ${String(err)}`) }
    finally { setSaving(false) }
  }
  return <div className="tempo-shift">
    <section className="panel tempo-shift-header">
      <div className="eyebrow">DIENSTE & VERFÜGBARKEIT</div>
      <h2>Die nächsten Tage vorbereiten</h2>
      <HelpDisclosure id="calendar-shift-intro"><p>Erst die Dienste und Möglichkeiten eintragen, danach können wir die Trainingseinheiten sinnvoll verteilen. Wochenenden sind standardmäßig <strong>Frei als Vorschlag</strong> – auch sie können Tagdienst oder Einsatz werden.</p></HelpDisclosure>
      <div className="tempo-shift-toolbar">
        <div className="tempo-shift-choices" role="group" aria-label="Planungshorizont">
          <Choice selected={horizon === 7} onClick={() => {setHorizon(7);setSelectedDate(null);setDraft(null)}}>7 Tage</Choice>
          <Choice selected={horizon === 14} onClick={() => {setHorizon(14);setSelectedDate(null);setDraft(null)}}>14 Tage</Choice>
          <Choice selected={horizon === 'rolling'} onClick={() => {setHorizon('rolling');setSelectedDate(null);setDraft(null)}}>Rollierend 10+</Choice>
        </div>
        <div className="tempo-shift-stepper"><button type="button" onClick={() => {setRangeOffset(o=>o-7);setSelectedDate(null);setDraft(null)}} aria-label="Vorherige Woche">‹</button><button type="button" onClick={() => {setRangeOffset(0);setSelectedDate(null);setDraft(null)}}>Heute</button><button type="button" onClick={() => {setRangeOffset(o=>o+7);setSelectedDate(null);setDraft(null)}} aria-label="Nächste Woche">›</button></div>
      </div>
      <div className="tempo-shift-stats"><strong>{loading ? '–' : confirmed} / {days.length} Tage bestätigt</strong><span>{days.length - confirmed} Tage noch offen</span></div>
      <div className="tempo-shift-meter"><span style={{width:`${days.length ? confirmed / days.length * 100 : 0}%`}}/></div>
    </section>



    <details className="tempo35-rhythm">
      <summary>🔁 Meine Standardwoche · wiederkehrende Trainingsschwerpunkte</summary>
      <p>Lege grob fest, wann Ausdauer, Kraft, Zusatztraining oder Recovery bevorzugt sind. Diese Präferenzen gelten auch in Folgewochen. Bei Dienst, Krankheit oder fixierten Trainingsterminen darf TEMPO abweichen; danach wird dein Wochenrhythmus wieder bevorzugt. Keine Einheit wird dadurch ungefragt gespeichert.</p>
      <div className="tempo35-rhythm-grid">{RHYTHM_DAYS.map((label,i)=><label key={label}>{label}<select value={rhythmDraft[i]} onChange={e=>setRhythmDraft(old=>old.map((x,j)=>j===i?e.target.value as DayFocus:x))}>{Object.entries(RHYTHM_CHOICES).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>)}</div>
      <button type="button" onClick={()=>void saveRhythm()}>Standardwoche speichern</button>
      {rhythmMessage&&<p role="status">{rhythmMessage}</p>}
      <small>Nur eine Planungspräferenz. Dein Dienstplan wird nicht verändert. Fixierte Recoverytage und absolvierte Trainings haben Vorrang.</small>
    </details>

    {horizon==='rolling'&&<div className="tempo31-calendar-info"><strong>Rollierender Ausblick · mindestens 10 Tage ab heute.</strong> Die Kalenderwochen werden vollständig im 3/2/2-Raster gezeigt. Farbige Vorschläge an noch ungeklärten Diensttagen sind vorläufig und noch nicht gespeichert. Unter „Trainingsvorschläge“ kannst du geeignete Termine nach Dienstbestätigung fest übernehmen.</div>}
    <CalendarBoard shifts={Object.values(entries)} plans={[...savedPlans,...tentativePlan]} done={completedTrainings} onOpenDay={onOpenDay} onAddDay={onAddDay} days={days} restDays={restDays} blockKinds={blockKinds} onConfirm={async record=>{const current=await listRecords<TrainingRecord>('plannedSessions'); if(current.some(x=>x.profileId===PROFILE_ID&&x.date===record.date&&x.status==='geplant'))throw new Error('Für diesen Tag gibt es bereits einen gespeicherten Trainingsplan. Bitte zuerst den Tag öffnen.');const now=new Date().toISOString();await saveRecord('plannedSessions',{...record,id:`user:${PROFILE_ID}:${record.date}:${Date.now()}`,title:record.title.replace(/^Vorschlag · /,''),status:'geplant',createdBy:'tempo-user',locked:true,createdAt:now,updatedAt:now});window.dispatchEvent(new Event('tempo:training-change'))}}/>

    {proposedWeekends.length > 0 && <button className="tempo-shift-weekend-button" type="button" onClick={() => void confirmWeekends()} disabled={saving || loading}>Freie Wochenend-Vorschläge bestätigen ({proposedWeekends.length})</button>}

    {selectedDate && draft && <section className="panel tempo-shift-editor" id="tempo-shift-editor">
      <div className="tempo-shift-editor-head"><div><div className="eyebrow">TAG BEARBEITEN</div><h2>{new Intl.DateTimeFormat('de-DE', {weekday:'long', day:'numeric', month:'long', year:'numeric'}).format(parseKey(selectedDate))}</h2></div><button className="tempo-shift-dismiss" aria-label="Editor schließen" onClick={() => {setSelectedDate(null);setDraft(null)}}>×</button></div>
      <div className="tempo-shift-choices" role="group" aria-label="Dienst auswählen">
        {(['frei','tagdienst','einsatz'] as ShiftKind[]).map(kind => <Choice key={kind} selected={draft.shift === kind} onClick={() => update({shift:kind})}>{shiftName[kind]}</Choice>)}
      </div>
      {draft.shift === 'frei' && <p className="tempo-shift-tip">Grundsätzlich ganzer Tag für Training verfügbar. Die tägliche Readiness bestimmt später, welche Belastung sinnvoll ist.</p>}
      {draft.shift === 'einsatz' && <p className="tempo-shift-tip">Früh/unplanbar: grundsätzlich Pause, leichte Mobility oder Recovery. Keine harte Einheit automatisch einplanen.</p>}
      {draft.shift === 'tagdienst' && <div className="tempo-shift-day-work">
        <h3>Was ist trotz Tagdienst möglich?</h3>
        <div className="tempo-shift-choices">
          {AVAILABILITY_CHOICES.map(({key,symbol,label})=><Choice key={key} selected={draft[key]} onClick={()=>update({[key]:!draft[key]})}>{symbol} {label}</Choice>)}
          <Choice selected={draft.afterWorkCycling} onClick={() => update({afterWorkCycling:!draft.afterWorkCycling})}>🚴 Rad nach Dienst</Choice>
        </div>
        {draft.afterWorkCycling && <><h3>Rad nach Dienst</h3><div className="tempo-shift-choices">
          {(['indoor','outdoor','egal'] as AfterWorkRide[]).map(kind => <Choice selected={draft.afterWorkRide === kind} key={kind} onClick={() => update({afterWorkRide:kind})}>{kind === 'indoor' ? 'Indoor / Zwift' : kind === 'outdoor' ? 'Draußen' : 'Egal'}</Choice>)}
        </div></>}
        <h3>Radpendeln</h3>
        <div className="tempo-shift-choices">
          {(['nein','hin','zurueck','beide'] as CommuteKind[]).map(kind => <Choice selected={draft.commute === kind} key={kind} onClick={() => update({commute:kind, homeIntervals: kind === 'beide' ? draft.homeIntervals : false})}>{kind === 'nein' ? 'Kein Pendeln' : kind === 'hin' ? 'Hinfahrt' : kind === 'zurueck' ? 'Heimfahrt' : 'Hin + Rück'}</Choice>)}
        </div>
        {draft.commute !== 'nein' && <p className="tempo-shift-tip">{profileKm ? `${profileKm} km je Strecke${draft.commute === 'beide' ? ` · zusammen ${totalKm} km` : ''}.` : 'Für Kilometer bitte unter „Profil & Daten“ den Arbeitsweg je Strecke speichern.'} Verkehrsreiche Abschnitte sind keine Intervallstrecke.</p>}
        {(draft.commute === 'beide' || draft.commute === 'zurueck') && <>
          <h3>Heimfahrt</h3>
          <div className="tempo-shift-choices">
            <Choice selected={!draft.homeIntervals} onClick={() => update({homeIntervals:false})}>Locker bevorzugt</Choice>
            <Choice selected={draft.homeIntervals} onClick={() => update({homeIntervals:true})}>Intervalle optional</Choice>
          </div>
          <p className="tempo-shift-tip">Bei Hin + Rück: Hinfahrt locker. Strukturierte Anteile höchstens auf geeigneten freien Abschnitten der Heimfahrt – nur bei Tageslicht, sicheren Bedingungen und ausreichender Erholung.</p>
        </>}
      </div>}
      <div className="tempo-shift-editor-actions"><button type="button" disabled={saving || loading} className="tempo-shift-save" onClick={() => void saveDay()}>{saving ? 'Wird gespeichert …' : 'Tag bestätigen & speichern'}</button>
        <button type="button" className="tempo-shift-choice" onClick={() => onOpenDay(selectedDate)}>Training für diesen Tag öffnen →</button>
      </div>
    </section>}
    <div className="tempo-shift-feedback" role="status">{feedback}</div>
    <details className="tempo-28-plan-tools"><summary>Schnelle Dienstkorrektur öffnen</summary><QuickAdjustmentPanel onSaved={(record)=>{setEntries(old=>({...old,[record.date]:record}));setPlanRefresh(n=>n+1);window.dispatchEvent(new Event('tempo:shift-change'));setFeedback('Dienstkorrektur gespeichert.')}}/></details>
    <details className="tempo-28-plan-tools"><summary>Trainingsvorschläge, Abgleich & Belastungsprüfung öffnen</summary><ReconciliationPanel context="calendar"/><PlanPreview days={days} shifts={entries} refreshIndex={planRefresh}/></details>
  </div>
}
