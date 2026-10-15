import { getRecord, listRecords, saveRecord } from '../db/storage.js';
import { LOCAL_PROFILE } from './library.js';
export const COOPER_METERS = 3200;
export const COOPER_SECONDS = 12 * 60;
export const COOPER_TARGET = 3.2;
export const RUN_LABELS = {
    cooper: 'Cooper-Test',
    funrun: 'Freizeitlauf / Volkslauf',
    fivek: '5-km-Lauf',
    tenk: '10-km-Lauf',
    half: 'Halbmarathon',
    marathon: 'Marathon',
    trail: 'Trailrun',
    other: 'Anderer Lauf',
};
/** Strict clock duration; never interpret 28:29 as decimal minutes. */
export function parseTargetTime(value) {
    const v = value.trim();
    if (!v)
        return undefined;
    const parts = v.split(':');
    if (parts.length !== 2 && parts.length !== 3 || parts.some(x => !/^\d{1,2}$/.test(x)))
        return NaN;
    const [h, m, s] = parts.length === 3 ? parts.map(Number) : [0, ...parts.map(Number)];
    if (m > 59 || s > 59 || h > 47)
        return NaN;
    const seconds = h * 3600 + m * 60 + s;
    return seconds > 0 ? seconds : NaN;
}
export function displayDuration(seconds) {
    if (!Number.isFinite(seconds) || !seconds || seconds < 0)
        return '';
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), Math.floor(seconds % 60)].map(x => String(x).padStart(2, '0')).join(':');
}
export function paceText(distanceKm, seconds) {
    if (!distanceKm || distanceKm <= 0 || !seconds || seconds <= 0)
        return '';
    const pace = Math.round(seconds / distanceKm);
    return `${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, '0')} min/km`;
}
export function runDistancePreset(kind) {
    return { cooper: COOPER_TARGET, fivek: 5, tenk: 10, half: 21.0975, marathon: 42.195 }[kind];
}
const FLAG_ID = 'tempo:migration:cooper-3200-phase26';
/** One-time, explicit user-requested target. No invented date or training completion. */
export async function ensureCooperGoal() {
    if (await getRecord('settings', FLAG_ID))
        return;
    const rows = (await listRecords('events')).filter(e => e.profileId === LOCAL_PROFILE);
    const existing = rows.find(e => e.status !== 'abgeschlossen' && (e.runningKind === 'cooper' || /cooper[\s-]*test|cooper\b/i.test(e.name)));
    const now = new Date().toISOString();
    if (!existing) {
        // On older devices the historic fixed ID may be an unrelated (Mallorca) goal.
        // Never overwrite it: choose a unique ID if already occupied.
        const fixedId = 'goal:cooper-test-3200';
        const id = rows.some(x => x.id === fixedId) ? `goal:cooper-${Date.now()}-${Math.random().toString(36).slice(2)}` : fixedId;
        const record = {
            id, profileId: LOCAL_PROFILE, createdAt: now, updatedAt: now,
            name: 'Cooper-Test · 3.200 m in 12 Minuten', kind: 'challenge', priority: 'B',
            status: 'offen', vacation: 'nicht_noetig', sport: 'running', runningKind: 'cooper',
            distanceKm: COOPER_TARGET, targetSeconds: COOPER_SECONDS,
            notes: 'Termin noch offen. Bitte manuell bearbeiten, keine automatische Überschreibung.',
        };
        await saveRecord('events', record);
    }
    // Existing goal stays exactly as the user configured it.
    await saveRecord('settings', { id: FLAG_ID, createdAt: now, updatedAt: now, profileId: LOCAL_PROFILE, completed: true });
}
export function upcomingCooper(events) {
    return events.find(e => e.profileId === LOCAL_PROFILE && e.status !== 'abgeschlossen' &&
        e.sport === 'running' && e.runningKind === 'cooper');
}
