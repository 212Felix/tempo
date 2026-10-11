import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getRecord, listRecords, saveRecord } from './storage'
import type { ProfileRecord, TempoRecord } from './types'
import './shift-calendar.css'
import PlanPreview from '../planning/PlanPreview'
import HelpDisclosure from '../ui/HelpDisclosure'
import ManualTrainingPanel from '../planning/ManualTrainingPanel'
import QuickAdjustmentPanel from './QuickAdjustmentPanel'

const PROFILE_ID = 'local-primary-profile'
type ShiftKind = 'offen' | 'frei' | 'tagdienst' | 'einsatz'
type CommuteKind = 'nein' | 'hin' | 'zurueck' | 'beide'
type AfterWorkRide = 'egal' | 'indoor' | 'outdoor'
type ShiftEntry = TempoRecord & {
  date: string
  shift?: ShiftKind
  workStrength?: boolean
  workRun?: boolean
  afterWorkCycling?: boolean
  afterWorkRide?: AfterWorkRide
  commute?: CommuteKind
  homeIntervals?: boolean
}
type ShiftValues = {
  shift: ShiftKind
  workStrength: boolean
  workRun: boolean
  afterWorkCycling: boolean
  afterWorkRide: AfterWorkRide
  commute: CommuteKind
  homeIntervals: boolean
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const shiftName: Record<ShiftKind, string> = { offen: 'Offen', frei: 'Frei', tagdienst: 'Tagdienst', einsatz: 'Einsatz' }
const emptyValues = (date: string): ShiftValues => ({
  shift: isWeekend(date) ? 'frei' : 'offen',
  workStrength: false, workRun: false, afterWorkCycling: false, afterWorkRide: 'egal',
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
    workStrength: Boolean(entry?.workStrength), workRun: Boolean(entry?.workRun),
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
    workStrength: values.shift === 'tagdienst' && values.workStrength,
    workRun: values.shift === 'tagdienst' && values.workRun,
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

export default function ShiftCalendarPanel() {
  const [rangeOffset, setRangeOffset] = useState(0)
  const [horizon, setHorizon] = useState<7 | 14>(14)
  const [entries, setEntries] = useState<Record<string, ShiftEntry>>({})
  const [profileKm, setProfileKm] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [planRefresh, setPlanRefresh] = useState(0)
  const [feedback, setFeedback] = useState('Dienste werden geladen …')
  const start = useMemo(() => { const now = new Date(); return addDays(now, rangeOffset) }, [rangeOffset])
  const days = useMemo(() => Array.from({length:horizon}, (_, i) => formatKey(addDays(start, i))), [start, horizon])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [draft, setDraft] = useState<ShiftValues | null>(null)

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
        setFeedback('Wähle einen Tag und bestätige den Dienst.')
        setLoading(false)
      })
      .catch(error => { if (active) {setLoading(false);setFeedback(`Datenbankfehler: ${String(error)}`)} })
    return () => { active = false }
  }, [])

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
        </div>
        <div className="tempo-shift-stepper"><button type="button" onClick={() => {setRangeOffset(o=>o-7);setSelectedDate(null);setDraft(null)}} aria-label="Vorherige Woche">‹</button><button type="button" onClick={() => {setRangeOffset(0);setSelectedDate(null);setDraft(null)}}>Heute</button><button type="button" onClick={() => {setRangeOffset(o=>o+7);setSelectedDate(null);setDraft(null)}} aria-label="Nächste Woche">›</button></div>
      </div>
      <div className="tempo-shift-stats"><strong>{loading ? '–' : confirmed} / {days.length} Tage bestätigt</strong><span>{days.length - confirmed} Tage noch offen</span></div>
      <div className="tempo-shift-meter"><span style={{width:`${days.length ? confirmed / days.length * 100 : 0}%`}}/></div>
    </section>

    <QuickAdjustmentPanel onSaved={(record)=>{
      setEntries(old=>({...old,[record.date]:record}))
      setPlanRefresh(n=>n+1)
      setSelectedDate(null);setDraft(null)
      window.dispatchEvent(new Event('tempo:shift-change'))
      setFeedback('Schnelle Tagesänderung gespeichert. Planvorschlag darunter vor Übernahme prüfen.')
    }}/>

    {Array.from({length: Math.ceil(days.length/7)}, (_, group) => {
      const weekDays = days.slice(group*7, group*7+7)
      return <section className="tempo-shift-week" key={weekDays[0]}>
        <div className="tempo-shift-week-head"><h3>{group === 0 ? 'Erste 7 Tage' : 'Weitere 7 Tage'}</h3><span>{displayDate(weekDays[0])} – {displayDate(weekDays[weekDays.length - 1])}</span></div>
        <div className="tempo-shift-grid">{weekDays.map(date => {
          const entry = entries[date], confirmedDay = isConfirmed(entry)
          const suggested = isWeekend(date) && !confirmedDay
          const kind = confirmedDay ? (entry?.shift ?? 'offen') : (suggested ? 'frei' : 'offen')
          return <button type="button" key={date} className={`tempo-shift-tile ${confirmedDay ? 'is-confirmed' : 'is-unconfirmed'} ${selectedDate === date ? 'is-selected' : ''}`} onClick={() => selectDay(date)} aria-label={`${displayDate(date, true)}, ${shiftName[kind]}, ${confirmedDay ? 'bestätigt' : 'noch offen'}`} aria-pressed={selectedDate === date}>
            <span className="tempo-shift-tile-date">{displayDate(date, true)}</span>
            <strong>{shiftName[kind]}</strong>
            <small>{confirmedDay ? '✓ BESTÄTIGT' : suggested ? 'VORSCHLAG' : 'NOCH OFFEN'}</small>
            {confirmedDay && kind === 'tagdienst' && entry?.commute && entry.commute !== 'nein' && <span className="tempo-shift-tile-detail">🚲 {entry.commute === 'beide' ? 'Hin + zurück' : entry.commute === 'hin' ? 'Hinfahrt' : 'Heimfahrt'}</span>}
            {confirmedDay && kind === 'einsatz' && <span className="tempo-shift-tile-detail">Recovery bevorzugt</span>}
          </button>
        })}</div>
      </section>
    })}

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
          <Choice selected={draft.workStrength} onClick={() => update({workStrength:!draft.workStrength})}>Kraft auf Arbeit</Choice>
          <Choice selected={draft.workRun} onClick={() => update({workRun:!draft.workRun})}>Laufen auf Arbeit</Choice>
          <Choice selected={draft.afterWorkCycling} onClick={() => update({afterWorkCycling:!draft.afterWorkCycling})}>Rad nach Dienst</Choice>
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
        <button type="button" className="tempo-shift-choice" onClick={() => window.dispatchEvent(new CustomEvent('tempo:manual-add',{detail:selectedDate}))}>＋ Eigenes Training für diesen Tag</button>
      </div>
    </section>}
    <div className="tempo-shift-feedback" role="status">{feedback}</div>
    <ManualTrainingPanel days={days}/>
    <PlanPreview days={days} shifts={entries} refreshIndex={planRefresh}/>
  </div>
}
