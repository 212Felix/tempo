/** Canonical TEMPO duration presentation. No ambiguous decimal-minute editing. */
export function secondsFromMinutes(minutes: number): number {return Math.max(0,Math.round((Number.isFinite(minutes)?minutes:0)*60))}
export function formatSeconds(value:number):string{
  const n=Math.max(0,Math.round(value))
  return `${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`
}
export function durationFor(record:{durationSec?:number;durationSeconds?:number;durationMin?:number}):string{
  if(Number.isFinite(record.durationSec))return formatSeconds(record.durationSec!)
  if(Number.isFinite(record.durationSeconds))return formatSeconds(record.durationSeconds!)
  return formatSeconds(secondsFromMinutes(record.durationMin??0))
}
export function parseHms(value:string,allowZero=false):{seconds:number;minutes:number}{
  const match=/^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(value.trim())
  if(!match)throw Error('Dauer bitte als hh:mm:ss eingeben, z. B. 00:28:29.')
  const seconds=Number(match[1])*3600+Number(match[2])*60+Number(match[3])
  if((!allowZero&&seconds<1)||seconds>24*3600)throw Error('Trainingsdauer muss zwischen 00:00:01 und 24:00:00 liegen.')
  return {seconds,minutes:seconds/60}
}
