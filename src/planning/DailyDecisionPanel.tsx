import {useEffect, useState} from 'react'
import {getRecord, listRecords, saveRecord} from '../db/storage'
import {assessDailyTraining, type DailyGuidance} from './daily'
import {currentKey, PROFILE_ID, type CompletedRecord, type ReadinessRecord, type ShiftRecord, type TrainingRecord} from './engine'
import './daily.css'

/** Zeigt Hinweise für HEUTE. Keine automatische Änderung des Plans. */
export default function DailyDecisionPanel({onOpenReadiness,onOpenCalendar}:{onOpenReadiness:()=>void;onOpenCalendar:()=>void}) {
  const [guidance,setGuidance] = useState<DailyGuidance | null>(null)
  const [shift,setShift]=useState<ShiftRecord | undefined>()
  const [saving,setSaving]=useState(false)
  const [availabilityNotice,setAvailabilityNotice]=useState('')
  const [error,setError] = useState('')
  const [revision,setRevision] = useState(0)
  useEffect(()=>{
    const refresh=()=>setRevision(n=>n+1)
    window.addEventListener('tempo:training-change', refresh)
    window.addEventListener('tempo:shift-change', refresh)
    window.addEventListener('tempo:readiness-change', refresh)
    return()=>{
      window.removeEventListener('tempo:training-change', refresh)
      window.removeEventListener('tempo:shift-change', refresh)
      window.removeEventListener('tempo:readiness-change', refresh)
    }
  },[])
  useEffect(()=>{
    let active=true
    const day=currentKey()
    void Promise.all([
      getRecord<ReadinessRecord>('readinessEntries',`${PROFILE_ID}:${day}`),
      getRecord<ShiftRecord>('shifts',`${PROFILE_ID}:${day}`),
      listRecords<TrainingRecord>('plannedSessions'),
      listRecords<CompletedRecord>('completedSessions'),
    ]).then(([readiness,shift,planned,completed])=>{
      if(!active)return
      setError('')
      setShift(shift)
      setGuidance(assessDailyTraining({date:day,readiness,shift,
        planned:planned.filter(x=>x.profileId===PROFILE_ID),
        completed:completed.filter(x=>x.profileId===PROFILE_ID),
      }))
    }).catch(err=>{if(active)setError(`Tagesdaten konnten nicht gelesen werden: ${String(err)}`)})
    return()=>{active=false}
  },[revision])
  async function toggleAvailability(field:'workStrength'|'workRun'|'afterWorkStrength'|'afterWorkRun'|'afterWorkCycling') {
    if(saving||shift?.shift!=='tagdienst')return
    setSaving(true)
    try{
      const now=new Date().toISOString()
      const record:ShiftRecord={...shift,[field]:!Boolean(shift[field]),updatedAt:now}
      await saveRecord('shifts',record)
      setShift(record)
      setAvailabilityNotice('Zeitfenster gespeichert ✓ · Bestehende Trainings bleiben unverändert. Neuen Planvorschlag unter „14 Tage“ prüfen.')
      window.dispatchEvent(new Event('tempo:shift-change'))
    }catch(e){setAvailabilityNotice('Speichern fehlgeschlagen: '+String(e))}
    finally{setSaving(false)}
  }
  return <section className={`panel tempo-daily-decision tempo-daily-${guidance?.status??'offen'}`} aria-label="Tagesentscheidung">
    <div className="eyebrow">HEUTE · READINESS + TRAINING + DIENST</div>
    {error?<p role="alert">{error}</p>:!guidance?<p>Tagesbewertung wird geladen …</p>:<>
      <div className="tempo-daily-header"><h2>{guidance.label}</h2><span>{guidance.status==='normal'?'● GRÜN':guidance.status==='vorsicht'?'● GELB':guidance.status==='erholung'?'● ROT':'○ OFFEN'}</span></div>
      {guidance.reason.map(text=><p className="tempo-daily-reason" key={text}>{text}</p>)}
      <p className="tempo-daily-recommendation">{guidance.recommendation}</p>
      {guidance.requiresReview && <div className="tempo-daily-warning" role="status"><strong>Geplante Einheit prüfen</strong><p>{guidance.conflictTitles.length ? guidance.conflictTitles.join(' · ') : 'Für heute ist ein belastender Trainingsreiz vorgesehen.'} bleibt gespeichert. TEMPO ändert nichts ohne deine Bestätigung.</p></div>}
      {shift?.shift==='tagdienst' && <div className="tempo-daily-availability"><h3>Was ist trotz Dienst möglich?</h3>
        <div className="tempo-daily-availability-buttons">
          {([['workStrength','Kraft auf Arbeit'],['workRun','Laufen auf Arbeit'],['afterWorkStrength','Kraft nach Dienst'],['afterWorkRun','Laufen nach Dienst'],['afterWorkCycling','Rad nach Dienst']] as const).map(([key,name])=><button type="button" key={key} disabled={saving} aria-pressed={Boolean(shift[key])} className={shift[key]?'selected':''} onClick={()=>void toggleAvailability(key)}>{shift[key]?'✓ ':''}{name}</button>)}
        </div>
        {availabilityNotice&&<p role="status">{availabilityNotice}</p>}
      </div>}
      <div className="tempo-daily-actions"><button type="button" onClick={onOpenReadiness}>{guidance.readiness==='offen'?'Check-in jetzt ausfüllen':'Readiness ansehen'}</button>{guidance.requiresReview && <button type="button" className="tempo-daily-plan-link" onClick={onOpenCalendar}>Neuplanung prüfen →</button>}<span>Hinweis, keine automatische Freigabe oder Planänderung.</span></div>
    </>}
  </section>
}
