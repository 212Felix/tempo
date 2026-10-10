import type { FitPoint } from './fit'
import type { ClimbCandidate } from './climbs'

export type SegmentValues = {
  powerW?: number
  heartRateBpm?: number
  cadenceRpm?: number
  sampleCount: number
  powerSamples: number
  heartRateSamples: number
}

export type ClimbAnalysis = {
  points: FitPoint[]
  startSec: number
  endSec: number
  all: SegmentValues
  firstHalf: SegmentValues
  secondHalf: SegmentValues
  powerDifferenceW?: number
  heartRateDifferenceBpm?: number
  warnings: string[]
}

/** Estimates from saved ~5-second FIT samples; not normalized power or a physiological diagnosis.
 * No interpolation across gaps and no assumption that elapsed time equals pedalling time. */
export function analyzeClimb(points: FitPoint[], climb: ClimbCandidate): ClimbAnalysis | null {
  const sampled = points.filter(p =>
    Number.isFinite(p.sec) &&
    typeof p.distanceKm === 'number' && Number.isFinite(p.distanceKm) &&
    p.distanceKm >= climb.startKm - 0.03 && p.distanceKm <= climb.endKm + 0.03
  ).sort((a,b)=>a.sec-b.sec)
  if(sampled.length < 2)return null
  const startSec = sampled[0].sec
  const endSec = sampled[sampled.length-1].sec
  const middleSec = (startSec + endSec) / 2
  const first = sampled.filter(p=>p.sec<=middleSec)
  const second = sampled.filter(p=>p.sec>middleSec)
  function summary(part: FitPoint[]): SegmentValues {
    const power=part.map(p=>p.power).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x))
    const hr=part.map(p=>p.hr).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x))
    const cadence=part.map(p=>p.cadence).filter((x):x is number=>typeof x==='number'&&Number.isFinite(x))
    const avg=(nums:number[]):number|undefined=>nums.length?Math.round(nums.reduce((a,b)=>a+b,0)/nums.length):undefined
    return {powerW:avg(power),heartRateBpm:avg(hr),cadenceRpm:avg(cadence),
      sampleCount:part.length,powerSamples:power.length,heartRateSamples:hr.length}
  }
  const all=summary(sampled),firstHalf=summary(first),secondHalf=summary(second)
  const warnings:string[]=[]
  const maxGap=sampled.slice(1).reduce((max,p,i)=>Math.max(max,p.sec-sampled[i].sec),0)
  if(maxGap>60)warnings.push('Längere Messlücke oder Pause innerhalb des Abschnitts. Die Dauer ist keine reine Fahrzeit.')
  if(all.powerSamples<all.sampleCount*0.6)warnings.push('Leistungswerte sind nur teilweise vorhanden; Mittelwerte eingeschränkt vergleichbar.')
  if(all.heartRateSamples<all.sampleCount*0.6)warnings.push('Herzfrequenzwerte sind nur teilweise vorhanden; Mittelwerte eingeschränkt vergleichbar.')
  if(sampled.length<20)warnings.push('Wenige Messpunkte in diesem Segment. Die Analyse ist entsprechend unsicher.')
  return {points:sampled,startSec,endSec,all,firstHalf,secondHalf,
    powerDifferenceW:firstHalf.powerW!==undefined&&secondHalf.powerW!==undefined?secondHalf.powerW-firstHalf.powerW:undefined,
    heartRateDifferenceBpm:firstHalf.heartRateBpm!==undefined&&secondHalf.heartRateBpm!==undefined?secondHalf.heartRateBpm-firstHalf.heartRateBpm:undefined,
    warnings}
}
