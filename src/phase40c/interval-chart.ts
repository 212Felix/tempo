import type {TrainingStep} from '../phase37/intervals'
export type ChartSegment={id:string;title:string;seconds:number;startSeconds:number;endSeconds:number;watts:number|null;lowW:number|null;highW:number|null;pct:number|null;zone:string;effort:TrainingStep['effort']}
export function chartSegments(steps:TrainingStep[],ftp?:number):ChartSegment[]{
 let cursor=0
 return steps.filter(s=>Number.isFinite(s.seconds)&&s.seconds>0).map(s=>{
  const startSeconds=cursor;cursor+=s.seconds
  const lo=typeof s.lowFtp==='number'&&Number.isFinite(s.lowFtp)?s.lowFtp:null
  const hi=typeof s.highFtp==='number'&&Number.isFinite(s.highFtp)?s.highFtp:null
  const pct=lo!==null&&hi!==null?(lo+hi)/2:null
  const watt=ftp&&Number.isFinite(ftp)&&ftp>0&&pct!==null?Math.round(ftp*pct):null
  const zone=pct===null?'offen':pct<.56?'Z1':pct<=.75?'Z2':pct<=.9?'Z3':pct<=1.05?'Z4':'Z5+'
  return {id:s.id,title:s.title,seconds:s.seconds,startSeconds,endSeconds:cursor,watts:watt,lowW:watt!==null&&lo!==null?Math.round(ftp!*lo):null,highW:watt!==null&&hi!==null?Math.round(ftp!*hi):null,pct,zone,effort:s.effort}
 })
}
