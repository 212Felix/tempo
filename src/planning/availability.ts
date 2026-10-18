import type {ShiftRecord} from './engine'

// Keep legacy location-specific flags intact. Explicit day availability in Phase 33
// takes precedence over them, without rewriting where earlier training took place.
export type AvailabilityKey = 'possibleStrength'|'possibleRun'|'possibleYoga'|'possibleStabi'
export const AVAILABILITY_CHOICES:readonly {key:AvailabilityKey;label:string;symbol:string}[] = [
 {key:'possibleStrength',label:'Kraft',symbol:'🏋️'},
 {key:'possibleRun',label:'Laufen',symbol:'🏃'},
 {key:'possibleStabi',label:'Stabi',symbol:'🤸'},
 {key:'possibleYoga',label:'Yoga',symbol:'🧘'},
]
export function availabilityFlag(shift:Partial<ShiftRecord>|undefined,key:AvailabilityKey):boolean {
 if(!shift) return false
 const explicit=shift[key]
 if(typeof explicit==='boolean')return explicit
 if(key==='possibleStrength')return Boolean(shift.workStrength||shift.afterWorkStrength)
 if(key==='possibleRun')return Boolean(shift.workRun||shift.afterWorkRun)
 return false
}
