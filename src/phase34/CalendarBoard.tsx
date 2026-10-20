import {useEffect,useMemo,useRef,useState, type PointerEvent as ReactPointerEvent} from 'react'
import {buildCalendar,deriveCalendarDay,addDays,todayLocal,type ActivityLike,type ShiftLike,type CompactDay} from '../phase28/calendar-model'
import {holidaySaxony,isWeekendOrHoliday} from '../phase30/saxon-holidays'
import type {RestDayRecord} from '../phase31/rest-days'
import type {TrainingRecord} from '../planning/engine'
import WeekReplanner from '../phase30/WeekReplanner'
import './calendar-board.css'

type Props={days:string[];shifts:ShiftLike[];plans:TrainingRecord[];done:ActivityLike[];restDays:RestDayRecord[];blockKinds:Record<string,string>;onOpenDay:(date:string)=>void;onAddDay:(date:string)=>void;onConfirm:(entry:TrainingRecord)=>Promise<TrainingRecord>;onStart:(session:TrainingRecord)=>void}
const weekday=(date:string)=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(date+'T12:00:00'))
const iconFor=(kind:string)=>/strength/.test(kind)?'🏋️':/run/.test(kind)?'🏃':/swim/.test(kind)?'🏊':/sportspiel/.test(kind)?'⚽':/golf/.test(kind)?'⛳':/stabi/.test(kind)?'🤸':/yoga|mobility/.test(kind)?'🧘':/recovery/.test(kind)?'🌿':'🚴'

const movingAllowed=(r:TrainingRecord)=>r.status==='geplant'&&!r.id.startsWith('preview:')&&r.date>=todayLocal()

