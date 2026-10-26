/** Best-effort syntax check. Does not replace tsc -b and Vite build. */
import {createRequire} from 'node:module'
import {readdirSync,readFileSync} from 'node:fs'
const require=createRequire(import.meta.url)
let ts
try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
let count=0
const problems=[]
function scan(dir){
 for(const e of readdirSync(dir,{withFileTypes:true})){
  const path=`${dir}/${e.name}`
  if(e.isDirectory())scan(path)
  else if(/\.tsx?$/.test(path)){
   const result=ts.transpileModule(readFileSync(path,'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true})
   count++
   for(const d of result.diagnostics??[])if(d.category===ts.DiagnosticCategory.Error)problems.push(`${path}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`)
  }
 }
}
scan('src')
if(problems.length){console.error(problems.join('\n'));process.exitCode=1}
else console.log(`Syntax für ${count} TS-/TSX-Dateien geprüft (kein vollständiger Produktions-Build).`)
