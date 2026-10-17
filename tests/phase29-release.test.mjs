import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = p => readFileSync(p,'utf8')
// Legacy file name deliberately preserved because browser uploads don't delete older files.
test('Phase 29 -> 30: Header und Paket zeigen die neue Version', () => {
  assert.match(read('src/App.tsx'),/PHASE 30/)
  assert.match(read('src/App.tsx'),/V0\.30/)
  assert.equal(JSON.parse(read('package.json')).version,'0.30.0')
})
test('Phase 29 -> 30: Readiness bleibt ohne Eintrag sicher', () => {
  assert.match(read('src/phase28/adaptive-planner.ts'),/if\s*\(readiness\s*&&\s*readiness\.date/)
})
test('Phase 29 -> 30: Datenbankname, Schema und 20 Stores identisch', () => {
  const db = read('src/db/types.ts')
  assert.match(db,/DATABASE_NAME = 'tempo-local'/)
  assert.match(db,/DATABASE_VERSION = 1/)
  assert.match(db,/BACKUP_SCHEMA_VERSION = 1/)
  const stores = db.split('export const STORE_NAMES = [')[1]?.split('] as const')[0]?.match(/'[^']+'/g)
  assert.equal(stores?.length,20)
})
test('Phase 29 -> 30: Backup-Import ergaenzt ohne Daten zu loeschen', () => {
  const storage = read('src/db/storage.ts')
  assert.match(storage,/if\s*\(request\.result === undefined\) store\.add\(item\)/)
  assert.doesNotMatch(storage,/deleteDatabase\s*\(/)
})
test('Phase 29 -> 30: GitHub Pages nur nach erfolgreichem Build', () => {
  const flow = read('.github/workflows/deploy.yml')
  assert.match(flow,/branches:\s*\[main\]/)
  assert.match(flow,/npm run build/)
  assert.match(flow,/needs: build/)
})
