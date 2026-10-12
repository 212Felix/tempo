import type {TempoRecord} from '../db/types'
/** Saved boundaries in percent. Recalculate displayed W/bpm if FTP / max HR changes. */
export type ZonePreferences=TempoRecord & {powerUpperPct:number[];hrUpperPct:number[]}
export const ZONE_SETTINGS_ID='cycling-zones:local-primary-profile'
export const RIDE_SETTINGS_ID='cycling-environments:local-primary-profile'
// Generic FTP-oriented starter values, editable to match a Garmin profile.
export const POWER_DEFAULT=[55.5,73,90,104.5,119.5,150.6]
export const HR_DEFAULT=[60,70,80,90]
export const powerColor=['#8c9eb1','#619fc9','#59ae91','#c9b75e','#d99058','#d76d72','#ac79c4']
export const heartColor=['#8c9eb1','#619fc9','#59ae91','#d99058','#d76d72']
export function validUpper(values:number[],expected:number):boolean{
  return values.length===expected&&values.every((v,i)=>Number.isFinite(v)&&v>0&&v<=220&&(i===0||v>values[i-1]))
}
export function powerZones(ftp:number,upper:number[]){
  const limits=upper.map(v=>Math.round(ftp*v/100))
  return Array.from({length:7},(_,i)=>({n:i+1,min:i===0?0:limits[i-1]+1,max:i===6?null:limits[i],color:powerColor[i],pct:i===6?`>${upper[5]} %`:`${i===0?0:upper[i-1]}–${upper[i]} %`}))
}
export function heartZones(maxHr:number,upper:number[]){
  const limits=upper.map(v=>Math.round(maxHr*v/100))
  return Array.from({length:5},(_,i)=>({n:i+1,min:i===0?Math.round(maxHr*.5):limits[i-1]+1,max:i===4?maxHr:limits[i],color:heartColor[i]}))
}
