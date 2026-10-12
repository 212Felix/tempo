import {durationFor,parseHms,formatSeconds} from '../time/duration'
import { deleteRecord, listRecords, openTempoDatabase, saveRecord } from '../db/storage'
import { PLANNER_VERSION, PROFILE_ID, type CompletedRecord, type ManualSessionKind, type Priority, type TrainingRecord } from './engine'

export type ManualSport = 'cycling' | 'running' | 'strength' | 'swimming' | 'martial' | 'mobility'
export const sports: {value:ManualSport; label:string; icon:string}[] = [
  {value:'cycling',label:'Radfahren',icon:'🚲'},
  {value:'running',label:'Laufen',icon:'🏃'},
  {value:'strength',label:'Kraft / Workout',icon:'🏋️'},
  {value:'swimming',label:'Schwimmen',icon:'🏊'},
  {value:'martial',label:'Kampfsport',icon:'🥊'},
  {value:'mobility',label:'Recovery / Mobility',icon:'🧘'},
]
export type ManualForm = {
  date: string
  sport: ManualSport
  title: string
  duration: string
  distance: string
  elevation: string
  rpe: string
  priority: Priority
  target: string
  notes: string
  cyclingEnvironment: 'outdoor'|'indoor'|'unknown'
  strengthLocation: 'studio'|'arbeit'
}
export const defaultForm = (date: string): ManualForm => ({date, sport:'cycling',title:'',duration:'01:00:00',distance:'',elevation:'',rpe:'',priority:'SOLL',target:'',notes:'',cyclingEnvironment:'unknown',strengthLocation:'studio'})
export type Editable = {kind:'planned'; record:TrainingRecord} | {kind:'completed'; record:CompletedRecord}
export const sportFor = (kind: TrainingRecord['sessionType'] | undefined): ManualSport => {
  if (kind==='commute'||kind==='long'||kind==='quality'||kind==='endurance'||kind==='manual-cycling') return 'cycling'
  if (kind==='run'||kind==='manual-running') return 'running'
  if (kind==='strength-a'||kind==='strength-b'||kind==='manual-strength') return 'strength'
  if (kind==='manual-swimming') return 'swimming'
  if (kind==='manual-martial') return 'martial'
  return 'mobility'
}
export const labelFor = (kind:TrainingRecord['sessionType'] | undefined) => sports.find(x=>x.value===sportFor(kind))!
export const kindFor = (sport:ManualSport):ManualSessionKind => `manual-${sport}` as ManualSessionKind
export const toForm = (entry:Editable):ManualForm => {
  const r=entry.record
  return {
    date:r.date,
    sport:sportFor(r.sessionType),
    title:r.title??'', duration:durationFor(r),
    distance:entry.kind==='planned' ? (r.expectedKm==null?'':String(r.expectedKm)) : (r.distanceKm==null?'':String(r.distanceKm)),
    elevation:r.elevationM==null?'':String(r.elevationM),
    rpe:r.rpe==null?'':String(r.rpe),
    priority:entry.kind==='planned'?entry.record.priority:'SOLL',
    target:entry.kind==='planned'?entry.record.target:'', notes:r.notes??'',
    cyclingEnvironment:r.cyclingEnvironment==='outdoor'||r.cyclingEnvironment==='indoor'?r.cyclingEnvironment:'unknown',
    strengthLocation:r.strengthLocation==='arbeit'?'arbeit':'studio',
  }
}
const decimal=(value:string, label:string, max:number, required=false):number|undefined => {
  const clean=value.trim().replace(',','.')
  if (!clean && !required) return undefined
  const n=Number(clean)
  if (!clean || !Number.isFinite(n) || n<0 || n>max || (required && n<=0)) throw new Error(`${label}: bitte eine gültige Zahl eingeben.`)
  return n
}
const validDate=(value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) && new Date(`${value}T12:00:00`).toISOString().slice(0,10)===value
export function validateForm(form:ManualForm, mode:'planned'|'completed') {
  if (!validDate(form.date)) throw new Error('Bitte ein gültiges Datum wählen.')
  if (!form.title.trim()) throw new Error('Bitte einen Trainingsnamen eingeben.')
  if (form.title.trim().length>120 || form.notes.length>1500 || form.target.length>1000) throw new Error('Ein Textfeld ist zu lang.')
  const parsed=parseHms(form.duration,mode==='planned')
  const duration=parsed.minutes
  const durationSec=parsed.seconds
  const distance=decimal(form.distance,'Kilometer',1500)
  const elevation=decimal(form.elevation,'Höhenmeter',15000)
  const rpe=decimal(form.rpe,'RPE',10)
  if (rpe!==undefined && (rpe<1 || !Number.isInteger(rpe))) throw new Error('RPE muss zwischen 1 und 10 liegen.')
  return {duration,durationSec,distance,elevation,rpe}
}
export const notifyChange=()=>window.dispatchEvent(new Event('tempo:training-change'))
export const newId=()=>`manual:${PROFILE_ID}:${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
export async function loadManualEntries(){
  const [planned, completed] = await Promise.all([listRecords<TrainingRecord>('plannedSessions'),listRecords<CompletedRecord>('completedSessions')])
  return {
    planned:planned.filter(x=>x.profileId===PROFILE_ID).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),
    completed:completed.filter(x=>x.profileId===PROFILE_ID).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)),
  }
}
export async function saveManualPlanned(form:ManualForm, previous?:TrainingRecord) {
  const {duration,durationSec,distance,elevation,rpe}=validateForm(form,'planned')
  const now=new Date().toISOString()
  const wasGenerated = previous?.createdBy === PLANNER_VERSION
  const record:TrainingRecord={
    ...(previous??{}), id:wasGenerated?newId():previous?.id??newId(),profileId:PROFILE_ID,
    date:form.date,sessionType:kindFor(form.sport),title:form.title.trim(),durationMin:duration,durationSec,
    priority:form.priority,description:'Manuell geplant · nicht automatisch überschreiben',
    target:form.target.trim()||'Nach Tagesform und persönlichem Ziel',
    notes:form.notes.trim(),expectedKm:distance,elevationM:elevation,rpe,cyclingEnvironment:form.sport==='cycling'?form.cyclingEnvironment:undefined,
    strengthLocation:form.sport==='strength'?form.strengthLocation:undefined,
    status:'geplant',createdBy:'tempo-user',locked:true,
    createdAt:previous?.createdAt??now,updatedAt:now,
  }
  if (wasGenerated && previous) {
    // Vorherige auto:<Datum>-ID atomar ersetzen. Sonst könnte sie bei einer
    // Neuplanung am ursprünglichen Datum den verschobenen Eintrag überschreiben.
    const db=await openTempoDatabase()
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('plannedSessions','readwrite')
      tx.objectStore('plannedSessions').delete(previous.id)
      tx.objectStore('plannedSessions').put(record)
      tx.oncomplete=()=>{db.close();resolve()}
      tx.onerror=()=>{db.close();reject(tx.error??new Error('Manuelle Bearbeitung fehlgeschlagen.'))}
      tx.onabort=()=>{db.close();reject(tx.error??new Error('Manuelle Bearbeitung abgebrochen.'))}
    })
  } else {
    await saveRecord('plannedSessions',record)
  }
  notifyChange()
}
export async function saveManualCompleted(form:ManualForm, previous?:CompletedRecord, planned?:TrainingRecord) {
  const {duration,durationSec,distance,elevation,rpe}=validateForm(form,'completed')
  const now=new Date().toISOString()
  const record:CompletedRecord={
    ...(previous??{}),id:previous?.id??newId(),profileId:PROFILE_ID,date:form.date,
    sessionType:kindFor(form.sport),title:form.title.trim(),durationMin:duration,durationSec,
    distanceKm:distance,elevationM:elevation,rpe,notes:form.notes.trim(),
    cyclingEnvironment:form.sport==='cycling'?form.cyclingEnvironment:undefined,
    strengthLocation:form.sport==='strength'?form.strengthLocation:undefined,
    source:planned?'plan':previous?.source??'manuell',
    plannedSessionId:planned?.id??previous?.plannedSessionId,
    createdAt:previous?.createdAt??now,updatedAt:now,
  }
  if (!planned) {
    await saveRecord('completedSessions',record)
  } else {
    // Status und Ist-Aktivität gehören zu EINER Transaktion.
    const db=await openTempoDatabase()
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(['plannedSessions','completedSessions'],'readwrite')
      tx.objectStore('completedSessions').put(record)
      tx.objectStore('plannedSessions').put({...planned,status:'erledigt',locked:true,updatedAt:now})
      tx.oncomplete=()=>{db.close();resolve()}
      tx.onerror=()=>{db.close();reject(tx.error??new Error('Abschluss konnte nicht gespeichert werden.'))}
      tx.onabort=()=>{db.close();reject(tx.error??new Error('Abschluss abgebrochen.'))}
    })
  }
  notifyChange()
}
export async function deleteManual(entry:Editable) {
  if (entry.kind==='planned' && entry.record.status==='erledigt') throw new Error('Abgeschlossene Planungen können nicht einfach gelöscht werden. Bitte den Abschluss prüfen.')
  if (entry.kind==='completed' && entry.record.plannedSessionId) throw new Error('Dieser Abschluss gehört zu einem geplanten Training und kann hier noch nicht entfernt werden.')
  await deleteRecord(entry.kind==='planned'?'plannedSessions':'completedSessions',entry.record.id)
  notifyChange()
}
