import { dayDelta, plusDays, validDate } from '../events/library.js';
export const focusLabels = { cycling: 'Radfahren', running: 'Laufen', strength: 'Krafttraining', swimming: 'Schwimmen', mixed: 'Mehrere Sportarten' };
export const targetLabels = { basis: 'Grundlagenausdauer', tempo: 'Tempohärte', threshold: 'Schwelle', climbs: 'Berge / lange Anstiege', speed: 'Spritzigkeit / kurze Reize', technique: 'Technik / Ökonomie', recovery: 'Entlastung / Erholung' };
export const capacityLabels = { reduced: 'Weniger Zeit als üblich', normal: 'Normaler Trainingsalltag', more: 'Etwas mehr Zeit', much: 'Deutlich mehr Zeit / Urlaub' };
export const blockIsValid = (b) => validDate(b.startDate) && validDate(b.endDate) && b.endDate >= b.startDate && dayDelta(b.startDate, b.endDate) <= 90 && Object.keys(focusLabels).includes(b.focus) && Object.keys(targetLabels).includes(b.target) && Object.keys(capacityLabels).includes(b.capacity);
export function matchingBlock(date, blocks) {
    return blocks.filter(b => b.enabled && blockIsValid(b) && b.startDate <= date && b.endDate >= date).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}
