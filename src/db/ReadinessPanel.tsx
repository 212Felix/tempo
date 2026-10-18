import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getRecord, saveRecord } from './storage'
import type { TempoRecord, ProfileRecord } from './types'
import './readiness.css'
import MorningFuelingCheck from '../phase32/MorningFuelingCheck'

const PROFILE_ID = 'local-primary-profile'
const dateKey = () => {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

const fields = [
  { key: 'sleep', title: 'Schlafqualität', left: 'sehr schlecht', right: 'sehr gut', positive: true },
  { key: 'energy', title: 'Energie / Erholung', left: 'niedrig', right: 'sehr gut', positive: true },
  { key: 'stress', title: 'Stress', left: 'gering', right: 'hoch', positive: false },
  { key: 'fatigue', title: 'Müdigkeit', left: 'gering', right: 'hoch', positive: false },
  { key: 'legs', title: 'Beinempfinden', left: 'frisch / locker', right: 'schwer / belastet', positive: false },
] as const

type RatingKey = (typeof fields)[number]['key']
type Ratings = Partial<Record<RatingKey, number>>
type ShiftKind = 'offen' | 'frei' | 'tagdienst' | 'einsatz'
type CommuteKind = 'nein' | 'hin' | 'zurueck' | 'beide'
type AfterWorkRide = 'egal' | 'indoor' | 'outdoor'
type IllnessKind = 'erkaeltung' | 'hals' | 'magen' | 'schmerzen' | 'verletzung' | 'sonstiges'

type ReadyData = {
  ratings: Ratings
  illness: 'nein' | 'ja' | ''
  illnessKind: IllnessKind | ''
  note: string
  shift: ShiftKind
  workStrength: boolean
  workRun: boolean
  afterWorkStrength: boolean
  afterWorkRun: boolean
  afterWorkCycling: boolean
  afterWorkRide: AfterWorkRide
  commute: CommuteKind
}

type DayEntry = TempoRecord & { date: string; ratings?: Ratings; illness?: 'nein' | 'ja' | ''; illnessKind?: IllnessKind | ''; note?: string }
type ShiftEntry = TempoRecord & { date: string; shift?: ShiftKind; workStrength?: boolean; workRun?: boolean; afterWorkStrength?: boolean; afterWorkRun?: boolean; afterWorkCycling?: boolean; afterWorkRide?: AfterWorkRide; commute?: CommuteKind }

const fresh: ReadyData = {
  ratings: {}, illness: '', illnessKind: '', note: '', shift: 'offen',
  workStrength: false, workRun: false, afterWorkStrength:false, afterWorkRun:false, afterWorkCycling: false,
  afterWorkRide: 'egal', commute: 'nein',
}

export function evaluateReadiness(data: Pick<ReadyData, 'ratings' | 'illness'>): { level: 'offen' | 'gruen' | 'gelb' | 'rot'; title: string; reason: string } {
  const allRated = fields.every(f => data.ratings[f.key] != null)
  if (!allRated || data.illness === '') return { level: 'offen', title: 'Check-in noch unvollständig', reason: 'Bitte die fünf Bereiche und die Frage zu Krankheit/Auffälligkeiten beantworten.' }
  if (data.illness === 'ja') return { level: 'rot', title: 'ROT · Belastung prüfen', reason: 'Du hast Beschwerden angegeben. Harte Belastungen lieber zurückstellen und gesundheitliche Symptome beachten.' }
  const unfavorable = fields.filter(f => {
    const value = data.ratings[f.key]!
    return f.positive ? value <= 2 : value >= 4
  })
  const middling = fields.filter(f => data.ratings[f.key] === 3)
  const named = unfavorable.map(f => f.title.toLowerCase())
  if (unfavorable.length >= 3 || (data.ratings.energy! <= 2 && data.ratings.fatigue! >= 4)) {
    return { level: 'rot', title: 'ROT · Erholung bevorzugen', reason: `Mehrere Belastungssignale (${named.join(', ')}). Keine harte Einheit erzwingen; Umfang und Intensität heute deutlich reduzieren.` }
  }
  if (unfavorable.length || middling.length >= 3) {
    return { level: 'gelb', title: 'GELB · Heute flexibel bleiben', reason: unfavorable.length ? `Auffällig: ${named.join(', ')}. Trainieren ggf. möglich, aber Intensität und Zeit kritisch prüfen.` : 'Mehrere Werte sind mittelmäßig. Belastung nach Gefühl dosieren und gegebenenfalls reduzieren.' }
  }
  return { level: 'gruen', title: 'GRÜN · Gute Ausgangslage', reason: 'Deine heutigen Angaben sind insgesamt unauffällig. Geplantes Training grundsätzlich möglich; Tagesform weiterhin beachten.' }
}

function prettifyDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d))
}

