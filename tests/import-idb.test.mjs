/** Test the real Phase-28 import function against an asynchronous transactional IDB stub.
 * No user's backup or browser is ever modified here. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { importTempoBackup } from './integration/db/storage.js'
import { STORE_NAMES } from './integration/db/types.js'

function mockDatabase(initial={}) {
  const live = Object.fromEntries(STORE_NAMES.map(name=>[name,new Map((initial[name]??[]).map(x=>[x.id,structuredClone(x)]))]))
  globalThis.indexedDB = { open() {
    const request={result:{},onsuccess:null,onerror:null,onblocked:null}
    request.result={ close(){},transaction(names){
      const buffer=Object.fromEntries(names.map(n=>[n,new Map(live[n])]))
      let pending=0,aborted=false,completed=false
      const tx={oncomplete:null,onerror:null,onabort:null,error:null,abort(){aborted=true;queueMicrotask(()=>tx.onabort?.())},objectStore(name){
        const map=buffer[name]
        function make(work){
          const r={onsuccess:null,onerror:null,result:undefined}
          pending++
          queueMicrotask(()=>{
            if(aborted)return
            try{r.result=work();r.onsuccess?.();pending--
              if(pending===0 && !completed){completed=true;queueMicrotask(()=>{if(!aborted){for(const n of names)live[n]=buffer[n];tx.oncomplete?.()}})}
            }catch(err){pending--;aborted=true;tx.error=err;tx.onerror?.()}
          })
          return r
        }
        return {get(id){return make(()=>structuredClone(map.get(id)))},add(record){return make(()=>{if(map.has(record.id))throw Error('Duplicate id');map.set(record.id,structuredClone(record));return record.id})}}
      }}
      return tx
    }}
    queueMicrotask(()=>request.onsuccess?.())
    return request
  }}
  return live
}
function backup(additions={}) {
  return {format:'tempo-backup',schemaVersion:1,exportedAt:'2026-10-15T17:14:10.812Z',
    stores:Object.fromEntries(STORE_NAMES.map(name=>[name,additions[name]??[]]))}
}
test('Phase-28 Backup-Import fügt fehlende IDs hinzu, lässt ältere vorhandene Werte unverändert',async()=>{
  const existing={id:'manual-old',profileId:'profile',date:'2026-10-15',title:'Meine aktuelle Radausfahrt',notes:'Heute geändert'}
  const db=mockDatabase({plannedSessions:[existing]})
  await importTempoBackup(backup({plannedSessions:[{id:'manual-old',title:'Veraltetes Backup',notes:'Alt'}, {id:'manual-new',date:'2026-10-16',title:'Neue Einheit'}]}))
  assert.deepEqual(db.plannedSessions.get('manual-old'),existing)
  assert.equal(db.plannedSessions.get('manual-new')?.title,'Neue Einheit')
  assert.equal(db.plannedSessions.size,2)
})
test('Phase-28 Backup-Import lehnt doppelte IDs ab und verändert nichts',async()=>{
  const existing={id:'manual-old',title:'Aktuell'}
  const db=mockDatabase({plannedSessions:[existing]})
  await assert.rejects(importTempoBackup(backup({plannedSessions:[{id:'same'}, {id:'same'}]})),/doppelter Datensatz/)
  assert.equal(db.plannedSessions.size,1)
  assert.deepEqual(db.plannedSessions.get('manual-old'),existing)
})
