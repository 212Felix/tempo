import {useMemo} from 'react';
import {buildCalendar,todayLocal,WEEK_PATTERN,type ActivityLike,type ShiftLike} from './calendar-model';
import './compact-calendar.css';
import {holidaySaxony,isWeekendOrHoliday} from '../phase30/saxon-holidays';

/** Read-only calendar view: all persistence stays in the existing TEMPO modules. */
export default function CompactCalendar({shifts,plans,done,onOpenDay,days}:{
 shifts:ShiftLike[];plans:ActivityLike[];done:ActivityLike[];onOpenDay:(date:string)=>void;days:string[];
}){
 const dates=days;
 const horizon=days.length;
 const cells=useMemo(()=>buildCalendar(dates,shifts,plans,done),[dates,shifts,plans,done]);
 const fmt=(iso:string)=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(`${iso}T12:00:00`));
 return <section className="tempo-28-calendar" aria-label="Trainingskalender">
  <header className="tempo-28-controls"><h2>Deine Trainingswoche</h2><span>Tippe auf einen Tag für alle Details</span></header>
  {Array.from({length:horizon/7},(_,week)=><div key={dates[week*7]} className="tempo-28-week">
   <div className="tempo-28-week-caption">{fmt(dates[week*7])} – {fmt(dates[week*7+6])}</div>
   {WEEK_PATTERN.map((row,i)=><div key={i} className={`tempo-28-row tempo-28-cols-${row.length}`}>
    {row.map(idx=>{const day=cells[week*7+idx];return <button type="button" className={`tempo-28-tile ${day.date===todayLocal()?'is-today':''} ${isWeekendOrHoliday(day.date)?'is-holiday':''}`} key={day.date} onClick={()=>onOpenDay(day.date)} aria-label={`${fmt(day.date)}, ${day.service}, ${day.activities.length} Trainingsaktivitäten`}>
     <strong className="tempo-28-date">{fmt(day.date)}</strong>{holidaySaxony(day.date)&&<small className="tempo30-holiday-caption">{holidaySaxony(day.date)}</small>}<small className="tempo-28-duty">{day.service}</small>
     {day.commuteNote&&<span className="tempo-28-commute">🚲 {day.commuteNote}</span>}
     {day.activities.map(a=><span key={a.id} className="tempo-28-training"><span aria-hidden="true">{a.icon} </span>{a.title}{a.commuteLeg&&<span className="tempo-28-route"> ↩ {a.commuteLeg==='rueck'?'Rückweg':a.commuteLeg==='hin'?'Hinweg':'Hin&Rück'}</span>}{a.done&&<span aria-label="Absolviert"> ✓</span>}</span>)}
     {day.activities.length===0&&!day.commuteNote&&<span className="tempo-28-empty">Ruhetag / frei</span>}
    </button>})}
   </div>)}
  </div>)}
 </section>;
}
