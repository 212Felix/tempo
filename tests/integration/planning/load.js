import { readinessLevel } from './engine.js';
const daysBetween = (from, to) => {
    const asUTC = (key) => {
        const [year, month, day] = key.split('-').map(Number);
        return Date.UTC(year, month - 1, day);
    };
    return Math.round((asUTC(to) - asUTC(from)) / 86400000);
};
const isCycling = (type) => ['manual-cycling', 'long', 'endurance', 'quality', 'commute'].includes(type ?? '');
const isStrength = (type) => ['manual-strength', 'strength-a', 'strength-b'].includes(type ?? '');
const isRunning = (type) => ['manual-running', 'run'].includes(type ?? '');
function trainingLoad(input) {
    const duration = input.durationMin ?? 0;
    const distance = input.distanceKm ?? 0;
    const elevation = input.elevationM ?? 0;
    const rpe = input.rpe ?? 0;
    const cycling = isCycling(input.sessionType);
    const strength = isStrength(input.sessionType);
    const running = isRunning(input.sessionType);
    if (cycling && (distance >= 160 || duration >= 330 || elevation >= 2600 || (duration >= 180 && rpe >= 8)))
        return { guardDays: 2, cautionDays: 3, label: 'Sehr lange oder intensive Radeinheit' };
    if (cycling && (distance >= 75 || duration >= 150 || elevation >= 1400 || (duration >= 60 && rpe >= 7)))
        return { guardDays: 1, cautionDays: 2, label: 'Höhere Radbelastung' };
    if (running && (duration >= 90 || (duration >= 40 && rpe >= 8)))
        return { guardDays: 1, cautionDays: 2, label: 'Hohe Laufbelastung' };
    if (strength && (duration >= 40 && rpe >= 8))
        return { guardDays: 1, cautionDays: 1, label: 'Anstrengendes Krafttraining' };
    if (rpe >= 9 && duration >= 30)
        return { guardDays: 1, cautionDays: 1, label: 'Sehr hohe subjektive Belastung' };
    if ((cycling && distance >= 45) || (strength && duration >= 45) || (running && duration >= 50) || rpe >= 7)
        return { guardDays: 0, cautionDays: 1, label: 'Zusätzliche Trainingsbelastung' };
    return null;
}
/** Trainingseingaben zählen für die Folgeplanung, auch wenn sie vor dem Planzeitraum liegen. */
export function createLoadCalendar(dates, completed, planned, readiness) {
    const result = Object.fromEntries(dates.map(date => [date, { level: 'none', reasons: [] }]));
    const rank = { none: 0, caution: 1, recovery: 2 };
    const note = (date, level, reason) => {
        const day = result[date];
        if (!day)
            return;
        if (rank[level] > rank[day.level])
            day.level = level;
        if (!day.reasons.includes(reason))
            day.reasons.push(reason);
    };
    const completedSessionIds = new Set(completed.map(entry => entry.plannedSessionId).filter(Boolean));
    const inputs = [
        ...completed.map(item => ({
            date: item.date, sessionType: item.sessionType, durationMin: item.durationMin,
            distanceKm: item.distanceKm, elevationM: item.elevationM, rpe: item.rpe,
            origin: 'absolviert',
        })),
        // Nur selbst fest verplante Einheiten werden berücksichtigt, nicht die ersetzbaren
        // automatisch erstellten Einheiten. Sonst würde der Plan sich selbst blockieren.
        ...planned.filter(item => item.status === 'geplant' && (item.locked || item.createdBy === 'tempo-user') && !completedSessionIds.has(item.id))
            .map(item => ({ date: item.date, sessionType: item.sessionType, durationMin: item.durationMin,
            distanceKm: item.expectedKm, elevationM: item.elevationM, rpe: item.rpe,
            origin: 'fest geplant' })),
    ];
    for (const entry of inputs) {
        if (!entry.date)
            continue;
        const load = trainingLoad(entry);
        if (!load)
            continue;
        for (const date of dates) {
            const delta = daysBetween(entry.date, date);
            if (delta < 1 || delta > load.cautionDays)
                continue;
            const severity = delta <= load.guardDays ? 'recovery' : 'caution';
            note(date, severity, `${load.label} am ${new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(entry.date + 'T12:00:00'))} (${entry.origin})`);
        }
    }
    if (readiness && result[readiness.date]) {
        const status = readinessLevel(readiness);
        if (readiness.illness === 'ja') {
            note(readiness.date, 'recovery', 'Krankheit/Auffälligkeit im Tages-Check-in gemeldet');
        }
        else if (status === 'rot') {
            note(readiness.date, 'recovery', 'Readiness ROT: mehrere ungünstige Signale – Erholung prüfen');
        }
        else if (status === 'gelb') {
            note(readiness.date, 'caution', 'Readiness GELB: Umfang und Intensität heute überprüfen');
        }
    }
    // Tages-Check-in bleibt zeitlich eng begrenzt: eine einzelne schlechte Nacht
    // ist KEIN automatischer Grund für mehrere volle Ruhetage.
    if (readiness && result[readiness.date] && readinessLevel(readiness) === 'rot') {
        const [year, month, day] = readiness.date.split('-').map(Number);
        const following = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
        if (result[following]) {
            note(following, 'caution', readiness.illness === 'ja'
                ? 'Beschwerden am Vortag gemeldet – Tagesform erneut prüfen, harte Belastung nicht voraussetzen'
                : 'Deutlich eingeschränkte Readiness am Vortag – Morgencheck vor Intensität wiederholen');
        }
    }
    return result;
}
