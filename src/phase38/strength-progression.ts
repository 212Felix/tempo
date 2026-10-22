import type {Exercise} from '../workouts/catalog'
/** Only compare matching exercise, machine variant and training location. */
export type HistoricalStrengthSet={date:string;sessionKey:string;exerciseId:string;setIndex:number;exerciseVariant?:string;trainingLocation?:string;reps?:number;rir?:number;weightKg?:number;completed?:boolean}
export type StrengthProposal={reps:number;rir:number;holdSeconds:number;weightKg?:number;previousWeight?:number;increased:boolean;reason:string}
export function targetReps(reps:string):number{
 const m=reps.match(/(\d+)\s*[–-]\s*(\d+)/)
 return m?Number(m[1]):Number(reps.match(/\d+/)?.[0]??8)
}
export function maxTargetReps(reps:string):number{
 const m=reps.match(/(\d+)\s*[–-]\s*(\d+)/)
 return m?Number(m[2]):targetReps(reps)
}
/** Phase 38.2: use the upper-middle of a prescribed repetition range as the editable default.
 * Preserve min/max as separate bounds for the training progression logic. */
export function defaultTargetReps(reps:string):number{
 return Math.ceil((targetReps(reps)+maxTargetReps(reps))/2)
}
export function strengthProposal(exercise:Exercise,rows:HistoricalStrengthSet[],location:string,variant:string,onDate:string):StrengthProposal{
 const reps=defaultTargetReps(exercise.reps),holdSeconds=exercise.hold?reps:0
 const result:StrengthProposal={reps:exercise.hold?0:reps,holdSeconds,rir:2,increased:false,reason:'Vorgabe für dieses Programm'}
 const candidates=rows.filter(x=>x.date<onDate&&x.exerciseId===exercise.id&&x.trainingLocation===location&&x.exerciseVariant===variant&&x.weightKg!==undefined&&x.weightKg>0).sort((a,b)=>b.date.localeCompare(a.date))
 const latest=candidates[0]
 if(!latest)return result
 const lastSets=candidates.filter(x=>x.date===latest.date&&x.sessionKey===latest.sessionKey)
 // Only progress if all working sets of a comparable, previously completed session hit the upper rep target and RIR >= 2.
 const sets=lastSets.filter(x=>x.reps!==undefined&&x.weightKg!==undefined)
 const lastWeight=latest.weightKg!
 const achieved=sets.length>=exercise.sets&&sets.every(x=>x.reps!>=maxTargetReps(exercise.reps)&&x.rir!==undefined&&x.rir>=2&&Math.abs(x.weightKg!-lastWeight)<0.01)
 const struggling=sets.length>=exercise.sets&&sets.some(x=>x.reps!<targetReps(exercise.reps)&&x.rir===0)
 const rawIncrement=/c-(?:biceps|triceps|lateral|reverse)|wall-slide|chest-open/.test(exercise.id)?1:2.5
 const inc=Math.min(rawIncrement,Math.max(0.5,lastWeight*0.05))
 const next=achieved?Math.round((lastWeight+inc)*2)/2:struggling?Math.round(lastWeight*0.975*2)/2:lastWeight
 return {...result,previousWeight:lastWeight,weightKg:next,increased:next>lastWeight,reason:next>lastWeight?'Alle vergleichbaren Arbeitssätze am oberen Wiederholungsziel mit mindestens RIR 2.':next<lastWeight?'Vorherige Sätze waren zu schwer: vorsichtige Reduktion.':'Zuletzt verwendetes Gewicht übernommen.'}
}
