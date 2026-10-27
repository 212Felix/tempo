import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getRecord, saveRecord,listRecords } from './storage'
import type { TempoRecord, ProfileRecord } from './types'
import './readiness.css'
import MorningFuelingCheck from '../phase32/MorningFuelingCheck'
import ReadinessBattery from './ReadinessBattery'
import GarminWellnessCard from '../phase40c/GarminWellnessCard'
import {assessHybrid,hrvReference} from '../phase40d/hybrid-readiness'
import GarminRecoveryHistory from '../phase40d/GarminRecoveryHistory'
import {validateWellness,type Wellness} from '../phase40c/wellness'
import {AVAILABILITY_CHOICES,availabilityFlag} from '../planning/availability'

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
  possibleStrength: boolean
  possibleRun: boolean
  possibleYoga: boolean
  possibleStabi: boolean
  workStrength: boolean
  workRun: boolean
  afterWorkStrength: boolean
  afterWorkRun: boolean
  afterWorkCycling: boolean
  afterWorkRide: AfterWorkRide
  commute: CommuteKind
}

type DayEntry = TempoRecord & { date: string; ratings?: Ratings; illness?: 'nein' | 'ja' | ''; illnessKind?: IllnessKind | ''; note?: string }
type ShiftEntry = TempoRecord & { date: string; shift?: ShiftKind; possibleStrength?:boolean; possibleRun?:boolean; possibleYoga?:boolean; possibleStabi?:boolean; workStrength?: boolean; workRun?: boolean; afterWorkStrength?: boolean; afterWorkRun?: boolean; afterWorkCycling?: boolean; afterWorkRide?: AfterWorkRide; commute?: CommuteKind }

const fresh: ReadyData = {
  ratings: {}, illness: '', illnessKind: '', note: '', shift: 'offen',
  possibleStrength:false,possibleRun:false,possibleYoga:false,possibleStabi:false,
  workStrength: false, workRun: false, afterWorkStrength:false, afterWorkRun:false, afterWorkCycling: false,
  afterWorkRide: 'egal', commute: 'nein',
}

export function evaluateReadiness(data: Pick<ReadyData, 'ratings' | 'illness'>, wellness?:Wellness|null, baseline?:number): { level: 'offen' | 'gruen' | 'gelb' | 'rot'; title: string; reason: string } {
 const result=assessHybrid(data.ratings,data.illness,wellness,baseline)
 const title=result.level==='offen'?'Check-in noch unvollständig':result.level==='rot'?'ROT · Erholung bevorzugen':result.level==='gelb'?'GELB · Belastung prüfen':'GRÜN · Tagesform günstig'
 return {level:result.level,title,reason:`${result.reason} ${result.mode==='garmin+checkin'?'Garmin-Daten und subjektive Angaben kombiniert.':'Subjektiver Check-in; Garmin-Erholungswerte fehlen.'}`}
}

