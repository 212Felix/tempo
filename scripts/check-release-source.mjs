#!/usr/bin/env node
/** Static, read-only release safety checks. Do not ship personal training data. */
import {readdirSync,readFileSync,statSync} from 'node:fs'
import {join,relative} from 'node:path'
const root=process.cwd()
const prohibited=[/(^|\/)(tempo-backup|phase.?27.?\+.?daten)/i,/\.(fit|gpx|tcx|activity)$/i,/\/(?:__MACOSX|\.DS_Store)(?:\/|$)/]
const exclusions=new Set(['.git','node_modules','dist','.vite'])
const violations=[]
function walk(path){
 for(const item of readdirSync(path,{withFileTypes:true})){
  if(item.isDirectory()&&exclusions.has(item.name))continue
  const full=join(path,item.name),name=relative(root,full).replaceAll('\\','/')
  if(prohibited.some(re=>re.test('/'+name)))violations.push(name)
  if(item.isDirectory())walk(full)
 }
}
walk(root)
const text=readFileSync(join(root,'src/db/types.ts'),'utf8')
if(!text.includes("DATABASE_NAME = 'tempo-local'")||!text.includes('DATABASE_VERSION = 1')||!text.includes('BACKUP_SCHEMA_VERSION = 1'))
  violations.push('Persistenzvertrag verändert: Datenbankname oder Schemaversion')
const stores=text.split('export const STORE_NAMES = [')[1]?.split('] as const')[0]?.match(/'[^']+'/g)||[]
if(stores.length!==20)violations.push(`Erwartet: 20 Stores; gefunden: ${stores.length}`)
const deploy=readFileSync(join(root,'.github/workflows/deploy.yml'),'utf8')
if(/\bon:\s*\n\s*push:/.test(deploy)||!deploy.includes('workflow_dispatch:'))violations.push('Deployment muss manuell sein, nicht on push')
if(violations.length){console.error('RELEASE STOPP:',violations.join(' | '));process.exit(1)}
console.log('Release-Quellenprüfung: keine privaten Backup-/FIT-/GPX-Dateien, 20 Stores, unveränderter DB-Vertrag, manuelles Deployment.')
