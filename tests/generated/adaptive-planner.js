import { adviseStrengthVolume } from './periodization.js';
import { REGULAR_LEG_SETS } from './strength-dose.js';
const MS_DAY = 86400000;
function validDate(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s))
        return false;
    const date = new Date(s + 'T12:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s;
}
function advance(date, n) {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}
function difference(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / MS_DAY); }
export function mondayUTC(date) {
    if (!validDate(date))
        throw Error('Ungültiges Startdatum');
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
    return advance(date, -((weekday + 6) % 7));
}
export function plannedEvents(events) {
    return events.filter(e => e.status !== 'abgeschlossen' && e.sport === 'cycling' && validDate(e.date) &&
        (e.priority === 'A' || e.priority === 'B') && e.profileId === 'local-primary-profile')
        .sort((a, b) => a.date.localeCompare(b.date) || (a.priority === 'A' ? -1 : 1));
}
function eventIsTentative(event) {
    return Boolean(event && (event.status !== 'bestaetigt' || event.vacation === 'offen' || event.kind === 'trainingsblock'));
}
function assignedKind(daysToGoal, event, cycleIndex) {
    if (daysToGoal <= 13)
        return 'TAPER';
    if (daysToGoal <= 35)
        return 'MOUNTAIN';
    if (daysToGoal <= 63)
        return cycleIndex % 2 === 0 ? 'VOLUME' : 'MOUNTAIN';
    if (daysToGoal <= 91)
        return cycleIndex % 2 === 0 ? 'HIT' : 'MIT';
    if (daysToGoal <= 133)
        return 'MIT';
    if (daysToGoal <= 175)
        return cycleIndex % 2 === 0 ? 'STRENGTH' : 'BASE';
    if (event.priority === 'A' && daysToGoal <= 210)
        return 'BASE';
    return cycleIndex % 3 === 0 ? 'STRENGTH' : 'BASE';
}
function customKind(block) {
    if (block.focus === 'running')
        return 'RUN';
    if (block.focus === 'strength')
        return 'STRENGTH';
    if (block.target === 'climbs')
        return 'MOUNTAIN';
    if (block.target === 'speed')
        return 'HIT';
    if (block.target === 'tempo' || block.target === 'threshold')
        return 'MIT';
    if (block.capacity === 'more' || block.capacity === 'much')
        return 'VOLUME';
    return 'BASE';
}
const NO_ADAPTIVE_LOAD = new Set(['manual-swimming', 'manual-sportspiel', 'manual-golf']);
function weekMinutesFromSessions(start, end, completed, planned) {
    const doneInRange = completed.filter(x => x.date >= start && x.date <= end && x.profileId === 'local-primary-profile' && !NO_ADAPTIVE_LOAD.has(x.sessionType ?? ''));
    const completedLinked = new Set(doneInRange.map(x => x.plannedSessionId).filter(Boolean));
    const plannedInRange = planned.filter(x => x.profileId === 'local-primary-profile' && x.date >= start && x.date <= end && x.status === 'geplant' && !NO_ADAPTIVE_LOAD.has(x.sessionType) && !completedLinked.has(x.id));
    const safeMin = (x) => Number.isFinite(x.durationMin) && x.durationMin > 0 ? Math.min(1440, x.durationMin) : 0;
    return { done: Math.round(doneInRange.reduce((s, x) => s + safeMin(x), 0)),
        scheduled: Math.round(plannedInRange.reduce((s, x) => s + safeMin(x), 0)),
        protectedCount: plannedInRange.filter(x => x.locked || x.createdBy !== 'tempo-planner-v1').length };
}
function historyBaseline(start, completed) {
    const recent = completed.filter(x => x.profileId === 'local-primary-profile' && x.date < start && x.date >= advance(start, -42) && !NO_ADAPTIVE_LOAD.has(x.sessionType ?? '') &&
        x.durationMin && x.durationMin > 0);
    const weekSums = new Map();
    for (const entry of recent) {
        const k = mondayUTC(entry.date);
        weekSums.set(k, (weekSums.get(k) ?? 0) + Math.min(entry.durationMin, 1440));
    }
    // Sparse data cannot justify an individualised hours target.
    if (weekSums.size < 3)
        return undefined;
    const ordered = [...weekSums.values()].sort((a, b) => a - b);
    return ordered[Math.floor(ordered.length / 2)] / 60;
}
const LEG_DEFAULT = REGULAR_LEG_SETS;
export function deriveAdaptiveWeeks(options) {
    const { events, completed = [], planned = [], blocks = [], shifts = {}, readiness, regularLegSets = LEG_DEFAULT, } = options;
    const start = mondayUTC(options.start);
    const count = Math.max(0, Math.min(60, Math.floor(options.weeks)));
    const goals = plannedEvents(events);
    const initialBaseline = historyBaseline(start, completed);
    const safeLegSets = Number.isInteger(regularLegSets) ? Math.max(0, Math.min(40, regularLegSets)) : LEG_DEFAULT;
    return Array.from({ length: count }, (_, weekIndex) => {
        const weekStart = advance(start, weekIndex * 7), weekEnd = advance(weekStart, 6);
        const next = goals.find(e => e.date >= weekStart);
        const prev = [...goals].reverse().find(e => e.date < weekStart);
        const daysToGoal = next?.date ? difference(weekStart, next.date) : 9999;
        const daysAfterPrevious = prev?.date ? difference(prev.date, weekStart) : 9999;
        const preEventEnd = goals.find(e => e.date >= weekStart && e.date <= weekEnd);
        const confirmedBlock = blocks.filter(b => b.enabled && b.startDate <= weekStart && b.endDate >= weekEnd && b.createdBy === 'tempo-user')
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        const cycleIndex = weekIndex;
        let kind = next ? assignedKind(daysToGoal, next, cycleIndex) : 'BASE';
        if (confirmedBlock && kind !== 'TAPER')
            kind = customKind(confirmedBlock);
        if (prev && daysAfterPrevious < 14)
            kind = 'RECOVERY';
        if (preEventEnd)
            kind = 'TAPER';
        // Recovery / taper are always lower priority than a user's previously stored plan.
        const deload = cycleIndex % 4 === 3 || kind === 'TAPER' || kind === 'RECOVERY';
        const trainedRecently = completed.filter(x => x.date >= advance(weekStart, -42) && x.date < weekStart && x.profileId === 'local-primary-profile');
        const hasTrainingHistory = trainedRecently.filter(x => ['long', 'endurance', 'quality', 'commute', 'manual-cycling'].includes(x.sessionType ?? '')).length >= 4;
        if (kind === 'HIT' && !hasTrainingHistory)
            kind = 'MIT';
        const legs = kind === 'TAPER' ? Math.round(safeLegSets * .4) : kind === 'RECOVERY' ? 0 : adviseStrengthVolume(kind, safeLegSets).suggestedLegSets;
        const limits = { BASE: 1, STRENGTH: 1, MIT: 1, HIT: 1, VOLUME: 1, MOUNTAIN: 1, RUN: 0, TAPER: 0, RECOVERY: 0 };
        const qualityLimit = deload ? 0 : limits[kind];
        const strengthSlots = kind === 'RECOVERY' ? 0 : kind === 'TAPER' ? 1 : 2;
        let hoursRange;
        if (initialBaseline !== undefined && weekIndex < 4) {
            const factor = kind === 'RECOVERY' ? .5 : kind === 'TAPER' ? .6 : deload ? .75 : kind === 'VOLUME' ? 1.1 : 1;
            const anchor = Math.max(1, initialBaseline) * factor;
            hoursRange = [Math.max(1, Math.round(anchor * .9 * 2) / 2), Math.round(anchor * 1.05 * 2) / 2];
        }
        // No long-ride progression from inferred historical *max*: cap adaptive increases.
        const recentLongest = trainedRecently.filter(x => ['long', 'endurance', 'commute', 'manual-cycling'].includes(x.sessionType ?? ''))
            .reduce((max, x) => Math.max(max, x.durationMin ?? 0), 0);
        const maxLong = kind === 'RECOVERY' ? 0 : kind === 'TAPER' ? Math.min(90, recentLongest || 90) :
            kind === 'VOLUME' || kind === 'MOUNTAIN' ? Math.min(300, recentLongest ? Math.round(recentLongest * 1.1) : 120) :
                Math.min(240, recentLongest ? Math.round(recentLongest * 1.1) : 105);
        const thisWeek = weekMinutesFromSessions(weekStart, weekEnd, completed, planned);
        const notes = [];
        const safeguards = [];
        if (confirmedBlock)
            notes.push(`Dein Sonderblock „${confirmedBlock.name}“ wird berücksichtigt.`);
        if (next)
            notes.push(`Ausrichtung auf ${next.name} (${next.priority}-Ziel, ${next.date}).`);
        if (kind === 'HIT')
            notes.push('Maximal ein qualitätsbetonter VO₂-Reiz; die übrigen Radfahrten locker.');
        if (kind === 'MIT')
            notes.push('Sweet Spot / Schwelle dosiert; keine zusätzlichen harten Pendelintervalle.');
        if (kind === 'VOLUME')
            notes.push('Mehr ruhige Radzeit statt mehr harte Reize. Pendelkilometer zählen zur Belastung.');
        if (kind === 'MOUNTAIN')
            notes.push('Bergspezifische Belastung, Verpflegung und gleichmäßiges Pacing.');
        if (kind === 'STRENGTH')
            notes.push('Zwei Krafttermine nur bei passender Verfügbarkeit; Beine nicht bis zum Versagen.');
        if (kind === 'RUN')
            notes.push('Cooper-Ziel unterstützt, aber Laufintensität nur bei stabiler Laufverträglichkeit.');
        if (kind === 'RECOVERY')
            notes.push('Erholungswoche nach einem geplanten Belastungshöhepunkt. Aktivität individuell prüfen.');
        if (kind === 'TAPER')
            notes.push('Entlastung und Frische vor dem Termin; keine neue Umfangssteigerung.');
        if (deload && kind !== 'TAPER' && kind !== 'RECOVERY')
            notes.push('Jede vierte Woche als Entlastungswoche: weniger Umfang und kein Pflicht-Qualitätsreiz.');
        if (kind === 'VOLUME' || kind === 'MOUNTAIN' || kind === 'HIT')
            notes.push(`Bein-Arbeitssätze als Empfehlung: ${legs} statt ${safeLegSets}/Woche. Krafttermine möglichst erhalten, Unterkörper-Volumen reduzieren.`);
        if (next && eventIsTentative(next))
            safeguards.push(`Termin „${next.name}“ ist noch nicht vollständig bestätigt; Saisonfokus nur vorläufig.`);
        const dates = Array.from({ length: 7 }, (_, i) => advance(weekStart, i));
        const unconfirmed = dates.filter(d => !shifts[d]?.shift || shifts[d]?.shift === 'offen').length;
        if (unconfirmed)
            safeguards.push(`${unconfirmed} Diensttage offen: keine verbindlichen Einheiten ohne verfügbares Trainingsfenster.`);
        if (readiness && readiness.date >= weekStart && readiness.date <= weekEnd && readiness.illness === 'ja')
            safeguards.push('Beschwerden im Tages-Check-in: keine intensive Belastung vorschlagen.');
        if (initialBaseline === undefined)
            safeguards.push('Zu wenige aktuelle Wochen zur Ableitung eines verlässlichen Stundenbudgets; keine automatische Volumensteigerung.');
        if (thisWeek.protectedCount)
            safeguards.push(`${thisWeek.protectedCount} bestehende eigene/feste Einheiten bleiben unangetastet.`);
        const referenceEvent = kind === 'RECOVERY' ? prev : preEventEnd ?? next;
        const title = { BASE: 'Aerobe Basis', STRENGTH: 'Kraftbasis', MIT: 'Tempo / Schwelle', HIT: 'VO₂max-Fokus', VOLUME: 'Umfang / Ermüdungsresistenz', MOUNTAIN: 'Berge / langes Pacing', RUN: 'Laufaufbau', TAPER: 'Taper / Rennwoche', RECOVERY: 'Erholung' };
        return { startDate: weekStart, endDate: weekEnd, number: weekIndex + 1, kind, title: title[kind], goal: referenceEvent?.name, goalDate: referenceEvent?.date, goalTentative: eventIsTentative(referenceEvent), deload, hoursRange,
            qualityLimit, strengthSlots, legSets: legs, longRideMinutes: maxLong || undefined, easyRunMinutes: kind === 'TAPER' || kind === 'RECOVERY' ? 20 : 30,
            notes, safeguards, plannedMinutes: thisWeek.scheduled, completedMinutes: thisWeek.done, protectedSessions: thisWeek.protectedCount };
    });
}
export function adjustSuggestedSession(item, week, ftpWatts) {
    const adapted = { ...item };
    if (item.sessionType === 'quality') {
        if (week.qualityLimit === 0)
            return { ...adapted, sessionType: 'endurance', title: 'Lockere Grundlage statt Intervallen', durationMin: 45, priority: 'KANN', target: 'RPE 2–3, locker', description: 'Entlastung: keine zusätzliche harte Belastung.' };
        if (week.kind === 'HIT') {
            adapted.title = 'VO₂max · 4 × 3 Minuten';
            adapted.durationMin = 65;
            adapted.target = `15 min locker · 4 × 3 min ${ftpWatts ? `${Math.round(ftpWatts * 1.05)}–${Math.round(ftpWatts * 1.12)} W` : 'RPE 8'} · je 3 min leicht · ausrollen`;
            adapted.description = 'Harter Einzelreiz nur bei stabiler Form; keine zweite HIT-Einheit. Bei Ermüdung durch Z2 ersetzen.';
        }
        else if (week.kind === 'MIT') {
            adapted.title = 'Schwelle · 2 × 10 Minuten';
            adapted.durationMin = 65;
            adapted.target = `15 min locker · 2 × 10 min ${ftpWatts ? `${Math.round(ftpWatts * .88)}–${Math.round(ftpWatts * .94)} W` : 'RPE 6–7'} · 6 min locker · ausrollen`;
        }
        else if (week.kind === 'MOUNTAIN') {
            adapted.title = 'Lange Anstiege · 3 × 8 Minuten';
            adapted.durationMin = 70;
            adapted.target = `Einrollen · 3 × 8 min ${ftpWatts ? `${Math.round(ftpWatts * .8)}–${Math.round(ftpWatts * .9)} W` : 'RPE 5–6'} · 5 min locker · ausrollen`;
        }
    }
    if (item.sessionType === 'long' && week.longRideMinutes !== undefined) {
        adapted.durationMin = Math.min(item.durationMin, week.longRideMinutes);
        if (week.kind === 'VOLUME' || week.kind === 'MOUNTAIN')
            adapted.title = week.kind === 'VOLUME' ? 'Lange Z2-Fahrt · Verpflegung' : 'Lange Bergausdauer · Pacing';
    }
    if (item.sessionType === 'run') {
        adapted.durationMin = Math.min(item.durationMin, week.easyRunMinutes);
        adapted.notes = [adapted.notes, 'Cooper 3.200 m/12 min bleibt Nebenziel; Laufumfang nach Verträglichkeit, nicht abrupt erhöhen.'].filter(Boolean).join(' · ');
    }
    if (item.sessionType.startsWith('strength')) {
        adapted.notes = [adapted.notes, `Saisonempfehlung: Unterkörper insgesamt ca. ${week.legSets} Arbeitssätze/Woche über beide Krafttermine (nicht zusätzlich pro Einheit). Bereits erfasste Sätze unverändert.`, week.deload ? 'Entlastung: keine Sätze bis zum Muskelversagen.' : undefined].filter(Boolean).join(' · ');
    }
    return adapted;
}
