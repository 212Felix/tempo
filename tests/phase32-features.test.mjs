import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {adaptiveCarbTarget,piecePrice,followingDay,nutritionFromOcr,suspicionCount,statusForProduct,productUsable,validateEnrichedProduct} from './integration/phase32/fuel-model.js'
const p={id:'fuel-product:x',name:'Testgel',kind:'gel',servingGrams:42,servingUnit:'g',carbsGrams:30,sodiumMg:50,waterMl:0,packageQuantity:12,packageUnit:'piece',packagePriceEuro:30}
const exp=(id,tolerance,productIds=['fuel-product:x'],nextMorning)=>({id,date:id,productIds,tolerance,nextMorning,additionalCarbsGrams:0,notes:'',createdAt:'',updatedAt:''})
test('Phase 32: erste Unverträglichkeit gelb, zwei verschiedene Trainings rot',()=>{
 const first=[exp('e1','red')],twice=[...first,exp('e2','yellow',['fuel-product:x'],'red')]
 assert.equal(statusForProduct(p,first).tone,'yellow')
 assert.equal(statusForProduct(p,first).blocked,false)
 assert.equal(statusForProduct(p,twice).tone,'red')
 assert.equal(productUsable(p,twice),false)
 assert.equal(suspicionCount(p.id,twice),2)
})
test('Phase 32: mehrfache negative Angaben zu derselben Einheit zählen nur einmal',()=>{
 assert.equal(suspicionCount(p.id,[exp('e1','red',['fuel-product:x'],'red')]),1)
})
test('Phase 32: nur tatsächlich verwendete Produkte werden verdächtigt',()=>{
 assert.equal(statusForProduct(p,[exp('e1','red',['anderes-produkt'])]).tone,'unrated')
})
test('Phase 32: manuelle Sperre sofort, gelb nicht gesperrt',()=>{
 assert.equal(statusForProduct({...p,manuallyBlocked:true},[]).blocked,true)
 assert.equal(statusForProduct({...p,manualTolerance:'red'},[]).blocked,true)
 assert.equal(statusForProduct({...p,manualTolerance:'yellow'},[]).blocked,false)
})
test('Phase 32: Preis pro Portion bei Packungen in Stück und Gramm',()=>{
 assert.equal(piecePrice(p),2.5)
 assert.equal(piecePrice({...p,packageQuantity:1000,packageUnit:'g',packagePriceEuro:20}),.84)
 assert.equal(piecePrice({...p,packagePriceEuro:undefined}),null)
})
test('Phase 32: manuelles Label pro 100 g nicht als glattes Glukose-/Fruktose-Verhältnis deuten',()=>{
 assert.equal(nutritionFromOcr('Kohlenhydrate 80 g; davon Zucker 38 g').glucoseFructoseRatio,undefined)
 const n=nutritionFromOcr('Kohlenhydrate 80 g\nEiweiß 1,5 g\nFett 0 g\nSalz 0,5 g')
 assert.equal(n.carbsGrams,80);assert.equal(n.proteinGrams,1.5);assert.equal(n.sodiumMg,200)
})
test('Phase 32: einen Tag nach Training',()=>{
 assert.equal(followingDay('2026-12-31'),'2027-01-01')
})
test('Phase 32: adaptiv höchstens +5 g/h erst nach 2 guten Trainingserfahrungen',()=>{
 const good=[{...exp('e1','green',['fuel-product:x'],'green'),actualCarbsHour:80},{...exp('e2','green',['fuel-product:x'],'green'),actualCarbsHour:78}]
 assert.equal(adaptiveCarbTarget(75,good,180).goal,80)
 assert.equal(adaptiveCarbTarget(75,[good[0]],180).goal,75)
 assert.equal(adaptiveCarbTarget(0,good,30).goal,0)
})
test('Phase 32: bestehende Produkte ohne optionale Felder bleiben gültig',()=>{
 assert.equal(validateEnrichedProduct({id:p.id,name:p.name,kind:p.kind,servingGrams:p.servingGrams,carbsGrams:p.carbsGrams,sodiumMg:p.sodiumMg,waterMl:p.waterMl}),null)
})
test('Phase 32: Datenbankvertrag und lokale Sicherung unverändert',()=>{
 const db=readFileSync('src/db/types.ts','utf8')
 assert.match(db,/DATABASE_VERSION = 1/);assert.match(db,/BACKUP_SCHEMA_VERSION = 1/)
 assert.equal((db.split('STORE_NAMES = [')[1].split('] as const')[0].match(/'[^']+'/g)||[]).length,20)
 const app=readFileSync('src/App.tsx','utf8')
 assert.match(app,/PHASE 34/);assert.match(app,/FuelLibraryPanel/)
})
