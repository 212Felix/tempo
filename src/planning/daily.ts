import { readinessLevel, type ReadinessRecord, type ShiftRecord, type TrainingRecord, type CompletedRecord } from './engine'
import { createLoadCalendar } from './load'

/**
 * Vorsichtige Tageshinweise. Diese Funktion verändert niemals Datensätze oder Einheiten.
 * Die Angaben sind Trainingsheuristiken, keine medizinische Freigabe.
 */
export type DailyStatus = 'offen' | 'normal' | 'vorsicht' | 'erholung'
export type DailyGuidance = {
  status: DailyStatus
  label: string
  reason: string[]
  recommendation: string
  requiresReview: boolean
  conflictTitles: string[]
  readiness: ReturnType<typeof readinessLevel>
}

const demandingKinds = new Set([
  'quality', 'long', 'strength-a', 'strength-b',
  'manual-cycling', 'manual-running', 'manual-strength', 'manual-martial',
])

export function assessDailyTraining(input: {
  date: string
  readiness?: ReadinessRecord
  shift?: ShiftRecord
  planned: TrainingRecord[]
  completed: CompletedRecord[]
}): DailyGuidance {
  const { date, planned, completed, shift } = input
  const readiness = input.readiness?.date === date ? readinessLevel(input.readiness) : 'offen'
  const load = createLoadCalendar([date], completed, planned, input.readiness?.date === date ? input.readiness : undefined)[date]
  const reason: string[] = []
  let severity = 0

  const mark = (level: 'vorsicht' | 'erholung', message: string) => {
    severity = Math.max(severity, level === 'erholung' ? 2 : 1)
    if (!reason.includes(message)) reason.push(message)
  }

  if (readiness === 'offen') reason.push('Der heutige Readiness-Check-in fehlt oder ist noch nicht vollständig.')
  if (readiness === 'gelb') mark('vorsicht', 'Readiness GELB: Belastung und Intensität vor dem Start kritisch prüfen.')
  if (readiness === 'rot') mark('erholung', 'Readiness ROT: Heute keine harte Belastung empfehlen.')
  if (shift?.shift === 'einsatz') mark('erholung', 'Einsatztag: möglichst Pause oder leichte Recovery.')
  if (shift?.shift === 'tagdienst' && shift.commute === 'beide') {
    mark('vorsicht', 'Hin- und Rückfahrt werden zusammen als Ausdauerbelastung gewertet. Hinfahrt locker, Heimfahrt nur bei sicheren Bedingungen intensiver.')
  }
  if (load?.level === 'recovery') mark('erholung', `Regeneration bevorzugt: ${load.reasons[0] ?? 'zusätzliche Belastung'}`)
  else if (load?.level === 'caution') mark('vorsicht', `Vorbelastung beachten: ${load.reasons[0] ?? 'zusätzliche Belastung'}`)

  const status: DailyStatus = severity === 2 ? 'erholung' : severity === 1 ? 'vorsicht' : readiness === 'offen' ? 'offen' : 'normal'

  // Offener Check-in darf niemals als explizit grüne Freigabe erscheinen.
  if (reason.length === 0) reason.push('Keine zusätzlichen Warnsignale aus den bisher eingetragenen Daten.')

  const pending = planned.filter(s => s.date === date && s.status === 'geplant')
  const demanding = pending.filter(s => demandingKinds.has(s.sessionType))
  const conflictTitles = status === 'erholung' ? demanding.map(s => s.title) : []
  const requiresReview = conflictTitles.length > 0 || (status === 'vorsicht' && demanding.length > 0)
  let recommendation = 'Geplantes Training kann nach eigenem Empfinden geprüft werden. Intensität bleibt freiwillig und anpassbar.'
  if (status === 'offen') recommendation = 'Vor dem Training den kurzen Tages-Check-in ausfüllen. Ohne Readiness keine belastbare Tagesempfehlung.'
  if (status === 'vorsicht') recommendation = 'Bei Müdigkeit oder zusätzlicher Belastung die Einheit kürzen oder lockerer fahren. Qualität und schwere Beine gegebenenfalls verschieben.'
  if (status === 'erholung') recommendation = 'Pause oder sehr leichte Recovery bevorzugen. Harte Einheiten nicht durchdrücken; mögliche Verschiebung selbst prüfen.'
  if (shift?.commute === 'beide' && status !== 'erholung') recommendation = '96 km Pendeln bei hinterlegten 48 km je Weg sind bereits ein großer Ausdauerreiz. Zusätzliche Intensität nur bei ausreichender Erholung, Licht und Verkehrssicherheit.'

  return {status, label: status === 'erholung' ? 'Erholung bevorzugen' : status === 'vorsicht' ? 'Belastung anpassen' : status === 'offen' ? 'Check-in noch offen' : 'Tagesform unauffällig', reason, recommendation, requiresReview, conflictTitles, readiness}
}
