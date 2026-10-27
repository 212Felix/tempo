import type {GarminActivity} from '../garmin/csv'
import type {TrainingRecord} from '../planning/engine'
/** A safe, unambiguous association is informational and NEVER marks a plan completed. */
export function suggestedPlanMatch(activity:GarminActivity,plans:TrainingRecord[]):string|null{
 const sport=activity.sport
 if(sport!=='running'&&sport!=='cycling')return null
 const matches=plans.filter(p=>p.profileId===activity.profileId&&p.date===activity.date&&p.status==='geplant' &&(sport==='running'?(p.sessionType==='run'||p.sessionType==='manual-running'):(['quality','endurance','long','commute','manual-cycling'].includes(p.sessionType))) &&p.durationMin>0&&Math.abs(p.durationMin-activity.durationMin)<=Math.max(15,p.durationMin*.35))
 return matches.length===1?matches[0].id:null
}
