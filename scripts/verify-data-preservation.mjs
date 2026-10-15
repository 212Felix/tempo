#!/usr/bin/env node
/**
 * Strict read-only safety comparison of TEMPO exports, before vs after an update.
 * Exit code 1 on ANY disappeared or changed existing record. Additional records permitted.
 * Does not import, change or save records anywhere.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [previous,current]=process.argv.slice(2);
if (!previous || !current) {
  console.error('Aufruf: node scripts/verify-data-preservation.mjs backup-vorher.json backup-nachher.json');
  process.exit(2);
}
function load(filename) {
  const data=JSON.parse(readFileSync(filename,'utf8'));
  if (data.format!=='tempo-backup' || data.schemaVersion!==1 || !data.stores || typeof data.stores!=='object')
    throw Error('Ungültiges TEMPO-Backup: '+filename);
  const stores = {};
  for (const [name,records] of Object.entries(data.stores)) {
    if (!Array.isArray(records)) throw Error('Ungültiger Bereich '+name);
    const seen = new Set();
    for (const record of records) {
      if (!record || typeof record!=='object' || Array.isArray(record) || typeof record.id!=='string' || !record.id || seen.has(record.id))
        throw Error('Fehlende/doppelte ID in '+name);
      seen.add(record.id);
    }
    stores[name]=records;
  }
  return stores;
}
const before=load(previous), after=load(current);
const missing=[], changed=[], added=[];
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
for (const [store,items] of Object.entries(before)) {
  if (!Array.isArray(after[store])) { missing.push(`${store}: gesamter Datenbereich fehlt`); continue; }
  const afterById=new Map(after[store].map(item=>[item.id,item]));
  const beforeIds=new Set(items.map(item=>item.id));
  for (const item of items) {
    const newer=afterById.get(item.id);
    if (!newer) { missing.push(`${store}:${item.id}`); continue; }
    if (fingerprint(item)!==fingerprint(newer)) changed.push(`${store}:${item.id}`);
  }
  for (const item of after[store]) if (!beforeIds.has(item.id)) added.push(`${store}:${item.id}`);
}
const report={storesCompared:Object.keys(before).length,missing:missing.length,changed:changed.length,added:added.length,missingExamples:missing.slice(0,10),changedExamples:changed.slice(0,10)};
console.log(JSON.stringify(report,null,2));
if (missing.length || changed.length) { console.error('STOPP: Vorhandene Trainingsdaten fehlen oder wurden verändert!'); process.exit(1); }
console.log('OK: Alle ursprünglichen Datensätze vorhanden und unverändert.');
