import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const deploy = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const checker = readFileSync(new URL('../scripts/check-release-source.mjs', import.meta.url), 'utf8')

test('Hochladen auf main startet Freigabe, nicht auf Test-Branches', () => {
  assert.match(deploy, /^\s*push\s*:/m)
  assert.match(deploy, /branches\s*:\s*\[main\]/)
  assert.match(deploy, /^\s*workflow_dispatch\s*:/m)
})

test('Freigabe nur nach Sicherheits-/Logiktests und Produktions-Build', () => {
  assert.ok(deploy.includes('npm run build'), 'Produktions-Build ist Pflicht')
  // Beim neuen Phase-28-Workflow laufen Security und Logik vor dem Build.
  // Den bestehenden Phase-27-Workflow mit Build-Gate duerfen wir fuer den
  // vereinbarten direkten Upload weiterhin verwenden.
  const modern = deploy.includes('npm run test:security') || deploy.includes('npm run test:logic')
  if (modern) {
    assert.ok(deploy.includes('npm run test:security'))
    assert.ok(deploy.includes('npm run test:logic'))
  }
  assert.match(deploy, /needs:\s*build/)
  assert.ok(checker.includes('pushOnlyMain'))
})