function prettifyDate(date: string) {
  const [y,m,d]=date.split('-').map(Number)
  return new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(y,m-1,d))
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
  const [garmin,setGarmin]=useState<Wellness|null>(null)
  const [baseline,setBaseline]=useState<number|undefined>()
  useEffect(()=>{let alive=true;const reload=()=>void Promise.all([getRecord<TempoRecord&{wellness?:Wellness}>('settings',`garmin-wellness:${PROFILE_ID}:${day}`),listRecords<TempoRecord&{wellness?:Wellness}>('settings')]).then(([today,all])=>{if(!alive)return;const value=validateWellness(today?.wellness);setGarmin(value);setBaseline(hrvReference(all.filter(x=>x.id.startsWith(`garmin-wellness:${PROFILE_ID}:`)).map(x=>validateWellness(x.wellness)).filter((x):x is Wellness=>Boolean(x)),day))}).catch(()=>undefined);reload();window.addEventListener('tempo:garmin-wellness-change',reload);return()=>{alive=false;window.removeEventListener('tempo:garmin-wellness-change',reload)}},[day])
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
        shift: shift?.shift ?? 'offen', possibleStrength:availabilityFlag(shift,'possibleStrength'), possibleRun:availabilityFlag(shift,'possibleRun'),
        possibleYoga:availabilityFlag(shift,'possibleYoga'), possibleStabi:availabilityFlag(shift,'possibleStabi'),workStrength: !!shift?.workStrength,
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
        shift: next.shift, possibleStrength:next.possibleStrength,possibleRun:next.possibleRun,possibleYoga:next.possibleYoga,possibleStabi:next.possibleStabi,
        workStrength: next.workStrength, workRun: next.workRun,
        afterWorkStrength: next.shift==='tagdienst'&&next.afterWorkStrength, afterWorkRun: next.shift==='tagdienst'&&next.afterWorkRun,
        afterWorkCycling: next.afterWorkCycling, afterWorkRide: next.afterWorkRide,
        commute: next.commute,
      }
      await saveRecord('readinessEntries', readinessEntry)
      await saveRecord('shifts', shiftEntry)
    }).then(() => { window.dispatchEvent(new Event('tempo:readiness-change')); if (myRevision === revision.current) setStatus('Automatisch auf diesem Gerät gespeichert ✓') })
      .catch(e => { if (myRevision === revision.current) setStatus(`Speichern fehlgeschlagen: ${String(e)}`) })
  }

  const assessment = evaluateReadiness(data,garmin,baseline)
  const commuteKm = oneWayKm == null ? null : (data.commute === 'beide' ? 2 * oneWayKm : data.commute === 'nein' ? 0 : oneWayKm)
  const distanceText = (factor: number) => oneWayKm == null ? 'km offen' : `${Math.round(oneWayKm * factor * 10) / 10} km`

  return <div className="tempo-ready">
    <GarminWellnessCard date={day}/><GarminRecoveryHistory/>
    <section className="panel tempo-ready-panel tempo38-ratings">
      <div className="eyebrow">HEUTE · {prettifyDate(day).toUpperCase()}</div>
      <h2>Wie fühlst du dich heute?</h2>{garmin&&<p className="tempo40d-status">Garmin übernimmt verfügbare Schlaf- und Erholungswerte. Du bewertest weiter Stress, Müdigkeit und Beine. Bei fehlenden Garmin-Daten bleiben die bisherigen Fragen sichtbar.</p>}
      <details className="tempo38-readiness-help"><summary>ⓘ Skalen erklären</summary><p>Bei Stress, Müdigkeit und schweren Beinen bedeutet 1 = wenig und 5 = viel. Bei Schlaf und Erholung ist 5 = sehr gut.</p></details>
      {(garmin?fields.filter(f=>!(f.key==='sleep'&&garmin.sleepHours!==undefined)&&!(f.key==='energy'&&(garmin.bodyBattery!==undefined||(garmin.hrvMs!==undefined&&baseline!==undefined)))):fields).map(f => <div className="tempo-ready-field" key={f.key}>
        <div className="tempo-ready-field-head"><strong>{f.title}</strong><small>{f.left} → {f.right}</small></div>
        <BubbleSet label={f.title} positive={f.positive} selected={data.ratings[f.key]} onSelect={n => change({ ratings: { ...latest.current.ratings, [f.key]: n } })}/>
      </div>)}
    </section>

    <section className="panel tempo-ready-panel tempo38-illness">
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

    </section>


    <section className={`panel tempo-ready-panel tempo-ready-result tempo-ready-result-${assessment.level}`}>
      <div className="eyebrow">DEINE READINESS</div>
      <h2>{assessment.title}</h2>
      <ReadinessBattery level={assessment.level}/>
      <details className="tempo38-result-help"><summary>ⓘ Einschätzung erklären</summary><p>{assessment.reason}</p><small>Vorläufige Einschätzung anhand deiner Angaben, keine medizinische Diagnose.</small></details>
      <div role="status" className="tempo-ready-save">{status}</div>

    </section>
    <section className="panel tempo-ready-panel tempo38-other"><details><summary>Weitere Angaben und Dienstplanung</summary>
    <div className="tempo38-availability">
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
          {AVAILABILITY_CHOICES.map(({key,symbol,label})=><Choice key={key} chosen={data[key]} onClick={()=>change({[key]:!data[key]})}>{symbol} {label}</Choice>)}
          <Choice chosen={data.afterWorkCycling} onClick={() => change({ afterWorkCycling: !data.afterWorkCycling })}>🚴 Rad nach Dienst</Choice>
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
    </div>


      <label className="tempo-ready-label">Besonderheiten / kurze Notiz (optional)
        <textarea rows={2} maxLength={1000} value={data.note} onChange={e => change({ note: e.target.value })} placeholder="Was sollte TEMPO heute wissen?" />
      </label>
    </details></section>
    <MorningFuelingCheck/>
  </div>
}

export function ReadinessHomeCard({ onOpen }: { onOpen: () => void }) {
  const [state, setState] = useState<{ loading: boolean; title: string; description: string; level: 'offen' | 'gruen' | 'gelb' | 'rot' }>({ loading: true, title: 'Lädt …', description: 'Heutiger Check-in wird geprüft.', level: 'offen' })
  useEffect(() => {
    let active = true
    const load = () => {
      void Promise.all([getRecord<DayEntry>('readinessEntries', `${PROFILE_ID}:${dateKey()}`),getRecord<TempoRecord&{wellness?:Wellness}>('settings',`garmin-wellness:${PROFILE_ID}:${dateKey()}`),listRecords<TempoRecord&{wellness?:Wellness}>('settings')])
        .then(([entry,wellness,history]) => {
          if (!active) return
          const baseline = hrvReference(history.filter(r=>r.id.startsWith(`garmin-wellness:${PROFILE_ID}:`)).map(r=>validateWellness(r.wellness)).filter((r):r is Wellness=>Boolean(r)),dateKey())
          const score = evaluateReadiness({ ratings: entry?.ratings ?? {}, illness: entry?.illness ?? '' },validateWellness(wellness?.wellness),baseline)
          setState({ loading: false, title: entry ? score.title : 'Noch offen', description: entry ? score.reason : 'Dein heutiger Check-in wartet auf dich.', level: score.level })
        })
        .catch(() => { if (active) setState({ loading: false, title: 'Nicht verfügbar', description: 'Lokale Daten konnten nicht gelesen werden.', level: 'offen' }) })
    }
    load()
    window.addEventListener('tempo:readiness-change',load);window.addEventListener('tempo:garmin-wellness-change',load);window.addEventListener('tempo:day-rollover',load)
    return () => { active = false; window.removeEventListener('tempo:readiness-change',load);window.removeEventListener('tempo:garmin-wellness-change',load);window.removeEventListener('tempo:day-rollover',load) }
  }, [])
  return <section className={`panel tempo36-readiness tempo-ready-home-${state.level}`}>
    <div className="eyebrow">DEINE READINESS</div>
    <button className="tempo36-readiness-action tempo40b-battery-button" type="button" onClick={onOpen}><ReadinessBattery level={state.level}/><span className="tempo36-ready-open">Readiness öffnen ›</span></button>
  </section>
}
