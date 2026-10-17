import {openTempoDatabase} from '../db/storage'
import {PROFILE_ID,type TrainingRecord,type CompletedRecord,type ShiftRecord} from '../planning/engine'
export const weekDates=(iso:string)=>{const d=new Date(`${iso}T12:00:00Z`),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return Array.from({length:7},(_,i)=>{const x=new Date(d);x.setUTCDate(d.getUTCDate()+i);return x.toISOString().slice(0,10)})}
export type ReplanInput={sessions:TrainingRecord[];completed:CompletedRecord[];shifts:ShiftRecord[];anchorId:string;targetDate:string;excluded?:Record<string,string[]>;forced?:Record<string,string>}
export type ReplanResult={assigned:Record<string,string>;conflicts:string[];changed:TrainingRecord[];all:TrainingRecord[];week:string[]}
const isHard=(s:TrainingRecord)=>/quality|long|strength|manual-martial/i.test(s.sessionType)||/schwelle|vo2|intervall|hart/i.test(`${s.title} ${s.target}`)
const isQuality=(s:TrainingRecord)=>/quality/i.test(s.sessionType)||/schwelle|vo2|intervall/i.test(`${s.title} ${s.target}`)
const isLegStrength=(s:TrainingRecord)=>/strength/i.test(s.sessionType)&&!/oberkörper/i.test(s.title)
const isEasy=(s:TrainingRecord)=>/recovery|mobility|yoga|stabi/i.test(`${s.sessionType} ${s.title}`)
function incompatible(a:TrainingRecord,b:TrainingRecord){return (isQuality(a)&&isHard(b))||(isQuality(b)&&isHard(a))||(isLegStrength(a)&&isLegStrength(b))}
export function proposeWeek(input:ReplanInput):ReplanResult{
 const anchor=input.sessions.find(x=>x.id===input.anchorId)
 if(!anchor||anchor.status!=='geplant')throw Error('Die zu verschiebende Einheit ist nicht mehr geplant.')
 const week=weekDates(anchor.date)
 if(!week.includes(input.targetDate))throw Error('Zieltag muss zunächst innerhalb derselben Trainingswoche liegen.')
 const all=input.sessions.filter(x=>x.profileId===PROFILE_ID&&week.includes(x.date)&&x.status==='geplant')
 const taken=input.completed.filter(x=>x.profileId===PROFILE_ID&&week.includes(x.date))
 const assigned:Record<string,string>={[anchor.id]:input.targetDate}
 const byId=new Map(all.map(x=>[x.id,x]))
 const conflicts:string[]=[]
 const moving=[...all.filter(x=>x.id!==anchor.id)].sort((a,b)=>({MUSS:0,SOLL:1,KANN:2}[a.priority]-{MUSS:0,SOLL:1,KANN:2}[b.priority])||a.date.localeCompare(b.date))
 const score=(s:TrainingRecord,date:string)=>{
  const duty=input.shifts.find(x=>x.date===date)
  if(duty?.shift==='einsatz'&&!isEasy(s))return Infinity
  if(taken.some(x=>x.date===date)&&!isEasy(s))return Infinity
  const here=Object.entries(assigned).filter(([,when])=>when===date).map(([id])=>byId.get(id)!).filter(Boolean)
  if(here.some(other=>incompatible(s,other)||(isHard(s)&&isHard(other))))return Infinity
  const datePos=week.indexOf(date)
  let score=Math.abs(week.indexOf(s.date)-datePos)*5
  if(date!==s.date)score+=2
  if(duty?.shift==='tagdienst')score+=1
  if(here.some(other=>isHard(other)&&isHard(s)))score+=12
  for(const [id,when] of Object.entries(assigned)){
   const other=byId.get(id)!
   if(Math.abs(week.indexOf(when)-datePos)===1){
    if(incompatible(s,other))score+=18
    else if(isHard(other)&&isHard(s))score+=7
   }
  }
  return score
 }
 for(const item of moving){
  // Respektiere bewusst fixierte/manuell gesetzte Termine. Nur eine vom
  // Nutzer ausdrücklich gewählte Alternative darf einen solchen Termin ändern.
  const fixed=input.forced?.[item.id]||(item.locked||item.createdBy==='tempo-user'?item.date:undefined)
  const candidates=fixed?[fixed]:[item.date,...week.filter(x=>x!==item.date)]
  const options=candidates.filter(x=>week.includes(x)&&!(input.excluded?.[item.id]??[]).includes(x)).map(date=>({date,score:score(item,date)})).sort((a,b)=>a.score-b.score||a.date.localeCompare(b.date))
  const chosen=options.find(x=>Number.isFinite(x.score))
  if(!chosen){assigned[item.id]=item.date;conflicts.push(`${item.title}: kein konfliktfreier Tag gefunden – bitte Vorschlag bearbeiten.`)}else assigned[item.id]=chosen.date
 }
 // A last pass checks anchor adjacency, including sessions chosen before the anchor.
 for(const item of all){const day=assigned[item.id];for(const other of all){if(item.id>=other.id)continue;const otherDay=assigned[other.id];const gap=Math.abs(week.indexOf(day)-week.indexOf(otherDay));if(gap===0&&incompatible(item,other))conflicts.push(`${item.title} und ${other.title} liegen am selben Tag.`);if(gap===1&&incompatible(item,other))conflicts.push(`${item.title} und ${other.title} liegen direkt an aufeinanderfolgenden Tagen.`)}}
 if(taken.some(x=>x.date===input.targetDate))conflicts.push('Am gewählten Fixtermin liegt bereits ein absolviertes Training; Belastung und Erholung bitte prüfen.')
 return {assigned,conflicts:[...new Set(conflicts)],changed:all.filter(x=>assigned[x.id]!==x.date),all,week}
}
/** Only after explicit user approval; one IndexedDB transaction, never touch completed records. */
export async function applyWeekProposal(snapshot:ReplanResult):Promise<void>{
 if(snapshot.conflicts.length)throw Error('Zuerst Trainingskonflikte lösen.')
 const changed=snapshot.changed
 if(!changed.length)return
 const db=await openTempoDatabase()
 await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['plannedSessions','completedSessions'],'readwrite')
  const plan=tx.objectStore('plannedSessions'),completed=tx.objectStore('completedSessions')
  let abortReason='Einheiten wurden während der Planung verändert. Bitte die Vorschau neu öffnen.'
  // Safety: do not change records that were updated after the snapshot was created.
  for(const record of changed){
   const query=plan.get(record.id)
   query.onsuccess=()=>{
    if(!query.result||query.result.updatedAt!==record.updatedAt||query.result.status!=='geplant'){tx.abort();return}
    const done=completed.index('byDate').getAll(record.date)
    done.onsuccess=()=>{
     const linked=(done.result as CompletedRecord[]).some(x=>x.plannedSessionId===record.id)
     if(linked){abortReason='Die Einheit ist inzwischen abgeschlossen und darf nicht verschoben werden.';tx.abort();return}
     const now=new Date().toISOString()
     const wasAuto=record.id.startsWith('auto:')
     // Converting auto IDs to fresh user-confirmed IDs prevents later plan regeneration from overwriting moves.
     const nextId=wasAuto?`rescheduled:${PROFILE_ID}:${crypto.randomUUID?.()??`${Date.now()}-${Math.random()}`}`:record.id
     if(wasAuto)plan.delete(record.id)
     plan.put({...record,id:nextId,date:snapshot.assigned[record.id],createdBy:'tempo-user',locked:true,updatedAt:now,originalPlanId:record.id,originalPlanDate:record.date})
    }
   }
  }
  tx.oncomplete=()=>{db.close();window.dispatchEvent(new Event('tempo:training-change'));resolve()}
  tx.onabort=()=>{db.close();reject(new Error(abortReason))}
  tx.onerror=()=>{db.close();reject(tx.error??new Error('Wochenplan konnte nicht gespeichert werden.'))}
 })
}
