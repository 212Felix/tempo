import type { TempoRecord } from '../db/types'

/** Neutrale Bibliothek. Keine privaten Ziele in den Quelldateien hinterlegen. */
export type EventKind = 'rennen' | 'challenge' | 'trainingsblock'
export type EventStatus = 'offen' | 'bestaetigt' | 'flexibel' | 'abgeschlossen'
export type EventPriority = 'A' | 'B' | 'C'
export type VacationStatus = 'nicht_noetig' | 'offen' | 'bestaetigt'
export type Surface = 'rennrad' | 'gravel' | 'mtb' | 'gemischt'

export type RouteEntry = TempoRecord & {
  name: string
  surface: Surface
  distanceKm?: number
  elevationM?: number
  expectedHours?: number
  sourceUrl?: string
  description?: string
}

export type GoalEvent = TempoRecord & {
  name: string
  kind: EventKind
  status: EventStatus
  priority: EventPriority
  date?: string
  windowStart?: string
  windowEnd?: string
  drawingDate?: string
  vacation: VacationStatus
  routeId?: string
  distanceKm?: number
  elevationM?: number
  expectedHours?: number
  trainingPhase?: string
  notes?: string
}

export const LOCAL_PROFILE = 'local-primary-profile'
export const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const dt = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(dt.getTime()) && dt.toISOString().slice(0,10) === value
}
export function plusDays(date: string, offset: number): string {
  if (!validDate(date)) return ''
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0,10)
}
export function dayDelta(first: string, second: string): number {
  if (!validDate(first) || !validDate(second)) return 0
  return Math.round((Date.parse(`${second}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86400000)
}
export function dateLabel(value?: string): string {
  if (!value || !validDate(value)) return 'Termin offen'
  return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${value}T12:00:00Z`))
}
export const effectiveDate = (goal: GoalEvent): string | undefined =>
  goal.date && validDate(goal.date) ? goal.date : goal.windowStart && validDate(goal.windowStart) ? goal.windowStart : undefined

export function upcomingEvents(events: GoalEvent[], today: string): GoalEvent[] {
  return events.filter(e => e.profileId === LOCAL_PROFILE && e.kind !== 'trainingsblock' && e.status !== 'abgeschlossen' &&
    (!effectiveDate(e) || effectiveDate(e)! >= today))
    .sort((a,b) => (effectiveDate(a) ?? '9999-12-31').localeCompare(effectiveDate(b) ?? '9999-12-31') || a.name.localeCompare(b.name))
}

export function routeValues(goal: GoalEvent, routes: RouteEntry[]): {km?:number;hm?:number;hours?:number} {
  const route = routes.find(r => r.id === goal.routeId)
  return {km:goal.distanceKm ?? route?.distanceKm, hm:goal.elevationM ?? route?.elevationM, hours:goal.expectedHours ?? route?.expectedHours}
}

export type EventInfluence = {
  goalId: string
  eventName: string
  phase: 'taper' | 'rest-before' | 'event' | 'recovery'
  relativeDay: number
  note: string
  priority: EventPriority
}

/** Nur bestätigte, konkrete Termine beeinflussen Trainingsvorschläge. Keine Annahme bei Los/Urlaub offen. */
export function buildEventInfluences(days: string[], goals: GoalEvent[], routes: RouteEntry[]): Record<string,EventInfluence> {
  const out:Record<string,EventInfluence> = {}
  const weights:Record<EventInfluence['phase'],number> = {'taper':1,'rest-before':2,'recovery':3,'event':4}
  for (const goal of goals) {
    if (goal.profileId !== LOCAL_PROFILE || goal.status !== 'bestaetigt' || !goal.date || !validDate(goal.date) || goal.vacation === 'offen' || goal.kind === 'trainingsblock') continue
    const {km, hm, hours} = routeValues(goal, routes)
    const big = (km ?? 0) >= 180 || (hm ?? 0) >= 2500 || (hours ?? 0) >= 7
    const taper = goal.priority === 'A' ? (big ? 5 : 3) : goal.priority === 'B' ? 2 : 1
    const recovery = big ? 3 : goal.priority === 'A' ? 2 : 1
    for (const date of days) {
      const d = dayDelta(goal.date,date)
      let phase:EventInfluence['phase'] | undefined
      if (d === 0) phase = 'event'
      else if (d === -1) phase = 'rest-before'
      else if (d < -1 && d >= -taper) phase = 'taper'
      else if (d > 0 && d <= recovery) phase = 'recovery'
      if (!phase) continue
      const note = phase === 'event' ? `${goal.name}: geplanter Höhepunkt. Als tatsächliche Tour nachher separat protokollieren.` :
        phase === 'rest-before' ? `Vor ${goal.name}: Ruhetag oder sehr leichte Bewegung bevorzugen.` :
        phase === 'recovery' ? `Nach ${goal.name}: Erholung bevorzugen; täglich Readiness prüfen.` :
        `Vor ${goal.name}: Umfang reduzieren, keine zusätzliche harte Einheit erzwingen.`
      const candidate:EventInfluence = {goalId:goal.id,eventName:goal.name,phase,relativeDay:d,note,priority:goal.priority}
      if (!out[date] || weights[phase] > weights[out[date].phase]) out[date] = candidate
    }
  }
  return out
}
