/** Transpile only the pure planner dependency graph for node --test (no npm install needed). */
import {createRequire} from 'node:module'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {dirname,join} from 'node:path'
const require=createRequire(import.meta.url)
let ts
try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const files=[
 'src/phase28/periodization.ts','src/phase28/adaptive-planner.ts','src/phase28/strength-dose.ts','src/phase28/calendar-model.ts',
 'src/events/library.ts','src/events/running.ts','src/db/types.ts','src/db/storage.ts',
 'src/blocks/days.ts','src/blocks/library.ts','src/planning/load.ts','src/planning/engine.ts',
 'src/phase31/rest-days.ts','src/phase35/weekly-rhythm.ts','src/planning/availability.ts','src/phase32/fuel-model.ts','src/phase30/fueling.ts','src/phase30/saxon-holidays.ts','src/phase30/weekly-replanner.ts','src/phase30/block-guides.ts',
]
for(const input of files){
 const source=readFileSync(input,'utf8')
 const compiled=ts.transpileModule(source,{fileName:input,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true})
 if(compiled.diagnostics?.length)throw Error(`Syntaxproblem ${input}`)
 const fixed=compiled.outputText.replace(/(from\s+['"]|import\(['"])(\.\.?\/[^'"]+)(['"])/g,(_all,before,file,end)=>`${before}${file}.js${end}`)
 const path=join('tests/integration',input.replace(/^src\//,'' ).replace(/\.ts$/,'.js'))
 mkdirSync(dirname(path),{recursive:true});writeFileSync(path,fixed)
 if(input.startsWith('src/phase28/')){
   const short=join('tests/generated',input.split('/').at(-1).replace(/\.ts$/,'.js'))
   mkdirSync(dirname(short),{recursive:true})
   writeFileSync(short,fixed)
 }
}
