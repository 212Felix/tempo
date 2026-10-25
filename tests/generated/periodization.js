export const BLOCK_INFO = {
    BASE: { title: 'Grundlage', focus: 'Grundlagenausdauer', note: 'Viel lockere Ausdauer, kontrollierte Progression.' },
    STRENGTH: { title: 'Kraft', focus: 'Kraftentwicklung', note: 'A/B-Kraft progressiv, Radintensität moderat.' },
    MIT: { title: 'Mittlere Intensität', focus: 'Sweet Spot & Schwelle', note: 'Kontrollierte längere Intervalle.' },
    HIT: { title: 'Hohe Intensität', focus: 'VO₂max', note: 'Wenige gezielte harte Einheiten; Erholung beachten.' },
    VOLUME: { title: 'Volumen', focus: 'Ermüdungsresistenz', note: 'Mehr Radstunden; Bein-Kraftvolumen reduzieren.' },
    MOUNTAIN: { title: 'Berg', focus: 'Bergleistung', note: 'Längere Anstiege, Kletterrhythmus und Pacing.' },
    RUN: { title: 'Laufen', focus: 'Spezifischer Laufaufbau', note: 'Laufumfang behutsam steigern, Intensität dosieren.' },
};
/** Example defaults only. Athlete confirms actual load changes; no silent plan mutation. */
export function adviseStrengthVolume(block, regularLegSets) {
    if (!Number.isInteger(regularLegSets) || regularLegSets < 0)
        throw new Error('Satzanzahl muss >= 0 sein.');
    const ratio = { BASE: 1, STRENGTH: 1, MIT: 1, HIT: 0.90, VOLUME: 0.80, MOUNTAIN: 0.85, RUN: 0.95 };
    const suggestedLegSets = Math.min(regularLegSets, Math.round(regularLegSets * ratio[block]));
    const reductionPercent = regularLegSets ? Math.round(100 * (1 - suggestedLegSets / regularLegSets)) : 0;
    return {
        block, regularLegSets, suggestedLegSets, reductionPercent,
        explanation: `${BLOCK_INFO[block].title}: für erfahrene Kraftsportler erhaltender Ausgangsvorschlag, keine pauschale Halbierung. Änderungen erst nach Bestätigung; Schmerz, Krankheit und Schichtbelastung separat prüfen.`,
        affectsExistingSessions: false,
    };
}
export const EVENT_ANCHORS = [
    { name: 'Mallorca 312', date: '2027-04-30', priority: 'B', distanceKm: 312, elevationM: 5000 },
    { name: 'Ötztaler RM', date: '2027-08-29', priority: 'A', distanceKm: 227, elevationM: 5500 },
];
/** Purely advisory blocks for the overview: never an authoritative generated training plan. */
export function blocksForDate(date, blocks) {
    return blocks.filter(block => block.startDate <= date && block.endDate >= date);
}
