import type { FitPoint } from './fit'

/** Rough candidates based on saved 5-second distance/altitude samples.
 *  This is NOT a certified climb, route or interval-ready segment. */
export type ClimbCandidate = {
  startKm:number
  endKm:number
  distanceKm:number
  riseM:number
  gradePct:number
  elapsedSeconds:number
  averagePowerW?:number
  averageHrBpm?:number
}

type Reading={point:FitPoint;height:number}
const avg=(numbers:number[])=>numbers.length?Math.round(numbers.reduce((a,b)=>a+b,0)/numbers.length):undefined

export function findClimbCandidates(points:FitPoint[]):ClimbCandidate[]{
  const usable=points.filter(p=>Number.isFinite(p.sec)&&
    typeof p.distanceKm==='number' && Number.isFinite(p.distanceKm) && p.distanceKm>=0 &&
    typeof p.altitude==='number' && Number.isFinite(p.altitude) && Math.abs(p.altitude)<9500)
  if(usable.length<35)return []
  // Small rolling median of five samples dampens isolated altitude spikes.
  const samples:Reading[]=usable.map((point,i)=>{
    const a=usable.slice(Math.max(0,i-2),Math.min(usable.length,i+3)).map(p=>p.altitude as number).sort((x,y)=>x-y)
    return {point,height:a[Math.floor(a.length/2)]}
  })
  const found:ClimbCandidate[]=[]
  let valley=0,peak=0
  const close=(v:number,p:number)=>{
    const start=samples[v],end=samples[p]
    if(!start||!end||p<=v)return
    const distance=(end.point.distanceKm as number)-(start.point.distanceKm as number)
    const rise=end.height-start.height
    const seconds=end.point.sec-start.point.sec
    const grade=distance>0?rise/(distance*10):0
    if(distance<0.8||rise<40||grade<2.5||grade>20||seconds<180)return
    const slice=samples.slice(v,p+1)
    const watts=slice.map(x=>x.point.power).filter((n):n is number=>typeof n==='number' && Number.isFinite(n))
    const hrs=slice.map(x=>x.point.hr).filter((n):n is number=>typeof n==='number' && Number.isFinite(n))
    found.push({startKm:Math.round((start.point.distanceKm as number)*10)/10,
      endKm:Math.round((end.point.distanceKm as number)*10)/10,
      distanceKm:Math.round(distance*10)/10,riseM:Math.round(rise),gradePct:Math.round(grade*10)/10,
      elapsedSeconds:seconds,averagePowerW:avg(watts),averageHrBpm:avg(hrs)})
  }
  for(let i=1;i<samples.length;i++){
    const prev=samples[i-1],cur=samples[i]
    const jump=(cur.point.distanceKm as number)-(prev.point.distanceKm as number)
    const dt=cur.point.sec-prev.point.sec
    // A long break or a GPS/distance jump must never join two climbs.
    if(dt>120||dt<=0||jump<-.05||jump>.5){
      close(valley,peak);valley=i;peak=i;continue
    }
    if(cur.height<samples[valley].height){close(valley,peak);valley=i;peak=i;continue}
    if(cur.height>=samples[peak].height){peak=i;continue}
    const afterPeakKm=(cur.point.distanceKm as number)-(samples[peak].point.distanceKm as number)
    const dip=samples[peak].height-cur.height
    if((dip>24&&afterPeakKm>=0.15) || (afterPeakKm>=0.7 && dip>=6)){
      close(valley,peak)
      valley=i;peak=i
    }
  }
  close(valley,peak)
  return found.sort((a,b)=>b.riseM-a.riseM||b.distanceKm-a.distanceKm).slice(0,8)
}
