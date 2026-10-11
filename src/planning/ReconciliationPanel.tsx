import {durationFor} from '../time/duration'
import {useEffect,useMemo,useState} from 'react'
import {canMatchGarmin,canMatchPlan,canMatchTwoCompletions,mergeDuplicateCompletions,completePlanFromGarmin,attachGarminToCompleted,joinPlanAndCompleted,linkedTo,loadReconcileData,type ReconcileData} from './reconcile'
import './reconcile.css'

/** Non-destructive matching with explicit one-click confirmation; works for old entries, too. */
export default function ReconciliationPanel({context='calendar'}:{context?:'calendar'|'garmin'}){
  const [data,setData]=useState<ReconcileData>({planned:[],completed:[],garmin:[]})
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [notice,setNotice]=useState('')
  async function refresh(){const rows=await loadReconcileData();setData(rows);setLoading(false)}
  useEffect(()=>{
    let alive=true
    const load=()=>void loadReconcileData().then(rows=>{if(alive){setData(rows);setLoading(false)}}).catch(e=>{if(alive){setNotice(String(e));setLoading(false)}})
    load()
    window.addEventListener('tempo:training-change',load)
    window.addEventListener('tempo:garmin-change',load)
    return()=>{alive=false;window.removeEventListener('tempo:training-change',load);window.removeEventListener('tempo:garmin-change',load)}
  },[])
  const matches=useMemo(()=>{
    if(context==='calendar'){
      const result:{planned:typeof data.planned[number];done:typeof data.completed[number]}[]=[]
      for(const done of data.completed){
        if(done.plannedSessionId)continue
        const plans=data.planned.filter(p=>canMatchPlan(p,done)&&!linkedTo(p,data.completed)&&p.status!=='nicht-erledigt')
        if(plans.length===1)result.push({planned:plans[0],done})
      }
      return result.sort((a,b)=>b.done.date.localeCompare(a.done.date)).slice(0,15)
    }
    return []
  },[data,context])
  const duplicateCompletions=useMemo(()=>{
    if(context!=='calendar')return []
    return data.completed.filter(extra=>!extra.plannedSessionId)
      .flatMap(extra=>data.completed.filter(keeper=>canMatchTwoCompletions(keeper,extra))
        .map(keeper=>({keeper,extra})))
      .slice(0,10)
  },[data,context])
  const garminMatches=useMemo(()=>{
    if(context!=='garmin')return []
    const items:({garmin:typeof data.garmin[number];done?:typeof data.completed[number];planned?:typeof data.planned[number]})[]=[]
    for(const ga of data.garmin){
      if(data.completed.some(c=>c.externalActivityId===ga.id))continue
      const candidates=data.completed.filter(c=>!c.externalActivityId && canMatchGarmin(ga,c))
      if(candidates.length===1){items.push({garmin:ga,done:candidates[0]});continue}
      if(candidates.length>1)continue // Ambiguous; never choose silently.
      const plans=data.planned.filter(p=>!linkedTo(p,data.completed)&&p.status!=='nicht-erledigt'&&canMatchGarmin(ga,{date:p.date,sessionType:p.sessionType,durationMin:p.durationMin,distanceKm:p.expectedKm}))
      if(plans.length===1)items.push({garmin:ga,planned:plans[0]})
    }
    return items.sort((a,b)=>b.garmin.date.localeCompare(a.garmin.date)).slice(0,20)
  },[data,context])
  async function run(action:()=>Promise<void>,description:string){
    if(busy)return
    if(!window.confirm(description+'\n\nIst es tatsächlich dieselbe Trainingseinheit? Es wird nichts blind gelöscht.'))return
    setBusy(true)
    try{await action();await refresh();setNotice('✓ Zuordnung gespeichert. Der Abschluss zählt im Kalender und in der Folgeplanung nur einmal.')}
    catch(e){setNotice('Nicht zusammengeführt: '+(e instanceof Error?e.message:String(e)))}
    finally{setBusy(false)}
  }
  if(loading)return null
  if(context==='calendar'&&matches.length===0&&duplicateCompletions.length===0)return null
  return <section className="panel tempo-reconcile" aria-label="Trainingseinheiten abgleichen">
    <div className="eyebrow">PHASE 19 · EINE AKTIVITÄT, EIN ABSCHLUSS</div>
    <h2>{context==='calendar'?'Mögliche Doppeleinträge':'Garmin mit TEMPO verbinden'}</h2>
    <p className="tempo-reconcile-intro">{context==='calendar'?'TEMPO hat einen gespeicherten Trainingsabschluss und eine passende Planung am selben Tag erkannt. Bitte bestätige, ob es dieselbe Einheit ist.':'Eine Garmin-Aktivität kann bestehende Ist-Werte ergänzen oder ein geplantes Training als absolviert markieren. Keine automatische Doppelzählung.'}</p>
    {context==='calendar'?matches.map(({planned,done})=><div className="tempo-reconcile-match" key={done.id}>
      <div className="tempo-reconcile-chip">{done.date} · Möglicher Doppel-Eintrag</div>
      <div><strong>Plan:</strong> {planned.title} · {durationFor(planned)}</div>
      <div><strong>Ist:</strong> {done.title??'Training'} · {durationFor(done)}{done.rpe?` · RPE ${done.rpe}`:''}</div>
      {done.notes&&<small>Notiz: {done.notes}</small>}
      <button type="button" disabled={busy} onClick={()=>void run(()=>joinPlanAndCompleted(planned.id,done.id),`„${planned.title}“ und „${done.title}“ verbinden?`)}>Als eine Einheit zusammenführen</button>
    </div>):garminMatches.map(({garmin,done,planned})=><div className="tempo-reconcile-match" key={garmin.id}>
      <div className="tempo-reconcile-chip">{garmin.date} · {garmin.sport==='cycling'?'Rad':garmin.sport==='running'?'Lauf':garmin.sport==='strength'?'Kraft':'Schwimmen'}</div>
      <div><strong>Garmin:</strong> {garmin.title} · {durationFor(garmin)}{garmin.distanceKm?` · ${garmin.distanceKm.toFixed(1)} km`:''}</div>
      {done?<div><strong>Vorhandener Abschluss:</strong> {done.title} · RPE {done.rpe??'offen'}</div>:<div><strong>Geplante Einheit:</strong> {planned?.title} · {planned?durationFor(planned):'–'}</div>}
      <button type="button" disabled={busy} onClick={()=>void run(done?()=>attachGarminToCompleted(garmin.id,done.id):()=>completePlanFromGarmin(garmin.id,planned!.id),done?`Garmin-Messwerte mit „${done.title}“ verbinden? RPE und Notizen bleiben erhalten.`:`„${planned?.title}“ mit Garmin abschließen?`)}>{done?'Messwerte verbinden – kein Duplikat':'Zuordnen und als absolviert markieren'}</button>
    </div>)}
    {context==='calendar'&&duplicateCompletions.map(({keeper,extra})=><div className="tempo-reconcile-match" key={extra.id}>
      <div className="tempo-reconcile-chip">{extra.date} · Zwei tatsächliche Abschlüsse?</div>
      <div><strong>Bereits zugeordnet:</strong> {keeper.title} · {durationFor(keeper)}</div>
      <div><strong>Zusätzlicher Abschluss:</strong> {extra.title} · {durationFor(extra)}{extra.rpe?` · RPE ${extra.rpe}`:''}</div>
      <p className="tempo-reconcile-muted">Nur verbinden, wenn beide wirklich dieselbe absolvierte Einheit beschreiben. Der überzählige Originaleintrag wird zur Sicherheit im Backup-Bereich archiviert.</p>
      <button type="button" disabled={busy} onClick={()=>void run(()=>mergeDuplicateCompletions(keeper.id,extra.id),'Beide Abschlüsse zu genau einer realen Trainingseinheit zusammenführen?')}>Doppelabschluss bereinigen</button>
    </div>)}
    {context==='garmin'&&garminMatches.length===0&&<p className="tempo-reconcile-muted">Aktuell keine eindeutigen Zuordnungsvorschläge. Historische Garmin-Aktivitäten bleiben unverändert in der Bibliothek. Es werden keine Trainings automatisch abgeschlossen.</p>}
    {context==='garmin'&&garminMatches.length>0&&<p className="tempo-reconcile-muted">Bei mehreren ähnlich passenden Einheiten trifft TEMPO bewusst keine automatische Auswahl. Erst nach Bestätigung erfolgt die Zuordnung.</p>}
    {notice&&<p className="tempo-reconcile-status" role="status">{notice}</p>}
  </section>
}
