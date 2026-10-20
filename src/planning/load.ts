import { readinessLevel, type CompletedRecord, type ReadinessRecord, type TrainingRecord } from './engine'

/**
 * Belastungshinweise ohne medizinische Diagnose und ohne versteckte Änderungen.
 * Die Schwellen sind konservative Startheuristiken; später durch individuelle
 * Belastungs-/Erholungsdaten und Garmin-Werte zu ersetzen.
 */
export type LoadLevel = 'none' | 'caution' | 'recovery'
export type LoadDay = { level: LoadLevel; reasons: string[] }
export type LoadCalendar = Record<string, LoadDay>

const daysBetween = (from: string, to: string): number => {
  const asUTC = (key: string) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((asUTC(to) - asUTC(from)) / 86400000)
}

const isCycling = (type?: string) => ['manual-cycling','long','endurance','quality','commute'].includes(type ?? '')
const isStrength = (type?: string) => ['manual-strength','strength-a','strength-b','strength-c'].includes(type ?? '')
const isRunning = (type?: string) => ['manual-running','run'].includes(type ?? '')

function trainingLoad(input: {
  sessionType?: string; durationMin?: number; distanceKm?: number;
  elevationM?: number; rpe?: number; strengthVariant?:'A'|'B'|'C'
}): { guardDays: number; cautionDays: number; label: string } | null {
  if (input.sessionType==='manual-sportspiel'||input.sessionType==='manual-golf'||input.sessionType==='manual-swimming') return null
  const duration = input.durationMin ?? 0
  const distance = input.distanceKm ?? 0
  const elevation = input.elevationM ?? 0
  const rpe = input.rpe ?? 0
  const cycling = isCycling(input.sessionType)
  const upperBody=input.sessionType==='strength-c'||(input.sessionType==='manual-strength'&&input.strengthVariant==='C')
  const strength = isStrength(input.sessionType) && !upperBody
  const running = isRunning(input.sessionType)
  if (cycling && (distance >= 160 || duration >= 330 || elevation >= 2600 || (duration >= 180 && rpe >= 8)))
    return {guardDays: 2, cautionDays: 3, label: 'Sehr lange oder intensive Radeinheit'}
  if (cycling && (distance >= 75 || duration >= 150 || elevation >= 1400 || (duration >= 60 && rpe >= 7)))
    return {guardDays: 1, cautionDays: 2, label: 'Höhere Radbelastung'}
  if (running && (duration >= 90 || (duration >= 40 && rpe >= 8)))
    return {guardDays: 1, cautionDays: 2, label: 'Hohe Laufbelastung'}
  if (strength && (duration >= 40 && rpe >= 8))
    return {guardDays: 1, cautionDays: 1, label: 'Anstrengendes Krafttraining'}
  if (rpe >= 9 && duration >= 30)
    return {guardDays: 1, cautionDays: 1, label: 'Sehr hohe subjektive Belastung'}
  if ((cycling && distance >= 75) || (strength && duration >= 65 && rpe >= 7) || (running && duration >= 70 && rpe >= 7) || rpe >= 8)
    return {guardDays: 0, cautionDays: 1, label: 'Zusätzliche Trainingsbelastung'}
  return null
}

/** Trainingseingaben zählen für die Folgeplanung, auch wenn sie vor dem Planzeitraum liegen. */
export function createLoadCalendar(
  dates: string[], completed: CompletedRecord[], planned: TrainingRecord[],
  readiness?: ReadinessRecord,
): LoadCalendar {
  const result: LoadCalendar = Object.fromEntries(dates.map(date => [date, {level:'none' as LoadLevel, reasons:[]}]))
  const rank:Record<LoadLevel,number> = {none:0,caution:1,recovery:2}
  const note = (date: string, level: LoadLevel, reason: string) => {
    const day = result[date]
    if (!day) return
    if (rank[level] > rank[day.level]) day.level = level
    if (!day.reasons.includes(reason)) day.reasons.push(reason)
  }
  const completedSessionIds = new Set(completed.map(entry => entry.plannedSessionId).filter(Boolean))
  const inputs = [
    ...completed.map(item => ({
      date:item.date, sessionType:item.sessionType, durationMin:item.durationMin,
      distanceKm:item.distanceKm,elevationM:item.elevationM,rpe:item.rpe,strengthVariant:item.strengthVariant,
      origin:'absolviert' as const,
    })),
    // Nur selbst fest verplante Einheiten werden berücksichtigt, nicht die ersetzbaren
    // automatisch erstellten Einheiten. Sonst würde der Plan sich selbst blockieren.
    ...planned.filter(item => item.status === 'geplant' && (item.locked || item.createdBy === 'tempo-user') && !completedSessionIds.has(item.id))
      .map(item => ({date:item.date,sessionType:item.sessionType,durationMin:item.durationMin,
        distanceKm:item.expectedKm,elevationM:item.elevationM,rpe:item.rpe,strengthVariant:item.strengthVariant,
        origin:'fest geplant' as const})),
  ]
  for (const entry of inputs) {
    if (!entry.date) continue
    const load = trainingLoad(entry)
    if (!load) continue
    for (const date of dates) {
      const delta = daysBetween(entry.date,date)
      if (delta < 1 || delta > load.cautionDays) continue
      const severity:LoadLevel = delta <= load.guardDays ? 'recovery' : 'caution'
      note(date,severity, `${load.label} am ${new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit'}).format(new Date(entry.date+'T12:00:00'))} (${entry.origin})`)
    }
  }
  if (readiness && result[readiness.date]) {
    const status = readinessLevel(readiness)
    if (readiness.illness === 'ja') {
      note(readiness.date,'recovery','Krankheit/Auffälligkeit im Tages-Check-in gemeldet')
    } else if (status === 'rot') {
      note(readiness.date,'recovery','Readiness ROT: mehrere ungünstige Signale – Erholung prüfen')
    } else if (status === 'gelb') {
      note(readiness.date,'caution','Readiness GELB: Umfang und Intensität heute überprüfen')
    }
  }
  // Tages-Check-in bleibt zeitlich eng begrenzt: eine einzelne schlechte Nacht
  // ist KEIN automatischer Grund für mehrere volle Ruhetage.
  if (readiness && result[readiness.date] && readinessLevel(readiness) === 'rot') {
    const [year, month, day] = readiness.date.split('-').map(Number)
    const following = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0,10)
    if (result[following]) {
      note(following, 'caution', readiness.illness === 'ja'
        ? 'Beschwerden am Vortag gemeldet – Tagesform erneut prüfen, harte Belastung nicht voraussetzen'
        : 'Deutlich eingeschränkte Readiness am Vortag – Morgencheck vor Intensität wiederholen')
    }
  }
  return result
}
