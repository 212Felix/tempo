/** Sichtbare Kalenderwochen ohne Zugriff auf nicht vorhandene Wochentage.
 * Rein lesende Darstellung: keinerlei Schreibzugriff auf Dienste oder Trainings.
 */
import { mondayOf } from '../phase28/calendar-model.js';
export function calendarWeeks(records) {
    const weeks = [];
    let lastMonday;
    for (const record of records) {
        const monday = mondayOf(record.date);
        if (monday !== lastMonday) {
            weeks.push([]);
            lastMonday = monday;
        }
        weeks[weeks.length - 1].push(record);
    }
    return weeks;
}
/** Volle Wochen: Mo–Mi / Do–Fr / Sa–So (3/2/2).
 * Angebrochene Wochen enthalten nur die tatsaechlich sichtbaren Tage.
 */
export function calendarWeekRows(week) {
    return [week.slice(0, 3), week.slice(3, 5), week.slice(5, 7)].filter(row => row.length > 0);
}
