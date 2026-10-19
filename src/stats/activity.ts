import type {GarminActivity} from '../garmin/csv'
import type {CompletedRecord} from '../planning/engine'

export type RideEnvironment='indoor'|'outdoor'|'unknown'
export type StrengthPlace='studio'|'arbeit'
export type RideWithLocation=GarminActivity & {cyclingEnvironment?:RideEnvironment}
export type DoneWithContext=CompletedRecord & {
  externalActivityId?:string; cyclingEnvironment?:RideEnvironment; strengthLocation?:StrengthPlace
}

/** Never assume a generic 'Radfahren' without route/GPS metadata is outdoors. */
export function inferRideEnvironment(ride:Pick<GarminActivity,'title'|'activityType'>):RideEnvironment{
  const str=`${ride.title} ${ride.activityType}`.toLowerCase()
  if(/zwift|virtuell|virtual|indoor|trainer|rolle|tacx|wahoo|spinning|ergometer/.test(str))return 'indoor'
  if(/rennrad|gravel|offroad|mountainbik|mtb|radpendel|straßenrad|road cycling|road bike|outdoor|radwandern|radmarathon/.test(str))return 'outdoor'
  return 'unknown'
}
export function resolvedEnvironment(ride:RideWithLocation,overrides:Record<string,RideEnvironment>):RideEnvironment{
  return overrides[ride.id]??ride.cyclingEnvironment??inferRideEnvironment(ride)
}

/** Avoid CSV/FIT counting the same physical ride twice when older imports created two rows.
 * Conservative: only cross-source matches with very close distance + time. */
export function uniqueImported<T extends RideWithLocation>(items:T[]):T[]{
  const sorted=[...items].sort((a,b)=>Number(Boolean(b.fitSeriesId))-Number(Boolean(a.fitSeriesId)))
  const out:T[]=[]
  for(const a of sorted){
    const duplicate=out.some(b=>a.id===b.id || (
      a.source!==b.source && a.date===b.date && a.sport===b.sport &&
      Number.isFinite(a.durationMin)&&Number.isFinite(b.durationMin) &&
      Math.abs(a.durationMin-b.durationMin)<=Math.max(2,Math.min(a.durationMin,b.durationMin)*.02) &&
      Number.isFinite(a.distanceKm)&&Number.isFinite(b.distanceKm) &&
      Math.abs((a.distanceKm??0)-(b.distanceKm??0))<=Math.max(.25,Math.min(a.distanceKm??0,b.distanceKm??0)*.015)
    ))
    if(!duplicate)out.push(a)
  }
  return out
}

export type RideStat={count:number;km:number;hm:number;minutes:number}
export const emptyStat=():RideStat=>({count:0,km:0,hm:0,minutes:0})
export const addRide=(s:RideStat,r:{distanceKm?:number;elevationM?:number;durationMin?:number})=>{
  s.count++;s.km+=Number.isFinite(r.distanceKm)?Math.max(0,r.distanceKm??0):0
  s.hm+=Number.isFinite(r.elevationM)?Math.max(0,r.elevationM??0):0
  s.minutes+=Number.isFinite(r.durationMin)?Math.max(0,r.durationMin??0):0
}
export function rideSummary(activities:RideWithLocation[],overrides:Record<string,RideEnvironment>,minDate=''){
  const totals:Record<RideEnvironment,RideStat>={indoor:emptyStat(),outdoor:emptyStat(),unknown:emptyStat()}
  for(const a of activities)if(a.sport==='cycling'&&(!minDate||a.date>=minDate))addRide(totals[resolvedEnvironment(a,overrides)],a)
  return totals
}
const cyclingKinds=new Set(['long','endurance','quality','commute','manual-cycling'])
const strengthKinds=new Set(['strength-a','strength-b','strength-c','manual-strength'])
export function unlinkedManualCycling(completed:DoneWithContext[],minDate=''){
  return completed.filter(x=>cyclingKinds.has(x.sessionType??'')&&!x.externalActivityId&&(!minDate||x.date>=minDate))
}
export function strengthSummary(completed:DoneWithContext[],minDate=''){
  const counts={studio:0,arbeit:0,unknown:0}
  for(const x of completed)if(strengthKinds.has(x.sessionType??'')&&(!minDate||x.date>=minDate)){
    if(x.strengthLocation==='studio')counts.studio++
    else if(x.strengthLocation==='arbeit')counts.arbeit++
    else counts.unknown++
  }
  return counts
}
export const deNumber=(n:number,decimals=1)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:decimals}).format(n)
