import { useEffect, useState } from 'react';

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};

/** Phase 40: elapsed time survives navigation, reload, and phone backgrounding.
 * Pausing keeps the accumulated time, rather than resetting the clock.
 */
type TimerSnapshot={startedAt:number|null;accumulatedMs:number}
const timerKey=(sessionId:string)=>`tempo.phase28.strengthTimer.${sessionId}`
const cleanTimer=(input:unknown):TimerSnapshot=>{
 if(typeof input==='number'&&Number.isFinite(input)&&input>0)return {startedAt:input,accumulatedMs:0}
 if(!input||typeof input!=='object')return {startedAt:null,accumulatedMs:0}
 const value=input as Partial<TimerSnapshot>
 return {startedAt:typeof value.startedAt==='number'&&Number.isFinite(value.startedAt)&&value.startedAt>0?value.startedAt:null,
  accumulatedMs:typeof value.accumulatedMs==='number'&&Number.isFinite(value.accumulatedMs)?Math.max(0,value.accumulatedMs):0}
}
export function readStrengthTimer(sessionId:string):{running:boolean;elapsedSeconds:number}|null{
 try{const raw=window.localStorage.getItem(timerKey(sessionId));if(!raw)return null
  const parsed:unknown=JSON.parse(raw)
  const state=cleanTimer(parsed)
  const elapsedMs=state.accumulatedMs+(state.startedAt===null?0:Math.max(0,Date.now()-state.startedAt))
  return {running:state.startedAt!==null,elapsedSeconds:Math.floor(elapsedMs/1000)}
 }catch{return null}
}
export function clearStrengthTimer(sessionId:string):void{
 try{window.localStorage.removeItem(timerKey(sessionId))}catch{/* unavailable local storage */}
}
const readSnapshot=(sessionId:string):TimerSnapshot=>{
 try{const value=window.localStorage.getItem(timerKey(sessionId));return value?cleanTimer(JSON.parse(value)):cleanTimer(null)}
 catch{return cleanTimer(null)}
}
const persistTimer=(sessionId:string,value:TimerSnapshot)=>{
 try{window.localStorage.setItem(timerKey(sessionId),JSON.stringify(value))}catch{/* unavailable local storage */}
}
export function StrengthSessionTimer({ sessionId, onStop, onToggle, disabled=false }: { sessionId: string; onStop: (seconds: number) => void;onToggle?:()=>void;disabled?:boolean }) {
 const [snapshot,setSnapshot]=useState<TimerSnapshot>(()=>readSnapshot(sessionId))
 const [now,setNow]=useState(Date.now())
 const [feedback,setFeedback]=useState<'play'|'pause'|null>(null)
 useEffect(()=>{setSnapshot(readSnapshot(sessionId));setNow(Date.now())},[sessionId,disabled])
 useEffect(()=>{
  const tick=()=>setNow(Date.now())
  const timer=window.setInterval(tick,1000)
  document.addEventListener('visibilitychange',tick)
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick)}
 },[])
 useEffect(()=>{
  if(!feedback)return
  const timer=window.setTimeout(()=>setFeedback(null),550)
  return()=>clearTimeout(timer)
 },[feedback])
 const elapsedMs=snapshot.accumulatedMs+(snapshot.startedAt===null?0:Math.max(0,now-snapshot.startedAt))
 const toggle=()=>{
  const time=Date.now()
  const next:TimerSnapshot=snapshot.startedAt===null?{startedAt:time,accumulatedMs:snapshot.accumulatedMs}:
   {startedAt:null,accumulatedMs:snapshot.accumulatedMs+Math.max(0,time-snapshot.startedAt)}
  persistTimer(sessionId,next)
  setNow(time);setSnapshot(next);setFeedback(next.startedAt===null?'pause':'play')
  onToggle?.()
  if(next.startedAt===null)onStop(Math.floor(next.accumulatedMs/1000))
 }
 return <button type="button" disabled={disabled} className="tempo40-timer-touch" aria-label={snapshot.startedAt===null?'Kraft-Timer fortsetzen':'Kraft-Timer pausieren'} aria-pressed={snapshot.startedAt!==null} onClick={toggle}>
   <span className="tempo40-timer-time">{clock(elapsedMs/1000)}</span>
   <span className="tempo40-timer-subtext">{snapshot.startedAt===null?'Pausiert · zum Starten tippen':'Läuft · zum Pausieren tippen'}</span>
   {feedback&&<span className="tempo40-timer-watermark" aria-hidden="true">{feedback==='play'?'▶':'Ⅱ'}</span>}
 </button>
}

/** Countdown per timed set. Completion is explicit, not auto-checked. */
export function TimedHold({ exerciseId, setNumber, targetSeconds, checked, onDone }: {
  exerciseId: string; setNumber: number; targetSeconds: number; checked:boolean; onDone: (done: boolean) => void;
}) {
  const [deadline,setDeadline]=useState<number|null>(null);
  const [remaining,setRemaining]=useState(targetSeconds);

  useEffect(()=> { setRemaining(targetSeconds); setDeadline(null); },[exerciseId,setNumber,targetSeconds]);
  useEffect(()=>{
    if(deadline===null) return;
    const update=()=>{
      const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
      setRemaining(seconds);
      if(seconds===0) setDeadline(null);
    };
    update();
    const timer=window.setInterval(update,250);
    return ()=>window.clearInterval(timer);
  },[deadline]);
  const start=()=>{setRemaining(targetSeconds);setDeadline(Date.now()+targetSeconds*1000);};
  return <div className="tempo-28-hold-timer">
    <span className="tempo-28-hold-target">Satz {setNumber} · Ziel {targetSeconds}s</span>
    <strong className="tempo-28-time-value">{clock(remaining).slice(3)}</strong>
    <button className="tempo-28-timer-button" type="button" onClick={start}>{deadline===null?'Start':'Neustart'}</button>
    <label className="tempo-28-hold-done"><input type="checkbox" checked={checked} onChange={e=>onDone(e.target.checked)} /> Erledigt</label>
  </div>;
}
