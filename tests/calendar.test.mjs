import test from 'node:test';
import assert from 'node:assert/strict';
import {WEEK_PATTERN,daysFor,deriveCalendarDay,mondayOf} from './generated/calendar-model.js';
import {adviseStrengthVolume} from './generated/periodization.js';

test('7/14-Tage-Kalender startet montags, Raster ist 3/2/2',()=>{
  assert.equal(mondayOf('2026-10-15'),'2026-10-12');
  assert.equal(daysFor('2026-10-15',7).length,7);
  assert.equal(daysFor('2026-10-15',14).at(-1),'2026-10-25');
  assert.deepEqual(WEEK_PATTERN,[[0,1,2],[3,4],[5,6]]);
});
test('geplantes absolviertes Training erscheint nur einmal',()=>{
  const date='2026-10-15'; const plans=[{id:'a',date,title:'Rad Schwelle',sessionType:'quality',commuteLeg:'rueck'}];
  const completed=[{id:'done1',date,title:'Rad Schwelle',sessionType:'quality',plannedSessionId:'a'}];
  const day=deriveCalendarDay(date,{date,shift:'tagdienst',commute:'beide'},plans,completed);
  assert.equal(day.activities.length,1);
  assert.equal(day.activities[0].done,true);
  assert.equal(day.activities[0].commuteLeg,'rueck');
  assert.equal(day.commuteNote,'Pendeln (Hin)');
});
test('frei gefahrene Rückfahrt erzeugt keine zweite Leistungsaktivität',()=>{
  const date='2026-10-15';const day=deriveCalendarDay(date,{date,shift:'tagdienst',commute:'beide'},[],[{id:'free',date,title:'Schwellentraining',sessionType:'manual-cycling',commuteLeg:'rueck'}]);
  assert.equal(day.activities.length,1);
  assert.equal(day.commuteNote,'Pendeln (Hin)');
});
test('VOLUME empfiehlt weniger Bein-Arbeitssätze, nie Datenmutation',()=>{
  assert.equal(adviseStrengthVolume('VOLUME',12).suggestedLegSets,6);
  assert.equal(adviseStrengthVolume('BASE',12).suggestedLegSets,12);
  assert.equal(adviseStrengthVolume('VOLUME',12).affectsExistingSessions,false);
});
