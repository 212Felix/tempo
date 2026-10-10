/**
 * TEMPO Phase 2 – neutraler Datenvertrag.
 * Keine Personendaten oder Zielwattwerte sind im Quellcode hinterlegt.
 */
export const STORE_NAMES = [
  'profiles',
  'performanceEntries',
  'trainingPriorities',
  'shifts',
  'availability',
  'events',
  'routes',
  'trainingBlocks',
  'plannedSessions',
  'completedSessions',
  'readinessEntries',
  'exerciseCatalog',
  'strengthSets',
  'fuelingLogs',
  'fuelingFollowups',
  'recoverySessions',
  'bodyMetrics',
  'externalActivities',
  'importBatches',
  'settings',
] as const

export type StoreName = (typeof STORE_NAMES)[number]

export type TempoRecord = {
  id: string
  createdAt: string
  updatedAt: string
  profileId?: string
  [field: string]: unknown
}

export type ProfileRecord = TempoRecord & {
  displayName?: string
  weightKg?: number
  ftpWatts?: number
  maxHeartRateBpm?: number
}

export type TempoBackup = {
  format: 'tempo-backup'
  schemaVersion: 1
  exportedAt: string
  stores: Record<StoreName, TempoRecord[]>
}

export const DATABASE_NAME = 'tempo-local'
export const DATABASE_VERSION = 1
export const BACKUP_SCHEMA_VERSION = 1
