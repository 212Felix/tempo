import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = p => readFileSync(p,'utf8')
test('Phase 30: sichtbarer Header und Paketversion stimmen überein', () => {
  assert.match(read('src/App.tsx'),/PHASE 38/)
  assert.match(read('src/App.tsx'),/V0\.38/)
  assert.equal(JSON.parse(read('package.json')).version,'0.38.0')
})
test('Phase 30: Readiness ohne Eintrag ist explizit geschützt', () => {
  assert.match(read('src/phase28/adaptive-planner.ts'),/if\s*\(readiness\s*&&\s*readiness\.date/)
})
test('Phase 30: Datenbankname, Schema und Stores unverändert', () => {
  const db = read('src/db/types.ts')
  assert.match(db,/DATABASE_NAME = 'tempo-local'/)
  assert.match(db,/DATABASE_VERSION = 1/)
  assert.match(db,/BACKUP_SCHEMA_VERSION = 1/)
  const stores = db.split('export const STORE_NAMES = [')[1]?.split('] as const')[0]?.match(/'[^']+'/g)
  assert.equal(stores?.length,20)
})
test('Phase 30: Backups werden nur ergänzend eingespielt', () => {
  const storage = read('src/db/storage.ts')
  assert.match(storage,/if\s*\(request\.result === undefined\) store\.add\(item\)/)
  assert.doesNotMatch(storage,/deleteDatabase\s*\(/)
})
test('Phase 30: GitHub aktualisiert Pages nur bei erfolgreichem main-Build', () => {
  const flow = read('.github/workflows/deploy.yml')
  assert.match(flow,/branches:\s*\[main\]/)
  assert.match(flow,/npm run build/)
  assert.match(flow,/needs: build/)
})