function BubbleSet({ label, selected, positive, onSelect }: { label: string; selected?: number; positive: boolean; onSelect: (n: number) => void }) {
  return <div className="tempo-ready-bubbles" role="group" aria-label={label}>
    {[1, 2, 3, 4, 5].map(n => {
      const tone = (positive ? n >= 4 : n <= 2) ? 'green' : (n === 3 ? 'yellow' : 'red')
      return <button type="button" key={n} className={`tempo-ready-bubble tempo-ready-${tone} ${selected === n ? 'is-picked' : ''}`} aria-pressed={selected === n} onClick={() => onSelect(n)}>{n}</button>
    })}
  </div>
}

function Choice({ chosen, onClick, children }: { chosen: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className={`tempo-ready-choice ${chosen ? 'is-picked' : ''}`} onClick={onClick} aria-pressed={chosen}>{children}</button>
}

export default function ReadinessPanel() {
  const [day] = useState(dateKey)
  const [oneWayKm, setOneWayKm] = useState<number | null>(null)
  const [data, setData] = useState<ReadyData>(fresh)
  const latest = useRef<ReadyData>(fresh)
  const writing = useRef<Promise<void>>(Promise.resolve())
  const revision = useRef(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('Einträge werden geladen …')

  useEffect(() => {
    let active = true
    void Promise.all([
      getRecord<DayEntry>('readinessEntries', `${PROFILE_ID}:${day}`),
      getRecord<ShiftEntry>('shifts', `${PROFILE_ID}:${day}`),
      getRecord<ProfileRecord>('profiles', PROFILE_ID),
    ]).then(([ready, shift, profile]) => {
      if (!active) return
      const merged: ReadyData = {
        ...fresh,
        ratings: ready?.ratings ?? {}, illness: ready?.illness ?? '',
        illnessKind: ready?.illnessKind ?? '', note: ready?.note ?? '',
        shift: shift?.shift ?? 'offen', workStrength: !!shift?.workStrength,
        workRun: !!shift?.workRun, afterWorkStrength:!!shift?.afterWorkStrength, afterWorkRun:!!shift?.afterWorkRun, afterWorkCycling: !!shift?.afterWorkCycling,
        afterWorkRide: shift?.afterWorkRide ?? 'egal', commute: shift?.commute ?? 'nein',
      }
      latest.current = merged
      setData(merged)
      setOneWayKm(profile?.commuteOneWayKm ?? null)
      setStatus(ready || shift ? 'Deine gespeicherten Angaben wurden geladen.' : 'Noch keine Angaben für heute.')
      setLoading(false)
    }).catch(e => { if (active) { setStatus(`Datenbank konnte nicht geladen werden: ${String(e)}`); setLoading(true) } })
    return () => { active = false }
  }, [day])

  function change(patch: Partial<ReadyData>) {
    if (loading) return
    const next = { ...latest.current, ...patch }
    latest.current = next
    setData(next)
    const myRevision = ++revision.current
    setStatus('Wird gespeichert …')
    writing.current = writing.current.catch(() => undefined).then(async () => {
      const id = `${PROFILE_ID}:${day}`
      const stamp = new Date().toISOString()
      const [previousReady, previousShift] = await Promise.all([
        getRecord<DayEntry>('readinessEntries', id),
        getRecord<ShiftEntry>('shifts', id),
      ])
      const readinessEntry: DayEntry = {
        ...previousReady, id, date: day, profileId: PROFILE_ID,
        createdAt: previousReady?.createdAt || stamp, updatedAt: stamp,
        ratings: next.ratings, illness: next.illness, illnessKind: next.illnessKind,
        note: next.note,
      }
      const shiftEntry: ShiftEntry = {
        ...previousShift, id, date: day, profileId: PROFILE_ID,
        createdAt: previousShift?.createdAt || stamp, updatedAt: stamp,
        shift: next.shift, workStrength: next.workStrength, workRun: next.workRun,
        afterWorkStrength: next.shift==='tagdienst'&&next.afterWorkStrength, afterWorkRun: next.shift==='tagdienst'&&next.afterWorkRun,
        afterWorkCycling: next.afterWorkCycling, afterWorkRide: next.afterWorkRide,
        commute: next.commute,
      }
      await saveRecord('readinessEntries', readinessEntry)
      await saveRecord('shifts', shiftEntry)
    }).then(() => { window.dispatchEvent(new Event('tempo:readiness-change')); if (myRevision === revision.current) setStatus('Automatisch auf diesem Gerät gespeichert ✓') })
      .catch(e => { if (myRevision === revision.current) setStatus(`Speichern fehlgeschlagen: ${String(e)}`) })
  }

  const assessment = evaluateReadiness(data)
  const commuteKm = oneWayKm == null ? null : (data.commute === 'beide' ? 2 * oneWayKm : data.commute === 'nein' ? 0 : oneWayKm)
  const distanceText = (factor: number) => oneWayKm == null ? 'km offen' : `${Math.round(oneWayKm * factor * 10) / 10} km`

  return <div className="tempo-ready">
    <section className="panel tempo-ready-panel">
      <div className="eyebrow">HEUTE · {prettifyDate(day).toUpperCase()}</div>
      <h2>Wie fühlst du dich heute?</h2>
      <p>Fünf kurze Einschätzungen. <strong>Bei Stress, Müdigkeit und schweren Beinen bedeutet 1 = wenig und 5 = viel.</strong></p>
      {fields.map(f => <div className="tempo-ready-field" key={f.key}>
        <div className="tempo-ready-field-head"><strong>{f.title}</strong><small>{f.left} → {f.right}</small></div>
        <BubbleSet label={f.title} positive={f.positive} selected={data.ratings[f.key]} onSelect={n => change({ ratings: { ...latest.current.ratings, [f.key]: n } })}/>
      </div>)}
    </section>

    <section className="panel tempo-ready-panel">
      <div className="eyebrow">VERFÜGBARKEIT</div>
      <h2>Dienst heute</h2>
      <div className="tempo-ready-choices">
        <Choice chosen={data.shift === 'frei'} onClick={() => change({ shift: 'frei' })}>Frei <small>ganzer Tag möglich</small></Choice>
        <Choice chosen={data.shift === 'tagdienst'} onClick={() => change({ shift: 'tagdienst' })}>Tagdienst <small>Training eingeschränkt</small></Choice>
        <Choice chosen={data.shift === 'einsatz'} onClick={() => change({ shift: 'einsatz' })}>Einsatz <small>Recovery / Pause</small></Choice>
      </div>
      {data.shift === 'offen' && <p className="tempo-ready-hint">Dienst noch nicht ausgewählt.</p>}
      {data.shift === 'tagdienst' && <div className="tempo-ready-subpanel">
        <h3>Heute möglich</h3>
        <div className="tempo-ready-choices">
          <Choice chosen={data.workStrength} onClick={() => change({ workStrength: !data.workStrength })}>Kraft auf Arbeit</Choice>
          <Choice chosen={data.workRun} onClick={() => change({ workRun: !data.workRun })}>Laufen auf Arbeit</Choice>
          <Choice chosen={data.afterWorkStrength} onClick={() => change({ afterWorkStrength: !data.afterWorkStrength })}>Kraft nach Dienst</Choice>
          <Choice chosen={data.afterWorkRun} onClick={() => change({ afterWorkRun: !data.afterWorkRun })}>Laufen nach Dienst</Choice>
          <Choice chosen={data.afterWorkCycling} onClick={() => change({ afterWorkCycling: !data.afterWorkCycling })}>Rad nach Dienst</Choice>
        </div>
        {data.afterWorkCycling && <div className="tempo-ready-choices tempo-ready-small">
          <Choice chosen={data.afterWorkRide === 'indoor'} onClick={() => change({ afterWorkRide: 'indoor' })}>Indoor / Zwift</Choice>
          <Choice chosen={data.afterWorkRide === 'outdoor'} onClick={() => change({ afterWorkRide: 'outdoor' })}>Draußen</Choice>
          <Choice chosen={data.afterWorkRide === 'egal'} onClick={() => change({ afterWorkRide: 'egal' })}>Egal</Choice>
        </div>}
        <h3>Radpendeln</h3>
        <div className="tempo-ready-choices tempo-ready-small">
          <Choice chosen={data.commute === 'nein'} onClick={() => change({ commute: 'nein' })}>Nein</Choice>
          <Choice chosen={data.commute === 'hin'} onClick={() => change({ commute: 'hin' })}>Hinfahrt · {distanceText(1)}</Choice>
          <Choice chosen={data.commute === 'zurueck'} onClick={() => change({ commute: 'zurueck' })}>Heimfahrt · {distanceText(1)}</Choice>
          <Choice chosen={data.commute === 'beide'} onClick={() => change({ commute: 'beide' })}>Beide · {distanceText(2)}</Choice>
        </div>
        {data.commute !== 'nein' && commuteKm == null && <p className="tempo-ready-hint">Bitte zunächst unter „Profil & Daten“ die Länge deines Arbeitswegs je Richtung hinterlegen.</p>}
        {commuteKm != null && commuteKm > 0 && <p className="tempo-ready-hint">{commuteKm} km geplant. Stadtabschnitte immer verkehrsgerecht fahren. Bei beiden Strecken: Hinfahrt überwiegend locker, strukturierte Anteile höchstens auf der geeigneten Heimfahrt und nur bei Licht, Sicherheit und ausreichender Erholung.</p>}
      </div>}
      {data.shift === 'einsatz' && <p className="tempo-ready-hint">Früher oder unplanbarer Dienst: vorerst Pause oder leichte Recovery bevorzugen. Die tatsächliche Trainingsverschiebung folgt mit der Planungslogik.</p>}
    </section>

    <section className="panel tempo-ready-panel">
      <div className="eyebrow">GESUNDHEIT</div>
      <h2>Krankheit / Auffälligkeit?</h2>
      <div className="tempo-ready-choices tempo-ready-yesno">
        <Choice chosen={data.illness === 'nein'} onClick={() => change({ illness: 'nein', illnessKind: '' })}>Nein</Choice>
        <Choice chosen={data.illness === 'ja'} onClick={() => change({ illness: 'ja' })}>Ja</Choice>
      </div>
      {data.illness === 'ja' && <label className="tempo-ready-label">Art der Auffälligkeit
        <select value={data.illnessKind} onChange={e => change({ illnessKind: e.target.value as IllnessKind | '' })}>
          <option value="">Bitte auswählen (optional)</option>
          <option value="erkaeltung">Erkältung</option><option value="hals">Hals</option>
          <option value="magen">Magen / Darm</option><option value="schmerzen">Schmerzen</option>
          <option value="verletzung">Verletzung</option><option value="sonstiges">Sonstiges</option>
        </select>
      </label>}
      <label className="tempo-ready-label">Besonderheiten / kurze Notiz (optional)
        <textarea rows={2} maxLength={1000} value={data.note} onChange={e => change({ note: e.target.value })} placeholder="Was sollte TEMPO heute wissen?" />
      </label>
    </section>

    <MorningFuelingCheck/>
    <section className={`panel tempo-ready-panel tempo-ready-result tempo-ready-result-${assessment.level}`}>
      <div className="eyebrow">DEINE READINESS</div>
      <h2>{assessment.title}</h2>
      <p>{assessment.reason}</p>
      <div role="status" className="tempo-ready-save">{status}</div>
      <small>Vorläufige Einschätzung anhand deiner Angaben, keine medizinische Diagnose und noch keine automatische Änderung des Trainingsplans.</small>
    </section>
  </div>
}

export function ReadinessHomeCard({ onOpen }: { onOpen: () => void }) {
  const [state, setState] = useState<{ loading: boolean; title: string; description: string; level: 'offen' | 'gruen' | 'gelb' | 'rot' }>({ loading: true, title: 'Lädt …', description: 'Heutiger Check-in wird geprüft.', level: 'offen' })
  useEffect(() => {
    let active = true
    const load = () => {
      void getRecord<DayEntry>('readinessEntries', `${PROFILE_ID}:${dateKey()}`)
        .then(entry => {
          if (!active) return
          const score = evaluateReadiness({ ratings: entry?.ratings ?? {}, illness: entry?.illness ?? '' })
          setState({ loading: false, title: entry ? score.title : 'Noch offen', description: entry ? score.reason : 'Dein heutiger Check-in wartet auf dich.', level: score.level })
        })
        .catch(() => { if (active) setState({ loading: false, title: 'Nicht verfügbar', description: 'Lokale Daten konnten nicht gelesen werden.', level: 'offen' }) })
    }
    load()
    window.addEventListener('tempo:readiness-change',load)
    return () => { active = false; window.removeEventListener('tempo:readiness-change',load) }
  }, [])
  return <section className={`panel status-card tempo-ready-home tempo-ready-home-${state.level}`}>
    <div className="card-heading"><div className="eyebrow">DEINE READINESS</div><span className={`tempo-ready-light tempo-ready-light-${state.level}`}/></div>
    <h3>{state.title}</h3><p>{state.description}</p>
    <button type="button" className="text-action" onClick={onOpen}>{state.loading ? 'Bitte warten …' : 'Readiness öffnen'} →</button>
  </section>
}
