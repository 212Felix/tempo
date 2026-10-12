import type {GarminActivity} from '../garmin/csv'
import type {DoneWithContext,RideStat} from './activity'
import {addRide,emptyStat} from './activity'

export type SwimStats={garmin:RideStat;manual:RideStat;combined:RideStat;possibleDuplicates:number}
/** Garmin-imports and manual swim completions share the existing DB.
 * An already-linked completion and a strong same-day/duration/distance match
 * are not added a second time. Flag ambiguous matches for review. */
export function swimSummary(imported:GarminActivity[],completed:DoneWithContext[],since=''):SwimStats{
 const garmin=emptyStat(),manual=emptyStat(),combined=emptyStat()
 const swims=imported.filter(x=>x.sport==='swimming'&&(!since||x.date>=since))
 for(const x of swims){addRide(garmin,x);addRide(combined,x)}
 let possibleDuplicates=0
 for(const session of completed){
   if(session.sessionType!=='manual-swimming'||(since&&session.date<since))continue
   addRide(manual,session)
   const linked=Boolean(session.externalActivityId&&swims.some(x=>x.id===session.externalActivityId))
   const possible=swims.some(x=>x.date===session.date && typeof x.distanceKm==='number' && typeof session.distanceKm==='number' &&
     Math.abs(x.distanceKm-session.distanceKm)<=.05 &&
     Number.isFinite(x.durationMin) && Number.isFinite(session.durationMin) &&
     Math.abs(x.durationMin-session.durationMin!)<=1.5)
   if(linked||possible){if(possible&&!linked)possibleDuplicates++;continue}
   addRide(combined,session)
 }
 return {garmin,manual,combined,possibleDuplicates}
}
