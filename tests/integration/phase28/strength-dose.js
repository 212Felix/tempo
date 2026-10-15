/** Read-only set *display* recommendation. Existing logged sets must never be hidden. */
export const LEG_EXERCISE_IDS = new Set(['squat', 'rdl', 'copenhagen', 'side-abd', 'step-up', 'hip-thrust', 'cossack', 'side-plank-lift']);
const REGULAR_LEG_SETS_A_B = 20;
export function suggestedStrengthSets(exercises, weeklyLegSets, preserved = {}) {
    const weeklyBudget = Math.max(0, Math.min(REGULAR_LEG_SETS_A_B, Math.round(weeklyLegSets)));
    const legExercises = exercises.filter(ex => LEG_EXERCISE_IDS.has(ex.id));
    const originalTotal = legExercises.reduce((sum, ex) => sum + ex.sets, 0);
    const perSession = Math.min(originalTotal, Math.round(weeklyBudget / 2));
    // Largest-remainder allocation. When a leg set is necessary retain the key movements.
    const fraction = originalTotal ? perSession / originalTotal : 0;
    const floor = legExercises.map(ex => ({ id: ex.id, ideal: ex.sets * fraction, base: Math.floor(ex.sets * fraction) }));
    let remaining = Math.max(0, perSession - floor.reduce((sum, x) => sum + x.base, 0));
    floor.sort((a, b) => (b.ideal - b.base) - (a.ideal - a.base) || a.id.localeCompare(b.id));
    for (const x of floor) {
        if (remaining > 0) {
            x.base += 1;
            remaining--;
        }
    }
    const chosen = new Map(floor.map(ex => [ex.id, ex.base]));
    return Object.fromEntries(exercises.map(ex => [ex.id, Math.max(LEG_EXERCISE_IDS.has(ex.id) ? chosen.get(ex.id) ?? 0 : ex.sets, preserved[ex.id] ?? 0)]));
}
export const REGULAR_LEG_SETS = REGULAR_LEG_SETS_A_B;
