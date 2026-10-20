import {useEffect,useMemo,useState} from 'react'
import type {TrainingRecord} from '../planning/engine'
import {canMatchGarmin,canMatchPlan,completePlanFromGarmin,attachGarminToCompleted,joinPlanAndCompleted,loadReconcileData,type ReconcileData} from '../planning/reconcile'
import {durationFor} from '../time/duration'
/** User-reviewed, non-destructive match queue. Nothing is linked until 'selection speichern'. */
type Proposal={id:string;title:string;description:string;save:()=>Promise<void>}
export default function SessionGarminReview({session}:{session:TrainingRecord}){
 const [data,setData]=useState<ReconcileData>({planned:[],completed:[],garmin:[]})
 const [selected,setSelected]=useState<Record<string,'yes'|'no'|undefined>>({})
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{let alive=true;const load=()=>void loadReconcileData().then(d=>{if(alive)setData(d)}).catch(e=>{if(alive)setNotice(String(e))});load();window.addEventListener('tempo:garmin-change',load);window.addEventListener('tempo:training-change',load);return()=>{alive=false;window.removeEventListener('tempo:garmin-change',load);window.removeEventListener('tempo:training-change',load)}},[session.id])
 const proposals=useMemo(()=>{
  const results:Proposal[]=[]
  const done=data.completed.filter(c=>c.plannedSessionId===session.id)
  const empty=done.length===0
  if(empty){
    const possibles=data.completed.filter(c=>!c.plannedSessionId&&canMatchPlan(session,c))
    if(possibles.length===1)results.push({id:`completed:${possibles[0].id}`,title:'Vorhandenen Trainingsabschluss zuordnen',description:`${possibles[0].title??'Abschluss'} · ${durationFor(possibles[0])}`,save:()=>joinPlanAndCompleted(session.id,possibles[0].id)})
  }
  const available=data.garmin.filter(g=>!data.completed.some(c=>c.externalActivityId===g.id)&&canMatchGarmin(g,{date:session.date,sessionType:session.sessionType,durationMin:session.durationMin,distanceKm:session.expectedKm}))
  const competing=data.planned.filter(p=>p.id!==session.id&&p.status!=='nicht-erledigt'&&!data.completed.some(c=>c.plannedSessionId===p.id)&&available.some(g=>canMatchGarmin(g,{date:p.date,sessionType:p.sessionType,durationMin:p.durationMin,distanceKm:p.expectedKm})))
  if(available.length===1&&competing.length===0){const ga=available[0];const current=done.length===1?done[0]:undefined
    const otherSame=data.completed.filter(c=>!c.externalActivityId&&canMatchGarmin(ga,c))
    // Match only if association is unambiguous; existing completed records have precedence.
    if(current&&!current.externalActivityId&&otherSame.length===1&&otherSame[0].id===current.id){results.push({id:`garmin:${ga.id}`,title:'Garmin-Messwerte mit abgeschlossenem Training verbinden',description:`${ga.title} · ${durationFor(ga)} · bereits absolviert, kein zweites Training`,save:()=>attachGarminToCompleted(ga.id,current.id)})}
    else if(empty&&results.length===0&&otherSame.length===0){results.push({id:`garmin:${ga.id}`,title:'Geplantes Training mit Garmin abschließen',description:`${ga.title} · ${durationFor(ga)} · Ist-Werte aus Garmin`,save:()=>completePlanFromGarmin(ga.id,session.id)})}
  }
  return results
 },[data,session])
 async function saveSelection(){if(!proposals.some(p=>selected[p.id]==='yes'))return;setBusy(true);let ok=0
  try{for(const p of proposals){if(selected[p.id]!=='yes')continue;await p.save();ok++}setSelected({});setData(await loadReconcileData());setNotice(`${ok} bestätigte Zuordnung(en) gespeichert. Keine zusätzlichen Trainingseinheiten erzeugt.`)}catch(e){setNotice(`Nach ${ok} Zuordnung(en) gestoppt: ${String(e)}. Bitte Daten prüfen, bevor du erneut bestätigst.`)}finally{setBusy(false)}}
 if(proposals.length===0)return null
 return <section className="tempo37-match panel"><div className="eyebrow">GARMIN · VORSCHLÄGE PRÜFEN</div><h3>Passende Aktivitätsdaten</h3><p>Nur eindeutige Vorschläge erscheinen. Jede Zuordnung ausdrücklich bestätigen oder ablehnen; nichts wird automatisch zusammengeführt.</p>
 {proposals.map(p=><div className="tempo37-match-row" key={p.id}><strong>{p.title}</strong><p>{p.description}</p><div><button type="button" className={selected[p.id]==='yes'?'yes':''} aria-pressed={selected[p.id]==='yes'} onClick={()=>setSelected(v=>({...v,[p.id]:'yes'}))}>✓ Zuordnen</button><button type="button" className={selected[p.id]==='no'?'no':''} aria-pressed={selected[p.id]==='no'} onClick={()=>setSelected(v=>({...v,[p.id]:'no'}))}>✕ Nicht zuordnen</button></div></div>)}
 <button type="button" disabled={busy||!proposals.some(p=>selected[p.id]==='yes')} onClick={()=>void saveSelection()}>✓ Bestätigte Auswahl gesamt speichern</button>{notice&&<p role="status">{notice}</p>}</section>
}
