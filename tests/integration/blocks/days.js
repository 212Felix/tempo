import { plusDays, validDate } from '../events/library.js';
export const dayKindLabels = {
    leisure: 'Freizeit ohne Sport', rest: 'Ruhetag / Erholung', travel: 'An- / Abreise',
    'group-ride': 'Gemeinsame Tour', 'ride-training': 'Gezielte Trainingstour', challenge: 'Persönliche Challenge'
};
export const effortLabels = {
    easy: 'Locker, ohne Intervalle', varied: 'Nach Gefühl / Gruppe', tempo: 'Optional: Tempointervall', threshold: 'Optional: Schwellenintervall'
};
export const isTrainingFree = (kind) => kind === 'leisure' || kind === 'rest' || kind === 'travel';
export function dateInBlock(date, block) {
    return validDate(date) && date >= block.startDate && date <= block.endDate;
}
/** Throws away malformed legacy entries instead of acting on them. */
export function safeBlockDays(block) {
    if (!Array.isArray(block.days))
        return [];
    const used = new Set();
    return block.days.filter((v) => {
        if (!v || typeof v !== 'object' || Array.isArray(v))
            return false;
        const d = v;
        if (!dateInBlock(d.date, block) || !(d.kind in dayKindLabels) || used.has(d.date))
            return false;
        used.add(d.date);
        return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
}
/** Challenge reserves the day before for recovery unless already specified otherwise. */
export function blockDayForDate(date, blocks) {
    const active = blocks.filter(b => b.enabled && dateInBlock(date, b)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!active)
        return undefined;
    const plans = safeBlockDays(active);
    const direct = plans.find(d => d.date === date);
    if (direct)
        return direct;
    const challenge = plans.find(d => d.kind === 'challenge' && plusDays(d.date, -1) === date);
    if (challenge)
        return { date, kind: 'rest', title: 'Ruhetag vor ' + (challenge.title || 'der Challenge'), notes: 'Geplanter Entlastungstag vor der privaten Langdistanz. Eventuell bestehende Einheiten separat prüfen.' };
    return undefined;
}
export function planDayValid(block, plan) {
    if (!dateInBlock(plan.date, block) || !(plan.kind in dayKindLabels))
        return false;
    if (plan.title && plan.title.length > 100)
        return false;
    if (plan.notes && plan.notes.length > 600)
        return false;
    if (plan.durationMin !== undefined && (!Number.isFinite(plan.durationMin) || plan.durationMin < 0 || plan.durationMin > 1440))
        return false;
    if (plan.routeId && (!plan.routeSource || plan.routeId.length > 180))
        return false;
    if (plan.climbIntervals !== undefined) {
        if (!Array.isArray(plan.climbIntervals) || plan.climbIntervals.length > 8 || !plan.routeId || plan.routeSource !== 'garmin')
            return false;
        const seen = new Set();
        for (const target of plan.climbIntervals) {
            if (!target || typeof target.climbKey !== 'string' || target.climbKey.length > 250 || seen.has(target.climbKey) || !['steady', 'tempo', 'threshold'].includes(target.effort))
                return false;
            seen.add(target.climbKey);
        }
        if (plan.climbIntervals.filter(x => x.effort !== 'steady').length > 2)
            return false;
    }
    return true;
}
export function putBlockDay(block, plan) {
    if (!planDayValid(block, plan))
        throw new Error('Ungültige Tagesplanung.');
    const days = safeBlockDays(block).filter(d => d.date !== plan.date);
    return { ...block, days: [...days, plan].sort((a, b) => a.date.localeCompare(b.date)) };
}
export function dropBlockDay(block, date) {
    return { ...block, days: safeBlockDays(block).filter(d => d.date !== date) };
}
export function itineraryDates(block) {
    const dates = [];
    let d = block.startDate;
    for (let i = 0; i <= 90 && d <= block.endDate; i++, d = plusDays(d, 1))
        dates.push(d);
    return dates;
}
