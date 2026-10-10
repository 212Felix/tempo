import type { TempoRecord } from '../db/types'

/** Garmin Connect CSV overview import. No requests to Garmin or other servers. */
export type GarminActivity = TempoRecord & {
  source: 'garmin-csv'
  date: string
  startedAt?: string
  title: string
  sport: 'cycling'|'running'|'strength'|'swimming'|'other'
  activityType: string
  durationMin: number
  durationSeconds: number
  distanceKm?: number
  elevationM?: number
  avgPowerW?: number
  maxPowerW?: number
  normalizedPowerW?: number
  avgHrBpm?: number
  maxHrBpm?: number
  avgCadence?: number
  avgSpeedKmh?: number
  calories?: number
  importBatchId: string
}
export type CsvParseResult = { activities: GarminActivity[]; skipped: number; notes: string[] }
const PROFILE_ID = 'local-primary-profile'

/** Handles quoted semicolons/commas and escaped double quotation marks. */
export function parseCsv(text: string, separator?: ','|';'|'\t'): string[][] {
  const firstLine = (text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '')
  const count = (sep: string) => {
    let tally=0, quote=false
    for(let i=0;i<firstLine.length;i++) {
      if(firstLine[i]==='"') {if(quote && firstLine[i+1]==='"')i++;else quote=!quote}
      else if(!quote && firstLine[i]===sep)tally++
    }
    return tally
  }
  const delim = separator ?? (count(';')>count(',') && count(';')>=count('\t')?';':count('\t')>count(',')?'\t':',')
  const rows:string[][]=[]
  let row:string[]=[], value='', quoted=false
  const raw=text.replace(/^\uFEFF/, '')
  for(let i=0;i<raw.length;i++){
    const c=raw[i]
    if(c==='"'){
      if(quoted && raw[i+1]==='"'){value+='"';i++}else quoted=!quoted
    } else if(!quoted && c===delim){row.push(value.trim());value=''}
    else if(!quoted && (c==='\n'||c==='\r')) {
      if(c==='\r' && raw[i+1]==='\n')i++
      row.push(value.trim()); if(row.some(v=>v!==''))rows.push(row)
      row=[];value=''
    } else value+=c
  }
  row.push(value.trim());if(row.some(v=>v!==''))rows.push(row)
  if(quoted) throw new Error('CSV enthält ein nicht geschlossenes Anführungszeichen.')
  return rows
}
const normalize = (x:string) => x.toLowerCase().replace(/ø|Ø/g,'avg').replace(/durchschnitt|average|mittelwert/g,'avg').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[®™°]/g,'').replace(/[^a-z0-9]/g,'')
const keyFor=(headers:string[], names:string[]) => {
  const indices = names.map(n=>headers.indexOf(normalize(n))).filter(n=>n>=0)
  return indices[0]??-1
}
const aliases:Record<string,string[]>={
 date:['Date','Datum','Start time','Startzeit'],title:['Title','Titel','Name','Aktivitätsname','Aktivitat'],
 activityType:['Activity Type','Aktivitätstyp','Aktivitatstyp','Type','Sport'],
 duration:['Time','Zeit','Dauer','Moving Time','Bewegungszeit','Elapsed Time','Verstrichene Zeit','Total Time'],
 distance:['Distance','Distanz','Entfernung'],elevation:['Total Ascent','Anstieg gesamt','Gesamtanstieg','Höhenmeter','Elevation Gain','Elevation'],
 avgPower:['Avg Power','Average Power','Ø Leistung','Durchschnittliche Leistung','Avg. Power'],maxPower:['Max Power','Max. Power','Maximale Leistung'],
 np:['Normalized Power (NP)','Normalized Power','NP','Normalisierte Leistung'],
 hr:['Avg HR','Avg Heart Rate','Ø Herzfrequenz','Durchschnittliche Herzfrequenz','Avg. HR'],
 maxHr:['Max HR','Max Heart Rate','Maximale Herzfrequenz'],cadence:['Avg Bike Cadence','Avg Cadence','Ø Trittfrequenz','Durchschnittliche Trittfrequenz'],
 speed:['Avg Speed','Average Speed','Ø Geschwindigkeit','Durchschnittsgeschwindigkeit'],calories:['Calories','Kalorien']
}
/** Unit-aware decimal, accepting both German and English Garmin locales. */
export function garminNumber(value:string):number|undefined {
  const s=(value||'').replace(/\s/g,'').replace(/[^\d,.+\-]/g,'')
  if(!s||s==='--'||s==='-')return undefined
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.')
  let token=s
  if(comma>=0&&dot>=0) token=comma>dot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')
  else if(comma>=0)token=s.replace(',','.')
  const n=Number(token)
  return Number.isFinite(n)&&n>=0?n:undefined
}
/** Höhenmeter/Kalorien oft mit Tausendertrennzeichen (1.829 oder 1,829). */
export function garminWholeNumber(value:string):number|undefined {
  const raw=(value||'').replace(/\s/g,'').replace(/[^\d,.+\-]/g,'')
  if(/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,]/g,''))
  return garminNumber(value)
}
export function garminDurationSeconds(raw:string):number|undefined {
  const text=(raw||'').trim()
  if(!text)return undefined
  const parts=text.split(':')
  if(parts.length===2||parts.length===3){
    const nums=parts.map(x=>Number(x.replace(',','.')))
    if(nums.some(n=>!Number.isFinite(n)||n<0))return undefined
    const val=parts.length===3?nums[0]*3600+nums[1]*60+nums[2]:nums[0]*60+nums[1]
    return Math.round(val)
  }
  const n=garminNumber(text)
  // Bare numeric Garmin time is treated as seconds only if explicit seconds are shown.
  return /\b(s|sec|sek)\b/i.test(text)&&n!==undefined?Math.round(n):undefined
}
export function garminDate(raw:string):{date:string;startedAt?:string}|undefined {
  const x=(raw||'').trim()
  const iso=x.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?/)
  const eu=x.match(/^(\d{1,2})[.]([0-9]{1,2})[.](\d{4})(?:\s+(\d\d):(\d\d)(?::(\d\d))?)?/)
  const us=x.match(/^(\d{1,2})\/([0-9]{1,2})\/(\d{4})(?:\s+(\d\d):(\d\d)(?::(\d\d))?)?/)
  let year='',month='',day='',h='',m='',s=''
  if(iso){[year,month,day,h,m,s]=iso.slice(1).map(v=>v||'')}
  else if(eu){[day,month,year,h,m,s]=eu.slice(1).map(v=>v||'')}
  else if(us){[month,day,year,h,m,s]=us.slice(1).map(v=>v||'')}
  else return undefined
  const date=`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`
  const d=new Date(`${date}T12:00:00Z`)
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)return undefined
  return {date,startedAt:h&&m?`${date}T${h}:${m}:${s||'00'}`:undefined}
}
export function sportType(raw:string):GarminActivity['sport']{
  const s=normalize(raw)
  if(/cycling|bike|biking|radfahren|rennrad|gravel|mountainbike|fahrrad|indoorcycling|zwift/.test(s))return 'cycling'
  if(/running|lauf|jogging|trailrun/.test(s))return 'running'
  if(/strength|kraft|workout|fitness/.test(s))return 'strength'
  if(/swim|schwimm/.test(s))return 'swimming'
  return 'other'
}
function stableHash(input:string):string{
  let h=2166136261>>>0
  for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
  return h.toString(16).padStart(8,'0')
}
/** CSV summary only, no raw GPS/time-series included. */
export function parseGarminCsv(text:string,batchId:string):CsvParseResult {
  if(text.length>20_000_000)throw new Error('Datei zu groß. Bitte Aktivitäten in kleinere CSV-Teile exportieren.')
  const rows=parseCsv(text)
  if(rows.length<2)throw new Error('CSV enthält keine Aktivitätszeilen.')
  const headers=rows[0].map(normalize)
  const index=Object.fromEntries(Object.entries(aliases).map(([k,opts])=>[k,keyFor(headers,opts)])) as Record<keyof typeof aliases,number>
  if(index.date<0||index.duration<0||index.activityType<0)throw new Error('Keine Garmin-Aktivitätsübersicht erkannt. Benötigte Spalten: Datum, Aktivitätstyp und Zeit. Bitte „Alle Aktivitäten → CSV-Datei exportieren“ wählen.')
  const activities:GarminActivity[]=[],notes:string[]=[]
  let skipped=0
  const seen=new Set<string>()
  const at=(cells:string[],name:keyof typeof aliases)=>index[name]>=0?cells[index[name]]||'':''
  for(const row of rows.slice(1)){
    const date=garminDate(at(row,'date'))
    const durationSeconds=garminDurationSeconds(at(row,'duration'))
    if(!date||!durationSeconds){skipped++;continue}
    const activityType=at(row,'activityType').trim()
    const title=at(row,'title').trim().slice(0,160)||activityType||'Garmin-Aktivität'
    const dist=garminNumber(at(row,'distance'))
    const speed=garminNumber(at(row,'speed'))
    const distanceKm = dist!==undefined && /\b(mi|miles)\b/i.test(at(row,'distance')) ? dist*1.609344 : dist
    const avgSpeedKmh=speed!==undefined && /\b(mph)\b/i.test(at(row,'speed')) ? speed*1.609344 : speed
    const identity=[date.startedAt??date.date,activityType,durationSeconds,Math.round((distanceKm??0)*100),title].join('|')
    const id=`garmin:csv:${PROFILE_ID}:${stableHash(identity)}`
    if(seen.has(id)){skipped++;continue}
    seen.add(id)
    const now=new Date().toISOString()
    activities.push({id,createdAt:now,updatedAt:now,profileId:PROFILE_ID,source:'garmin-csv',
      date:date.date,...(date.startedAt?{startedAt:date.startedAt}:{}),sport:sportType(activityType),activityType,title,
      durationMin:Math.round(durationSeconds/6)/10,durationSeconds,
      ...(distanceKm!==undefined?{distanceKm:Math.round(distanceKm*1000)/1000}:{}),
      ...(garminWholeNumber(at(row,'elevation'))!==undefined?{elevationM:garminWholeNumber(at(row,'elevation'))}:{}),
      ...(garminNumber(at(row,'avgPower'))!==undefined?{avgPowerW:garminNumber(at(row,'avgPower'))}:{}),
      ...(garminNumber(at(row,'maxPower'))!==undefined?{maxPowerW:garminNumber(at(row,'maxPower'))}:{}),
      ...(garminNumber(at(row,'np'))!==undefined?{normalizedPowerW:garminNumber(at(row,'np'))}:{}),
      ...(garminNumber(at(row,'hr'))!==undefined?{avgHrBpm:garminNumber(at(row,'hr'))}:{}),
      ...(garminNumber(at(row,'maxHr'))!==undefined?{maxHrBpm:garminNumber(at(row,'maxHr'))}:{}),
      ...(garminNumber(at(row,'cadence'))!==undefined?{avgCadence:garminNumber(at(row,'cadence'))}:{}),
      ...(avgSpeedKmh!==undefined?{avgSpeedKmh}:{}),
      ...(garminWholeNumber(at(row,'calories'))!==undefined?{calories:garminWholeNumber(at(row,'calories'))}:{}),
      importBatchId:batchId})
  }
  if(!activities.length)throw new Error('Keine gültigen Aktivitäten gefunden. Bitte CSV-Format prüfen.')
  if(index.avgPower<0)notes.push('Keine Spalte mit Durchschnittsleistung gefunden. Einzelne FIT-Dateien liefern später mehr Leistungsdaten.')
  if(skipped)notes.push(`${skipped} Zeilen ohne gültiges Datum/Zeit oder als Duplikat übersprungen.`)
  notes.push('CSV enthält nur die Garmin-Zusammenfassung, keine sekundengenauen Watt-/Herzfrequenzdaten.')
  return {activities,skipped,notes}
}
