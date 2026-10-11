import {plusDays,validDate} from '../events/library'
import type {TrainingBlock} from './library'

/** Individual intentions belong to the block, not completed sessions or Garmin originals. */
export type BlockDayKind='leisure'|'rest'|'travel'|'group-ride'|'ride-training'|'challenge'
export type BlockDayEffort='easy'|'varied'|'tempo'|'threshold'
export type BlockDayRouteSource='garmin'|'route'
export type BlockDayPlan={
  date:string
  kind:BlockDayKind
  title?:string
  routeSource?:BlockDayRouteSource
  routeId?:string
  climbKey?:string
  routeName?:string
  routeDistanceKm?:number
  effort?:BlockDayEffort
  durationMin?:number
  notes?:string
}
export const dayKindLabels:Record<BlockDayKind,string>={
  leisure:'Freizeit ohne Sport',rest:'Ruhetag / Erholung',travel:'An- / Abreise',
  'group-ride':'Gemeinsame Tour','ride-training':'Gezielte Trainingstour',challenge:'Persönliche Challenge'
}
export const effortLabels:Record<BlockDayEffort,string>={
  easy:'Locker, ohne Intervalle',varied:'Nach Gefühl / Gruppe',tempo:'Optional: Tempointervall',threshold:'Optional: Schwellenintervall'
}
export const isTrainingFree=(kind:BlockDayKind)=>kind==='leisure'||kind==='rest'||kind==='travel'
export function dateInBlock(date:string,block:TrainingBlock):boolean{
  return validDate(date)&&date>=block.startDate&&date<=block.endDate
}
/** Throws away malformed legacy entries instead of acting on them. */
export function safeBlockDays(block:TrainingBlock):BlockDayPlan[]{
  if(!Array.isArray(block.days))return []
  const used=new Set<string>()
  return block.days.filter((v):v is BlockDayPlan=>{
    if(!v||typeof v!=='object'||Array.isArray(v))return false
    const d=v as BlockDayPlan
    if(!dateInBlock(d.date,block)||!(d.kind in dayKindLabels)||used.has(d.date))return false
    used.add(d.date);return true
  }).sort((a,b)=>a.date.localeCompare(b.date))
}
/** Challenge reserves the day before for recovery unless already specified otherwise. */
export function blockDayForDate(date:string,blocks:TrainingBlock[]):BlockDayPlan|undefined{
  const active=blocks.filter(b=>b.enabled&&dateInBlock(date,b)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]
  if(!active)return undefined
  const plans=safeBlockDays(active)
  const direct=plans.find(d=>d.date===date)
  if(direct)return direct
  const challenge=plans.find(d=>d.kind==='challenge'&&plusDays(d.date,-1)===date)
  if(challenge)return {date,kind:'rest',title:'Ruhetag vor '+(challenge.title||'der Challenge'),notes:'Geplanter Entlastungstag vor der privaten Langdistanz. Eventuell bestehende Einheiten separat prüfen.'}
  return undefined
}
export function planDayValid(block:TrainingBlock,plan:BlockDayPlan):boolean{
  if(!dateInBlock(plan.date,block)||!(plan.kind in dayKindLabels))return false
  if(plan.title&&plan.title.length>100)return false
  if(plan.notes&&plan.notes.length>600)return false
  if(plan.durationMin!==undefined&&(!Number.isFinite(plan.durationMin)||plan.durationMin<0||plan.durationMin>1440))return false
  if(plan.routeId&&(!plan.routeSource||plan.routeId.length>180))return false
  return true
}
export function putBlockDay(block:TrainingBlock,plan:BlockDayPlan):TrainingBlock{
  if(!planDayValid(block,plan))throw new Error('Ungültige Tagesplanung.')
  const days=safeBlockDays(block).filter(d=>d.date!==plan.date)
  return {...block,days:[...days,plan].sort((a,b)=>a.date.localeCompare(b.date))}
}
export function dropBlockDay(block:TrainingBlock,date:string):TrainingBlock{
  return {...block,days:safeBlockDays(block).filter(d=>d.date!==date)}
}
export function itineraryDates(block:TrainingBlock):string[]{
  const dates:string[]=[];let d=block.startDate
  for(let i=0;i<=90&&d<=block.endDate;i++,d=plusDays(d,1)) dates.push(d)
  return dates
}
