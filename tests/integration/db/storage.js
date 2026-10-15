import { BACKUP_SCHEMA_VERSION, DATABASE_NAME, DATABASE_VERSION, STORE_NAMES, } from './types.js';
/** Daten sind geräte-/browsergebunden. GitHub erhält diese Einträge nicht. */
export function openTempoDatabase() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('Dieser Browser unterstützt IndexedDB nicht.'));
            return;
        }
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            for (const name of STORE_NAMES) {
                if (db.objectStoreNames.contains(name))
                    continue;
                const store = db.createObjectStore(name, { keyPath: 'id' });
                store.createIndex('byProfile', 'profileId', { unique: false });
                // Fehlende Felder erzeugen einfach keinen Indexeintrag.
                store.createIndex('byDate', 'date', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Datenbank konnte nicht geöffnet werden.'));
        request.onblocked = () => reject(new Error('Datenbank-Update blockiert. Bitte andere TEMPO-Tabs schließen.'));
    });
}
function singleStoreRequest(name, mode, requestFor) {
    return openTempoDatabase().then(db => new Promise((resolve, reject) => {
        let result;
        const tx = db.transaction(name, mode);
        const request = requestFor(tx.objectStore(name));
        request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => { db.close(); resolve(result); };
        tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Speichern fehlgeschlagen.')); };
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Vorgang abgebrochen.')); };
    }));
}
export function getRecord(name, id) {
    return singleStoreRequest(name, 'readonly', store => store.get(id));
}
export function listRecords(name) {
    return singleStoreRequest(name, 'readonly', store => store.getAll());
}
export function saveRecord(name, input) {
    if (!input.id || typeof input.id !== 'string') {
        return Promise.reject(new Error('Jeder Datensatz benötigt eine eindeutige ID.'));
    }
    const now = new Date().toISOString();
    const record = { ...input, createdAt: input.createdAt || now, updatedAt: now };
    return singleStoreRequest(name, 'readwrite', store => store.put(record))
        .then(key => String(key));
}
export function deleteRecord(name, id) {
    return singleStoreRequest(name, 'readwrite', store => store.delete(id))
        .then(() => undefined);
}
export async function getStoreCounts() {
    const db = await openTempoDatabase();
    return new Promise((resolve, reject) => {
        const counts = {};
        const tx = db.transaction([...STORE_NAMES], 'readonly');
        for (const name of STORE_NAMES) {
            const request = tx.objectStore(name).count();
            request.onsuccess = () => { counts[name] = request.result; };
        }
        tx.oncomplete = () => { db.close(); resolve(counts); };
        tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Datenbankprüfung fehlgeschlagen.')); };
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Datenbankprüfung abgebrochen.')); };
    });
}
/**
 * Exportiert alles bewusst als JSON. Private Informationen nur mit Einwilligung
 * weitergeben und Backups sicher aufbewahren.
 */
export async function exportTempoBackup() {
    const db = await openTempoDatabase();
    return new Promise((resolve, reject) => {
        const stores = {};
        const tx = db.transaction([...STORE_NAMES], 'readonly');
        for (const name of STORE_NAMES) {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => { stores[name] = request.result; };
        }
        tx.oncomplete = () => {
            db.close();
            resolve({
                format: 'tempo-backup',
                schemaVersion: BACKUP_SCHEMA_VERSION,
                exportedAt: new Date().toISOString(),
                stores,
            });
        };
        tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Backup fehlgeschlagen.')); };
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Backup abgebrochen.')); };
    });
}
function parseBackup(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Keine gültige TEMPO-Datei.');
    const backup = value;
    if (backup.format !== 'tempo-backup' || backup.schemaVersion !== BACKUP_SCHEMA_VERSION ||
        !backup.stores || typeof backup.stores !== 'object') {
        throw new Error('Backupformat oder Version wird nicht unterstützt.');
    }
    for (const name of STORE_NAMES) {
        const records = backup.stores[name];
        if (!Array.isArray(records))
            throw new Error(`Der Bereich ${name} fehlt im Backup.`);
        const ids = new Set();
        for (const item of records) {
            if (!item || typeof item !== 'object' || Array.isArray(item) ||
                typeof item.id !== 'string' || item.id.length === 0 || ids.has(item.id)) {
                throw new Error(`Ungültiger oder doppelter Datensatz im Bereich ${name}.`);
            }
            ids.add(item.id);
        }
    }
    return backup;
}
/**
 * Verlustfreier Backup-Import: ausschließlich noch nicht vorhandene IDs ergänzen.
 * Ein bereits vorhandener Datensatz wird niemals von einer Backup-Datei überschrieben.
 * Ein vollständiges Wiederherstellen durch Leeren der Datenbank ist bewusst NICHT möglich.
 * Alle Änderungen liegen in einer einzigen IndexedDB-Transaktion.
 */
export async function importTempoBackup(untrustedJson) {
    const backup = parseBackup(untrustedJson);
    const db = await openTempoDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([...STORE_NAMES], 'readwrite');
        try {
            for (const name of STORE_NAMES) {
                const store = tx.objectStore(name);
                for (const item of backup.stores[name]) {
                    const request = store.get(item.id);
                    request.onsuccess = () => {
                        if (request.result === undefined)
                            store.add(item);
                    };
                    request.onerror = () => tx.abort();
                }
            }
        }
        catch (error) {
            tx.abort();
            db.close();
            reject(error);
            return;
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Import fehlgeschlagen.')); };
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Import abgebrochen.')); };
    });
}
