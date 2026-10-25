import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {findAssignmentConflicts} from './integration/phase39/garmin-conflicts.js'
import {isStrengthDraft} from './integration/workouts/strengthDraft.js'
const candidates=[
 {activity:{garminActivityId:'10000',title:'Rennrad Leipzig',date:'2026-10-12'},status:'review'},
 {activity:{garminActivityId:'20000',title:'Radfahrt Leipzig 2',date:'2026-10-12'},status:'review'},
 {activity:{garminActivityId:'30000',title:'Laufen',date:'2026-10-11'},status:'review'},
]
test('Phase40: duplicated FIT assignments list BOTH activities and the shared target',()=>{
 const conflicts=findAssignmentConflicts(candidates,{'10000':'fit-one','20000':'fit-one','30000':'fit-other'})
 assert.equal(conflicts.length,1)
 assert.equal(conflicts[0].targetId,'fit-one')
 assert.deepEqual(conflicts[0].activityIds,['10000','20000'])
 assert.match(conflicts[0].activityNames.join(' '),/Rennrad Leipzig/)
})
test('Phase40: skip or new never falsely count as duplicate FIT matches',()=>{
 assert.deepEqual(findAssignmentConflicts(candidates,{'10000':'fit-one','20000':'skip','30000':'new'}),[])
 assert.deepEqual(findAssignmentConflicts(candidates,{'10000':'fit-one','20000':'fit-two','30000':'fit-three'}),[])
})
test('Phase40: incompatible stored workout draft is rejected',()=>{
 assert.equal(isStrengthDraft({version:1,sessionKey:'x',profileId:'wrong'}),false)
 assert.equal(isStrengthDraft(null),false)
 const draft={version:1,sessionKey:'planned-session',profileId:'local-primary-profile',date:'2026-10-25',plannedId:'planned-session',variant:'A',location:'studio',inputs:{},completedHolds:{},duration:'00:05:00',rpe:'5',notes:'',savedAt:new Date().toISOString()}
 assert.equal(isStrengthDraft(draft),true)
})
test('Phase40: no cloudflare worker or persistence-store migrations',()=>{
 const schema=readFileSync('src/db/types.ts','utf8')
 assert.match(schema,/DATABASE_VERSION = 1/)
 const worker=readFileSync('cloudflare/tempo-garmin-worker/worker.mjs','utf8')
 assert.match(worker,/Accept:\s*['"]\*\/\*['"]/)  // working Garmin token fix remains intact
 const strength=readFileSync('src/workouts/StrengthPanel.tsx','utf8')
 assert.match(strength,/tempo40-pinned-timer/)
 assert.match(strength,/archiveStrengthDraft/)
 const garmin=readFileSync('src/phase39/GarminSyncPanel.tsx','utf8')
 assert.match(garmin,/findAssignmentConflicts/)
})
