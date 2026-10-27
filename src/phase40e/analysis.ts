import type {TrainingRecord,CompletedRecord} from '../planning/engine'
import type {GarminActivity} from '../garmin/csv'
import type {FitPoint,FitTrace} from '../garmin/fit'
import type {TrainingStep} from '../phase37/intervals'

export type DisplayStatus='erledigt'|'offen'|'teilweise'|'verschoben'|'ausgefallen'|'garmin-pruefen'
export type MatchLink={id:string;plannedSessionId?:string;garminActivityId?:string;actual?:unknown}
export type CompletedLink=CompletedRecord&{externalActivityId?:string}
export type LinkedActual={activity?:GarminActivity;completed?:CompletedLink;trace?:FitTrace;proposed?:boolean}
export type Segment={id:string;name:string;effort:string;start:number;end:number;targetLow?:number;targetHigh?:number;actual?:number;source:'fit'|'none';quality:'ok'|'warn'|'high'|'missing'|'unrated';deltaPercent?:number}

export const isBike=(session:Pick<TrainingRecord,'sessionType'>)=>['quality','endurance','long','commute','manual-cycling'].includes(session.sessionType)
export const isRun=(session:Pick<TrainingRecord,'sessionType'>)=>['run','manual-running'].includes(session.sessionType)
export function sportLabel(type:string){return /strength/.test(type)?'Kraft':/run/.test(type)?'Laufen':/swim/.test(type)?'Schwimmen':/cycling|quality|endurance|long|commute/.test(type)?'Radfahren':/golf/.test(type)?'Golf':/sportspiel/.test(type)?'Sportspiel':/recover|mobility|yoga/.test(type)?'Recovery':'Training'}
export function activityStatus(plan:TrainingRecord,done:CompletedLink[],proposals:MatchLink[]=[],currentDate= new Date().toISOString().slice(0,10)):DisplayStatus{
 const matching=done.filter(x=>x.plannedSessionId===plan.id)
 if(plan.status==='erledigt'||matching.length){const actual=matching[0]; if(actual?.durationMin!==undefined&&plan.durationMin>0&&actual.durationMin<plan.durationMin*.75)return 'teilweise';return 'erledigt'}
 if(plan.status==='nicht-erledigt')return 'ausgefallen'
 if(proposals.some(x=>x.plannedSessionId===plan.id))return 'garmin-pruefen'
 if(typeof plan.originalPlanDate==='string'&&plan.originalPlanDate!==plan.date)return 'verschoben'
 if(plan.date<currentDate)return 'offen'
 return 'offen'
}
/** Garmin link only when its identifier is genuinely unique; NEVER fuzzy-attach FIT samples to a plan. */
export function linkedActual(plan:TrainingRecord,done:CompletedLink[],activities:GarminActivity[],links:MatchLink[],traces:FitTrace[]):LinkedActual{
 const completed=done.find(c=>c.plannedSessionId===plan.id)
 const possibleIds=[completed?.externalActivityId,...links.filter(l=>l.plannedSessionId===plan.id).map(l=>l.garminActivityId)].filter((v):v is string=>typeof v==='string')
 const uniquely=[...new Set(possibleIds)]
 const activity=uniquely.length===1?activities.find(a=>a.id===uniquely[0]&&!a.duplicateOf):undefined
 const trace=activity?.fitSeriesId?traces.find(t=>t.id===activity.fitSeriesId&&t.activityId===activity.id):undefined
 return {completed,activity,trace,proposed:!!activity&&!completed}
}
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)
export function sampleMetric(points:FitPoint[],start:number,end:number,metric:'watt'|'ftp'|'hr'|'pace',ftp?:number):number|undefined{
 if(end<=start)return undefined
 const valid=points.filter(p=>p.sec>=start&&p.sec<end&&p.sec>=0)
 if(metric==='pace'){
  // Pace comes from recorded cumulative distance and timestamps, never from GPS coordinate estimation.
  const distance=valid.filter(p=>finite(p.distanceKm)).sort((a,b)=>a.sec-b.sec)
  if(distance.length<2)return undefined
  const a=distance[0],b=distance[distance.length-1],elapsed=b.sec-a.sec,km=(b.distanceKm??0)-(a.distanceKm??0)
  return elapsed>=30&&km>.025&&km<elapsed/75?elapsed/60/km:undefined
 }
 if(metric==='ftp'&&(!finite(ftp)||ftp<=0))return undefined
 const key=metric==='hr'?'hr':'power'
 const available=valid.filter(p=>finite(p[key]))
 if(available.length<2)return undefined
 // Do not average isolated points across large recording gaps.
 const gaps=available.slice(1).filter((p,i)=>p.sec-available[i].sec>45).length
 if(gaps>1)return undefined
 const average=available.reduce((s,p)=>s+(p[key] as number),0)/available.length
 return metric==='ftp'?100*average/(ftp as number):average
}
export function compareIntervals(steps:TrainingStep[],points:FitPoint[]|undefined,metric:'watt'|'ftp'|'hr'|'pace',ftp?:number):Segment[]{
 let cursor=0
 return steps.map((s,index)=>{
  const start=cursor;cursor+=s.seconds
  const low=metric==='watt'&&finite(ftp)&&ftp>0&&finite(s.lowFtp)?s.lowFtp*ftp:metric==='ftp'&&finite(s.lowFtp)?s.lowFtp*100:metric==='pace'&&finite(s.paceMinPerKm)?s.paceMinPerKm:undefined
  const high=metric==='watt'&&finite(ftp)&&ftp>0&&finite(s.highFtp)?s.highFtp*ftp:metric==='ftp'&&finite(s.highFtp)?s.highFtp*100:metric==='pace'&&finite(s.paceMinPerKm)?s.paceMinPerKm:undefined
  const actual=points?.length?sampleMetric(points,start,cursor,metric,ftp):undefined
  let quality:Segment['quality']='unrated',deltaPercent: number|undefined
  if(actual===undefined)quality='missing'
  else if(low===undefined||high===undefined)quality='unrated'
  else {
   const lowBound=Math.min(low,high),highBound=Math.max(low,high),reference=(lowBound+highBound)/2
   const tolerance=metric==='pace'?Math.max(.15,reference*.04):metric==='hr'?7:Math.max(metric==='ftp'?4:10,reference*.04)
   const deviation=actual<lowBound?actual-lowBound:actual>highBound?actual-highBound:0
   deltaPercent=reference>0?100*(actual-reference)/reference:undefined
   quality=deviation===0?'ok':Math.abs(deviation)>tolerance*2?'high':'warn'
  }
  return {id:s.id||`step-${index}`,name:s.title,effort:s.effort,start,end:cursor,targetLow:low,targetHigh:high,actual,source:actual===undefined?'none':'fit',quality,deltaPercent}
 })
}
export function intervalDeviationHint(segment:Segment,metric:'watt'|'ftp'|'hr'|'pace'):string{
 if(segment.actual===undefined||segment.targetLow===undefined||segment.targetHigh===undefined)return 'Keine verlässliche SOLL-/IST-Beurteilung möglich.'
 const lower=Math.min(segment.targetLow,segment.targetHigh),upper=Math.max(segment.targetLow,segment.targetHigh)
 if(segment.actual<lower)return metric==='pace'?'Schneller als Zielpace.':'Unterhalb des geplanten Belastungsbereichs.'
 if(segment.actual>upper)return metric==='pace'?'Langsamer als Zielpace.':'Oberhalb des geplanten Belastungsbereichs.'
 return 'Im vorgegebenen Intensitätsbereich.'
}
export function overallAssessment(plan:TrainingRecord,actual:LinkedActual,segments:Segment[]):{label:string;advice:string;checked:number;deviant:number}{
 const check=segments.filter(s=>s.quality==='ok'||s.quality==='warn'||s.quality==='high')
 const deviant=check.filter(s=>s.quality==='high').length
 const duration=actual.activity?.durationMin??actual.completed?.durationMin
 if(!actual.completed&&!actual.activity)return {label:'Noch keine Ist-Daten',advice:'Nach dem Training kannst du die tatsächlichen Werte mit Garmin zuordnen.',checked:0,deviant:0}
 if(!check.length&&duration===undefined)return {label:'Messwerte unvollständig',advice:'Ohne geeignete FIT-Zeitreihe ist keine Intensitätsbeurteilung möglich.',checked:0,deviant:0}
 const diff=typeof duration==='number'&&plan.durationMin>0?(duration-plan.durationMin)/plan.durationMin:undefined
 const timeNote=diff!==undefined&&Math.abs(diff)>.20?`Die tatsächliche Dauer weicht um ${Math.abs(Math.round(diff*100))} % ab. `:''
 const advice=deviant?`${deviant} von ${check.length} bewertbaren Abschnitten weichen deutlich von der Vorgabe ab. Betroffen: ${check.filter(s=>s.quality==='high').slice(0,3).map(s=>s.name).join(', ')}. Zu hohe wie zu niedrige Intensität können den Reiz verändern. Mögliche Ursachen: Streckenverlauf, Messung oder Ermüdung – kein automatisches Urteil über deine Fitness.`:check.length?'Die bewertbaren Intervalle haben keine großen Abweichungen.':'Für eine verlässliche Intervallbewertung fehlen vollständige Watt-/Pace-Soll- oder Ist-Daten.'
 return {label:deviant?'Trainingsreiz teilweise abweichend':diff!==undefined&&Math.abs(diff)>.20?'Trainingsdauer abweichend':check.length?'Im Zielbereich':'Absolviert · begrenzt bewertbar',advice:timeNote+advice,checked:check.length,deviant}
}
