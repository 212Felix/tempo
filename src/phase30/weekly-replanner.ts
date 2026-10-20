import {openTempoDatabase} from '../db/storage'
import {PROFILE_ID,currentKey,type TrainingRecord,type CompletedRecord,type ShiftRecord} from '../planning/engine'
import {makeRestDay,restId,type RestDayRecord,type RestMode} from '../phase31/rest-days'
import {rhythmPenalty,type WeekRhythm} from '../phase35/weekly-rhythm'
export const weekDates=(iso:string)=>{const d=new Date(`${iso}T12:00:00Z`),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day);return Array.from({length:7},(_,i)=>{const x=new Date(d);x.setUTCDate(d.getUTCDate()+i);return x.toISOString().slice(0,10)})}
export type ReplanInput={sessions:TrainingRecord[];completed:CompletedRecord[];shifts:ShiftRecord[];anchorId:string;targetDate:string;excluded?:Record<string,string[]>;forced?:Record<string,string>;restDays?:RestDayRecord[];suggestions?:TrainingRecord[];rhythm?:WeekRhythm}
export type RestReplanInput={sessions:TrainingRecord[];completed:CompletedRecord[];shifts:ShiftRecord[];restDate:string;mode:RestMode;note?:string;excluded?:Record<string,string[]>;forced?:Record<string,string>;restDays?:RestDayRecord[];suggestions?:TrainingRecord[];rhythm?:WeekRhythm}
export type ReplanResult={assigned:Record<string,string>;conflicts:string[];notices:string[];changed:TrainingRecord[];all:TrainingRecord[];week:string[];restDay?:RestDayRecord}
/** Include the anchor week and TWO following weeks; Sunday can move into the future. */
export const replanDates=(anchor:string)=>Array.from({length:21},(_,i)=>{const start=weekDates(anchor)[0],d=new Date(`${start}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)})
const isHard=(s:TrainingRecord)=>/quality|long|strength-[ab]|manual-martial/i.test(s.sessionType)||/schwelle|vo2|intervall|hart/i.test(`${s.title} ${s.target}`)||((s.rpe??0)>=8&&!/strength-c/.test(s.sessionType))
const isQuality=(s:TrainingRecord)=>/quality/i.test(s.sessionType)||/schwelle|vo2|intervall/i.test(`${s.title} ${s.target}`)
const isLegStrength=(s:TrainingRecord)=>/strength/i.test(s.sessionType)&&!/oberkörper|strength-c/i.test(`${s.title} ${s.sessionType}`)
const isEasy=(s:TrainingRecord)=>/recovery|mobility|yoga|stabi/i.test(`${s.sessionType} ${s.title}`)
function incompatible(a:TrainingRecord,b:TrainingRecord){return (isQuality(a)&&isHard(b))||(isQuality(b)&&isHard(a))||(isLegStrength(a)&&isLegStrength(b))}
export function proposeWeek(input:ReplanInput):ReplanResult{
 const anchor=input.sessions.find(x=>x.id===input.anchorId)
 if(!anchor||anchor.status!=='geplant')throw Error('Die zu verschiebende Einheit ist nicht mehr geplant.')
 if(input.targetDate<currentKey())throw Error('In die Vergangenheit darf kein Training verschoben werden.')
 const days=replanDates(anchor.date)
 if(!days.includes(input.targetDate))throw Error('Der gewählte Tag liegt außerhalb des Planungsfensters.')
 return schedule({sessions:input.sessions,completed:input.completed,shifts:input.shifts,days,anchor,targetDate:input.targetDate,restDays:input.restDays??[],excluded:input.excluded,forced:input.forced,suggestions:input.suggestions,rhythm:input.rhythm})
}
export function proposeRestDay(input:RestReplanInput):ReplanResult{
 if(input.restDate<currentKey())throw Error('Ein trainingsfreier Tag kann nur für heute oder die Zukunft fixiert werden.')
 return schedule({sessions:input.sessions,completed:input.completed,shifts:input.shifts,days:replanDates(input.restDate),restDate:input.restDate,restDay:makeRestDay(input.restDate,input.mode,input.note),restDays:input.restDays??[],excluded:input.excluded,forced:input.forced,suggestions:input.suggestions,rhythm:input.rhythm})
}
function schedule(input:{sessions:TrainingRecord[];completed:CompletedRecord[];shifts:ShiftRecord[];days:string[];anchor?:TrainingRecord;targetDate?:string;restDate?:string;restDay?:RestDayRecord;restDays:RestDayRecord[];excluded?:Record<string,string[]>;forced?:Record<string,string>;suggestions?:TrainingRecord[];rhythm?:WeekRhythm}):ReplanResult{
 const {days,anchor,targetDate,restDate}=input
 const today=currentKey()
 const excludedDays=new Set(input.restDays.map(x=>x.date))
 if(restDate)excludedDays.add(restDate)
 const stored=input.sessions.filter(x=>x.profileId===PROFILE_ID&&days.includes(x.date)&&x.status==='geplant'&&!['manual-sportspiel','manual-golf'].includes(x.sessionType))
 const savedDates=new Set(stored.map(x=>x.date))
 // Read-only, calculated training suggestions are included in the preview.
 // They enter the database ONLY if the athlete confirms a date change.
 const suggestions=(input.suggestions??[]).filter(x=>x.profileId===PROFILE_ID&&days.includes(x.date)&&x.status==='geplant'&&!savedDates.has(x.date))
 const all=[...stored,...suggestions]
 const taken=input.completed.filter(x=>x.profileId===PROFILE_ID&&days.includes(x.date)&&!['manual-swimming','manual-sportspiel','manual-golf'].includes(x.sessionType??''))
 const assigned:Record<string,string>={}
 if(anchor&&targetDate)assigned[anchor.id]=targetDate
 const byId=new Map(all.map(x=>[x.id,x]))
 const conflicts:string[]=[]
 const notices:string[]=[]
 if(anchor&&targetDate&&excludedDays.has(targetDate))conflicts.push('Der Zieltag wurde von dir als trainingsfrei fixiert.')
 if(restDate&&taken.some(x=>x.date===restDate))conflicts.push('Am freizuhaltenden Tag liegt bereits ein absolviertes Training; dies bleibt unverändert.')
 const isFixed=(x:TrainingRecord)=>!x.id.startsWith('preview:')&&(x.date<today||x.locked||x.createdBy==='tempo-user')
 const moving=[...all.filter(x=>x.id!==anchor?.id)].sort((a,b)=>Number(isFixed(b))-Number(isFixed(a))||({MUSS:0,SOLL:1,KANN:2}[a.priority]-{MUSS:0,SOLL:1,KANN:2}[b.priority])||a.date.localeCompare(b.date))
 const score=(s:TrainingRecord,date:string)=>{
  if(excludedDays.has(date)||date<today&&date!==s.date)return Infinity
  const duty=input.shifts.find(x=>x.date===date)
  if(duty?.shift==='einsatz'&&!isEasy(s))return Infinity
  if(taken.some(x=>x.date===date)&&!isEasy(s)&&s.date!==date)return Infinity
  const here=Object.entries(assigned).filter(([,when])=>when===date).map(([id])=>byId.get(id)!).filter(Boolean)
  if(here.some(other=>incompatible(s,other)||(isHard(s)&&isHard(other))))return Infinity
  if(here.length>=2)return Infinity
  const datePos=days.indexOf(date)
  let value=Math.abs(days.indexOf(s.date)-datePos)*5+rhythmPenalty(s,date,input.rhythm)
  if(date!==s.date)value+=2
  if(duty?.shift==='tagdienst'){
   // Availability preferences are respected without forbidding an athlete's manual override.
   if(s.sessionType==='long'&&s.durationMin>=120)value+=28
   else if(isQuality(s)&&!duty.afterWorkCycling)value+=18
   else if(/strength/.test(s.sessionType)&&!(duty.possibleStrength||duty.afterWorkStrength||duty.workStrength))value+=14
   else if(/run/.test(s.sessionType)&&!(duty.possibleRun||duty.afterWorkRun||duty.workRun))value+=14
   else value+=1
  }
  if(!duty||duty.shift==='offen')value+=6
  for(const [id,when] of Object.entries(assigned)){
   const other=byId.get(id)!
   if(!other)continue
   if(Math.abs(days.indexOf(when)-datePos)===1){
    if(incompatible(s,other))value+=55
    else if(isHard(other)&&isHard(s))value+=7
   }
  }
  return value
 }
 for(const item of moving){
  // Never move already-finished, past or athlete-locked sessions without explicit selection.
  const fixed=input.forced?.[item.id]||(isFixed(item)?item.date:undefined)
  const candidates=fixed?[fixed]:[item.date,...days.filter(x=>x!==item.date)]
  const options=candidates.filter(x=>days.includes(x)&&!(input.excluded?.[item.id]??[]).includes(x)).map(date=>({date,score:score(item,date)})).sort((a,b)=>a.score-b.score||a.date.localeCompare(b.date))
  const chosen=options.find(x=>Number.isFinite(x.score))
  if(!chosen){assigned[item.id]=item.date;conflicts.push(`${item.title}: kein konfliktfreier Tag gefunden. Fixierte Einheiten bleiben unverändert.`)}
  else assigned[item.id]=chosen.date
 }
 for(const item of all){
  if(excludedDays.has(assigned[item.id]))conflicts.push(`${item.title} liegt auf einem festgelegten trainingsfreien Tag.`)
  const day=assigned[item.id]
  for(const other of all){
   if(item.id>=other.id)continue
   const gap=Math.abs(days.indexOf(day)-days.indexOf(assigned[other.id]))
   if(gap===0&&incompatible(item,other))conflicts.push(`${item.title} und ${other.title} liegen am selben Tag.`)
   if(gap===1&&incompatible(item,other))notices.push(`${item.title} und ${other.title} liegen an aufeinanderfolgenden Tagen. Bei hoher Belastung Abstand prüfen.`)
  }
 }
 if(anchor&&targetDate&&taken.some(x=>x.date===targetDate))conflicts.push('Am gewählten Fixtermin liegt bereits ein absolviertes Training; automatische Überplanung bleibt gesperrt.')
 if(anchor&&targetDate&&input.shifts.some(x=>x.date===targetDate&&x.shift==='einsatz'))notices.push('Der ausgewählte Tag ist ein Einsatz-Tag. TEMPO empfiehlt die Verfügbarkeit noch einmal zu prüfen.')
 return {assigned,conflicts:[...new Set(conflicts)],notices:[...new Set(notices)],changed:all.filter(x=>assigned[x.id]!==x.date),all,week:days,restDay:input.restDay}
}
/** Only after explicit user approval; one IndexedDB transaction, never touch completed records. */
export async function applyWeekProposal(snapshot:ReplanResult):Promise<void>{
 if(snapshot.conflicts.length)throw Error('Zuerst Trainingskonflikte lösen.')
 const changed=snapshot.changed
 if(!changed.length&&!snapshot.restDay)return
 const db=await openTempoDatabase()
 await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['plannedSessions','completedSessions','settings'],'readwrite')
  const plan=tx.objectStore('plannedSessions'),completed=tx.objectStore('completedSessions'),settings=tx.objectStore('settings')
  let abortReason='Einheiten wurden während der Planung verändert. Bitte die Vorschau neu öffnen.'
  if(snapshot.restDay){
   const entry=snapshot.restDay
   const previous=settings.get(restId(entry.date))
   previous.onsuccess=()=>{
    // Respect an existing choice changed in another tab; re-open preview first.
    if(previous.result){abortReason='Für diesen Tag liegt bereits eine Festlegung vor. Bitte neu öffnen.';tx.abort();return}
    const done=completed.index('byDate').getAll(entry.date)
    done.onsuccess=()=>{
     if((done.result as CompletedRecord[]).some(x=>x.profileId===PROFILE_ID)){
      abortReason='Der Tag hat inzwischen ein absolviertes Training und kann nicht rückwirkend freigehalten werden.';tx.abort();return
     }
     settings.add(entry)
    }
   }
  }
  // Safety: do not change records that were updated after the snapshot was created.
  for(const record of changed){
   if(record.id.startsWith('preview:')){
    const now=new Date().toISOString()
    const destination=snapshot.assigned[record.id]
    const proposed={...record,id:`rescheduled:${PROFILE_ID}:${crypto.randomUUID?.()??`${Date.now()}-${Math.random()}`}`,date:destination,title:record.title.replace(/^Vorschlag · /,''),createdBy:'tempo-user',locked:true,createdAt:now,updatedAt:now}
    plan.add(proposed)
    continue
   }
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
