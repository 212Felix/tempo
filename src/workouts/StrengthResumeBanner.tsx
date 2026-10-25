import {useState} from 'react'
import {readActiveStrengthDraft,type StrengthDraft} from './strengthDraft'
import {readStrengthTimer} from '../phase28/StrengthTimers'

/** Shown on Tagestraining, independently of the planned workout for today. */
export default function StrengthResumeBanner({onResume}:{onResume:(draft:StrengthDraft)=>void}){
 const [draft]=useState(()=>readActiveStrengthDraft())
 if(!draft)return null
 const time=readStrengthTimer(draft.sessionKey)
 return <aside className="tempo40-resume-banner" aria-label="Offenes Krafttraining">
  <div><strong>Krafttraining noch offen</strong><p>Dein Zwischenstand vom {new Date(draft.savedAt).toLocaleString('de-DE')} ist gesichert.{time?.running?' Der Trainings-Timer läuft weiter.':''}</p></div>
  <button type="button" onClick={()=>onResume(draft)}>Aktives Training fortsetzen</button>
 </aside>
}
