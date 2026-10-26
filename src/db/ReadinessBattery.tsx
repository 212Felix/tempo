/** Readiness drawn from TEMPO's own manual check-in, NOT Garmin Body Battery. */
import type {ReactNode} from 'react'
export type ReadinessLevel='offen'|'gruen'|'gelb'|'rot'
const blocks:Record<ReadinessLevel,number>={offen:0,gruen:5,gelb:3,rot:1}
export default function ReadinessBattery({level,children}:{level:ReadinessLevel;children?:ReactNode}){
 return <div className={`tempo40b-battery tempo40b-battery-${level}`} role="img" aria-label={`TEMPO Tagesform: ${level==='gruen'?'grün':level==='gelb'?'gelb':level==='rot'?'rot':'offen'}`}>
   <div className="tempo40b-battery-shell"><div className="tempo40b-battery-bars">{Array.from({length:5},(_,i)=><span key={i} className={i<blocks[level]?'charged':''}/>)}</div></div>
   <div className="tempo40b-battery-copy"><span>🚴 · 🏃</span><strong>{level==='offen'?'CHECK-IN':level==='gruen'?'GUTE BASIS':level==='gelb'?'DOSIEREN':'ERHOLEN'}</strong><small>{level==='offen'?'Noch keine Einschätzung':'TEMPO Tagesform · selbst eingeschätzt'}</small>{children}</div>
 </div>
}
