import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {defaultTargetReps,strengthProposal,targetReps,maxTargetReps} from './integration/phase38/strength-progression.js'
import {activityArt} from './integration/phase382/activity-art.js'
const source=f=>readFileSync(f,'utf8')
test('38.2: Standardwiederholungen liegen im oberen Mittel des erlaubten Bereichs',()=>{
 assert.equal(defaultTargetReps('8–10'),9)
 assert.equal(defaultTargetReps('5-6'),6)
 assert.equal(defaultTargetReps('6–10'),8)
 assert.equal(defaultTargetReps('3–3'),3)
 assert.equal(targetReps('8–10'),8)
 assert.equal(maxTargetReps('8–10'),10)
 const fresh=strengthProposal({id:'x',sets:3,reps:'8–10',hold:false},[],'studio','test','2026-10-22')
 assert.equal(fresh.reps,9);assert.equal(fresh.rir,2)
})
test('38.2: sportartspezifische Bildklassifizierung arbeitet ausschließlich mit Aktivitätsmetadaten',()=>{
 const classify=(sessionType,title)=>activityArt({sessionType,title})
 assert.equal(classify('yoga','Yoga'),'yoga')
 assert.equal(classify('strength-c','Kraft C'),'strength')
 assert.equal(classify('manual-swimming','Schwimmen'),'swim')
 assert.equal(classify('running-easy','Easy Run'),'run')
 assert.equal(classify('cycling-endurance','Lockere Z2-Einheit'),'bike')
 assert.equal(classify('manual-golf','Golf'),'golf')
})
test('38.2: Bilddesign nur für Home und Tagestraining, Kalender bleibt ohne Fotos',()=>{
 const app=source('src/App.tsx'),css=source('src/phase382/phase382.css')
 assert.match(app,/tempo382-home-hero/)
 assert.match(app,/page!=='home'&&<img/)
 assert.match(css,/\.page-training/)
 assert.match(css,/\.page-home/)
 assert.doesNotMatch(css,/\.page-calendar\s*\{[^}]*url\(/)
 assert.ok(readdirSync('public/phase382').includes('hero-deer.webp'))
})
test('38.2: Routenwechsel setzt Scrollposition nach dem React-Mount zurück',()=>{
 const app=source('src/App.tsx')
 assert.match(app,/useLayoutEffect\(\(\)=>\{/)
 assert.match(app,/window\.scrollTo\(0,0\)/)
 assert.doesNotMatch(app,/window\.scrollTo\(\{top:0,behavior:'smooth'\}\)/)
})
test('38.2: Version 38.2 ohne Änderung am Datenbankschema und Kalenderhotfix',()=>{
 assert.match(source('src/App.tsx'),/V0\.38\.2/)
 assert.match(source('src/db/types.ts'),/DATABASE_VERSION = 1/)
 assert.match(source('src/App.tsx'),/CalendarSafeguard/)
 assert.match(source('src/phase38/calendar-weeks.ts'),/week/)
})
