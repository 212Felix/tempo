/** Read-only conservative duplicate diagnosis. No deletes or remote writes. */
import type {GarminActivity} from './csv'
export type StoredDuplicateGroup={canonical:GarminActivity;alternates:GarminActivity[];reason:string}
export function activeGarminActivities<T extends GarminActivity>(records:T[]):T[]{return records.filter(x=>!x.duplicateOf)}
export function similarStoredActivity(a:GarminActivity,b:GarminActivity):boolean{
 if(a.id===b.id||a.sport!==b.sport||a.date!==b.date)return false
 if(a.garminActivityId&&b.garminActivityId&&a.garminActivityId===b.garminActivityId)return true
 // Only automatically *suggest* matches when both exact start timestamps exist.
 if(!a.startedAt||!b.startedAt)return false
 const startA=Date.parse(a.startedAt),startB=Date.parse(b.startedAt)
 if(!Number.isFinite(startA)||!Number.isFinite(startB)||Math.abs(startA-startB)>120000)return false
 if(!Number.isFinite(a.durationSeconds)||!Number.isFinite(b.durationSeconds)||Math.abs(a.durationSeconds-b.durationSeconds)>120)return false
 if(a.distanceKm!==undefined&&b.distanceKm!==undefined){
  if(Math.abs(a.distanceKm-b.distanceKm)>Math.max(.3,Math.min(a.distanceKm,b.distanceKm)*.025))return false
 }
 return true
}
export function findStoredDuplicateGroups(records:GarminActivity[]):StoredDuplicateGroup[]{
 const rows=records.filter(x=>x.profileId==='local-primary-profile'&&!x.duplicateOf)
 const visited=new Set<string>()
 const groups:StoredDuplicateGroup[]=[]
 for(const first of rows){
  if(visited.has(first.id))continue
  const matches=rows.filter(next=>!visited.has(next.id)&&similarStoredActivity(first,next))
  if(!matches.length)continue
  const items=[first,...matches].sort((a,b)=>Number(Boolean(b.fitSeriesId))-Number(Boolean(a.fitSeriesId))||a.id.localeCompare(b.id))
  items.forEach(item=>visited.add(item.id))
  groups.push({canonical:items[0],alternates:items.slice(1),reason:'Gleiche Garmin-ID oder nahezu identischer Startzeitpunkt, Sportart und Dauer. Bitte manuell prüfen.'})
 }
 return groups
}
