import {useEffect,useMemo,useState} from 'react'
import {getRecord,listRecords,saveRecord} from '../db/storage'
import type {TempoRecord} from '../db/types'
import {PROFILE_ID,currentKey,type TrainingRecord} from '../planning/engine'
import {calculateFuel,parseGpx,recommendCarbsHour,recommendFluidHour,type NutritionInput,type RouteSummary} from './fueling'
import {loadUsableProducts,loadExperiences} from '../phase32/fuel-storage'
import {adaptiveCarbTarget,type EnrichedProduct,type FuelExperience,piecePrice} from '../phase32/fuel-model'
import './phase30.css'

type ProductRecord=EnrichedProduct
type RouteRecord=TempoRecord&{date:string;summary:RouteSummary}
const isoDate=(value:string)=>/^\d{4}-\d\d-\d\d$/.test(value)
const settingsRouteId=(date:string)=>`fuel-route:${PROFILE_ID}:${date}`
const defaults:NutritionInput={sport:'cycling',durationMin:180,intensity:'tempo',temperatureC:18,gutTraining:'building',bottleMl:750}
const formatMin=(minutes:number)=>`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')} h`
function sourceSport(x:TrainingRecord):NutritionInput['sport']{return x.sessionType.includes('run')?'running':'cycling'}
function sourceIntensity(x:TrainingRecord):NutritionInput['intensity']{return /schwelle|tempo|intervall|vo2|sweet|quality|hit/i.test(`${x.title} ${x.target}`)?'hard':/locker|z2|grundlage|easy|long/i.test(x.title)?'easy':'tempo'}
export function FuelingQuick({session}:{session:TrainingRecord}){
 const [open,setOpen]=useState(false),[products,setProducts]=useState<ProductRecord[]>([]),[history,setHistory]=useState<FuelExperience[]>([])
 const [route,setRoute]=useState<RouteSummary|undefined>()
 const [gelId,setGelId]=useState<string>(''),[powderId,setPowderId]=useState<string>(''),[quickMessage,setQuickMessage]=useState('')
 const [checked,setChecked]=useState<number[]>([]),[busyTick,setBusyTick]=useState(false)
 useEffect(()=>{if(!open)return;let active=true;void Promise.all([loadUsableProducts(),getRecord<RouteRecord>('settings',settingsRouteId(session.date)),loadExperiences()]).then(([items,r,experiences])=>{if(active){setProducts(items);setRoute(r?.summary);setHistory(experiences)}}).catch(()=>undefined);return()=>{active=false}},[open,session.date])
 const preferredGel=gelId==='none'?undefined:products.find(p=>p.id===(gelId||products.find(q=>q.kind==='gel')?.id)),powder=powderId==='none'?undefined:products.find(p=>p.id===(powderId||products.find(q=>q.kind==='powder')?.id))
 const valid=['long','quality','endurance','commute','manual-cycling','run','manual-running'].includes(session.sessionType)
 const input:NutritionInput={...defaults,sport:sourceSport(session),durationMin:Math.max(20,session.durationMin||90),intensity:sourceIntensity(session),route}
 const suggestion=adaptiveCarbTarget(recommendCarbsHour(input),history,input.durationMin)
 const plan=calculateFuel({...input,targetCarbsHour:suggestion.goal},preferredGel,powder)
 const trackingId=`fuel-consumed:${PROFILE_ID}:${session.id}`
 const planSignature=`${session.id}:${input.durationMin}:${preferredGel?.id??''}:${powder?.id??''}`
 useEffect(()=>{if(!open)return;let live=true;void getRecord<TempoRecord&{checked?:number[];planSignature?:string}>('fuelingLogs',trackingId).then(entry=>{if(live)setChecked(entry?.planSignature===planSignature?(entry.checked??[]):[])}).catch(()=>undefined);return()=>{live=false}},[open,trackingId,planSignature])
 const taken=plan.events.filter((_,idx)=>checked.includes(idx)),actualCarbs=Math.round(taken.reduce((sum,e)=>sum+e.carbs,0)),actualWater=taken.reduce((sum,e)=>sum+e.waterMl,0)
 async function toggleIntake(index:number){if(busyTick)return;const indices=checked.includes(index)?checked.filter(x=>x!==index):[...checked,index];setBusyTick(true);try{await saveRecord('fuelingLogs',{id:trackingId,profileId:PROFILE_ID,date:session.date,sessionId:session.id,source:'live-fueling',planSignature,checked:indices,actualWaterMl:Math.round(plan.events.reduce((sum,e,i)=>sum+(indices.includes(i)?e.waterMl:0),0)),actualCarbsGrams:Math.round(plan.events.reduce((sum,e,i)=>sum+(indices.includes(i)?e.carbs:0),0)),createdAt:'',updatedAt:''});setChecked(indices);window.dispatchEvent(new Event('tempo:fuel-change'))}catch(error){setQuickMessage(`Einnahme konnte nicht gespeichert werden: ${String(error)}`)}finally{setBusyTick(false)}}
 async function saveQuick(){try{await saveRecord('fuelingLogs',{id:`fuel-plan:${PROFILE_ID}:${session.id}`,profileId:PROFILE_ID,date:session.date,sessionId:session.id,input:{...input,targetCarbsHour:suggestion.goal},productIds:[preferredGel?.id,powder?.id].filter(Boolean),plan,createdAt:'',updatedAt:''});setQuickMessage('Fueling-Strategie für diese Einheit lokal gespeichert ✓');window.dispatchEvent(new Event('tempo:fuel-change'))}catch(error){setQuickMessage(`Speichern fehlgeschlagen: ${String(error)}`)}}
 if(!valid)return null
 return <div className="tempo30-inline-fuel"><button type="button" className="tempo30-link-button" onClick={()=>setOpen(s=>!s)} aria-expanded={open}>💧 Fueling für diese Einheit {open?'▲':'▼'}</button>
 {open&&<div className="tempo30-fuel-quick"><p><strong>{plan.carbsHour} g KH/h</strong> · {plan.fluidHour} ml/h · insgesamt ca. {plan.totalCarbs} g KH und {plan.totalFluidMl} ml Flüssigkeit</p>
 <div className="tempo30-form-grid"><label>Mein Gel<select value={gelId||preferredGel?.id||'none'} onChange={e=>setGelId(e.target.value)}><option value="none">Ohne Gel</option>{products.filter(p=>p.kind==='gel').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Mein Pulver<select value={powderId||powder?.id||'none'} onChange={e=>setPowderId(e.target.value)}><option value="none">Ohne Pulver</option>{products.filter(p=>p.kind==='powder').map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
 {route&&<p>🗺️ Hinterlegte GPX: {route.distanceKm} km · {route.elevationGainM} hm</p>}
 <p>{preferredGel?`${plan.gelCount} × ${preferredGel.name}`:'Noch keine eigenen Gels hinterlegt'} · {powder?`${plan.powderPerBottleGrams} g ${powder.name} je ${input.bottleMl}-ml-Flasche`:'KH-Pulver noch nicht hinterlegt'}</p>
 <h4>Während des Trainings: Einnahmen abhaken</h4><div className="tempo34-fuel-live">{plan.events.map((e,index)=><label key={`${e.minute}:${index}`}><input type="checkbox" checked={checked.includes(index)} disabled={busyTick} onChange={()=>void toggleIntake(index)}/><span>{formatMin(e.minute)} · {e.label} · {e.carbs} g KH · {e.waterMl} ml</span></label>)}</div>
 <div className="tempo34-fuel-balance"><strong>Soll / Ist</strong><p>KH: {plan.totalCarbs} / {actualCarbs} g · Wasser: {plan.totalFluidMl} / {actualWater} ml</p><small>Abhaken speichert den Konsum sofort lokal. Die tatsächliche Aufnahme kann im Trainingsabschluss ergänzt werden.</small></div>
 <button type="button" className="tempo30-link-button" onClick={()=>void saveQuick()}>Fueling für diesen Trainingstag speichern</button>{quickMessage&&<p role="status">{quickMessage}</p>}
 <small>{suggestion.reason}. Vorläufige Richtwerte. Produkte, Trinkmenge, KH-Ziel und GPX kannst du unter „Fueling“ anpassen. Die Empfehlungen berücksichtigen noch keine individuell gemessene Schweißrate.</small></div>}</div>
}
export default function FuelingPanel({onOpenLibrary}:{onOpenLibrary:()=>void}){
 const [date,setDate]=useState(currentKey())
 const [sessions,setSessions]=useState<TrainingRecord[]>([]),[chosenId,setChosenId]=useState('')
 const [products,setProducts]=useState<ProductRecord[]>([]),[gelId,setGelId]=useState(''),[powderId,setPowderId]=useState('')
 const [route,setRoute]=useState<RouteSummary|undefined>()
 const [msg,setMsg]=useState(''),[saving,setSaving]=useState(false)
 const [input,setInput]=useState<NutritionInput>(defaults)
 const [estimatedSpeed,setEstimatedSpeed]=useState(24)
 const [history,setHistory]=useState<FuelExperience[]>([])
 const patch=(p:Partial<NutritionInput>)=>setInput(old=>({...old,...p}))
 useEffect(()=>{let live=true;void Promise.all([loadUsableProducts(),listRecords<TrainingRecord>('plannedSessions')]).then(([filtered,ss])=>{if(live){setProducts(filtered);setSessions(ss.filter(x=>x.profileId===PROFILE_ID&&x.status==='geplant'));setGelId(old=>old||filtered.find(x=>x.kind==='gel')?.id||'');setPowderId(old=>old||filtered.find(x=>x.kind==='powder')?.id||'')}}).catch(error=>setMsg(String(error)));return()=>{live=false}},[])
 useEffect(()=>{const refresh=()=>{void loadUsableProducts().then(items=>{setProducts(items);setGelId(old=>items.some(p=>p.id===old)?old:'');setPowderId(old=>items.some(p=>p.id===old)?old:'')}).catch(()=>undefined)};window.addEventListener('tempo:fuel-change',refresh);return()=>window.removeEventListener('tempo:fuel-change',refresh)},[])
 useEffect(()=>{let active=true;void getRecord<RouteRecord>('settings',settingsRouteId(date)).then(r=>{if(active){setRoute(r?.summary);setInput(old=>({...old,route:r?.summary}))}}).catch(()=>undefined);return()=>{active=false}},[date])
 const chosen=sessions.find(s=>s.id===chosenId)
 function chooseSession(id:string){setChosenId(id);const s=sessions.find(x=>x.id===id);if(s){setDate(s.date);patch({sport:sourceSport(s),durationMin:Math.max(20,s.durationMin||90),intensity:sourceIntensity(s)})}}
 useEffect(()=>{void loadExperiences().then(setHistory).catch(()=>undefined);const changed=()=>{void loadExperiences().then(setHistory).catch(()=>undefined)};window.addEventListener('tempo:fuel-change',changed);return()=>window.removeEventListener('tempo:fuel-change',changed)},[])
 const gel=products.find(x=>x.id===gelId),powder=products.find(x=>x.id===powderId)
 const baseCarbs=recommendCarbsHour(input),baseFluids=recommendFluidHour(input)
 const adaptive=adaptiveCarbTarget(baseCarbs,history,input.durationMin)
 const plan=useMemo(()=>{try{return calculateFuel({...input,targetCarbsHour:input.targetCarbsHour??adaptive.goal},gel,powder)}catch{return undefined}},[input,gel,powder,adaptive.goal])
 const loadGpx=async(file?:File)=>{if(!file)return;setMsg('');try{const text=await file.text();const summary=parseGpx(text,file.name);setRoute(summary);patch({route:summary});await saveRecord('settings',{id:settingsRouteId(date),date,profileId:PROFILE_ID,summary,createdAt:'',updatedAt:''} satisfies RouteRecord);setMsg('GPX-Streckendaten für diesen Tag lokal gespeichert. Die Positionspunkte wurden nicht gespeichert.')}catch(error){setMsg(`GPX: ${String(error)}`)}}
 const savePlan=async()=>{if(!plan||!isoDate(date))return;setSaving(true);try{await saveRecord('fuelingLogs',{id:`fuel-plan:${PROFILE_ID}:${chosenId||date}`,profileId:PROFILE_ID,date,sessionId:chosenId||undefined,routeSummary:route,input:{...input,route:undefined},productIds:[gelId,powderId],plan,createdAt:'',updatedAt:''});setMsg('Fueling-Plan lokal gespeichert. Vor dem Training kannst du ihn jederzeit neu berechnen.')}catch(error){setMsg(`Speichern fehlgeschlagen: ${String(error)}`)}finally{setSaving(false)}}
 const num=(n:number|undefined,update:(v:number)=>void,min:number,max:number,step=1)=><input type="number" inputMode="decimal" min={min} max={max} step={step} value={n??''} onChange={e=>update(Number(e.target.value)||0)}/>
 return <div className="tempo30-page">
  <section className="panel tempo30-card"><div className="eyebrow">TEMPO · LEISTUNGSORIENTIERTE VERPFLEGUNG</div><h2>Fueling</h2><p>Erstelle eine konkrete Trink- und Kohlenhydratstrategie für deine geplanten Radfahrten und Läufe – mit deinen eigenen Gels und KH-Pulvern. Die Berechnung ist transparent und kann jederzeit überschrieben werden.</p>
   <div className="tempo30-form-grid">
    <label>Trainingstag<input type="date" value={date} onChange={e=>{setDate(e.target.value);setChosenId('')}}/></label>
    <label>Geplante TEMPO-Einheit<select value={chosenId} onChange={e=>chooseSession(e.target.value)}><option value="">Freie Aktivität berechnen</option>{sessions.filter(s=>s.sessionType.includes('run')||['long','quality','endurance','commute','manual-cycling'].includes(s.sessionType)).map(s=><option key={s.id} value={s.id}>{s.date} · {s.title}</option>)}</select></label>
    <label>Sportart<select value={input.sport} onChange={e=>patch({sport:e.target.value as NutritionInput['sport']})}><option value="cycling">🚴 Rad</option><option value="running">🏃 Laufen</option></select></label>
    <label>Dauer (Minuten){num(input.durationMin,v=>patch({durationMin:v}),1,1800,5)}</label>
    <label>Intensität<select value={input.intensity} onChange={e=>patch({intensity:e.target.value as NutritionInput['intensity']})}><option value="easy">Locker / Z2</option><option value="tempo">Tempo / mittel</option><option value="hard">Hart / Intervalle</option></select></label>
    <label>Temperatur (°C){num(input.temperatureC,v=>patch({temperatureC:v}),-15,45)}</label>
    <label>KH-Verträglichkeit<select value={input.gutTraining} onChange={e=>patch({gutTraining:e.target.value as NutritionInput['gutTraining']})}><option value="start">Im Aufbau</option><option value="building">Regelmäßig 60–75 g/h</option><option value="trained">Hohe Zufuhr erprobt</option></select></label>
    <label>Flaschengröße (ml){num(input.bottleMl,v=>patch({bottleMl:v}),250,1500,50)}</label>
    <label>KH-Ziel (g/h){num(input.targetCarbsHour??adaptive.goal,v=>patch({targetCarbsHour:v}),0,120,5)}<small>Vorschlag {adaptive.goal} g/h · {adaptive.reason} · manuell überschreibbar</small></label>
    <label>Trinkziel (ml/h){num(input.targetFluidsHour??baseFluids,v=>patch({targetFluidsHour:v}),200,1200,50)}<small>Vorschlag {baseFluids} ml/h · ohne Schweißratentest nur Richtwert</small></label>
   </div>
   <div className="tempo30-gpx"><strong>🗺️ GPX-Strecke für {date}</strong><p>GPX vor der Tour hinzufügen, damit Streckenlänge und Höhenmeter für die Dauerplanung bekannt sind. Trackpunkte bleiben ausschließlich während der Auswertung im Browser.</p><input aria-label="GPX auswählen" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={e=>void loadGpx(e.target.files?.[0])}/>{route&&<div><p>✓ {route.fileName}: <strong>{route.distanceKm} km · {route.elevationGainM} hm</strong></p><label>Erwartete Durchschnittsgeschwindigkeit (km/h) <input type="number" min="4" max="55" step="0.5" value={estimatedSpeed} onChange={e=>setEstimatedSpeed(Number(e.target.value)||24)}/></label><p>Schätzung: ca. {Math.round(route.distanceKm/Math.max(4,estimatedSpeed)*60)} Minuten. Steile Anstiege können den Schnitt senken.</p><button type="button" onClick={()=>patch({durationMin:Math.max(1,Math.round(route.distanceKm/Math.max(4,estimatedSpeed)*60))})}>Geschätzte GPX-Dauer als Fueling-Dauer verwenden</button></div>}</div>
  </section>
  <section className="panel tempo30-card"><div className="tempo30-accordion-head"><h2>🧃 Deine verfügbaren Fueling-Produkte</h2><button type="button" onClick={onOpenLibrary}>📚 Produktbibliothek öffnen →</button></div><p>{products.length} verwendbare Produkte · manuell und automatisch gesperrte Produkte stehen hier nicht zur Auswahl.</p>
   <div className="tempo30-form-grid"><label>Gel<select value={gelId} onChange={e=>setGelId(e.target.value)}><option value="">Kein Gel ausgewählt</option>{products.filter(p=>p.kind==='gel').map(p=><option key={p.id} value={p.id}>{p.name} · {p.carbsGrams} g KH</option>)}</select></label><label>KH-Pulver<select value={powderId} onChange={e=>setPowderId(e.target.value)}><option value="">Kein Pulver ausgewählt</option>{products.filter(p=>p.kind==='powder').map(p=><option key={p.id} value={p.id}>{p.name} · {p.carbsGrams} g KH / Portion</option>)}</select></label></div>
   <small>Bei geplanten Wettkämpfen oder Trainings nur erprobte Produkte verwenden. Riegel und andere Lebensmittel sind in der separaten Bibliothek verfügbar; die automatische Portionsverteilung ist derzeit für Gels und Pulver ausgelegt.</small>
  </section>
  {plan&&<section className="panel tempo30-card"><div className="eyebrow">DEINE BERECHNETE STRATEGIE</div><h2>Verpflegungsplan · {formatMin(input.durationMin)}</h2>
   <div className="tempo30-stats"><div><strong>{plan.carbsHour}</strong><small>g KH / Stunde</small></div><div><strong>{plan.totalCarbs}</strong><small>g KH gesamt</small></div><div><strong>{plan.fluidHour}</strong><small>ml / Stunde</small></div><div><strong>{plan.totalFluidMl}</strong><small>ml gesamt</small></div></div>
   <h3>Packliste / Flaschenmischung</h3><p><strong>{plan.gelCount} Gels</strong>{gel?` à ${gel.carbsGrams} g KH`:''} · <strong>{plan.bottleCount} × {input.bottleMl} ml</strong> Flaschenvolumen · <strong>{plan.powderPerBottleGrams} g KH-Pulver/Flasche</strong>{powder?` (${powder.name})`:''}</p>
   <p><strong>Geschätzte Produktkosten:</strong> {gel&&piecePrice(gel)!==null?`${(plan.gelCount*piecePrice(gel)!).toFixed(2)} € Gels`:'Gels ohne Preis'} · {powder&&powder.packagePriceEuro!==undefined&&powder.packageQuantity&&powder.packageUnit==='g'?`${(powder.packagePriceEuro*plan.powderTotalGrams/powder.packageQuantity).toFixed(2)} € Pulver`:'Pulver ohne Preis'}. Versand und sonstige Produkte nicht enthalten.</p>
   <small>Gesamt KH aus Gels und Pulver: {Math.round(plan.gelCount*(gel?.carbsGrams??0)+plan.powderCarbsTotal)} von {plan.totalCarbs} g geplant. Flaschenanzahl beschreibt das Gesamtgetränkevolumen einschließlich möglicher Nachfüllungen.</small>
   <h3>Einnahmeplan</h3><div className="tempo30-timeline">{plan.events.map(event=><div key={event.minute}><strong>{formatMin(event.minute)}</strong><span>{event.label}</span><span>{event.waterMl} ml</span></div>)}</div>
   {plan.warnings.map(w=><p key={w} className="tempo30-warning">⚠ {w}</p>)}
   <button type="button" disabled={saving} onClick={()=>void savePlan()}>{saving?'Speichert …':'Diese Strategie speichern'}</button>
   <p className="tempo30-note">Richtwerte, keine individuelle Schweiß- oder metabolische Messung. Bei hohen KH-Mengen Verträglichkeit regelmäßig trainieren. Bei Rennen Verpflegungsstationen, Natriumzufuhr und tatsächliches Wetter zusätzlich berücksichtigen.</p>
  </section>}
  <section className="panel tempo30-card"><h2>📈 KH-Verträglichkeit trainieren</h2><p>Über mehrere geeignete Trainingseinheiten schrittweise aufbauen. Nach einer absolvierten Einheit dokumentierst du Produkte und Verträglichkeit mit Grün, Gelb oder Rot. Am nächsten Morgen folgt die kurze Nachfrage direkt im Readiness-Bogen.</p><p>Dein Grün/Gelb/Rot-Feedback und die tatsächlich konsumierten Produkte erfasst du nach dem Abschluss der Trainingseinheit im Tagestraining. Die Nachfrage über Nacht erscheint am folgenden Morgen im Readiness-Bogen.</p></section>
  {msg&&<p className="tempo30-message" role="status">{msg}</p>}
 </div>
}
