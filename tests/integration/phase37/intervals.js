export function recoveryValid(x) { return x.seconds >= 0 && x.seconds <= 1800 && Number.isFinite(x.seconds) && ((x.mode === 'heart-rate') ? (Number.isInteger(x.heartRateLimit) && x.heartRateLimit >= 75 && x.heartRateLimit <= 190 && Number.isFinite(x.maxWaitSeconds) && x.maxWaitSeconds >= 30 && x.maxWaitSeconds <= 1800) : (x.mode === 'active' ? Number.isFinite(x.paceMinPerKm) && x.paceMinPerKm >= 3 && x.paceMinPerKm <= 15 : x.seconds >= 15)); }
export function formatStepTime(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`; }
export function wattsForStep(step, ftp) {
    if (step.lowFtp === undefined || step.highFtp === undefined)
        return 'Intensität nach Vorgabe';
    if (!ftp || !Number.isFinite(ftp) || ftp <= 0)
        return `${Math.round(step.lowFtp * 100)}–${Math.round(step.highFtp * 100)} % FTP (Watt nach FTP-Eingabe)`;
    return `${Math.round(ftp * step.lowFtp)}–${Math.round(ftp * step.highFtp)} W (${Math.round(step.lowFtp * 100)}–${Math.round(step.highFtp * 100)} % FTP)`;
}
/** The known TEMPO 2x8 prescription has a complete 60-min budget; easy riding fills the duration. */
export function cyclingIntervalSteps(session) {
    if (session.sessionType !== 'quality' || !/tempo.einstieg\s*2\s*[×x]\s*8/i.test(session.title))
        return null;
    const total = Math.round(session.durationMin * 60);
    const core = 15 * 60 + 8 * 60 + 5 * 60 + 8 * 60 + 10 * 60;
    if (total < core)
        return null; // do not silently exceed a saved duration
    const steps = [
        { id: 'warm', title: 'Einrollen', seconds: 900, effort: 'warmup', lowFtp: .50, highFtp: .65 },
        { id: 'rep1', title: 'Tempo-Intervall 1/2', seconds: 480, effort: 'work', lowFtp: .80, highFtp: .88 },
        { id: 'pause1', title: 'Aktive Pause – weiterpedalieren', seconds: 300, effort: 'recovery', lowFtp: .45, highFtp: .55, recovery: 'active' },
        { id: 'rep2', title: 'Tempo-Intervall 2/2', seconds: 480, effort: 'work', lowFtp: .80, highFtp: .88 },
    ];
    const easy = total - core;
    if (easy > 0)
        steps.push({ id: 'easy', title: 'Lockeres Weiterfahren', seconds: easy, effort: 'endurance', lowFtp: .55, highFtp: .68 });
    steps.push({ id: 'cool', title: 'Ausrollen', seconds: 600, effort: 'cooldown', lowFtp: .40, highFtp: .55 });
    return steps;
}
export function stepsSeconds(steps) { return steps.reduce((n, s) => n + s.seconds, 0); }
export function formatPace(minPerKm) { const sec = Math.round(minPerKm * 60); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min/km`; }
export function runRecoveryText(recovery) {
    if (recovery.mode === 'heart-rate')
        return `Gehen / stehen bis HF ≤ ${recovery.heartRateLimit} bpm · höchstens ${formatStepTime(recovery.maxWaitSeconds ?? 0)} warten. Bei fehlender HF-Messung: manuell fortfahren oder abbrechen.`;
    if (recovery.mode === 'active')
        return `${formatStepTime(recovery.seconds)} locker traben · Zielpace ${formatPace(recovery.paceMinPerKm ?? 7)}`;
    return `${formatStepTime(recovery.seconds)} passive Pause (stehen / langsam gehen)`;
}
/** No fixed 135 bpm is prescribed universally. Only user-specific confirmed value. */
export function defaultsForRunRecovery() { return { mode: 'active', seconds: 120, paceMinPerKm: 7 }; }
