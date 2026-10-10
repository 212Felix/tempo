import { createLoadCalendar } from './load'
import { buildEventInfluences, type GoalEvent, type RouteEntry } from '../events/library'
import { currentKey, isConfirmed, readinessLevel,
  type CompletedRecord, type ReadinessRecord, type ShiftRecord, type TrainingRecord,
  PROFILE_ID } from './engine'

/** Hinweise zu einem BEREITS gespeicherten Plan. Verändert keinerlei Datensätze. */
export type ReviewIssue = {
  id: string
  date: string
  severity: 'hinweis' | 'konflikt'
  title: string
  explanation: string
  suggestion: string
  protected: boolean
}

function demanding(item: TrainingRecord): boolean {
  if (['quality', 'long', 'strength-a', 'strength-b', 'manual-martial'].includes(item.sessionType)) return true
  if (item.sessionType === 'manual-strength') return item.durationMin >= 35 || (item.rpe ?? 0) >= 6
  if (item.sessionType === 'manual-cycling') return item.durationMin >= 90 || (item.rpe ?? 0) >= 7
  if (item.sessionType === 'manual-running') return item.durationMin >= 55 || (item.rpe ?? 0) >= 7
  if (item.sessionType === 'run') return (item.rpe ?? 0) >= 7
  return (item.rpe ?? 0) >= 8
}
const easy = (item: TrainingRecord) => item.sessionType === 'recovery' || item.sessionType === 'manual-mobility'

