import {useEffect,useMemo,useState} from 'react'
import {listRecords} from '../db/storage'
import {PROFILE_ID,type TrainingRecord,type CompletedRecord,type ShiftRecord} from '../planning/engine'
import {proposeWeek,applyWeekProposal,weekDates,type ReplanResult} from './weekly-replanner'
import './phase30.css'
const icon=(s:TrainingRecord)=>/strength/.test(s.sessionType)?'🏋️':/run/.test(s.sessionType)?'🏃':/recovery|mobility|yoga|stabi/.test(`${s.sessionType} ${s.title}`)?'🧘':'🚴'
const nice=(d:string)=>new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(`${d}T12:00:00`))
export default function WeekReplanner({anchor,onClose,onSaved}:{anchor:TrainingRecord;onClose:()=>void;onSaved:()=>void}){
 const [source,setSource]=useState<{sessions:TrainingRecord[];completed:CompletedRecord[];shifts:ShiftRecord[]}|null>(null)
 const [target,setTarget]=useState(anchor.date),[exclusions,setExclusions]=useState<Record<string,string[]>>({}),[forced,setForced]=useState<Record<string,string>>({})
 const [approved,setApproved]=useState<Record<string,'yes'|'no'>>({}),[dropdown,setDropdown]=useState<string|null>(null)
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{let live=true;void Promise.all([listRecords<TrainingRecord>('plannedSessions'),listRecords<CompletedRecord>('completedSessions'),listRecords<ShiftRecord>('shifts')]).then(([sessions,completed,shifts])=>{if(live)setSource({sessions,completed,shifts})}).catch(error=>setMessage(String(error)));return()=>{live=false}},[anchor.id])
 const proposal=useMemo<ReplanResult|undefined>(()=>{if(!source)return;try{return proposeWeek({...source,anchorId:anchor.id,targetDate:target,excluded:exclusions,forced})}catch(error){return undefined}},[source,anchor.id,target,exclusions,forced])
 useEffect(()=>{if(!dropdown)return;const close=(event:PointerEvent)=>{
  const target=event.target as HTMLElement
  if(!target.closest('.tempo30-alternatives')&&!target.closest('.tempo30-day-actions'))setDropdown(null)
 };document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[dropdown])
 const week=weekDates(anchor.date)
 const differences=proposal?.changed.filter(s=>s.id!==anchor.id)||[]
 const rejected=differences.filter(s=>approved[s.id]==='no')
 const canApply=Boolean(proposal&&!proposal.conflicts.length&&!rejected.length&&target!==anchor.date)
 const reroll=()=>{if(!proposal)return;const next={...exclusions};for(const item of rejected){next[item.id]=[...new Set([...(next[item.id]||[]),proposal.assigned[item.id]])]}setExclusions(next);setApproved({});setDropdown(null);setMessage(rejected.length?'Alternative Tage werden mit deinen Ablehnungen gesucht.':'Neue Verteilung geprüft.')}
 const selectAlternative=(item:TrainingRecord,date:string)=>{setForced(old=>({...old,[item.id]:date}));setApproved(old=>({...old,[item.id]:'yes'}));setDropdown(null);setMessage('Alternative ausgewählt. Die übrigen Einheiten wurden neu auf Konflikte geprüft.')}
 const commit=async()=>{if(!proposal||!canApply)return;setBusy(true);setMessage('');try{await applyWeekProposal(proposal);onSaved();onClose()}catch(error){setMessage(String(error))}finally{setBusy(false)}}
 return <div className="tempo30-modal-bg" onClick={e=>{if(e.target===e.currentTarget)onClose()}}><section className="tempo30-modal" role="dialog" aria-modal="true" aria-label="Intelligente Wochenumplanung">
 <header className="tempo30-modal-head"><div><div className="eyebrow">DEIN ALLTAG · TEMPOS TRAININGSLOGIK</div><h2>Wochenplan neu ordnen</h2></div><button type="button" aria-label="Schließen" onClick={onClose}>×</button></header>
 <p><strong>{icon(anchor)} {anchor.title}</strong> am {nice(anchor.date)} · Priorität {anchor.priority}. Wähle einen neuen Tag. TEMPO versucht alle übrigen Trainings zu erhalten und berücksichtigt harte Belastungen.</p>
 <label>Neuer, von dir fixierter Trainingstag <select value={target} onChange={e=>{setTarget(e.target.value);setApproved({});setExclusions({});setForced({})}}>{week.map(d=><option key={d} value={d}>{nice(d)}</option>)}</select></label>
 <div className="tempo30-legend"><span className="tempo30-old">Rot: bisherige Einheiten</span><span className="tempo30-new">Grün: neuer Vorschlag</span></div>
 {proposal?<div className="tempo30-week-grid">{[[0,1,2],[3,4],[5,6]].map((row,i)=><div key={i} className={`tempo30-week-row cols-${row.length}`}>{row.map(index=>{
 const day=week[index],old=proposal.all.filter(s=>s.date===day),newItems=proposal.all.filter(s=>proposal.assigned[s.id]===day),changes=[...new Set([...old,...newItems].filter(s=>s.date!==proposal.assigned[s.id]))],affected=changes.filter(s=>s.id!==anchor.id),choice=affected.length?approved[affected[0].id]:undefined
 return <div className="tempo30-week-tile" key={day}><strong>{nice(day)}</strong>{old.filter(s=>s.date!==proposal.assigned[s.id]).map(s=><span key={s.id} className="tempo30-old">{icon(s)} {s.title}</span>)}{newItems.map(s=><span key={s.id} className="tempo30-new">{icon(s)} {s.title}{s.id===anchor.id&&' 📌'}</span>)}{newItems.length===0&&<small>Frei / Erholung</small>}
 {affected.length>0&&<div className="tempo30-day-actions"><button type="button" className={choice==='yes'?'picked':''} onClick={()=>setApproved(prev=>({...prev,...Object.fromEntries(affected.map(s=>[s.id,'yes']))}))} aria-label="Vorschlag für diesen Tag bestätigen">✓</button><button type="button" className={choice==='no'?'rejected':''} onClick={()=>setApproved(prev=>({...prev,...Object.fromEntries(affected.map(s=>[s.id,'no']))}))} aria-label="Vorschlag für diesen Tag ablehnen">×</button><button type="button" aria-label="Alternativen für den Tag" aria-expanded={dropdown===day} onClick={()=>setDropdown(x=>x===day?null:day)}>⌄</button></div>}
 {dropdown===day&&affected.length>0&&<div className="tempo30-alternatives"><small>Passenden Termin wählen:</small>{affected.map(s=><label key={s.id}>{icon(s)} {s.title}<select value={proposal.assigned[s.id]} onChange={e=>selectAlternative(s,e.target.value)}>{week.map(d=><option value={d} key={d}>{nice(d)}</option>)}</select></label>)}</div>}
 </div>})}</div>)}</div>:<p>Trainingswoche wird geladen …</p>}
 {proposal&&<><div className="tempo30-week-summary">{proposal.all.length} geplante Einheiten bleiben erhalten · {proposal.changed.length} umgeplant · {proposal.all.filter(s=>s.sessionType.includes('run')).length} Laufeinheiten · {proposal.all.filter(s=>s.sessionType.includes('strength')).length} Krafttermine</div>{proposal.conflicts.map(err=><p className="tempo30-warning" key={err}>⚠ {err}</p>)}</>}
 {message&&<p role="status" className="tempo30-message">{message}</p>}
 <div className="tempo30-modal-actions"><button type="button" disabled={busy||!canApply} onClick={()=>void commit()}>{busy?'Übernahme läuft …':'Gesamten Wochenplan bestätigen'}</button><button type="button" className="outline" disabled={!rejected.length||busy} onClick={reroll}>Alternative Zuordnung berechnen</button><button type="button" className="outline" onClick={onClose}>Ohne Änderungen schließen</button></div>
 <p className="tempo30-note">Nichts wird gespeichert, bevor du unten bestätigst. Bereits absolvierte Trainingseinheiten bleiben unangetastet. Wenn TEMPO einen Konflikt meldet, werden keine Änderungen gespeichert.</p>
 </section></div>
}
