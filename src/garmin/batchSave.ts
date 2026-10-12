import type {GarminActivity} from './csv'
import type {FitDecoded,FitTrace} from './fit'
import {mergeCsvInto,canAttachFit,type BatchRow} from './batchMatch'
const PROFILE_ID='local-primary-profile'

function createFitRecord(p:FitDecoded,now:string):{activity:GarminActivity;trace:FitTrace}{
  const activityId=`garmin:fit:${PROFILE_ID}:${p.fingerprint.slice(0,32)}`
  const traceId=`garmin:fit-trace:${PROFILE_ID}:${p.fingerprint.slice(0,32)}`
  const trace:FitTrace={id:traceId,profileId:PROFILE_ID,kind:'garmin-fit-trace',createdAt:now,updatedAt:now,activityId,
    sha256:p.fingerprint,fileName:p.fileName,startedAt:p.startedAt,recordCount:p.recordCount,sampleIntervalSeconds:5,
    points:p.records,...(p.elapsedSeconds===undefined?{}:{elapsedSeconds:p.elapsedSeconds}),
    ...(p.timerSeconds===undefined?{}:{timerSeconds:p.timerSeconds}),
    ...(p.movingSeconds===undefined?{}:{movingSeconds:p.movingSeconds})}
  const activity:GarminActivity={id:activityId,createdAt:now,updatedAt:now,profileId:PROFILE_ID,source:'garmin-fit',date:p.date,
    startedAt:p.startedAt,title:`FIT · ${p.fileName.replace(/\.fit$/i,'')}`,sport:p.sport,activityType:p.sport,
    durationMin:Math.round(p.durationSeconds/6)/10,durationSeconds:p.durationSeconds,
    ...(p.distanceKm===undefined?{}:{distanceKm:p.distanceKm}),
    ...(p.elevationM===undefined?{}:{elevationM:p.elevationM}),
    ...(p.avgPowerW===undefined?{}:{avgPowerW:p.avgPowerW}),
    ...(p.avgHrBpm===undefined?{}:{avgHrBpm:p.avgHrBpm}),
    ...(p.maxPowerW===undefined?{}:{maxPowerW:p.maxPowerW}),
    ...(p.maxHrBpm===undefined?{}:{maxHrBpm:p.maxHrBpm}),
    ...(p.avgCadence===undefined?{}:{avgCadence:p.avgCadence}),
    fitSeriesId:traceId,importBatchId:traceId}
  return {activity,trace}
}
export function prepareWrites(rows:BatchRow[],existing:GarminActivity[]):{activities:GarminActivity[];traces:FitTrace[];created:number;merged:number;skipped:number}{
  const now=new Date().toISOString()
  const map=new Map(existing.map(x=>[x.id,x]))
  const traces=new Map<string,FitTrace>()
  let created=0,merged=0,skipped=0
  if(rows.some(x=>x.decision==='review'))throw new Error('Bitte jede auffällige Zeile einzeln bestätigen oder überspringen.')
  // First create new activities, so cross-file merges can reference them.
  for(const r of rows.filter(x=>x.decision==='create')){
    const obj=r.source.kind==='csv'?r.source.activity:createFitRecord(r.source.fit,now).activity
    if(map.has(obj.id))throw new Error(`Bereits vorhanden: ${obj.title}. Bitte Vorschau neu laden.`)
    map.set(obj.id,obj);created++
    if(r.source.kind==='fit'){
      const {trace}=createFitRecord(r.source.fit,now)
      traces.set(trace.id,trace)
    }
  }
  for(const r of rows){
    if(r.decision==='skip'){skipped++;continue}
    if(r.decision==='create')continue
    if(r.decision!=='merge'||!r.matchId)throw new Error('Für das Zusammenführen muss eine Zielaktivität ausgewählt sein.')
    const target=map.get(r.matchId)
    if(!target)throw new Error(`Zielaktivität ${r.matchId} nicht gefunden. Vorschau erneut erstellen.`)
    if(r.source.kind==='csv'){
      map.set(target.id,{...mergeCsvInto(target,r.source.activity),updatedAt:now});merged++
    }else{
      const p=r.source.fit
      if(!canAttachFit(target,p))throw new Error(`Für ${target.title} ist bereits ein FIT-Verlauf vorhanden oder die Sportart stimmt nicht überein.`)
      const {trace}=createFitRecord(p,now)
      traces.set(trace.id,{...trace,activityId:target.id})
      map.set(target.id,{...target,fitSeriesId:trace.id,updatedAt:now});merged++
    }
  }
  // Return only changed records, never overwrite untouched library entries.
  const changed=[...map.values()].filter(x=>!existing.some(y=>y.id===x.id&&y===x))
  return {activities:changed,traces:[...traces.values()],created,merged,skipped}
}