export function reviewSavedPlan(input: {
  days: string[]
  shifts: Record<string, ShiftRecord>
  existing: TrainingRecord[]
  completed: CompletedRecord[]
  readiness?: ReadinessRecord
  events?: GoalEvent[]
  routes?: RouteEntry[]
}): ReviewIssue[] {
  const { days, shifts, existing, completed, readiness } = input
  const today = currentKey()
  const active = existing.filter(item => item.profileId === PROFILE_ID && item.status === 'geplant' && days.includes(item.date) && item.date >= today)
  const eventInfluences = buildEventInfluences(days,input.events??[],input.routes??[])
  const load = createLoadCalendar(days, completed.filter(x => x.profileId === PROFILE_ID), existing.filter(x => x.profileId === PROFILE_ID), readiness)
  const issues: ReviewIssue[] = []
  const add = (date: string, id: string, severity: ReviewIssue['severity'], title: string, explanation: string, suggestion: string, protectedEntry: boolean) => {
    if (!issues.some(issue => issue.id === `${date}:${id}`)) {
      issues.push({ id: `${date}:${id}`, date, severity, title, explanation, suggestion, protected: protectedEntry })
    }
  }
  for (const date of days) {
    if (date < today) continue
    const items = active.filter(x => x.date === date)
    if (!items.length) continue
    const shift = shifts[date]
    const event = eventInfluences[date]
    const protectedEntry = items.some(x => x.locked || x.createdBy === 'tempo-user')
    const strenuous = items.filter(demanding)
    if (event && shift?.shift==='tagdienst' && shift.commute && shift.commute !== 'nein') add(date,'event-commute','hinweis','Radpendeln im Eventfenster','Radpendeln fällt in Vor-/Nachbereitung eines Höhepunkts.','Diesen Pendeltag als reale Belastung bewerten und bei Bedarf eine Fahrtalternative suchen.',protectedEntry)
    if (event?.phase==='event') add(date,'event','konflikt','Eventtag und weiteres Training',event.note,'Keine zusätzliche harte Einheit fest einplanen. Eigenes Training bleibt geschützt.',protectedEntry)
    else if (event?.phase==='recovery' && strenuous.length) add(date,'post-event','konflikt','Erholung nach Event',event.note,'Belastendes Training verschieben oder reduzieren; subjektive Erholung prüfen.',protectedEntry)
    else if (event?.phase==='rest-before' && strenuous.length) add(date,'pre-event','konflikt','Ruhetag vor Event',event.note,'Belastung reduzieren und Vorbereitungsruhe schützen.',protectedEntry)
    else if (event?.phase==='taper' && strenuous.length) add(date,'taper','hinweis','Entlastung vor Event',event.note,'Keine zusätzliche harte Trainingseinheit erzwingen.',protectedEntry)
    if (!isConfirmed(shift)) {
      add(date,'unconfirmed','hinweis','Dienst nicht bestätigt',
        'Für diesen Tag sind bereits Trainings gespeichert, der Dienst ist aber noch offen.',
        'Erst Dienst bestätigen und danach den Trainingstag erneut prüfen.',protectedEntry)
    }
    if (shift?.shift === 'einsatz' && items.some(item => !easy(item))) {
      add(date,'shift','konflikt','Training am Einsatztag',
        'An diesem Tag ist ein Einsatz eingetragen. Zusätzliche Belastung kann wegen frühem Beginn oder Dauer unpassend sein.',
        'Pause oder kurze Recovery bevorzugen; eine eigene Einheit bei Bedarf unter Tagestraining verschieben.',protectedEntry)
    }
    const state = load[date]
    if (state?.level === 'recovery' && items.some(item => !easy(item))) {
      add(date,'recovery','konflikt','Hohe Vorbelastung vor geplantem Training',
        state.reasons.join(' · ') || 'Für diesen Tag ist eine Erholungsphase angezeigt.',
        'Keine intensive Einheit erzwingen. Training bei Bedarf verschieben, kürzen oder durch Recovery ersetzen.',protectedEntry)
    } else if (state?.level === 'caution' && strenuous.length) {
      add(date,'caution','hinweis','Vorbelastung berücksichtigen',
        state.reasons.join(' · ') || 'Zuletzt wurde zusätzliche Trainingsbelastung dokumentiert.',
        'Intensität, Dauer und Beinempfinden vor dem Start überprüfen.',protectedEntry)
    }
    if (date === today && readiness?.date === date) {
      const level = readinessLevel(readiness)
      if (level === 'rot' && items.some(item => !easy(item))) {
        add(date,'readiness-red','konflikt','Readiness ROT',
          'Der heutige Check-in spricht gegen eine intensive Belastung.',
          'Harte Einheiten nicht durchdrücken; bei Krankheitssymptomen Training pausieren und gegebenenfalls ärztlich abklären.',protectedEntry)
      } else if (level === 'gelb' && strenuous.length) {
        add(date,'readiness-yellow','hinweis','Readiness GELB',
          'Die Tagesform ist eingeschränkt und es stehen belastende Einheiten im Plan.',
          'Vor dem Training Intensität reduzieren oder die Einheit verschieben.',protectedEntry)
      }
    }
    if (shift?.shift === 'tagdienst' && shift.commute === 'beide' && strenuous.some(item => item.sessionType !== 'commute')) {
      add(date,'commute','konflikt','Radpendeln plus weitere Belastung',
        'Hin- und Rückfahrt ergeben zusammen bereits einen langen Trainingstag.',
        'Hinfahrt locker; Heimfahrt nur bei sicheren Bedingungen intensiver. Zusätzliche harte Einheiten kritisch prüfen.',protectedEntry)
    }
    const total = items.reduce((sum,item) => sum+Math.max(0,item.durationMin),0)
    if (items.length >= 2 && total >= 100 && strenuous.length) {
      add(date,'double','hinweis','Mehrere Einheiten am selben Tag',
        `${items.length} gespeicherte Einheiten mit zusammen ${total} Minuten geplanter Dauer.`,
        'Gesamtbelastung berücksichtigen und einen Schwerpunkt setzen.',protectedEntry)
    }
  }
  return issues.sort((a,b) => a.date.localeCompare(b.date) || (a.severity===b.severity ? 0 : a.severity==='konflikt' ? -1 : 1))
}