/** Neutral phase skeleton, anchored only to actual locally saved event dates. */
export function deriveSeasonPhases(events, today) {
    const anchors = events.filter(x => x.status !== 'abgeschlossen' && (x.kind !== 'trainingsblock' || (x.priority === 'B' && (x.distanceKm ?? 0) >= 180)) && validDate(x.date ?? '') && x.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date));
    // A events take precedence. A preceding *long* B challenge can define an
    // intermediate training milestone without displacing the eventual A goal.
    const aEvents = anchors.filter(x => x.priority === 'A');
    let first;
    let second;
    if (aEvents.length >= 2) {
        [first, second] = aEvents;
    }
    else if (aEvents.length === 1) {
        const a = aEvents[0];
        const longB = anchors.filter(x => x.priority === 'B' && x.date < a.date && (x.distanceKm ?? 0) >= 180).at(-1);
        if (longB) {
            first = longB;
            second = a;
        }
        else
            first = a;
    }
    else
        [first, second] = anchors;
    if (!first?.date)
        return [];
    const output = [];
    const push = (id, title, startDate, endDate, detail, eventId, tentative = false) => {
        if (startDate <= endDate && validDate(startDate) && validDate(endDate))
            output.push({ id, title, startDate, endDate, detail, eventId, tentative });
    };
    const firstStart = plusDays(first.date, -195);
    push('B01', 'Wiedereinstieg', firstStart, plusDays(first.date, -166), 'Routine, Grundlagentraining und behutsamer Laufaufbau', first.id);
    push('B02', 'Aerobe Basis', plusDays(first.date, -165), plusDays(first.date, -111), 'Ausdauer, dosierte Qualität, Kraft', first.id);
    push('B03', 'Leistungsaufbau', plusDays(first.date, -110), plusDays(first.date, -56), 'Schwelle, längere Belastungen, ergänzende Sportarten', first.id);
    push('B04', `${first.name} · spezifisch`, plusDays(first.date, -55), plusDays(first.date, -20), 'Wettkampfspezifische Ausdauer und Verpflegung', first.id);
    push('B05', `${first.name} · Formspitze`, plusDays(first.date, -19), first.date, 'Reduzierter Umfang, Taper und Hauptevent', first.id);
    if (second?.date) {
        const start = plusDays(first.date, 1);
        const recoveryEnd = plusDays(first.date, 15);
        push('B06', 'Regeneration & Neustart', start, recoveryEnd, 'Erholung vor dem nächsten Aufbau', first.id);
        push('B07', 'Berg- und Belastungsaufbau', plusDays(recoveryEnd, 1), plusDays(second.date, -62), 'Umfang, Höhenmeter und Kraftausdauer', second.id);
        push('B08', `${second.name} · spezifisch`, plusDays(second.date, -61), plusDays(second.date, -29), 'Lange Belastungen und wiederholte Anstiege', second.id);
        push('B09', 'Wettkampfform', plusDays(second.date, -28), plusDays(second.date, -14), 'Spezifische Schlüsselreize, Belastung kontrollieren', second.id);
        push('B10', 'Taper & Event', plusDays(second.date, -13), second.date, 'Frische, kurze Aktivierung, Wettkampf', second.id);
    }
    return output.map(phase => ({ ...phase, tentative: anchors.find(e => e.id === phase.eventId)?.status !== 'bestaetigt' }));
}
export function describeBlock(b) {
    const capacity = b.capacity === 'reduced' ? 'geringerer Umfang' : b.capacity === 'normal' ? 'normaler Umfang' : b.capacity === 'more' ? 'etwas mehr lockeres Volumen' : 'zusätzliche lockere Einheiten nur bei guter Erholung';
    return `${focusLabels[b.focus]} · ${targetLabels[b.target]} · ${capacity}${b.weeklyHours ? ` · Zeitbudget maximal ${b.weeklyHours} h/Woche` : ''}`;
}
/** One-session conservative personalization. Does NOT create an extra session, nor change completed/protected sessions. */
export function tailorSession(base, block, ftp) {
    if (!block || block.target === 'recovery')
        return base;
    const target = block.target;
    let result = { ...base };
    if (block.focus === 'cycling' && (base.sessionType === 'long' || base.sessionType === 'endurance' || base.sessionType === 'quality')) {
        if (base.sessionType === 'long' && block.capacity !== 'reduced')
            result = { ...result, durationMin: Math.min(Math.round(base.durationMin * 1.1), 165) };
        if (base.sessionType === 'quality') {
            if (target === 'speed')
                result = { ...result, title: 'Kurze Aktivierungen · kontrolliert', durationMin: 55, target: 'Locker einrollen · 5 × 20 Sekunden hohe Kadenz mit viel Erholung · locker ausrollen', description: 'Spritzigkeit ohne maximales Sprinttraining. Nur bei guter Tagesform und sicherer Strecke.' };
            if (target === 'threshold')
                result = { ...result, title: 'Schwellenaufbau 2 × 8', target: ftp ? `2 × 8 min bei ${Math.round(ftp * .9)}–${Math.round(ftp * .95)} W, lange Pause` : '2 × 8 min kontrolliert (RPE 6–7), lange Pause' };
            if (target === 'climbs')
                result = { ...result, title: 'Dosierte Bergintervalle 3 × 6', target: ftp ? `3 × 6 min bei ${Math.round(ftp * .8)}–${Math.round(ftp * .88)} W am sicheren Anstieg` : '3 × 6 min moderat am Berg (RPE 5–6)' };
            if (target === 'technique')
                result = { ...result, title: 'Tritttechnik und Ökonomie', target: '3 × 8 min runder Tritt, hohe Kadenz ohne Pressen; lange Pausen', durationMin: 55 };
        }
        if (base.sessionType === 'endurance' && target === 'climbs')
            result = { ...result, title: 'Lockere Grundlage mit Höhenmetern', description: 'Bevorzugt wellige Strecke, keine harten Anstiege' };
    }
    if (block.focus === 'running' && base.sessionType === 'run') {
        // Wiedereinstieg: keine ungedeckten harten Laufintervalle.
        result = { ...result, title: target === 'technique' ? 'Easy Run + 4 kurze Steigerungen' : 'Lockerer Lauf · Schwerpunkt', durationMin: Math.min(Math.round(base.durationMin * (block.capacity === 'reduced' ? .85 : 1.1)), 45), target: target === 'technique' ? 'Locker laufen; optional 4 × 12 Sekunden Steigerung mit vollständiger Erholung' : 'Gesprächstempo, RPE 3–4; bei Bedarf Gehpausen' };
    }
    if (block.focus === 'strength' && base.sessionType.startsWith('strength'))
        result = { ...result, description: target === 'speed' ? 'Explosive Bewegung technisch kontrolliert, ohne Maximallasten und ohne Muskelversagen.' : 'Kraftschwerpunkt, Technik vor Zusatzgewicht. Keine erschöpfenden Sätze.' };
    return { ...result, notes: [result.notes, `Fokusblock: ${block.name} (${focusLabels[block.focus]}; ${targetLabels[block.target]}). Keine automatische Trainingsfreigabe.`].filter(Boolean).join(' · ') };
}
export function mayIncreaseVolume(block, weeklyCompleted, readiness, shifts) {
    if (block.capacity !== 'more' && block.capacity !== 'much')
        return false;
    if (readiness?.illness === 'ja')
        return false;
    const hard = weeklyCompleted.filter(c => (c.rpe ?? 0) >= 8).length;
    if (hard >= 2)
        return false;
    if (shifts && Object.values(shifts).some(s => s.shift === 'einsatz'))
        return false;
    return true;
}
export function classifySport(b) { return b.focus === 'cycling' ? ['endurance', 'long', 'quality'] : b.focus === 'running' ? ['run'] : b.focus === 'strength' ? ['strength-a', 'strength-b'] : ['recovery']; }
