/** Phase 28: Read-only normalized view of the Phase 27 data model.
 * Does not call IndexedDB and does not modify records.
 */
export type Commute = 'nein' | 'hin' | 'zurueck' | 'beide';
export interface ShiftLike {date: string; shift?: string; commute?: Commute;}
export interface ActivityLike {
  id: string;
  date: string;
  title?: string;
  sessionType?: string;
  status?: string;
  plannedSessionId?: string;
  commuteLeg?: 'hin' | 'rueck' | 'beide';
}
export interface CompactActivity {
  id: string;
  title: string;
  icon: string;
  done: boolean;
  commuteLeg?: 'hin' | 'rueck' | 'beide';
}
export interface CompactDay {
  date: string;
  service: string;
  activities: CompactActivity[];
  commuteNote: string | null;
}
const dayText: Record<string,string> = {
  frei: 'Frei', tagdienst: 'Tagdienst', einsatz: 'Einsatz', offen: 'Offen',
  fruehdienst: 'Frühdienst', spaetdienst: 'Spätdienst', nachtdienst: 'Nachtdienst',
};
const iconFor=(type:string)=> type.includes('strength')?'🏋':type.includes('run')?'🏃':type.includes('mobility')?'🧘':type.includes('swim')?'🏊':type.includes('recovery')?'◯':type.includes('commute')?'🚲':'🚴';
export const todayLocal = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const mondayOf = (date:string):string => {const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()-(d.getDay()+6)%7);return todayLocal(d);};
export const addDays = (date:string,count:number):string => {const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+count);return todayLocal(d);};
export function daysFor(anchor:string, horizon:7|14):string[] {
  const start=mondayOf(anchor);
  return Array.from({length:horizon},(_,i)=>addDays(start,i));
}
export const WEEK_PATTERN = [[0,1,2],[3,4],[5,6]] as const;
export function deriveCalendarDay(date:string,shift:ShiftLike|undefined,plans:ActivityLike[],completed:ActivityLike[]):CompactDay {
  const existing=plans.filter(x=>x.date===date);
  const done=completed.filter(x=>x.date===date);
  const linked=new Set(done.map(x=>x.plannedSessionId).filter((x):x is string=>Boolean(x)));
  const listed:CompactActivity[]=existing.map(x=>({
    id:x.id,title:x.title?.trim()||x.sessionType||'Training',icon:iconFor(x.sessionType||''),
    done:x.status==='erledigt'||linked.has(x.id),commuteLeg:x.commuteLeg,
  }));
  for(const x of done){
    if(x.plannedSessionId && existing.some(p=>p.id===x.plannedSessionId))continue;
    if(listed.some(y=>y.id===x.id))continue;
    listed.push({id:x.id,title:x.title?.trim()||x.sessionType||'Training',icon:iconFor(x.sessionType||''),done:true,commuteLeg:x.commuteLeg});
  }
  const commute=shift?.commute;
  const linkedHin=listed.some(x=>x.commuteLeg==='hin'||x.commuteLeg==='beide');
  const linkedBack=listed.some(x=>x.commuteLeg==='rueck'||x.commuteLeg==='beide');
  const commuteExisting=existing.some(x=>x.sessionType==='commute')||done.some(x=>x.sessionType==='commute');
  const planHin=(commute==='hin'||commute==='beide')&&!linkedHin;
  const planBack=(commute==='zurueck'||commute==='beide')&&!linkedBack;
  const commuteNote=commuteExisting ? null : planHin&&planBack?'Pendeln (Hin&Rück)':planHin?'Pendeln (Hin)':planBack?'Pendeln (Rück)':null;
  return {date,service:shift?.shift?dayText[shift.shift]||shift.shift:'Offen',activities:listed,commuteNote};
}
export function buildCalendar(dates:string[],shifts:ShiftLike[],plans:ActivityLike[],done:ActivityLike[]):CompactDay[]{
 const byDate=new Map(shifts.map(x=>[x.date,x]));
 return dates.map(date=>deriveCalendarDay(date,byDate.get(date),plans,done));
}
