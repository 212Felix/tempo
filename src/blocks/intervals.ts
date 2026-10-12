import type {LibraryClimb} from '../garmin/climbLibrary'

/** A route day can contain multiple optional targets. These are intentions, never FIT workouts. */
export type ClimbEffort='steady'|'tempo'|'threshold'
export type ClimbInterval={climbKey:string;effort:ClimbEffort}
export const climbEffortNames:Record<ClimbEffort,string>={steady:'Locker / Grundlage',tempo:'Tempo',threshold:'Kontrollierte Schwelle'}

export function chosenIntervals(items:ClimbInterval[]|undefined, candidates:LibraryClimb[]):{item:ClimbInterval;climb:LibraryClimb}[]{
  if(!Array.isArray(items))return []
  const lookup=new Map(candidates.map(climb=>[climb.key,climb]))
  const seen=new Set<string>()
  return items.flatMap(item=>{
    if(!item || typeof item.climbKey!=='string' || seen.has(item.climbKey) || !(item.effort in climbEffortNames))return []
    const climb=lookup.get(item.climbKey)
    if(!climb)return []
    seen.add(item.climbKey)
    return [{item,climb}]
  }).sort((a,b)=>a.climb.climb.startKm-b.climb.climb.startKm)
}

function wattTarget(effort:ClimbEffort,ftp?:number):string{
  const ranges:Record<ClimbEffort,[number,number]>={steady:[.56,.73],tempo:[.76,.85],threshold:[.88,.95]}
  const rpe:Record<ClimbEffort,string>={steady:'RPE 2–3',tempo:'RPE 5–6',threshold:'RPE 6–7'}
  const [from,to]=ranges[effort]
  return ftp&&ftp>=80&&ftp<=800?`${Math.round(ftp*from)}–${Math.round(ftp*to)} W (${rpe[effort]})`:rpe[effort]
}

/** Conservative suggestion: leave at least 2 minutes spare on each historic climb. */
export function usableIntervalMinutes(elapsedSeconds:number,effort:ClimbEffort):number{
  if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<=0)return 0
  const cap=effort==='threshold'?18:effort==='tempo'?20:60
  const remaining=Math.floor(elapsedSeconds/60)-2
  const n=Math.min(cap,remaining)
  const minimum=effort==='threshold'?6:effort==='tempo'?8:5
  return n>=minimum?n:0
}
export type WorkoutSummary={text:string;warnings:string[];hardCount:number;usableCount:number}
export function routeWorkout(items:ClimbInterval[]|undefined,climbs:LibraryClimb[],ftp?:number):WorkoutSummary{
  const selected=chosenIntervals(items,climbs)
  const warnings:string[]=[]
  const hard=selected.filter(s=>s.item.effort!=='steady')
  if(hard.length>2)warnings.push('Mehr als zwei intensive Bergabschnitte geplant. Reduziere auf höchstens zwei, um die Gruppentour nicht zu überladen.')
  const lines=['OPTIONALE TRAININGSREIZE AUF DER GRUPPENTOUR','Einrollen: mindestens 15 Minuten locker. Ampeln, Verkehr, Gruppe und Tagesform haben immer Vorrang.']
  let usableCount=0
  for(const {climb,item} of selected){
    const c=climb.climb
    const duration=usableIntervalMinutes(c.elapsedSeconds,item.effort)
    const km=`km ${c.startKm.toLocaleString('de-DE',{maximumFractionDigits:1})}–${c.endKm.toLocaleString('de-DE',{maximumFractionDigits:1})}`
    const label=climbEffortNames[item.effort]
    if(duration){
      usableCount++
      lines.push(`${km}: ${label}, optional ${duration} min bei ${wattTarget(item.effort,ftp)}. Danach locker weiterfahren; keine zusätzlichen Wiederholungen erzwingen.`)
    }else{
      warnings.push(`${km}: Für einen ${label.toLowerCase()}-Reiz ist die gemessene Anstiegsdauer zu kurz oder nicht verfügbar. Keine automatische Intervallvorgabe.`)
      lines.push(`${km}: ${label} nur nach Gefühl; keine gesicherte Intervallvorgabe.`)
    }
    if(climb.analysis?.warnings?.length)warnings.push(`${km}: FIT-Messlücken bzw. unvollständige Sensordaten beachten.`)
  }
  lines.push('Zwischen intensiven Abschnitten möglichst mindestens 10 Minuten locker; am Ende mindestens 10 Minuten ausrollen. Bei Müdigkeit oder Gruppenkonflikten Intervalle auslassen.')
  lines.push('Streckenkilometer und Dauern stammen von einer früheren Fahrt. Diese Notiz ist keine Garmin-Datei und wird nicht automatisch an das Gerät gesendet.')
  return {text:lines.join('\n'),warnings,hardCount:hard.length,usableCount}
}
