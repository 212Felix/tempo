import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const module='scripts/verify-data-preservation.mjs';
function check(before,after){
 const d=mkdtempSync(join(tmpdir(),'tempo-preserve-'));
 try{
  const first=join(d,'first.json'),second=join(d,'second.json');
  for(const [path,stores] of [[first,before],[second,after]]) writeFileSync(path,JSON.stringify({format:'tempo-backup',schemaVersion:1,stores}));
  return spawnSync(process.execPath,[module,first,second],{encoding:'utf8',cwd:process.cwd()});
 }finally{rmSync(d,{recursive:true,force:true})}
}
const a={plannedSessions:[{id:'a',title:'Radfahren'}],completedSessions:[{id:'b',durationMin:40}]};
test('Backup-Vergleich akzeptiert nur zusätzliche Einträge',()=>{
 const result=check(a,{plannedSessions:[...a.plannedSessions,{id:'c',title:'Kraft'}],completedSessions:a.completedSessions});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/"added": 1/);
});
test('Backup-Vergleich stoppt bei verschwundenen Einheiten',()=>{
 const result=check(a,{plannedSessions:[],completedSessions:a.completedSessions});
 assert.equal(result.status,1);
 assert.match(result.stdout,/"missing": 1/);
});
test('Backup-Vergleich stoppt bei Überschreibung gleicher ID',()=>{
 const result=check(a,{plannedSessions:[{id:'a',title:'Unbemerkt überschrieben'}],completedSessions:a.completedSessions});
 assert.equal(result.status,1);
 assert.match(result.stdout,/"changed": 1/);
});
test('Backup-Vergleich stoppt bei duplizierten IDs im neuen Export',()=>{
 const result=check(a,{plannedSessions:[a.plannedSessions[0],a.plannedSessions[0]],completedSessions:a.completedSessions});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,/doppelte ID/);
});
