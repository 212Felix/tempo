import type {GarminActivity} from './csv'
import type {FitDecoded,FitTrace} from './fit'

export type BatchSource = {kind:'csv';activity:GarminActivity}|{kind:'fit';fit:FitDecoded}
export type Decision = 'create'|'merge'|'skip'|'review'
export type BatchRow = {key:string;fileName:string;source:BatchSource;label:string;date:string;sport:GarminActivity['sport'];distanceKm?:number;durationSeconds:number;
  proposed:Decision;decision:Decision;matchId:string;matches:{id:string;label:string}[];reason:string}

function minutes(raw:string|undefined):number|undefined {
  if(!raw)return undefined
  const ms=Date.parse(raw)
  return Number.isFinite(ms)?ms/60000:undefined
}
export function similar(a:Pick<GarminActivity,'date'|'startedAt'|'sport'|'distanceKm'|'durationSeconds'>,
  b:Pick<GarminActivity,'date'|'startedAt'|'sport'|'distanceKm'|'durationSeconds'>):boolean {
  if(a.sport!==b.sport)return false
  if(Math.abs(Date.parse(a.date+'T12:00:00Z')-Date.parse(b.date+'T12:00:00Z'))>86400000)return false
  if(a.distanceKm===undefined || b.distanceKm===undefined)return false
  if(Math.abs(a.distanceKm-b.distanceKm)>Math.max(0.45,Math.max(a.distanceKm,b.distanceKm)*0.012))return false
  if(Math.abs(a.durationSeconds-b.durationSeconds)>Math.max(180,Math.max(a.durationSeconds,b.durationSeconds)*0.055))return false
  // A morning and an evening commute with similar duration are not the same ride.
  const t1=minutes(a.startedAt),t2=minutes(b.startedAt)
  if(t1!==undefined&&t2!==undefined&&Math.abs(t1-t2)>45)return false
  return true
}
/** Broader safety alert for CSV moving-time vs FIT elapsed/timer-time discrepancies. Never auto-merge. */
export function possibleDuplicate(a:Pick<GarminActivity,'date'|'startedAt'|'sport'|'distanceKm'|'durationSeconds'>,
 b:Pick<GarminActivity,'date'|'startedAt'|'sport'|'distanceKm'|'durationSeconds'>):boolean {
 if(a.sport!==b.sport)return false
 if(Math.abs(Date.parse(a.date+'T12:00:00Z')-Date.parse(b.date+'T12:00:00Z'))>86400000)return false
 const t1=minutes(a.startedAt),t2=minutes(b.startedAt)
 if(t1!==undefined&&t2!==undefined&&Math.abs(t1-t2)>90)return false
 if(a.distanceKm!==undefined&&b.distanceKm!==undefined){
   if(Math.abs(a.distanceKm-b.distanceKm)>Math.max(1.5,Math.max(a.distanceKm,b.distanceKm)*.025))return false
   if(t1!==undefined&&t2!==undefined)return true // time + distance outweigh pause differences
   return Math.abs(a.durationSeconds-b.durationSeconds)<=Math.max(3600,Math.max(a.durationSeconds,b.durationSeconds)*.4)
 }
 return t1!==undefined&&t2!==undefined&&Math.abs(t1-t2)<=10&&Math.abs(a.durationSeconds-b.durationSeconds)<300
}
function asActivity(src:BatchSource):GarminActivity {
  if(src.kind==='csv')return src.activity
  const p=src.fit
  return {id:`garmin:fit:local-primary-profile:${p.fingerprint.slice(0,32)}`,createdAt:'',updatedAt:'',profileId:'local-primary-profile',
    source:'garmin-fit',date:p.date,startedAt:p.startedAt,title:`FIT · ${p.fileName.replace(/\.fit$/i,'')}`,sport:p.sport,
    activityType:p.sport,durationMin:p.durationSeconds/60,durationSeconds:p.durationSeconds,distanceKm:p.distanceKm,
    elevationM:p.elevationM,avgPowerW:p.avgPowerW,avgHrBpm:p.avgHrBpm,importBatchId:''}
}
export function inspectBatch(sources:{fileName:string;source:BatchSource}[],existing:GarminActivity[],traces:FitTrace[]):BatchRow[] {
  // CSV first: within one selection a FIT may then point to the staged CSV entry.
  const ordered=[...sources].sort((a,b)=>Number(a.source.kind==='fit')-Number(b.source.kind==='fit'))
  const seen=new Map<string,string>()
  const available=[...existing]
  const rows:BatchRow[]=[]
  for(let i=0;i<ordered.length;i++){
    const {fileName,source}=ordered[i]
    const a=asActivity(source)
    const identity=source.kind==='fit'?'fit:'+source.fit.fingerprint:'csv:'+a.id
    const identical=source.kind==='fit'
      ? traces.find(t=>t.sha256===source.fit.fingerprint)
      : existing.find(x=>x.id===a.id || x.csvId===a.id)
    const alreadyInSelection=seen.get(identity)
    const possibles=available.filter(x=>x.id!==a.id&&possibleDuplicate(x,a)).map(x=>({id:x.id,
      label:`${x.date} · ${x.title} · ${x.distanceKm?.toFixed(1)??'–'} km`}))
    let decision:Decision='create',reason='Neu: Kein passender Eintrag gefunden.'
    if(identical||alreadyInSelection){decision='skip';reason='Exaktes Duplikat: bereits gespeichert oder in dieser Auswahl vorhanden.'}
    else if(possibles.length){decision='review';reason='Mögliche Überschneidung: vor dem Speichern einzeln entscheiden.'}
    rows.push({key:'row-'+i,fileName,source,label:a.title,date:a.date,sport:a.sport,distanceKm:a.distanceKm,
      durationSeconds:a.durationSeconds,proposed:decision,decision,
      matchId:possibles.length===1?possibles[0].id:'',matches:possibles,reason})
    seen.set(identity,a.id)
    if(!identical&&!alreadyInSelection)available.push(a)
  }
  return rows
}
export function mergeCsvInto(original:GarminActivity,csv:GarminActivity):GarminActivity {
  const fields: (keyof GarminActivity)[] = ['distanceKm','elevationM','avgPowerW','maxPowerW','normalizedPowerW',
    'avgHrBpm','maxHrBpm','avgCadence','avgSpeedKmh','calories','startedAt']
  const result:GarminActivity={...original,csvId:csv.id}
  if(/^(FIT\s*[·:\-]|\d+_ACTIVITY)/i.test(original.title))result.title=csv.title
  if(!result.activityType || result.activityType===result.sport)result.activityType=csv.activityType
  for(const field of fields){if((result as Record<string,unknown>)[field]===undefined && (csv as Record<string,unknown>)[field]!==undefined)
    (result as Record<string,unknown>)[field]=(csv as Record<string,unknown>)[field]}
  return result
}
export function canAttachFit(target:GarminActivity,fit:FitDecoded):boolean {
  return target.sport===fit.sport && typeof target.fitSeriesId!=='string'
}
