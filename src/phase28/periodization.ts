/** Recommendations are read-only previews. Never erase or replace a planned session. */
export type BlockKind = 'BASE' | 'STRENGTH' | 'MIT' | 'HIT' | 'VOLUME' | 'MOUNTAIN' | 'RUN';
export const BLOCK_INFO: Record<BlockKind, { title: string; focus: string; note: string }> = {
  BASE: { title: 'Grundlage', focus: 'Grundlagenausdauer', note: 'Viel lockere Ausdauer, kontrollierte Progression.' },
  STRENGTH: { title: 'Kraft', focus: 'Kraftentwicklung', note: 'A/B-Kraft progressiv, Radintensität moderat.' },
  MIT: { title: 'Mittlere Intensität', focus: 'Sweet Spot & Schwelle', note: 'Kontrollierte längere Intervalle.' },
  HIT: { title: 'Hohe Intensität', focus: 'VO₂max', note: 'Wenige gezielte harte Einheiten; Erholung beachten.' },
  VOLUME: { title: 'Volumen', focus: 'Ermüdungsresistenz', note: 'Mehr Radstunden; Bein-Kraftvolumen reduzieren.' },
  MOUNTAIN: { title: 'Berg', focus: 'Bergleistung', note: 'Längere Anstiege, Kletterrhythmus und Pacing.' },
  RUN: { title: 'Laufen', focus: 'Spezifischer Laufaufbau', note: 'Laufumfang behutsam steigern, Intensität dosieren.' },
};
export interface Block {
  id: string;
  kind: BlockKind;
  startDate: string;
  endDate: string;
  goal?: string;
  notes?: string;
}
export interface WeekAdvice {
  block: BlockKind;
  regularLegSets: number;
  suggestedLegSets: number;
  reductionPercent: number;
  explanation: string;
  affectsExistingSessions: false;
}
/** Example defaults only. Athlete confirms actual load changes; no silent plan mutation. */
export function adviseStrengthVolume(block: BlockKind, regularLegSets: number): WeekAdvice {
  if (!Number.isInteger(regularLegSets) || regularLegSets < 0) throw new Error('Satzanzahl muss >= 0 sein.');
  const ratio: Record<BlockKind, number> = { BASE: 1, STRENGTH: 1, MIT: 0.85, HIT: 0.7, VOLUME: 0.5, MOUNTAIN: 0.7, RUN: 0.85 };
  const suggestedLegSets = Math.min(regularLegSets, Math.round(regularLegSets * ratio[block]));
  const reductionPercent = regularLegSets ? Math.round(100 * (1 - suggestedLegSets / regularLegSets)) : 0;
  return {
    block, regularLegSets, suggestedLegSets, reductionPercent,
    explanation: `${BLOCK_INFO[block].title}: unverbindlicher Vorschlag. Änderungen erst nach Bestätigung; Schmerz, Krankheit und Schichtbelastung separat prüfen.`,
    affectsExistingSessions: false,
  };
}
export const EVENT_ANCHORS = [
  { name: 'Mallorca 312', date: '2027-04-30', priority: 'B', distanceKm: 312, elevationM: 5000 },
  { name: 'Ötztaler RM', date: '2027-08-29', priority: 'A', distanceKm: 227, elevationM: 5500 },
] as const;

/** Purely advisory blocks for the overview: never an authoritative generated training plan. */
export function blocksForDate(date: string, blocks: Block[]): Block[] {
  return blocks.filter(block => block.startDate <= date && block.endDate >= date);
}
