/** Garmin FIT decoding and local-only time series: no uploads, no API tokens. */
import type { GarminActivity } from './csv'
import { sportType } from './csv'
import type { TempoRecord } from '../db/types'

export type FitPoint = {
  sec: number
  power?: number
  hr?: number
  altitude?: number
  cadence?: number
  distanceKm?: number
  lat?: number
  lon?: number
}
export type FitTrace = TempoRecord & {
  profileId: string
  kind: 'garmin-fit-trace'
  activityId: string
  sha256: string
  fileName: string
  startedAt: string
  sampleIntervalSeconds: number
  recordCount: number
  points: FitPoint[]
}
export type FitDecoded = {
  fingerprint: string
  fileName: string
  date: string
  startedAt: string
  sport: GarminActivity['sport']
  distanceKm?: number
  durationSeconds: number
  elevationM?: number
  avgPowerW?: number
  avgHrBpm?: number
  maxPowerW?: number
  maxHrBpm?: number
  avgCadence?: number
  records: FitPoint[]
  recordCount: number
  warnings: string[]
}

const finite = (x: unknown): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined
function data(m: unknown): Record<string, unknown> {
  return m && typeof m === 'object' && !Array.isArray(m) ? m as Record<string, unknown> : {}
}
function array(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map(data) : []
}
function dateOf(v: unknown): Date | undefined {
  const d=v instanceof Date?v:typeof v === 'string'?new Date(v):undefined
  return d && Number.isFinite(d.getTime()) ? d : undefined
}
function positive(x: unknown): number | undefined {
  const n=finite(x)
  return n !== undefined && n>=0 ? n : undefined
}
function toDegrees(x: unknown): number | undefined {
  const n=finite(x)
  if(n===undefined)return undefined
  const d=Math.abs(n)>180?n*180/2147483648:n
  return Math.abs(d)<=180?d:undefined
}
function sportOf(session: Record<string,unknown>): GarminActivity['sport'] {
  const s=String(session.sport??'').toLowerCase()
  if(s==='cycling'||s==='running'||s==='swimming')return sportType(s)
  return sportType(s+' '+String(session.subSport??''))
}
export function buildFitFromMessages(messages: Record<string, unknown>, fingerprint: string, fileName: string): FitDecoded {
  const sessions=array(messages.sessionMesgs)
  const session=sessions[0]??{}
  const rows=array(messages.recordMesgs)
  if(rows.length < 4)throw new Error('Diese FIT-Datei enthält zu wenige Zeitverlaufsdaten. Bitte die Original-Aktivität exportieren.')
  const entries=rows.map(x=>({x,t:dateOf(x.timestamp)})).filter((e):e is {x:Record<string,unknown>;t:Date}=>Boolean(e.t))
    .sort((a,b)=>a.t.getTime()-b.t.getTime())
  if(entries.length<4)throw new Error('In dieser FIT-Datei wurden keine verwertbaren Zeitstempel gefunden.')
  const start=dateOf(session.startTime)??entries[0].t
  const startMs=start.getTime()
  const endMs=entries[entries.length-1].t.getTime()
  const durationSeconds=positive(session.totalTimerTime)??Math.max(1,Math.round((endMs-startMs)/1000))
  if(durationSeconds<10)throw new Error('Die Aktivität ist zu kurz für einen FIT-Verlauf.')
  const raw: FitPoint[]=entries.map(({x,t})=>{
    const point:FitPoint={sec:Math.max(0,Math.round((t.getTime()-startMs)/1000))}
    const power=positive(x.power),hr=positive(x.heartRate),alt=finite(x.enhancedAltitude)??finite(x.altitude)
    const cad=positive(x.cadence),dist=positive(x.distance)
    if(power!==undefined && power<4000)point.power=power
    if(hr!==undefined&&hr<=240)point.hr=hr
    if(alt!==undefined && Math.abs(alt)<10000)point.altitude=alt
    if(cad!==undefined && cad<250)point.cadence=cad
    if(dist!==undefined)point.distanceKm=dist/1000
    const lat=toDegrees(x.positionLat),lon=toDegrees(x.positionLong)
    if(lat!==undefined && lon!==undefined && Math.abs(lat)<=90){point.lat=lat;point.lon=lon}
    return point
  })
  // Keep at most 1 point every 5 seconds for lightweight, private IndexedDB/JSON backups.
  // No interpolation across recording gaps; missing channels remain missing.
  const points:FitPoint[]=[],interval=5
  let lastSec=-interval
  for(const point of raw){
    if(point.sec>=lastSec+interval){points.push(point);lastSec=point.sec}
  }
  const sum=(key:keyof FitPoint)=>raw.reduce<number[]>((a,p)=>{
    const n=p[key];if(typeof n==='number'&&Number.isFinite(n))a.push(n);return a
  },[])
  const power=sum('power'),hrs=sum('hr'),cads=sum('cadence')
  const avg=(nums:number[])=>nums.length?Math.round(nums.reduce((a,b)=>a+b,0)/nums.length):undefined
  const sessionDistance=positive(session.totalDistance)
  const lastDistance=[...raw].reverse().find(p=>p.distanceKm!==undefined)?.distanceKm
  const elevation=positive(session.totalAscent)
  const warnings:string[]=[]
  if(!power.length)warnings.push('Keine Wattwerte in dieser FIT-Aufzeichnung gefunden.')
  if(!hrs.length)warnings.push('Keine Herzfrequenzwerte in dieser FIT-Aufzeichnung gefunden.')
  if(!points.some(p=>p.altitude!==undefined))warnings.push('Kein Höhenprofil in dieser FIT-Aufzeichnung gefunden.')
  if(!points.some(p=>p.lat!==undefined))warnings.push('Keine GPS-Koordinaten erkannt.')
  return {fingerprint,fileName,date:start.toISOString().slice(0,10),startedAt:start.toISOString(),
    sport:sportOf(session),durationSeconds:Math.round(durationSeconds),
    distanceKm:sessionDistance!==undefined?sessionDistance/1000:lastDistance,
    elevationM:elevation, avgPowerW:positive(session.avgPower)??avg(power),maxPowerW:positive(session.maxPower)??(power.length?power.reduce((a,b)=>Math.max(a,b),0):undefined),
    avgHrBpm:positive(session.avgHeartRate)??avg(hrs),maxHrBpm:positive(session.maxHeartRate)??(hrs.length?hrs.reduce((a,b)=>Math.max(a,b),0):undefined),
    avgCadence:positive(session.avgCadence)??avg(cads),records:points,recordCount:entries.length,warnings}
}
export async function decodeFitFile(file: File):Promise<FitDecoded> {
  if(!/\.fit$/i.test(file.name))throw new Error('Bitte die entpackte .fit-Datei auswählen (nicht ZIP, GPX oder TCX).')
  if(file.size>75_000_000)throw new Error('FIT-Datei über 75 MB. Bitte eine kleinere Aktivität wählen.')
  const bytes=await file.arrayBuffer()
  if(bytes.byteLength<18)throw new Error('Die FIT-Datei ist leer oder unvollständig.')
  const dig=await crypto.subtle.digest('SHA-256',bytes)
  const fingerprint=Array.from(new Uint8Array(dig),x=>x.toString(16).padStart(2,'0')).join('')
  // Dynamic import: FIT SDK is only loaded when needed, not on every TEMPO page.
  const {Decoder,Stream}=await import('@garmin/fitsdk')
  const stream=Stream.fromArrayBuffer(bytes)
  const decoder=new Decoder(stream)
  if(!decoder.isFIT())throw new Error('Keine gültige FIT-Datei.')
  if(!decoder.checkIntegrity())throw new Error('FIT-Prüfsumme ungültig. Bitte erneut als Originaldatei exportieren.')
  const {messages,errors}=decoder.read()
  const parsed=buildFitFromMessages(messages as Record<string,unknown>,fingerprint,file.name)
  if(Array.isArray(errors)&&errors.length)parsed.warnings.push('Garmin-FIT-Lesehinweis: Einzelne Felder konnten nicht interpretiert werden.')
  return parsed
}

/** Explicit, conservative matching: no automatic merge when more than one candidate is plausible. */
export function fitMatches(activity:FitDecoded,others:GarminActivity[]): GarminActivity[] {
  const dateMs=Date.parse(activity.date+'T12:00:00Z')
  return others.filter(a=>a.source==='garmin-csv'&&a.sport===activity.sport &&
    Math.abs(Date.parse(a.date+'T12:00:00Z')-dateMs)<=86400000 &&
    a.distanceKm!==undefined && activity.distanceKm!==undefined &&
    Math.abs(a.distanceKm-activity.distanceKm)<=Math.max(1.5,a.distanceKm*0.025) &&
    Math.abs(a.durationSeconds-activity.durationSeconds)<=Math.max(900,a.durationSeconds*0.15)
  )
}
