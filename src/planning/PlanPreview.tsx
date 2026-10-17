import {durationFor} from '../time/duration'
import { useEffect, useMemo, useState } from 'react'
import { getRecord, listRecords } from '../db/storage'
import type { ProfileRecord } from '../db/types'
import {matchingBlock,describeBlock,type TrainingBlock} from '../blocks/library'
import {isTrainingFree,dayKindLabels} from '../blocks/days'
import {
  PROFILE_ID, PLANNER_VERSION, commitGeneratedPlan, currentKey, friendlyDate, generatePlan, readinessLevel,
  type CompletedRecord, type ReadinessRecord, type ShiftRecord, type TrainingRecord,
} from './engine'
import { reviewSavedPlan } from './review'
import './plan.css'
import HelpDisclosure from '../ui/HelpDisclosure'
import { buildEventInfluences, type GoalEvent, type RouteEntry } from '../events/library'
import '../events/events.css'
import { upcomingCooper, paceText } from '../events/running'

export default function PlanPreview({days, shifts, refreshIndex}: {days:string[]; shifts:Record<string,ShiftRecord>; refreshIndex:number}) {
  const [profile, setProfile] = useState<ProfileRecord | undefined>()
  const [ready, setReady] = useState<ReadinessRecord | undefined>()
  const [existing, setExisting] = useState<TrainingRecord[]>([])
  const [completed, setCompleted] = useState<CompletedRecord[]>([])
  const [events, setEvents] = useState<GoalEvent[]>([])
  const [routes, setRoutes] = useState<RouteEntry[]>([])
  const [blocks, setBlocks] = useState<TrainingBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [manualRefresh, setManualRefresh] = useState(0)
  const [notice, setNotice] = useState('')
  const rangeId = days.join('|')
  useEffect(() => {
    const onChanged = () => setManualRefresh(n=>n+1)
    window.addEventListener('tempo:training-change',onChanged)
    window.addEventListener('tempo:blocks-change',onChanged)
    return () => {window.removeEventListener('tempo:training-change',onChanged);window.removeEventListener('tempo:blocks-change',onChanged)}
  },[])
  useEffect(() => {
    let live = true
    setLoading(true)
    void Promise.all([
      getRecord<ProfileRecord>('profiles',PROFILE_ID),
      getRecord<ReadinessRecord>('readinessEntries',`${PROFILE_ID}:${currentKey()}`),
      listRecords<TrainingRecord>('plannedSessions'),
      listRecords<CompletedRecord>('completedSessions'),
      listRecords<GoalEvent>('events'),
      listRecords<RouteEntry>('routes'),
      listRecords<TrainingBlock>('trainingBlocks'),
    ]).then(([p,r,old,done,ev,rt,bl]) => {
      if (!live) return
      setProfile(p); setReady(r); setExisting(old); setCompleted(done); setEvents(ev); setRoutes(rt); setBlocks(bl); setLoading(false)
    }).catch(err => { if (live) {setLoading(false);setNotice(`Daten konnten nicht geladen werden: ${String(err)}`)} })
    return () => {live = false}
  }, [rangeId,refreshIndex,manualRefresh])
  const planned = useMemo(() => generatePlan({days, shifts, profile, readiness:ready, existing, completed, events, routes, blocks}),
    [rangeId, shifts, profile, ready, existing, completed, events, routes, blocks])
  const eventInfluences = useMemo(() => buildEventInfluences(days,events,routes),[rangeId,events,routes])
  const currentBlocks = blocks.filter(b=>days.some(d=>matchingBlock(d,[b])?.id===b.id))
  const already = existing.filter(s => s.profileId === PROFILE_ID && days.includes(s.date))
  const reviewIssues = useMemo(() => reviewSavedPlan({days, shifts, existing, completed, readiness:ready, events, routes}), [rangeId, shifts, existing, completed, ready, events, routes])
  const seriousIssues = reviewIssues.filter(issue => issue.severity === 'konflikt').length
  // Vorher/Nachher ist nur eine Vorschau: Änderungen bleiben bis zur Bestätigung lokal ungespeichert.
  const comparisons = planned.flatMap(day => {
    if (!day.confirmed || day.protected || day.date < currentKey() || already.some(x=>x.date===day.date)) return []
    const before = already.find(x => x.date === day.date && x.createdBy === PLANNER_VERSION && x.status === 'geplant' && !x.locked)
    const after = day.session
    if (!before && !after) return []
    if (before?.title === after?.title && before?.durationMin === after?.durationMin && before?.target === after?.target) return []
    return [{date:day.date,before:before?.title ?? 'Frei / bisher ungeplant',after:after?.title ?? 'Pause / kein zusätzliches Training',reason:day.eventInfluence?.note ?? day.recoveryReasons?.[0] ?? (day.shift === 'einsatz' ? 'Einsatztag' : 'Anpassung an Dienst, Verfügbarkeit und Trainingsabstand')}]
  })
  const currentReadiness = ready?.date === currentKey() ? readinessLevel(ready) : 'offen' 
  const unconfirmed = planned.filter(p => !p.confirmed).length
  const dutyWithoutWindow=planned.filter(p=>p.date>=currentKey()&&p.confirmed&&!p.protected&&p.shift==='tagdienst'&&!shifts[p.date]?.workStrength&&!shifts[p.date]?.workRun&&!shifts[p.date]?.afterWorkStrength&&!shifts[p.date]?.afterWorkRun&&!shifts[p.date]?.afterWorkCycling&&(!shifts[p.date]?.commute||shifts[p.date]?.commute==='nein')).length
  const cooperGoal=upcomingCooper(events)
  const sessions = planned.filter(p => p.session && p.confirmed && !p.protected)
  const minutes = sessions.reduce((total,p) => total+(p.session?.durationMin || 0),0)
  const commuteCount = sessions.filter(p => p.session?.sessionType === 'commute').length
  const important = planned.filter(p => p.session && ['long','quality'].includes(p.session.sessionType)).length
  const loadAlerts = planned.filter(p => p.date >= currentKey() && p.confirmed && p.recoveryFlag === 'recovery')
  async function saveDay(date: string) {
    if (loading || working) return
    const day = planned.find(d => d.date === date)
    if (!day || !day.confirmed || day.protected || day.date < currentKey()) return
    const before = already.find(x => x.date === date && x.createdBy === PLANNER_VERSION && x.status === 'geplant' && !x.locked)
    const label = day.session?.title ?? 'Ruhetag ohne zusätzliche TEMPO-Einheit'
    if (!window.confirm(`${friendlyDate(date)} gezielt ändern?\n\nBisher: ${before?.title ?? 'Keine TEMPO-Einheit'}\nNeu: ${label}\n\nNur freie Tage werden ergänzt. Bestehende Einträge – auch automatische Planungen – werden nicht ersetzt.`)) return
    setWorking(true)
    setSavingDate(date)
    try {
      await commitGeneratedPlan([day], existing, completed)
      setExisting(await listRecords<TrainingRecord>('plannedSessions'))
      window.dispatchEvent(new Event('tempo:training-change'))
      setNotice(`${friendlyDate(date)} aktualisiert ✓ · Andere Tage wurden nicht verändert.`)
    } catch(error) {setNotice(`Tagesanpassung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`)}
    finally {setWorking(false); setSavingDate(null)}
  }
  async function save() {
    if (loading || working) return
    if (!window.confirm(`TEMPO soll die Vorschläge für ${days.length} Tage übernehmen?\n\nTEMPO ergänzt Vorschläge nur an bisher vollständig freien Tagen. KEIN vorhandenes Training wird überschrieben oder gelöscht. Nicht bestätigte Diensttage bleiben ohne festes Training.`)) return
    setWorking(true)
    setSavingDate(null)
    try {
      const count = await commitGeneratedPlan(planned, existing, completed)
      setExisting(await listRecords<TrainingRecord>('plannedSessions'))
      window.dispatchEvent(new Event('tempo:training-change'))
      setNotice(`${count} Einheiten gespeichert ✓ · Unter „Tagestraining“ einsehbar. Anpassung nach späteren Dienständerungen nur durch erneutes Vorschlagen und Bestätigen.`)
    } catch(error) {setNotice(`Speichern fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`)}
    finally {setWorking(false)}
  }
  return <section className="panel tempo-plan">
    <div className="eyebrow">PHASE 12 · TRAININGSABGLEICH MIT EVENTPLANUNG</div>
    <h2>Trainingsplan vorschlagen</h2>
    {currentBlocks.length>0&&<div className="tempo-plan-event-summary"><strong>Fokusblock aktiv: {currentBlocks.map(x=>x.name).join(' · ')}</strong><p>{currentBlocks.map(describeBlock).join(' · ')}. Nur ein Vorschlag; geschützte und absolvierte Einheiten bleiben unverändert.</p></div>}
    <HelpDisclosure id="calendar-plan-intro"><p>Der Vorschlag berücksichtigt bestätigte Dienste, manuelle Termine und dokumentierte zusätzliche Belastung. Nach längeren oder intensiven Aktivitäten werden Folgetage vorsichtiger geplant. Gespeicherte Trainings werden auf mögliche Konflikte geprüft. Einzelne TEMPO-Tage kannst du gezielt übernehmen; eigene Einheiten werden nur markiert, nicht verändert. Bestätigte Eventtermine können zusätzlich Vor-/Nachentlastung auslösen. Keine vollständige Periodisierung oder medizinische Trainingsfreigabe.</p></HelpDisclosure>
    {loading ? <p className="tempo-plan-muted">Vorschläge werden berechnet …</p> : <>
      {cooperGoal&&<div className="tempo-plan-event-summary"><strong>🏃 Cooper-Test: 3.200 m / 12 Minuten</strong><p>Zieltempo: {paceText(3.2,720)} · {cooperGoal.date?`Test am ${friendlyDate(cooperGoal.date)}`:'Testdatum noch offen'}. Laufvorschläge starten konservativ, ohne sofortige harte Intervalle. Datum unter „Ziele & Events“ bearbeiten.</p></div>}
      {dutyWithoutWindow>0&&<div className="tempo-plan-warning"><strong>{dutyWithoutWindow} Tagdienst-Tage ohne bestätigtes Trainingsfenster.</strong> TEMPO plant hier absichtlich nichts fest ein. Unter „Die nächsten Tage vorbereiten“ kannst du Kraft und Laufen auf Arbeit oder nach Dienst sowie Rad nach Dienst zulassen – nur an tatsächlich verfügbaren Tagen.</div>}
      {Object.values(eventInfluences).length>0 && <div className="tempo-plan-event-summary"><strong>Eventsteuerung aktiv</strong><HelpDisclosure id="calendar-event-help"><p>Bestätigte Ziele erhalten einen geschützten Höhepunkttag sowie vorläufige Entlastung davor und danach. Die Challenge selbst ist noch keine absolvierte Fahrt und muss später dokumentiert werden. Eigene Termine bleiben erhalten.</p></HelpDisclosure></div>}
      {events.some(e=>e.profileId===PROFILE_ID && e.status!=='bestaetigt' && e.status!=='abgeschlossen') && <div className="tempo-plan-warning">Ziele mit offenem Startplatz oder flexiblem Termin sind gespeichert, verursachen aber noch keinen festen Taper.</div>}
      <div className="tempo-plan-stats"><span><strong>{sessions.length}</strong> Einheiten</span><span><strong>{Math.floor(minutes/60)}:{String(minutes%60).padStart(2,'0')} h</strong> {commuteCount ? 'ohne Pendelzeit' : 'Vorschlag'}</span><span><strong>{important}</strong> Rad-Schwerpunkte</span></div>
      <div className={`tempo-plan-readiness tempo-plan-readiness-${currentReadiness}`} role="status"><strong>Readiness heute: {currentReadiness==='gruen'?'GRÜN':currentReadiness==='gelb'?'GELB':currentReadiness==='rot'?'ROT':'NOCH OFFEN'}</strong><span>{currentReadiness==='offen'?'Ohne abgeschlossenen Check-in keine grüne Freigabe.':currentReadiness==='rot'?'Heute Erholung bevorzugen; morgen erneut prüfen.':currentReadiness==='gelb'?'Heute Qualität und schwere Beine kritisch prüfen.':'Heute keine zusätzlichen Readiness-Warnsignale.'}</span></div>
      {ready?.date===currentKey() && ready.illness==='ja' && <div className="tempo-plan-warning">Heute wurden Beschwerden gemeldet. Falls Pendeln trotzdem nötig ist, bitte selbst kritisch prüfen; geplante Belastungen werden nicht als medizinische Freigabe verstanden.</div>}
      {loadAlerts.length > 0 && <div className="tempo-plan-load-alert" role="status"><strong>Belastung berücksichtigt · {loadAlerts.length} Folgetage</strong><HelpDisclosure id="calendar-load-explained"><p>Für {loadAlerts.length} bestätigte Folgetage empfiehlt TEMPO besondere Vorsicht oder Recovery. Bereits von dir festgelegte Einheiten bleiben unverändert und können mit einem Hinweis markiert sein.</p></HelpDisclosure></div>}
      {unconfirmed > 0 && <div className="tempo-plan-warning"><strong>{unconfirmed} von {days.length} Diensten noch unbestätigt.</strong><HelpDisclosure id="calendar-shift-warning"><p>An diesen Tagen plant TEMPO vorsichtshalber keine feste Einheit. Wochenenden sind bis zur Bestätigung nur Vorschläge.</p></HelpDisclosure></div>}
      <section className="tempo-plan-review" aria-label="Plan-Konfliktprüfung">
        <div className="tempo-plan-changes-head"><strong>Dein gespeicherter Plan · Belastungscheck</strong><span>{reviewIssues.length} Hinweise · {seriousIssues} Konflikte</span></div>
        {reviewIssues.length === 0 ? <p className="tempo-plan-review-empty">Keine offensichtlichen Konflikte erkannt. Fehlende Daten bedeuten keine Trainingsfreigabe.</p>
          : <div className="tempo-plan-review-list">{reviewIssues.slice(0,16).map(issue => <div key={issue.id} className={`tempo-plan-review-issue ${issue.severity==='konflikt'?'is-conflict':'is-notice'}`}>
              <div className="tempo-plan-review-head"><strong>{friendlyDate(issue.date)} · {issue.title}</strong><span>{issue.severity==='konflikt'?'Bitte prüfen':'Hinweis'}</span></div>
              <p>{issue.explanation}</p><small>{issue.suggestion}</small>
              {issue.protected && <em>Eigene Einheit geschützt · zum Bearbeiten „Tagestraining“ öffnen</em>}
            </div>)}</div>}
        <HelpDisclosure id="calendar-review-help"><p>Dies ist eine vorsichtige Plausibilitätsprüfung, keine medizinische Freigabe. Noch kein automatisches Verschieben deiner eigenen Trainings.</p></HelpDisclosure>
      </section>
      <section className="tempo-plan-changes" aria-label="Änderungsvergleich">
        <div className="tempo-plan-changes-head"><strong>Änderungen gegenüber deinem gespeicherten Plan</strong><span>{comparisons.length} {comparisons.length===1?'Vorschlag':'Vorschläge'}</span></div>
        {comparisons.length===0 ? <p>Keine Änderungen an bereits automatisch eingeplanten Einheiten erforderlich. Eventuell erscheinen neue Trainingsvorschläge nach vollständiger Dienstplanung.</p> : <div className="tempo-plan-comparison-list">{comparisons.slice(0,14).map(change=><div className="tempo-plan-comparison" key={change.date}><strong>{friendlyDate(change.date)}</strong><div><span>Bisher: {change.before}</span><span>Vorschlag: {change.after}</span></div><small>{change.reason}</small><button type="button" disabled={working} className="tempo-plan-one-button" onClick={() => void saveDay(change.date)}>{working && savingDate===change.date?'Wird gespeichert …':'Nur diesen Tag übernehmen'}</button></div>)}</div>}
        <HelpDisclosure id="calendar-compare-help"><p><strong>Nur Vorschau.</strong> Du kannst einzelne freie Tage oder den gesamten Vorschlag übernehmen. Phase 28 ergänzt ausschließlich leere Tage. Manuelle, automatische und absolvierte Einträge bleiben geschützt.</p></HelpDisclosure>
      </section>
      <div className="tempo-plan-grid">
        {planned.map(day => {
          const item = day.session
          const fixed = day.protected ? already.filter(x => x.date === day.date) : []
          const protectedEntry = fixed[0]
          return <div key={day.date} className={`tempo-plan-day ${!day.confirmed?'is-open':item?.sessionType === 'recovery'?'is-rest':day.protected?'is-locked':'is-ready'}`}>
            <div className="tempo-plan-top"><strong>{friendlyDate(day.date)}</strong><span>{day.confirmed ? (day.shift==='frei'?'Frei':day.shift==='tagdienst'?'Tagdienst':'Einsatz') : 'Dienst offen'}</span></div>
            {day.protected ? <><div className="tempo-plan-name">{protectedEntry?.title || 'Bereits dokumentiert'}</div><small>{fixed.length>1?`${fixed.length} Einheiten geschützt`:'Gespeicherte Einheit geschützt'} · Bestehendes Training wird nicht überschrieben.</small></> : day.eventInfluence?.phase==='event' ? <><div className="tempo-plan-name">🏁 {day.eventInfluence.eventName}</div><small>Geplanter Höhepunkt · keine zusätzliche TEMPO-Einheit · nicht automatisch als absolviert verbucht</small></> : day.seasonEvent ? <><div className="tempo-plan-name">🏁 {day.seasonEvent}</div><small>{day.seasonEventTentative?'Zieltermin noch vorläufig · Tag vorsorglich für das Event reserviert.':'Geplantes Event · kein zusätzliches TEMPO-Workout.'} Bestehende eigene Einheiten bleiben geschützt.</small></> : day.blockIntention && isTrainingFree(day.blockIntention.kind) && !day.protected ? <><div className="tempo-plan-name">🌿 {day.blockIntention.title||dayKindLabels[day.blockIntention.kind]}</div><small>Im Sonderblock ausdrücklich trainingsfrei vorgemerkt. TEMPO erzeugt für diesen Tag keine zusätzliche Einheit.</small></> : day.blockIntention?.kind==='challenge' && !day.protected ? <><div className="tempo-plan-name">🏁 {day.blockIntention.title||'Private Challenge'}</div><small>Geplant, nicht absolviert. Keine zusätzliche Einheit; Vortag nach Möglichkeit sportfrei.</small></> : !day.confirmed ? <><div className="tempo-plan-name">{day.blockIntention ? 'Blocktag vorgemerkt · Dienst bestätigen':'Dienst bestätigen'}</div><small>{day.blockIntention ? `${dayKindLabels[day.blockIntention.kind]} · noch kein festes Training`: 'Kein festes Training'}</small></>
              : day.protected ? <><div className="tempo-plan-name">{protectedEntry?.title || 'Bereits dokumentiert'}</div><small>{fixed.length > 1 ? `${fixed.length} Einheiten auf diesem Tag bleiben geschützt` : 'Bestehende Einheit bleibt geschützt'}</small></>
              : item ? <><div className="tempo-plan-name">{item.sessionType==='commute'?'🚲 ':item.sessionType.startsWith('strength')?'🏋️ ':item.sessionType==='run'?'🏃 ':item.sessionType==='recovery'?'🧘 ':'🚴 '}{item.title}</div><div className="tempo-plan-sub">{item.durationMin ? durationFor(item) : 'Dauer offen'} · {item.priority}{item.expectedKm ? ` · ${item.expectedKm} km` : ''}</div><small>{item.sessionType==='commute' ? item.notes : item.description}</small></>
              : <><div className="tempo-plan-name">{day.shift==='tagdienst'&&!shifts[day.date]?.workStrength&&!shifts[day.date]?.workRun&&!shifts[day.date]?.afterWorkCycling?'Noch kein Trainingsfenster':'Ruhetag / frei'}</div><small>{day.shift==='tagdienst'&&!shifts[day.date]?.workStrength&&!shifts[day.date]?.workRun&&!shifts[day.date]?.afterWorkCycling?'Falls nach dem Dienst Zeit ist: in Dienste & Verfügbarkeit aktivieren, anschließend Vorschlag neu prüfen.':'Belastung bewusst offenlassen'}</small></>}
            {day.seasonEvent && day.protected && <div className="tempo-plan-warning">Zieltermin {day.seasonEvent} überschneidet sich mit einem bestehenden Training. Beide bleiben erhalten – bitte individuell prüfen.</div>}
            {day.blockIntention && day.protected && <div className="tempo-plan-warning">Sonderblock: {dayKindLabels[day.blockIntention.kind]} vorgesehen. Bereits gespeichertes Training bleibt geschützt – bitte mögliche Überschneidung selbst prüfen.</div>}
            {day.blockIntention && day.shift==='tagdienst' && shifts[day.date]?.commute && shifts[day.date]?.commute!=='nein' && <div className="tempo-plan-warning">Achtung: eingetragenes Radpendeln verursacht zusätzliche Belastung, auch wenn dieser Urlaubstag als trainingsfrei markiert ist.</div>}
            {day.eventInfluence && <div className={`tempo-plan-event-note ${day.eventInfluence.phase==='recovery'?'event-recovery':''}`}><strong>{day.eventInfluence.phase==='event'?'Höhepunkt':day.eventInfluence.phase==='rest-before'?'Vorbereitung: Ruhetag':day.eventInfluence.phase==='recovery'?'Nachbereitung / Recovery':'Reduzierte Belastung vor Event'}</strong>{day.eventInfluence.note}{day.shift==='tagdienst' && shifts[day.date]?.commute && shifts[day.date]?.commute !== 'nein' ? ' · Achtung: eingetragenes Radpendeln zählt als Belastung, nicht als Erholung.' : ''}{day.protected?' · Dein eigener Trainingseintrag bleibt geschützt.':''}</div>}
            {day.confirmed && day.recoveryFlag && day.recoveryFlag !== 'none' && <div className={`tempo-plan-load-note ${day.recoveryFlag === 'recovery' ? 'is-high' : 'is-mild'}`}><strong>{day.recoveryFlag === 'recovery' ? 'Regeneration bevorzugt' : 'Belastung beachten'}</strong><span>{day.recoveryReasons?.join(' · ')}</span>{day.protected && <span>Deine gespeicherte Einheit bleibt geschützt. Belastung und Termin bitte selbst prüfen.</span>}</div>}
            {day.confirmed && <button type="button" className="tempo-plan-manual-button" onClick={() => window.dispatchEvent(new CustomEvent('tempo:manual-add',{detail:day.date}))}>＋ Eigenes Training</button>}
          </div>
        })}
      </div>
      <HelpDisclosure id="calendar-final-rules" label="Planungsregeln"><p>Eine einzelne schlechte Nacht führt nicht automatisch zu mehreren Ruhetagen; nach ROT wird der Folgetag vorsichtiger betrachtet und die neue Readiness am Morgen erneut benötigt. Manuell geplante und absolvierte Einheiten werden bei der Neuplanung geschützt. Ihre Belastung beeinflusst die Folgetage. Die Schwellen sind vorläufige Heuristiken; Uhrdaten und individuelle Reaktionen ergänzen wir später. Änderungen am gespeicherten Plan erfolgen erst nach deiner Bestätigung.</p><p>Einheiten bleiben Empfehlungen. Readiness wird morgens erneut geprüft. Ein Einsatz erhält nur Recovery/Pause. Volle Pendeltage werden als eigener Ausdauerreiz gerechnet; bei Hin + Rück bleibt die Hinfahrt locker.</p></HelpDisclosure>
      <button type="button" className="tempo-plan-save" disabled={working || loading} onClick={() => void save()}>{working?'Plan wird gespeichert …':'Vorschläge prüfen & Plan übernehmen'}</button>
      <div className="tempo-plan-feedback" role="status">{notice || 'Noch nichts ergänzt. Bestätigung erforderlich.'}</div>
    </>}
  </section>
}
