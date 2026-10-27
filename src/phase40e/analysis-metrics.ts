import type {GarminActivity} from '../garmin/csv'
import type {FitTrace,FitPoint} from '../garmin/fit'

export const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)
const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:undefined
/** Simple duration×intensity load proxy, explicitly NOT Garmin training load or TSS. */
export function loadProxy(activity:GarminActivity,ftp?:number):number|null{
 if(activity.durationMin<=0)return null
 if(activity.sport==='cycling'&&finite(activity.avgPowerW)&&finite(ftp)&&ftp>0)return Math.round(activity.durationMin/60*100*(activity.avgPowerW/ftp)**2)
 if(activity.sport==='running')return Math.round(activity.durationMin/60*55) // duration-only approximation, no inferred speed/HR zones
 return null
}
export function fitnessTrend(activities:GarminActivity[],ftp?:number,days=90){
 const rows: {date:string;load:number;fitness:number;fatigue:number;form:number}[]=[]
 const now=new Date(),anchor=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12)
 const loads=new Map<string,number>()
 for(const a of activities){const load=loadProxy(a,ftp);if(load!==null)loads.set(a.date,(loads.get(a.date)??0)+load)}
 let fitness=0,fatigue=0
 for(let i=days-1;i>=0;i--){const d=new Date(anchor);d.setDate(d.getDate()-i);const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const load=loads.get(date)??0;const form=fitness-fatigue
  fitness+= (load-fitness)*(1-Math.exp(-1/42));fatigue+=(load-fatigue)*(1-Math.exp(-1/7))
  rows.push({date,load,fitness:+fitness.toFixed(1),fatigue:+fatigue.toFixed(1),form:+form.toFixed(1)})
 }
 return rows
}
/** Best average power in a window; requires enough actual samples and bounds gaps. */
export function bestRollingPower(points:FitPoint[],windowSeconds:number):number|undefined{
 const p=points.filter(x=>finite(x.power)&&x.power!>=0).sort((a,b)=>a.sec-b.sec)
 if(p.length<5)return undefined
 let best:number|undefined
 for(let i=0;i<p.length;i++){
  let j=i+1;while(j<p.length&&p[j].sec-p[i].sec<windowSeconds)j++
  if(j>=p.length||p[j].sec-p[i].sec>windowSeconds+20)continue
  const window=p.slice(i,j+1);if(window.length<Math.max(5,Math.floor(windowSeconds/30)))continue
  if(window.some((v,k)=>k>0&&v.sec-window[k-1].sec>20))continue
  const power=mean(window.map(x=>x.power as number));if(power!==undefined)best=Math.max(best??0,power)
 }
 return best===undefined?undefined:Math.round(best)
}
export function powerCurve(traces:FitTrace[],durations=[60,300,1200,3600]){
 return durations.map(seconds=>({seconds,watts:traces.reduce<number|undefined>((b,t)=>{const v=bestRollingPower(t.points,seconds);return v===undefined?b:Math.max(b??0,v)},undefined)}))
}
export function criticalPower(points:{seconds:number;watts?:number}[]):{cp:number;wPrimeKj:number}|null{
 const a=points.find(x=>x.seconds===300),b=points.find(x=>x.seconds===1200)
 if(!a?.watts||!b?.watts||a.watts<=b.watts)return null
 const cp=(b.watts*b.seconds-a.watts*a.seconds)/(b.seconds-a.seconds)
 const wPrime=(a.watts-cp)*a.seconds/1000
 return cp>0&&wPrime>0?{cp:Math.round(cp),wPrimeKj:Math.round(wPrime*10)/10}:null
}
export function durability(points:FitPoint[]):{first:number;late:number;changePct:number}|null{
 const valid=points.filter(p=>finite(p.power)),length=points.at(-1)?.sec??0
 if(length<7200)return null
 const averages=(start:number,end:number)=>mean(valid.filter(p=>p.sec>=start&&p.sec<end).map(p=>p.power!))
 const first=averages(900,2700),late=averages(length-2700,length-900)
 if(!first||!late||first<=0)return null
 return {first:Math.round(first),late:Math.round(late),changePct:Math.round((late/first-1)*100)}
}
export function aerobicDrift(points:FitPoint[],sport:'cycling'|'running'):{early:number;late:number;driftPct:number}|null{
 const usable=points.filter(p=>finite(p.hr)&&p.hr!>=60&& (sport==='cycling'?finite(p.power)&&p.power!>0:finite(p.distanceKm)))
 if(usable.length<30)return null
 const start=usable[0].sec,end=usable[usable.length-1].sec,half=(start+end)/2
 if(end-start<2400)return null
 const efficiency=(rows:FitPoint[])=>{
  const hr=mean(rows.map(p=>p.hr!))
  if(!hr)return undefined
  if(sport==='cycling'){const p=mean(rows.map(p=>p.power!));return p?p/hr:undefined}
  const km=rows.at(-1)!.distanceKm!-rows[0].distanceKm!,hours=(rows.at(-1)!.sec-rows[0].sec)/3600
  return km>0&&hours>0?km/hours/hr:undefined
 }
 const a=efficiency(usable.filter(p=>p.sec<half)),b=efficiency(usable.filter(p=>p.sec>=half))
 return a&&b?{early:a,late:b,driftPct:Math.round((b/a-1)*1000)/10}:null
}
export function criticalSpeed(activities:GarminActivity[]):{metersPerSecond:number;paceSecondsKm:number}|null{
 // Two distinct maximum-effort test distances cannot be inferred from ordinary easy runs.
 const tests=activities.filter(a=>a.sport==='running'&&/race|wettkampf|test|cooper|bestzeit/i.test(a.title)&&finite(a.distanceKm)&&a.distanceKm!>=1&&a.durationSeconds>0)
 if(tests.length<2)return null
 const best=[...tests].sort((a,b)=>a.distanceKm!-b.distanceKm!)
 const short=best[0],long=best[best.length-1]
 if(long.distanceKm!-short.distanceKm!<1||long.durationSeconds-short.durationSeconds<300)return null
 const speed=(long.distanceKm!-short.distanceKm!)*1000/(long.durationSeconds-short.durationSeconds)
 return speed>2&&speed<8?{metersPerSecond:+speed.toFixed(2),paceSecondsKm:Math.round(1000/speed)}:null
}
/** Only measured ascent from FIT points; no invented grade or segment name. */
export function climbSummary(trace:FitTrace):{ascent:number;gainPerHour:number}|null{
 const p=trace.points.filter(x=>finite(x.altitude)&&finite(x.sec)).sort((a,b)=>a.sec-b.sec)
 if(p.length<10)return null
 let rise=0
 for(let i=1;i<p.length;i++)if(p[i].sec-p[i-1].sec<=30&&p[i].altitude!-p[i-1].altitude!>=2)rise+=p[i].altitude!-p[i-1].altitude!
 const duration=p.at(-1)!.sec-p[0].sec
 return duration>0&&rise>0?{ascent:Math.round(rise),gainPerHour:Math.round(rise/duration*3600)}:null
}
