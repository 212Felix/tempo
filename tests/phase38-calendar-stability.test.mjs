import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {calendarWeeks,calendarWeekRows} from './integration/phase38/calendar-weeks.js'
import {addDays} from './integration/phase28/calendar-model.js'

const visible=(start,length)=>Array.from({length},(_,i)=>({date:addDays(start,i)}))

test('Kalender-Hotfix: alle Startwochentage bei 10-Tage-Ansicht',()=>{
 for(let offset=0;offset<7;offset++){
  const days=visible(addDays('2026-10-19',offset),10)
  const weeks=calendarWeeks(days)
  assert.deepEqual(weeks.flatMap(w=>calendarWeekRows(w).flat()),days)
  assert.ok(weeks.every(w=>w.length>0&&w.length<=7&&w[0]?.date&&w[w.length-1]?.date))
  assert.ok(weeks.every(w=>calendarWeekRows(w).length>0))
 }
})
test('Kalender-Hotfix: 7/14 Tage, Jahreswechsel und leerer Kalender',()=>{
 for(const start of ['2026-10-21','2026-12-30','2027-01-01','2027-08-29']){
  for(const count of [1,2,3,4,5,6,7,10,14,21]){
   const days=visible(start,count)
   assert.deepEqual(calendarWeeks(days).flatMap(w=>calendarWeekRows(w).flat()),days)
  }
 }
 assert.deepEqual(calendarWeeks([]),[])
 assert.deepEqual(calendarWeekRows([]),[])
 assert.deepEqual(calendarWeekRows(visible('2026-10-19',7)).map(x=>x.length),[3,2,2])
})
test('Kalender-Hotfix: Hauptkomponente verwendet keine festen Wochenindizes',()=>{
 const board=readFileSync('src/phase34/CalendarBoard.tsx','utf8')
 assert.ok(board.includes('calendarWeeks(records)'))
 assert.ok(board.includes('calendarWeekRows(week)'))
 assert.ok(board.includes('week[week.length-1].date'))
 assert.doesNotMatch(board,/week\[6\]\.date/)
 const app=readFileSync('src/App.tsx','utf8')
 assert.match(app,/CalendarSafeguard onBack/)
 assert.match(app,/V0\.39/)
})
