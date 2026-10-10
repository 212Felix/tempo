import {
  BACKUP_SCHEMA_VERSION,
  DATABASE_NAME,
  DATABASE_VERSION,
  STORE_NAMES,
  type StoreName,
  type TempoBackup,
  type TempoRecord,
} from './types'

/** Daten sind geräte-/browsergebunden. GitHub erhält diese Einträge nicht. */
export function openTempoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Dieser Browser unterstützt IndexedDB nicht.'))
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of STORE_NAMES) {
        if (db.objectStoreNames.contains(name)) continue
        const store = db.createObjectStore(name, { keyPath: 'id' })
        store.createIndex('byProfile', 'profileId', { unique: false })
        // Fehlende Felder erzeugen einfach keinen Indexeintrag.
        store.createIndex('byDate', 'date', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Datenbank konnte nicht geöffnet werden.'))
    request.onblocked = () => reject(new Error('Datenbank-Update blockiert. Bitte andere TEMPO-Tabs schließen.'))
  })
}

function singleStoreRequest<T>(
  name: StoreName,
  mode: IDBTransactionMode,
  requestFor: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openTempoDatabase().then(db => new Promise<T>((resolve, reject) => {
    let result: T
    const tx = db.transaction(name, mode)
    const request = requestFor(tx.objectStore(name))
    request.onsuccess = () => { result = request.result }
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Speichern fehlgeschlagen.')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Vorgang abgebrochen.')) }
  }))
}

export function getRecord<T extends TempoRecord = TempoRecord>(name: StoreName, id: string): Promise<T | undefined> {
  return singleStoreRequest<T | undefined>(name, 'readonly', store => store.get(id))
}

export function listRecords<T extends TempoRecord = TempoRecord>(name: StoreName): Promise<T[]> {
  return singleStoreRequest<T[]>(name, 'readonly', store => store.getAll())
}

export function saveRecord<T extends TempoRecord>(name: StoreName, input: T): Promise<string> {
  if (!input.id || typeof input.id !== 'string') {
    return Promise.reject(new Error('Jeder Datensatz benötigt eine eindeutige ID.'))
  }
  const now = new Date().toISOString()
  const record = { ...input, createdAt: input.createdAt || now, updatedAt: now }
  return singleStoreRequest<IDBValidKey>(name, 'readwrite', store => store.put(record))
    .then(key => String(key))
}

export function deleteRecord(name: StoreName, id: string): Promise<void> {
  return singleStoreRequest<undefined>(name, 'readwrite', store => store.delete(id))
    .then(() => undefined)
}

export async function getStoreCounts(): Promise<Record<StoreName, number>> {
  const db = await openTempoDatabase()
  return new Promise((resolve, reject) => {
    const counts = {} as Record<StoreName, number>
    const tx = db.transaction([...STORE_NAMES], 'readonly')
    for (const name of STORE_NAMES) {
      const request = tx.objectStore(name).count()
      request.onsuccess = () => { counts[name] = request.result }
    }
    tx.oncomplete = () => { db.close(); resolve(counts) }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Datenbankprüfung fehlgeschlagen.')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Datenbankprüfung abgebrochen.')) }
  })
}

/**
 * Exportiert alles bewusst als JSON. Private Informationen nur mit Einwilligung
 * weitergeben und Backups sicher aufbewahren.
 */
export async function exportTempoBackup(): Promise<TempoBackup> {
  const db = await openTempoDatabase()
  return new Promise((resolve, reject) => {
    const stores = {} as Record<StoreName, TempoRecord[]>
    const tx = db.transaction([...STORE_NAMES], 'readonly')
    for (const name of STORE_NAMES) {
      const request = tx.objectStore(name).getAll()
      request.onsuccess = () => { stores[name] = request.result as TempoRecord[] }
    }
    tx.oncomplete = () => {
      db.close()
      resolve({
        format: 'tempo-backup',
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        stores,
      })
    }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Backup fehlgeschlagen.')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Backup abgebrochen.')) }
  })
}

function parseBackup(value: unknown): TempoBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Keine gültige TEMPO-Datei.')
  const backup = value as Partial<TempoBackup>
  if (backup.format !== 'tempo-backup' || backup.schemaVersion !== BACKUP_SCHEMA_VERSION ||
      !backup.stores || typeof backup.stores !== 'object') {
    throw new Error('Backupformat oder Version wird nicht unterstützt.')
  }
  for (const name of STORE_NAMES) {
    const records = backup.stores[name]
    if (!Array.isArray(records)) throw new Error(`Der Bereich ${name} fehlt im Backup.`)
    const ids = new Set<string>()
    for (const item of records) {
      if (!item || typeof item !== 'object' || Array.isArray(item) ||
          typeof item.id !== 'string' || item.id.length === 0 || ids.has(item.id)) {
        throw new Error(`Ungültiger oder doppelter Datensatz im Bereich ${name}.`)
      }
      ids.add(item.id)
    }
  }
  return backup as TempoBackup
}

/**
 * Import vollständig in einer Transaktion: entweder alle Stores oder keiner.
 * mode=replace überschreibt vorhandene Daten. Niemals ohne Bestätigung aufrufen.
 */
export async function importTempoBackup(
  untrustedJson: unknown,
  mode: 'replace' | 'merge' = 'replace',
): Promise<void> {
  const backup = parseBackup(untrustedJson)
  const db = await openTempoDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([...STORE_NAMES], 'readwrite')
    try {
      for (const name of STORE_NAMES) {
        const store = tx.objectStore(name)
        if (mode === 'replace') store.clear()
        for (const item of backup.stores[name]) store.put(item)
      }
    } catch (error) {
      tx.abort()
      db.close()
      reject(error)
      return
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Import fehlgeschlagen.')) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Import abgebrochen.')) }
  })
}
