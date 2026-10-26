import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {SPORT_EXERCISES,exercisePool,validSessionExercises} from './integration/workouts/sportExercises.js'
import {STRENGTH} from './integration/workouts/catalog.js'
import {prescription} from './integration/planning/session-prescription.js'
import {orderGoalsChronologically} from './integration/events/library.js'
import {deriveAdaptiveWeeks} from './integration/phase28/adaptive-planner.js'
import {activeGarminActivities,findStoredDuplicateGroups} from './integration/garmin/stored-duplicates.js'

const now='2026-10-26'
const baseEvent=(id,date,status='bestaetigt')=>({id,name:id,profileId:'local-primary-profile',date,priority:'B',status,kind:'challenge',vacation:'nicht_noetig'})
const session=(id,sessionType,durationMin,target='')=>({id,date:now,profileId:'local-primary-profile',sessionType,title:sessionType==='endurance'?'Radeln':sessionType,durationMin,priority:'SOLL',description:'',target,status:'geplant'})

test('Phase40B: conservative sport-specific selection covers all four foci and unilateral safety',()=>{
 assert.ok(SPORT_EXERCISES.length>=12)
 for(const focus of ['Radfahren','Laufen','Explosivkraft','Rumpfstabilität'])assert.ok(SPORT_EXERCISES.some(x=>x.focus===focus))
 assert.match(SPORT_EXERCISES.find(x=>x.name==='Bulgarian Split Squat').cue,/Einbeinig \/ unilateral/)
 assert.deepEqual(new Set(SPORT_EXERCISES.map(x=>x.id)).size,SPORT_EXERCISES.length)
})
test('Phase40B: exercise selection can extend existing sessions without renaming base exercises',()=>{
 const pool=exercisePool(STRENGTH.C.exercises)
 assert.ok(pool.find(x=>x.id==='c-row'))
 assert.ok(pool.find(x=>x.id==='sport-hexbar'))
 assert.equal(pool.filter(x=>x.id==='c-row').length,1)
 assert.equal(validSessionExercises(STRENGTH.A.exercises),true)
 assert.equal(validSessionExercises([...STRENGTH.A.exercises,SPORT_EXERCISES[0]]),true)
 assert.equal(validSessionExercises([]),false)
})
test('Phase40B: upcoming goals always precede expired/completed even if unsorted in database',()=>{
 const goals=[baseEvent('Ötztaler RM','2027-08-29'),baseEvent('Vorbei','2026-08-01'),baseEvent('Mallorca','2027-04-30'),baseEvent('Cooper','2027-03-31'),baseEvent('Fertig','2026-02-01','abgeschlossen')]
 const ordered=orderGoalsChronologically(goals,now)
 assert.deepEqual(ordered.slice(0,3).map(g=>g.name),['Cooper','Mallorca','Ötztaler RM'])
 assert.deepEqual(ordered.slice(3).map(g=>g.name),['Fertig','Vorbei'].sort((a,b)=>goals.find(x=>x.name===a).date.localeCompare(goals.find(x=>x.name===b).date)))
 assert.deepEqual(goals.map(x=>x.name)[0],'Ötztaler RM') // input remains unchanged
})
test('Phase40B: precise endurance guidance uses ONLY stored FTP and HRmax',()=>{
 const lines=prescription(session('ride','endurance',120),{id:'profile',ftpWatts:250,maxHeartRateBpm:180})
 assert.match(lines.join(' · '),/120 min/)
 assert.match(lines.join(' · '),/140–188 W/)
 assert.match(lines.join(' · '),/117–135 bpm/)
 const missing=prescription(session('ride','endurance',120))
 assert.match(missing.join(' '),/Watt nach FTP-Eingabe/)
 assert.doesNotMatch(missing.join(' '),/\d{2,3}–\d{2,3} W/)
})
test('Phase40B: specific recorded intervals preserved, not invented or doubled',()=>{
 const workout={...session('intervals','quality',60),workoutSteps:[{id:'a',title:'Interval 1',seconds:480,effort:'work',lowFtp:.8,highFtp:.9}]}
 const text=prescription(workout,{id:'profile',ftpWatts:250}).join(' ')
 assert.match(text,/Interval 1: 8 min/)
 assert.match(text,/200–225 W/)
 assert.equal(text.match(/Interval 1/g).length,1)
})
test('Phase40B: adaptive legs reduced by high cycling/running volume without writing to plan',()=>{
 const entries=[session('long','long',360),session('ride','endurance',180)]
 const before=entries.map(x=>({...x}))
 const result=deriveAdaptiveWeeks({start:now,weeks:1,events:[],planned:entries})[0]
 assert.ok(result.legSets<20)
 assert.ok(result.notes.some(x=>x.includes('Rad- und Laufzeit')))
 assert.deepEqual(entries,before)
})
test('Phase40B: readiness symptoms and deployment shifts reduce dose only as recommendation',()=>{
 const result=deriveAdaptiveWeeks({start:now,weeks:1,events:[],shifts:{'2026-10-26':{id:'shift',profileId:'local-primary-profile',date:'2026-10-26',shift:'einsatz'}},readiness:{id:'ready',date:now,profileId:'local-primary-profile',illness:'ja'},})[0]
 assert.equal(result.qualityLimit,0)
 assert.ok(result.legSets<20)
 assert.ok(result.notes.some(x=>x.includes('Erholung')))
})
const garmin=(id,startedAt,durationSeconds=3600,source='garmin-fit')=>({id,profileId:'local-primary-profile',source,date:'2026-10-25',title:id,sport:'cycling',startedAt,durationSeconds,durationMin:durationSeconds/60,distanceKm:42,importBatchId:'fit',createdAt:'',updatedAt:''})
test('Phase40B: duplicate review requires corroborating time and duration',()=>{
 const a=garmin('fit','2026-10-25T08:00:00Z')
 const b=garmin('personal','2026-10-25T08:00:05Z',3598,'garmin-personal')
 const c=garmin('unrelated','2026-10-25T15:00:00Z')
 const groups=findStoredDuplicateGroups([a,b,c])
 assert.equal(groups.length,1)
 assert.equal(groups[0].alternates.length,1)
 assert.ok(groups[0].alternates.some(x=>x.id==='personal'))
})
test('Phase40B: soft archive hides only from analytics and retains original bytes and FIT references',()=>{
 const a={...garmin('fit','2026-10-25T08:00:00Z'),fitSeriesId:'trace1'}
 const b={...garmin('other','2026-10-25T08:00:02Z'),duplicateOf:a.id,fitSeriesId:'trace2'}
 const rows=[a,b]
 assert.deepEqual(activeGarminActivities(rows).map(x=>x.id),['fit'])
 assert.equal(rows.length,2)
 assert.equal(rows[1].fitSeriesId,'trace2')
 assert.deepEqual(findStoredDuplicateGroups(rows),[])
})
test('Phase40B: published code retains Phase40A drafts, Garmin auth and original data schema',()=>{
 const strength=readFileSync('src/workouts/StrengthPanel.tsx','utf8')
 assert.match(strength,/archiveStrengthDraft/)
 assert.match(strength,/completedHolds,equipment,exercises/)
 assert.match(strength,/swapExercise/)
 assert.match(readFileSync('src/phase40b/phase40b.css','utf8'),/font-size:16px!important/)
 assert.match(readFileSync('src/garmin/GarminLibraryPanel.tsx','utf8'),/StoredDuplicatesPanel/)
 assert.match(readFileSync('src/db/types.ts','utf8'),/DATABASE_VERSION = 1/)
 assert.match(readFileSync('cloudflare/tempo-garmin-worker/worker.mjs','utf8'),/Accept:\s*['"]\*\/\*['"]/) 
})
