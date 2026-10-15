import test from 'node:test'
import assert from 'node:assert/strict'
import {suggestedStrengthSets,REGULAR_LEG_SETS} from './generated/strength-dose.js'
const A=[{id:'squat',sets:3},{id:'rdl',sets:3},{id:'row',sets:3},{id:'incline',sets:3},{id:'copenhagen',sets:2},{id:'side-abd',sets:2}]
test('Normale Kraftwoche lässt Vorlagen unverändert',()=>{
 const dose=suggestedStrengthSets(A,REGULAR_LEG_SETS)
 assert.equal(dose.squat,3);assert.equal(dose.rdl,3);assert.equal(dose.row,3)
})
test('Volumenwoche halbiert Beinvolumen pro Woche, Oberkörper gleich',()=>{
 const dose=suggestedStrengthSets(A,10)
 assert.equal(dose.squat+dose.rdl+dose.copenhagen+dose['side-abd'],5)
 assert.equal(dose.row,3); assert.equal(dose.incline,3)
})
test('Bestehende Protokollsätze werden angezeigt, nicht versteckt',()=>{
 const already={squat:3,rdl:4};const before=JSON.stringify(already)
 const dose=suggestedStrengthSets(A,8,already)
 assert.equal(dose.squat,3);assert.equal(dose.rdl,4)
 assert.equal(JSON.stringify(already),before)
})
test('Recovery empfiehlt keine neuen Beinsätze, bewahrt absolvierte',()=>{
 const dose=suggestedStrengthSets(A,0,{squat:2})
 assert.equal(dose.squat,2);assert.equal(dose.rdl,0);assert.equal(dose.row,3)
})