export default function CalendarBoard({days,shifts,plans,done,restDays,blockKinds,onOpenDay,onAddDay,onConfirm,onStart}:Props){
 const records=useMemo(()=>buildCalendar(days,shifts,plans,done),[days,shifts,plans,done])
 const [selected,setSelected]=useState<string|null>(null)
 const [floatAt,setFloatAt]=useState<{top:number;left:number}|null>(null)
 function openTile(date:string,element?:HTMLElement|null){if(element){const bounds=element.getBoundingClientRect(),w=Math.min(window.innerWidth*.94,460),h=Math.min(window.innerHeight*.78,650);setFloatAt({top:Math.max(12,Math.min(bounds.top-16,window.innerHeight-h-12)),left:Math.max(8,Math.min(bounds.left,window.innerWidth-w-8))})}else setFloatAt(null);setSelected(date)}
 const [replan,setReplan]=useState<{session:TrainingRecord;target:string;swapId?:string}|null>(null)
 const [confirm,setConfirm]=useState<{session:TrainingRecord;target:string}|null>(null)
 const [drag,setDrag]=useState<TrainingRecord|null>(null)
 const [hover,setHover]=useState<string|null>(null)
 const [message,setMessage]=useState('')
 const [saving,setSaving]=useState(false)
 const held=useRef<ReturnType<typeof setTimeout>|null>(null)
 const pointer=useRef<{id:number;x:number;y:number;session:TrainingRecord;ready:boolean}|null>(null)
 const mounted=useRef(true)
 useEffect(()=>()=>{mounted.current=false;if(held.current)clearTimeout(held.current)},[])
 useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);setConfirm(null)}};document.addEventListener('keydown',esc);return()=>document.removeEventListener('keydown',esc)},[])
 const allDays=useMemo(()=>[...records], [records])
 function getDay(date:string):CompactDay{
  return allDays.find(d=>d.date===date)??deriveCalendarDay(date,shifts.find(s=>s.date===date),plans,done)
 }
 function beginDrag(e:ReactPointerEvent<HTMLButtonElement>,session:TrainingRecord){
  if(!movingAllowed(session)){if(session.id.startsWith('preview:'))setMessage('Bitte den vorläufigen Trainingsvorschlag zuerst bestätigen. Danach kannst du ihn ziehen.');return}
  if(held.current)clearTimeout(held.current)
  pointer.current={id:e.pointerId,x:e.clientX,y:e.clientY,session,ready:false};try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}
  held.current=setTimeout(()=>{if(!pointer.current)return;pointer.current.ready=true;setDrag(session);/* pointer was captured on press */},450)
 }
 function moveDrag(e:ReactPointerEvent<HTMLButtonElement>){
  const p=pointer.current;if(!p||p.id!==e.pointerId)return
  if(!p.ready&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>12){if(held.current)clearTimeout(held.current);pointer.current=null;return}
  if(p.ready){setHover(document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-tempo-date]')?.dataset.tempoDate??null)}
 }
 function finishDrag(e:ReactPointerEvent<HTMLButtonElement>){
  if(held.current)clearTimeout(held.current)
  const p=pointer.current;pointer.current=null;setDrag(null);setHover(null)
  if(!p?.ready||p.id!==e.pointerId)return
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-tempo-date]')?.dataset.tempoDate
  if(target&&target!==p.session.date&&target>=todayLocal()&&!restDays.some(r=>r.date===target))setConfirm({session:p.session,target})
  else if(target===p.session.date)setMessage('Die Einheit bleibt auf ihrem bisherigen Tag.')
  else setMessage('Bitte auf einen freien, zukünftigen Trainingstag ziehen. Dienstangaben werden niemals verschoben.')
 }
 function workoutButtons(date:string){return plans.filter(p=>p.date===date).map(p=><div className="tempo34-workout-line" key={p.id}>
  <button type="button" className={`tempo34-training-pill ${p.id.startsWith('preview:')?'is-preview':''}`} disabled={false} title={movingAllowed(p)?'Lang drücken und auf einen anderen Tag ziehen':'Training ansehen'} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>beginDrag(e,p)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={()=>{if(held.current)clearTimeout(held.current);pointer.current=null;setDrag(null)}} onClick={e=>{e.stopPropagation();if(!drag)openTile(date,e.currentTarget.closest<HTMLElement>('[data-tempo-date]'))}} aria-label={`${p.title}${movingAllowed(p)?' – zum Verschieben lange gedrückt halten':''}`}>
   {iconFor(p.sessionType)} {p.title.replace(/^Vorschlag · /,'')} {p.id.startsWith('preview:')?'· Vorschlag':''}
  </button></div>)}
 async function confirmPreview(session:TrainingRecord,begin=false){if(saving)return;setSaving(true);setMessage('');try{const saved=await onConfirm(session);if(mounted.current){setMessage('Training fest in deinen Plan übernommen.');if(begin){setSelected(null);onStart(saved)}}}catch(e){setMessage(String(e))}finally{if(mounted.current)setSaving(false)}}
 const daySelected=selected?getDay(selected):null
 const restSelected=selected?restDays.find(r=>r.date===selected):null
 return <section className="tempo34-board" aria-label="Einheitlicher Wochenkalender">
  <div className="tempo38-calendar-hint">Tag antippen · Einheit lang drücken zum Verschieben</div>
  {Array.from(new Set(records.map(day=>{const d=new Date(day.date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)})),weekStart=>{
   const week=records.filter(day=>{const d=new Date(day.date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)===weekStart});if(!week.length)return null
   return <div className="tempo34-calendar-week" key={week[0].date}>
    <div className="tempo34-calendar-week-label">{weekday(week[0].date)} – {weekday(week[6].date)}</div>
    {Array.from({length:Math.ceil(week.length/3)},(_,i)=>week.slice(i*3,i*3+3)).map((row,i)=><div className={`tempo34-calendar-row tempo34-n-${row.length+(week.length===7&&i===2?1:0)}`} key={i}>{row.map(day=>{
     const date=day.date,rest=restDays.find(r=>r.date===date),kind=blockKinds[date];return <div key={date} data-tempo-date={date} className={`tempo34-calendar-tile ${date===todayLocal()?'is-today':''} ${isWeekendOrHoliday(date)?'is-holiday':''} ${hover===date?'is-drop-target':''} ${rest?'is-rest':''}`} role="button" tabIndex={0} onClick={e=>openTile(date,e.currentTarget)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTile(date,e.currentTarget)}}} aria-label={`${weekday(date)} · ${day.service} · ${day.activities.length} Aktivitäten`}>
      <div className="tempo34-tile-head"><strong>{weekday(date)}</strong>{kind&&<span className={`tempo31-block-label tempo31-block-${kind.toLowerCase()}`}>{kind}</span>}</div>
      <small className="tempo34-duty">{day.service}{holidaySaxony(date)?' · Feiertag':''}</small>
      {rest&&<span className="tempo34-rest">🌿 {rest.mode==='free'?'Frei 🔒':'Recovery 🔒'}</span>}
      {day.commuteNote&&<span className="tempo34-commute">🚲 {day.commuteNote}</span>}
      {workoutButtons(date)}
      {day.activities.filter(a=>!plans.some(p=>p.id===a.id)).map(a=><span className="tempo34-training-pill is-done" key={a.id}>{a.icon} {a.title} ✓</span>)}
      {!day.activities.length&&!rest&&!day.commuteNote&&<small className="tempo34-empty">Noch frei</small>}
      <button type="button" className="tempo34-plus" onClick={e=>{e.stopPropagation();onAddDay(date)}} aria-label={`Training am ${weekday(date)} hinzufügen`}>＋</button>
     </div>
    })}{week.length===7&&i===2&&<div className="tempo34-week-summary"><strong>Wochenübersicht</strong><span>{week.flatMap(d=>d.activities).length} Aktivitäten</span><small>Nur Training wird getauscht. Dienst bleibt unverändert.</small></div>}</div>)}
   </div>
  })}
  {message&&<p role="status" className="tempo34-message">{message}</p>}
  {drag&&<div className="tempo34-drag-indicator" aria-live="polite">↔ {iconFor(drag.sessionType)} {drag.title} · zum Zieltag ziehen</div>}
  {selected&&daySelected&&<div className="tempo34-overlay" role="presentation" onClick={()=>setSelected(null)}>
   <div className="tempo34-floating-day" style={floatAt?{position:'absolute',top:floatAt.top,left:floatAt.left}:undefined} role="dialog" aria-modal="true" aria-label={`Tagesdetails ${weekday(selected)}`} onClick={e=>e.stopPropagation()}>
    <header className="tempo34-modal-head"><div className="tempo34-day-nav"><button type="button" onClick={()=>setSelected(addDays(selected,-1))} aria-label="Vorheriger Tag">‹</button><strong>{weekday(selected)}</strong><button type="button" onClick={()=>setSelected(addDays(selected,1))} aria-label="Nächster Tag">›</button></div><button type="button" onClick={()=>setSelected(null)} aria-label="Schließen">×</button></header>
    <div className="tempo34-modal-duty"><span>🗓 Dienst: <strong>{daySelected.service}</strong></span>{blockKinds[selected]&&<small>Block: {blockKinds[selected]}</small>}</div>
    {restSelected&&<p className="tempo34-rest">🌿 {restSelected.mode==='free'?'Trainingsfrei':'Recovery'} – fixiert</p>}
    {daySelected.commuteNote&&<p>🚲 {daySelected.commuteNote}</p>}
    <h3>Trainingsinhalt</h3>
    {plans.filter(p=>p.date===selected).length?plans.filter(p=>p.date===selected).map(p=><div className="tempo34-modal-workout" key={p.id}><strong>{iconFor(p.sessionType)} {p.title}</strong><small>{p.priority} · {p.durationMin} min · {p.target}</small><div className="tempo34-modal-actions">{p.id.startsWith('preview:')?<button type="button" disabled={saving} onClick={()=>void confirmPreview(p,true)}>▶ Übernehmen & Start</button>:<button type="button" onClick={()=>{setSelected(null);onStart(p)}}>▶ Start</button>}{p.id.startsWith('preview:')&&<button type="button" disabled={saving} onClick={()=>void confirmPreview(p)}>✓ Bestätigen</button>}<button type="button" onClick={()=>{setSelected(null);onOpenDay(selected)}}>✎ Bearbeiten</button><button type="button" disabled={!movingAllowed(p)} onClick={()=>{setSelected(null);setReplan({session:p,target:p.date})}}>↔ Verschieben</button></div></div>):<p>Keine feste Trainingseinheit für diesen Tag.</p>}
    {daySelected.activities.filter(a=>!plans.some(p=>p.id===a.id)).map(a=><p key={a.id}>{a.icon} {a.title} ✓ absolviert</p>)}
    <div className="tempo34-modal-actions"><button type="button" onClick={()=>{setSelected(null);onAddDay(selected)}}>＋ Aktivität</button><button type="button" onClick={()=>{setSelected(null);onOpenDay(selected)}}>🌿 Recovery / Tagesdetails</button></div>
    <small className="tempo34-modal-hint">Außerhalb der Kachel tippen, um zu schließen. Der Dienst wird beim Verschieben niemals geändert.</small>
   </div>
  </div>}
  {confirm&&<div className="tempo34-overlay" onClick={()=>setConfirm(null)}><div className="tempo34-place-confirm" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><h3>Training hier platzieren?</h3><p>{iconFor(confirm.session.sessionType)} {confirm.session.title}</p><p>{weekday(confirm.session.date)} → <strong>{weekday(confirm.target)}</strong></p><div className="tempo34-modal-actions"><button type="button" onClick={()=>{setReplan(confirm);setConfirm(null);setSelected(null)}}>✓ JA · Neu verteilen</button>{plans.find(p=>p.date===confirm.target&&p.status==='geplant'&&!p.id.startsWith('preview:')&&p.id!==confirm.session.id)&&<button type="button" onClick={()=>{const other=plans.find(p=>p.date===confirm.target&&p.status==='geplant'&&!p.id.startsWith('preview:')&&p.id!==confirm.session.id);setReplan({...confirm,swapId:other?.id});setConfirm(null);setSelected(null)}}>⇄ Trainings tauschen</button>}<button type="button" onClick={()=>setConfirm(null)}>× NEIN</button></div><small>Danach zeigt TEMPO die Neuverteilung zur Gesamtbestätigung.</small></div></div>}
  {replan&&<WeekReplanner key={`${replan.session.id}:${replan.target}`} anchor={replan.session} initialTarget={replan.target} initialSwapId={replan.swapId} onClose={()=>setReplan(null)} onSaved={()=>setReplan(null)}/>}
 </section>
}
