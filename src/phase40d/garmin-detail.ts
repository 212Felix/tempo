import {openTempoDatabase,listRecords} from '../db/storage'
import type {GarminActivity} from '../garmin/csv'
import {decodeFitFile,type FitTrace} from '../garmin/fit'
import {fitFromZip} from './zip-fit'
import {validateBridgeUrl} from '../phase39/garmin-sync'

export async function addGarminFitDetail(endpoint:string,secret:string,activity:GarminActivity):Promise<{saved:boolean;message:string}>{
 if(!activity.garminActivityId||!/^\d{5,20}$/.test(activity.garminActivityId)||activity.fitSeriesId)return {saved:false,message:'FIT-Messreihe bereits vorhanden oder Garmin-ID fehlt.'}
 const origin=validateBridgeUrl(endpoint)
 if(!origin||secret.length<24)throw Error('Garmin-Zugang fehlt.')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),40_000)
 let bytes:ArrayBuffer
 try{
  const response=await fetch(`${origin}/v1/activity-file?id=${encodeURIComponent(activity.garminActivityId)}`,{headers:{Authorization:`Bearer ${secret}`,Accept:'application/zip'},cache:'no-store',signal:controller.signal})
  if(!response.ok)throw Error(`Garmin-FIT nicht verfügbar (HTTP ${response.status}).`)
  const reported=Number(response.headers.get('Content-Length')??0)
  if(reported>75_000_000)throw Error('FIT-Archiv zu groß.')
  bytes=await response.arrayBuffer()
 }finally{clearTimeout(timer)}
 const file=await fitFromZip(bytes,`garmin-${activity.garminActivityId}.fit`)
 const parsed=await decodeFitFile(file)
 if(parsed.sport!==activity.sport||parsed.date!==activity.date)throw Error('FIT-Datei passt nicht zu Datum/Sportart der Aktivität; nichts gespeichert.')
 const now=new Date().toISOString(),traceId=`garmin:auto-fit-trace:${activity.garminActivityId}`
 const trace:FitTrace={id:traceId,kind:'garmin-fit-trace',profileId:activity.profileId||'local-primary-profile',createdAt:now,updatedAt:now,activityId:activity.id,sha256:parsed.fingerprint,fileName:file.name,startedAt:parsed.startedAt,recordCount:parsed.recordCount,sampleIntervalSeconds:5,points:parsed.records,elapsedSeconds:parsed.elapsedSeconds,timerSeconds:parsed.timerSeconds,movingSeconds:parsed.movingSeconds}
 const traces=await listRecords<FitTrace>('performanceEntries')
 if(traces.some(x=>x.kind==='garmin-fit-trace'&&x.sha256===trace.sha256))return {saved:false,message:'Diese Messreihe liegt bereits vor und wird nicht dupliziert.'}
 const db=await openTempoDatabase()
 await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['performanceEntries','externalActivities'],'readwrite'),ext=tx.objectStore('externalActivities'),performance=tx.objectStore('performanceEntries')
  const get=ext.get(activity.id)
  get.onsuccess=()=>{
   const prev=get.result as GarminActivity|undefined
   if(!prev||prev.fitSeriesId||prev.garminActivityId!==activity.garminActivityId){tx.abort();return}
   performance.add(trace)
   ext.put({...prev,fitSeriesId:traceId,updatedAt:now,...(prev.elevationM===undefined&&parsed.elevationM!==undefined?{elevationM:parsed.elevationM}:{}),...(prev.distanceKm===undefined&&parsed.distanceKm!==undefined?{distanceKm:parsed.distanceKm}:{})})
  }
  tx.oncomplete=()=>{db.close();resolve()}
  tx.onerror=()=>{db.close();reject(tx.error??Error('FIT-Detailspeicherung fehlgeschlagen.'))}
  tx.onabort=()=>{db.close();reject(Error('Aktivität wurde gleichzeitig verändert oder bereits verknüpft.'))}
 })
 window.dispatchEvent(new Event('tempo:garmin-import-change'))
 return {saved:true,message:`FIT-Verlauf mit ${parsed.records.length} Zeitpunkten gespeichert (Watt, Puls, Höhenprofil und GPS soweit aufgezeichnet).`}
}
