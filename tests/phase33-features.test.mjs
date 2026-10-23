import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {AVAILABILITY_CHOICES,availabilityFlag} from './integration/planning/availability.js'
const src = file => readFileSync(file,'utf8')
test('Phase 33: vier Dienstmöglichkeiten Kraft, Laufen, Stabi, Yoga mit Symbol',()=>{
 assert.deepEqual(AVAILABILITY_CHOICES.map(x=>x.label),['Kraft','Laufen','Stabi','Yoga'])
 for (const x of AVAILABILITY_CHOICES) assert.ok(x.symbol)
})
test('Phase 33: altes Kraft oder Laufen auf / nach Dienst bleibt verfügbar',()=>{
 assert.equal(availabilityFlag({afterWorkStrength:true},'possibleStrength'),true)
 assert.equal(availabilityFlag({workStrength:true},'possibleStrength'),true)
 assert.equal(availabilityFlag({afterWorkRun:true},'possibleRun'),true)
 assert.equal(availabilityFlag({workRun:true},'possibleRun'),true)
 assert.equal(availabilityFlag({},'possibleYoga'),false)
})
test('Phase 33: explizite Ablehnung übersteuert nur die vereinfachte Planungsverfügbarkeit',()=>{
 assert.equal(availabilityFlag({afterWorkStrength:true,possibleStrength:false},'possibleStrength'),false)
 assert.equal(availabilityFlag({workRun:true,possibleRun:false},'possibleRun'),false)
 assert.equal(availabilityFlag({possibleYoga:true,possibleStabi:true},'possibleYoga'),true)
})
test('Phase 33: alle Diensteditoren bieten dieselben vier Auswahlfelder an',()=>{
 for(const file of ['src/planning/DayShiftEditor.tsx','src/planning/DailyDecisionPanel.tsx','src/db/ReadinessPanel.tsx','src/db/ShiftCalendarPanel.tsx']){
  assert.match(src(file),/AVAILABILITY_CHOICES/)
 }
})
test('Phase 33: Startseite kompakt mit vorhandenem Hirschlogo',()=>{
 assert.match(src('src/App.tsx'),/tempo36-nav-logo/)
 assert.doesNotMatch(src('src/App.tsx'),/Dein Tag\. Deine Leistung\. Deine Erholung\./)
 assert.match(src('src/db/ReadinessPanel.tsx'),/tempo36-readiness-action/)
 assert.match(src('src/planning/DailyDecisionPanel.tsx'),/tempo33-readiness-details/)
})
test('Phase 33: Recovery-Erklärung optional und nie automatisch speichern',()=>{
 assert.match(src('src/planning/TrainingDayPanel.tsx'),/tempo36-rest-trigger/)
 assert.match(src('src/planning/TrainingDayPanel.tsx'),/setRestPreview\(true\)/)
})
test('Phase 33: Fotoaufnahme und Fotomediathek getrennt, weiterhin lokale OCR',()=>{
 const lib=src('src/phase32/FuelLibraryPanel.tsx')
 assert.match(lib,/Foto aufnehmen/);assert.match(lib,/Datei auswählen/)
 assert.match(lib,/capture="environment"/)
 assert.match(lib,/ref=\{libraryRef\} type="file" accept="image\/\*"/)
 assert.match(lib,/await worker\.recognize\(file\)/)
})
test('Phase 33: Release und 20 Stores, unveränderte Schemaversion',()=>{
 assert.match(src('src/App.tsx'),/PHASE 39/)
 assert.equal(JSON.parse(src('package.json')).version,'0.39.0')
 const db=src('src/db/types.ts')
 assert.match(db,/DATABASE_VERSION = 1/)
 assert.match(db,/BACKUP_SCHEMA_VERSION = 1/)
 assert.equal((db.split('STORE_NAMES = [')[1].split('] as const')[0].match(/'[^']+'/g)||[]).length,20)
})
