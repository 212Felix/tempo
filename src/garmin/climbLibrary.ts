import type { GarminActivity } from './csv'
import type { FitTrace } from './fit'
import type { ClimbCandidate } from './climbs'
import { findClimbCandidates } from './climbs'
import { analyzeClimb, type ClimbAnalysis } from './climbAnalysis'

/** Local analysis only: entries are derived from FIT traces, never stored as new workouts. */
export type LibraryClimb = {
  key: string
  activityId: string
  activityTitle: string
  date: string
  climbNumber: number
  climb: ClimbCandidate
  analysis: ClimbAnalysis | null
}

export function buildClimbLibrary(traces: FitTrace[], activities: GarminActivity[]): LibraryClimb[] {
  const byId = new Map(activities.map(activity => [activity.id, activity]))
  const results: LibraryClimb[] = []
  const seen = new Set<string>()
  for (const trace of traces) {
    if (trace.kind !== 'garmin-fit-trace') continue
    const activity = byId.get(trace.activityId)
    if (!activity || activity.sport !== 'cycling' || activity.profileId !== trace.profileId) continue
    // Guard against old duplicate trace entries associated with the same activity.
    if (seen.has(activity.id)) continue
    seen.add(activity.id)
    findClimbCandidates(trace.points)
      .sort((a, b) => a.startKm - b.startKm)
      .forEach((climb, index) => {
        results.push({
          key: `${activity.id}:${climb.startKm.toFixed(2)}:${climb.endKm.toFixed(2)}`,
          activityId: activity.id,
          activityTitle: activity.title,
          date: activity.date,
          climbNumber: index + 1,
          climb,
          analysis: analyzeClimb(trace.points, climb)
        })
      })
  }
  return results.sort((a,b) => b.date.localeCompare(a.date) ||
    a.activityTitle.localeCompare(b.activityTitle,'de') || a.climb.startKm - b.climb.startKm)
}

export function comparisonNotes(a: LibraryClimb, b: LibraryClimb): string[] {
  const notes: string[] = []
  if (Math.abs(a.climb.gradePct - b.climb.gradePct) > 1.5)
    notes.push('Unterschiedliche Steigungen: Watt- und Pulswerte nicht als direkten Formvergleich werten.')
  const aTime = a.climb.elapsedSeconds
  const bTime = b.climb.elapsedSeconds
  if (Math.abs(aTime - bTime) > Math.min(aTime,bTime) * 0.25)
    notes.push('Die Abschnitte sind unterschiedlich lang; die Leistungen sind daher nicht unmittelbar gleichwertig.')
  if (a.activityId === b.activityId)
    notes.push('Beide Anstiege stammen aus derselben Fahrt. Gelände und Tagesverlauf können die Werte beeinflussen.')
  for (const item of [a,b]) {
    if (item.analysis?.warnings.length) {
      notes.push('Mindestens ein Abschnitt enthält Messlücken oder unvollständige Sensordaten. Bitte Detailanalyse beachten.')
      break
    }
  }
  if (!notes.length) notes.push('Auch bei ähnlichen Anstiegen Temperatur, Wind, Ermüdung, Stopps und Intensitätsziel mitbedenken.')
  return notes
}
