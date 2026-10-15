import { useEffect, useState } from 'react';

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};

/** Single Start / Stop control; start timestamp persists across navigation/reload. */
export function StrengthSessionTimer({ sessionId, onStop }: { sessionId: string; onStop: (seconds: number) => void }) {
  const key = `tempo.phase28.strengthTimer.${sessionId}`;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastStop, setLastStop] = useState<number | null>(null);
  useEffect(() => {
    try {
      const found = window.localStorage.getItem(key);
      if (found && Number.isFinite(Number(found)) && Number(found)>0) setStartedAt(Number(found));
    } catch { /* private mode / quota */ }
  }, [key]);
  useEffect(() => {
    if (startedAt === null) return;
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now()-startedAt)/1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const toggle = () => {
    if (startedAt === null) {
      const now = Date.now();
      try { window.localStorage.setItem(key,String(now)); } catch { /* keep in memory */ }
      setStartedAt(now); setElapsed(0); setLastStop(null);
    } else {
      const duration = Math.max(0,Math.round((Date.now()-startedAt)/1000));
      // First clear running flag; the parent writes to the app's existing store.
      try { window.localStorage.removeItem(key); } catch { /* ignore */ }
      setStartedAt(null); setElapsed(duration); setLastStop(duration); onStop(duration);
    }
  };
  return <div className="tempo-28-session-timer" aria-label="Krafttrainingszeit">
    <span className="tempo-28-time-value">{clock(elapsed)}</span>
    <button type="button" className="tempo-28-timer-button" onClick={toggle}>{startedAt === null ? 'Start' : 'Stopp'}</button>
    {lastStop !== null && <span className="tempo-28-timer-confirm">{clock(lastStop)} gestoppt. Übernahme beim Speichern der Einheit erforderlich.</span>}
  </div>;
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
