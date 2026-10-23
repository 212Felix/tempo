import { openTempoDatabase } from '../db/storage.js';
const PROFILE_ID = 'local-primary-profile';
const num = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
/** Validate a network payload before it can ever reach local IndexedDB. */
export function validatePersonalSummary(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const x = value;
    const id = String(x.garminActivityId ?? '');
    if (!/^\d{5,20}$/.test(id) || !['cycling', 'running', 'swimming'].includes(String(x.sport)))
        return null;
    const date = String(x.date ?? '');
    if (!/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(Date.parse(date + 'T12:00:00Z')))
        return null;
    const durationSeconds = num(x.durationSeconds, 172800);
    if (!durationSeconds || typeof x.startedAt !== 'string' || x.startedAt.length > 45 || !x.startedAt.startsWith(date))
        return null;
    const sport = x.sport;
    const activity = { garminActivityId: id, date, startedAt: x.startedAt, title: String(x.title ?? sport).slice(0, 140), sport,
        activityType: String(x.activityType ?? sport).slice(0, 60), durationSeconds };
    const columns = { movingSeconds: 172800, elapsedSeconds: 172800, distanceKm: 500, elevationM: 25000,
        avgHrBpm: 260, maxHrBpm: 260, avgPowerW: 3000, maxPowerW: 4000, normalizedPowerW: 3000, avgCadence: 250,
        avgSpeedKmh: 220, maxSpeedKmh: 300, calories: 20000 };
    for (const [k, max] of Object.entries(columns)) {
        const v = num(x[k], max);
        if (v !== undefined)
            activity[k] = v;
    }
    return activity;
}
export function localPersonalId(garminId) { return `garmin:personal:${PROFILE_ID}:${garminId}`; }
function closeMatch(a, existing) {
    // Conservative: any same-day, same-sport activity must be reviewed so
    // moving-time vs elapsed-time or CSV locale differences never silently double-count.
    return a.sport === existing.sport && a.date === existing.date;
}
export function classifyPersonal(raw, existing) {
    const result = [], seen = new Set();
    for (const a of raw) {
        if (seen.has(a.garminActivityId))
            continue;
        seen.add(a.garminActivityId);
        if (existing.some(x => x.garminActivityId === a.garminActivityId || x.id === localPersonalId(a.garminActivityId))) {
            result.push({ activity: a, status: 'already', matches: [] });
            continue;
        }
        const matches = existing.filter(x => closeMatch(a, x));
        result.push({ activity: a, status: matches.length ? 'review' : 'new', matches });
    }
    return result;
}
const values = ['movingSeconds', 'elapsedSeconds', 'distanceKm', 'elevationM', 'avgHrBpm', 'maxHrBpm', 'avgPowerW', 'maxPowerW',
    'normalizedPowerW', 'avgCadence', 'avgSpeedKmh', 'maxSpeedKmh', 'calories'];
export function personalRecord(a) {
    const now = new Date().toISOString();
    const item = { id: localPersonalId(a.garminActivityId), profileId: PROFILE_ID, source: 'garmin-personal',
        date: a.date, startedAt: a.startedAt, title: a.title, sport: a.sport, activityType: a.activityType,
        durationSeconds: a.durationSeconds, durationMin: Math.round(a.durationSeconds / 6) / 10, garminActivityId: a.garminActivityId,
        importBatchId: `garmin:personal:${a.garminActivityId}`, createdAt: now, updatedAt: now };
    for (const k of values)
        if (a[k] !== undefined)
            item[k] = a[k];
    return item;
}
/** Link without overwriting FIT traces or user-maintained workout information. */
export function mergePersonal(existing, a) {
    if (existing.sport !== a.sport)
        throw Error('Sportart stimmt nicht überein.');
    if (existing.garminActivityId && existing.garminActivityId !== a.garminActivityId)
        throw Error('Bereits mit anderer Garmin-ID verknüpft.');
    const next = { ...existing, garminActivityId: a.garminActivityId, updatedAt: new Date().toISOString() };
    for (const k of values)
        if (next[k] === undefined && a[k] !== undefined)
            next[k] = a[k];
    if (!next.startedAt)
        next.startedAt = a.startedAt;
    return next;
}
/** Atomic commit limited to externalActivities; no automatic planned-training reconciliation. */
export async function commitPersonalImport(candidates, decisions, existing) {
    const byId = new Map(decisions.map(d => [d.garminActivityId, d.targetId]));
    const operations = [], claimed = new Set(), claimedTarget = new Set();
    let created = 0, linked = 0, skipped = 0;
    for (const candidate of candidates) {
        const { activity: a, status, matches } = candidate;
        if (status === 'already') {
            skipped++;
            continue;
        }
        const choice = byId.get(a.garminActivityId) ?? (status === 'new' ? 'new' : undefined);
        if (!choice)
            throw Error(`Bitte die Zuordnung für ${a.title} prüfen.`);
        if (choice === 'skip') {
            skipped++;
            continue;
        }
        if (claimed.has(a.garminActivityId))
            throw Error('Doppelte Garmin-ID in einer Auswahl.');
        claimed.add(a.garminActivityId);
        if (choice === 'new') {
            // A suspicious activity may be created only after an explicit user choice.
            operations.push(personalRecord(a));
            created++;
        }
        else {
            if (!matches.some(x => x.id === choice))
                throw Error('Ungültiges Zuordnungsziel.');
            if (claimedTarget.has(choice))
                throw Error('Dieselbe TEMPO-Aktivität ist mehrfach ausgewählt.');
            claimedTarget.add(choice);
            const old = existing.find(x => x.id === choice);
            if (!old)
                throw Error('Zielaktivität wurde nicht gefunden.');
            operations.push(mergePersonal(old, a));
            linked++;
        }
    }
    if (operations.length) {
        const db = await openTempoDatabase();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(['externalActivities'], 'readwrite');
            const store = tx.objectStore('externalActivities');
            for (const record of operations) {
                if (record.source === 'garmin-personal')
                    store.add(record);
                else
                    store.put(record);
            }
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error ?? Error('Import fehlgeschlagen.')); };
            tx.onabort = () => { db.close(); reject(tx.error ?? Error('Import abgebrochen.')); };
        });
    }
    return { created, linked, skipped };
}
export function validateBridgeUrl(input) {
    try {
        const u = new URL(input.trim());
        if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.pathname !== '/')
            return null;
        if (!u.hostname.endsWith('.workers.dev') && u.hostname !== 'localhost')
            return null;
        return u.origin;
    }
    catch {
        return null;
    }
}
export async function bridgeRequest(endpoint, credential, path, method = 'GET') {
    const origin = validateBridgeUrl(endpoint);
    if (!origin)
        throw Error('Bitte eine gültige HTTPS-Worker-Adresse eingeben (…workers.dev).');
    if (!credential || credential.length < 24)
        throw Error('Bitte den privaten TEMPO-Zugangscode eingeben.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), method === 'POST' ? 90_000 : 25_000);
    try {
        const response = await fetch(`${origin}${path}`, { method, headers: { Authorization: `Bearer ${credential}`, Accept: 'application/json' }, cache: 'no-store', signal: controller.signal });
        const body = await response.json();
        if (!response.ok)
            throw Error(body?.error || `HTTP ${response.status}`);
        return body;
    }
    finally {
        clearTimeout(timeout);
    }
}
