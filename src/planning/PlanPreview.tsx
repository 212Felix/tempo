import { useEffect, useMemo, useState } from 'react'
import { getRecord, listRecords } from '../db/storage'
import type { ProfileRecord } from '../db/types'
import {
  PROFILE_ID, commitGeneratedPlan, currentKey, friendlyDate, generatePlan,
  type CompletedRecord, type ReadinessRecord, type ShiftRecord, type TrainingRecord,
} from './engine'
import './plan.css'

export default function PlanPreview({days, shifts, refreshIndex}: {days:string[]; shifts:Record<string,ShiftRecord>; refreshIndex:number}) {
  const [profile, setProfile] = useState<ProfileRecord | undefined>()
  const [ready, setReady] = useState<ReadinessRecord | undefined>()
  const [existing, setExisting] = useState<TrainingRecord[]>([])
  const [completed, setCompleted] = useState<CompletedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [manualRefresh, setManualRefresh] = useState(0)
  const [notice, setNotice] = useState('')
  const rangeId = days.join('|')
  useEffect(() => {
    const onChanged = () => setManualRefresh(n=>n+1)
    window.addEventListener('tempo:training-change',onChanged)
    return () => window.removeEventListener('tempo:training-change',onChanged)
  },[])
  useEffect(() => {
    let live = true
    setLoading(true)
    void Promise.all([
      getRecord<ProfileRecord>('profiles',PROFILE_ID),
      getRecord<ReadinessRecord>('readinessEntries',`${PROFILE_ID}:${currentKey()}`),
      listRecords<TrainingRecord>('plannedSessions'),
      listRecords<CompletedRecord>('completedSessions'),
    ]).then(([p,r,old,done]) => {
      if (!live) return
      setProfile(p); setReady(r); setExisting(old); setCompleted(done); setLoading(false)
    }).catch(err => { if (live) {setLoading(false);setNotice(`Daten konnten nicht geladen werden: ${String(err)}`)} })
    return () => {live = false}
  }, [rangeId,refreshIndex,manualRefresh])
  const planned = useMemo(() => generatePlan({days, shifts, profile, readiness:ready, existing, completed}),
    [rangeId, shifts, profile, ready, existing, completed])
  const already = existing.filter(s => s.profileId === PROFILE_ID && days.includes(s.date))
  const unconfirmed = planned.filter(p => !p.confirmed).length
  const sessions = planned.filter(p => p.session && p.confirmed && !p.protected)
  const minutes = sessions.reduce((total,p) => total+(p.session?.durationMin || 0),0)
  const commuteCount = sessions.filter(p => p.session?.sessionType === 'commute').length
  const important = planned.filter(p => p.session && ['long','quality'].includes(p.session.sessionType)).length
  const loadAlerts = planned.filter(p => p.date >= currentKey() && p.confirmed && p.recoveryFlag === 'recovery')
  async function save() {
    if (loading || working) return
    if (!window.confirm(`TEMPO soll die Vorschläge für ${days.length} Tage übernehmen?\n\nBereits abgeschlossene oder manuell angelegte Einheiten bleiben geschützt. Noch nicht abgeschlossene, automatisch erzeugte Einheiten in diesem Zeitraum werden ersetzt. Nicht bestätigte Diensttage bleiben ohne festes Training.`)) return
    setWorking(true)
    try {
      const count = await commitGeneratedPlan(planned, existing, completed)
      setExisting(await listRecords<TrainingRecord>('plannedSessions'))
      setNotice(`${count} Einheiten gespeichert ✓ · Unter „Tagestraining“ einsehbar. Anpassung nach späteren Dienständerungen nur durch erneutes Vorschlagen und Bestätigen.`)
    } catch(error) {setNotice(`Speichern fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`)}
    finally {setWorking(false)}
  }
  return <section className="panel tempo-plan">
    <div className="eyebrow">PHASE 7 · BELASTUNGSGESTEUERTE PLANUNG</div>
    <h2>Trainingsplan vorschlagen</h2>
    <p>Der Vorschlag berücksichtigt bestätigte Dienste, manuelle Termine und dokumentierte zusätzliche Belastung. Nach längeren oder intensiven Aktivitäten werden Folgetage vorsichtiger geplant. Keine automatische Änderung deiner eigenen Einheiten; noch keine vollständige Periodisierung oder medizinische Trainingsfreigabe.</p>
    {loading ? <p className="tempo-plan-muted">Vorschläge werden berechnet …</p> : <>
      <div className="tempo-plan-stats"><span><strong>{sessions.length}</strong> Einheiten</span><span><strong>{Math.floor(minutes/60)}:{String(minutes%60).padStart(2,'0')} h</strong> {commuteCount ? 'ohne Pendelzeit' : 'Vorschlag'}</span><span><strong>{important}</strong> Rad-Schwerpunkte</span></div>
      {ready?.date===currentKey() && ready.illness==='ja' && <div className="tempo-plan-warning">Heute wurden Beschwerden gemeldet. Falls Pendeln trotzdem nötig ist, bitte selbst kritisch prüfen; geplante Belastungen werden nicht als medizinische Freigabe verstanden.</div>}
      {loadAlerts.length > 0 && <div className="tempo-plan-load-alert" role="status"><strong>Belastung berücksichtigt</strong><p>Für {loadAlerts.length} bestätigte Folgetage empfiehlt TEMPO besondere Vorsicht oder Recovery. Bereits von dir festgelegte Einheiten bleiben unverändert und können mit einem Hinweis markiert sein.</p></div>}
      {unconfirmed > 0 && <div className="tempo-plan-warning">{unconfirmed} von {days.length} Diensten sind noch unbestätigt. An diesen Tagen plant TEMPO vorsichtshalber keine feste Einheit. Wochenenden sind bis zur Bestätigung nur Vorschläge.</div>}
      <div className="tempo-plan-grid">
        {planned.map(day => {
          const item = day.session
          const fixed = day.protected ? already.filter(x => x.date === day.date) : []
          const protectedEntry = fixed[0]
          return <div key={day.date} className={`tempo-plan-day ${!day.confirmed?'is-open':item?.sessionType === 'recovery'?'is-rest':day.protected?'is-locked':'is-ready'}`}>
            <div className="tempo-plan-top"><strong>{friendlyDate(day.date)}</strong><span>{day.confirmed ? (day.shift==='frei'?'Frei':day.shift==='tagdienst'?'Tagdienst':'Einsatz') : 'Dienst offen'}</span></div>
            {!day.confirmed ? <><div className="tempo-plan-name">Dienst bestätigen</div><small>Kein festes Training</small></>
              : day.protected ? <><div className="tempo-plan-name">{protectedEntry?.title || 'Bereits dokumentiert'}</div><small>{fixed.length > 1 ? `${fixed.length} Einheiten auf diesem Tag bleiben geschützt` : 'Bestehende Einheit bleibt geschützt'}</small></>
              : item ? <><div className="tempo-plan-name">{item.sessionType==='commute'?'🚲 ':item.sessionType.startsWith('strength')?'🏋️ ':item.sessionType==='run'?'🏃 ':item.sessionType==='recovery'?'🧘 ':'🚴 '}{item.title}</div><div className="tempo-plan-sub">{item.durationMin ? `${item.durationMin} min` : 'Dauer offen'} · {item.priority}{item.expectedKm ? ` · ${item.expectedKm} km` : ''}</div><small>{item.sessionType==='commute' ? item.notes : item.description}</small></>
              : <><div className="tempo-plan-name">Ruhetag / frei</div><small>Belastung bewusst offenlassen</small></>}
            {day.confirmed && day.recoveryFlag && day.recoveryFlag !== 'none' && <div className={`tempo-plan-load-note ${day.recoveryFlag === 'recovery' ? 'is-high' : 'is-mild'}`}><strong>{day.recoveryFlag === 'recovery' ? 'Regeneration bevorzugt' : 'Belastung beachten'}</strong><span>{day.recoveryReasons?.join(' · ')}</span>{day.protected && <span>Deine gespeicherte Einheit bleibt geschützt. Belastung und Termin bitte selbst prüfen.</span>}</div>}
            {day.confirmed && <button type="button" className="tempo-plan-manual-button" onClick={() => window.dispatchEvent(new CustomEvent('tempo:manual-add',{detail:day.date}))}>＋ Eigenes Training</button>}
          </div>
        })}
      </div>
      <p className="tempo-plan-muted">Manuell geplante und absolvierte Einheiten werden bei der Neuplanung geschützt. Ihre Belastung beeinflusst die Folgetage. Die Schwellen sind vorläufige Heuristiken; Uhrdaten und individuelle Reaktionen ergänzen wir später. Änderungen am gespeicherten Plan erfolgen erst nach deiner Bestätigung.</p>
      <p className="tempo-plan-muted">Einheiten bleiben Empfehlungen. Readiness wird morgens erneut geprüft. Ein Einsatz erhält nur Recovery/Pause. Volle Pendeltage werden als eigener Ausdauerreiz gerechnet; bei Hin + Rück bleibt die Hinfahrt locker.</p>
      <button type="button" className="tempo-plan-save" disabled={working || loading} onClick={() => void save()}>{working?'Plan wird gespeichert …':'Vorschläge prüfen & Plan übernehmen'}</button>
      <div className="tempo-plan-feedback" role="status">{notice || 'Nichts wird automatisch überschrieben. Erst deine Bestätigung speichert die Vorschläge.'}</div>
    </>}
  </section>
}
