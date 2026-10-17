import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {getRecord,listRecords,saveRecord,deleteRecord} from '../db/storage'
import type {TempoRecord} from '../db/types'
import {PROFILE_ID,currentKey,type TrainingRecord} from '../planning/engine'
import {calculateFuel,parseGpx,productIsValid,recommendCarbsHour,recommendFluidHour,type FuelProduct,type NutritionInput,type RouteSummary,type ProductType} from './fueling'
import './phase30.css'

type ProductRecord=FuelProduct&TempoRecord
type RouteRecord=TempoRecord&{date:string;summary:RouteSummary}
type FuelFollowup=TempoRecord&{date:string;actualCarbsHour:number;actualFluidHour:number;giScore:number;notes:string;sessionId?:string}
const newId=()=>`fuel-product:${crypto.randomUUID?.()??Date.now()}`
const isoDate=(value:string)=>/^\d{4}-\d\d-\d\d$/.test(value)
const settingsRouteId=(date:string)=>`fuel-route:${PROFILE_ID}:${date}`
const defaults:NutritionInput={sport:'cycling',durationMin:180,intensity:'tempo',temperatureC:18,gutTraining:'building',bottleMl:750}
const formatMin=(minutes:number)=>`${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')} h`
function sourceSport(x:TrainingRecord):NutritionInput['sport']{return x.sessionType.includes('run')?'running':'cycling'}
function sourceIntensity(x:TrainingRecord):NutritionInput['intensity']{return /schwelle|tempo|intervall|vo2|sweet|quality|hit/i.test(`${x.title} ${x.target}`)?'hard':/locker|z2|grundlage|easy|long/i.test(x.title)?'easy':'tempo'}
export function FuelingQuick({session}:{session:TrainingRecord}){
 const [open,setOpen]=useState(false),[products,setProducts]=useState<ProductRecord[]>([])
 const [route,setRoute]=useState<RouteSummary|undefined>()
 useEffect(()=>{if(!open)return;let active=true;void Promise.all([listRecords<ProductRecord>('settings'),getRecord<RouteRecord>('settings',settingsRouteId(session.date))]).then(([items,r])=>{if(active){setProducts(items.filter(x=>x.id.startsWith('fuel-product:')&&x.profileId===PROFILE_ID));setRoute(r?.summary)}}).catch(()=>undefined);return()=>{active=false}},[open,session.date])
 const preferredGel=products.find(p=>p.kind==='gel'),powder=products.find(p=>p.kind==='powder')
 const valid=['long','quality','endurance','commute','manual-cycling','run','manual-running'].includes(session.sessionType)
 if(!valid)return null
 const input:NutritionInput={...defaults,sport:sourceSport(session),durationMin:Math.max(20,session.durationMin||90),intensity:sourceIntensity(session),route}
 const plan=calculateFuel(input,preferredGel,powder)
 return <div className="tempo30-inline-fuel"><button type="button" className="tempo30-link-button" onClick={()=>setOpen(s=>!s)} aria-expanded={open}>💧 Fueling für diese Einheit {open?'▲':'▼'}</button>
 {open&&<div className="tempo30-fuel-quick"><p><strong>{plan.carbsHour} g KH/h</strong> · {plan.fluidHour} ml/h · insgesamt ca. {plan.totalCarbs} g KH und {plan.totalFluidMl} ml Flüssigkeit</p>
 {route&&<p>🗺️ Hinterlegte GPX: {route.distanceKm} km · {route.elevationGainM} hm</p>}
 <p>{preferredGel?`${plan.gelCount} × ${preferredGel.name}`:'Noch keine eigenen Gels hinterlegt'} · {powder?`${plan.powderPerBottleGrams} g ${powder.name} je ${input.bottleMl}-ml-Flasche`:'KH-Pulver noch nicht hinterlegt'}</p>
 <div className="tempo30-timeline">{plan.events.map(e=><span key={e.minute}>{formatMin(e.minute)} · {e.label} · {e.waterMl} ml</span>)}</div>
 <small>Vorläufige Richtwerte. Produkte, Trinkmenge, KH-Ziel und GPX kannst du unter „Fueling & Trinken“ anpassen. Die Empfehlungen berücksichtigen noch keine individuell gemessene Schweißrate.</small></div>}</div>
}
export default function FuelingPanel(){
 const [date,setDate]=useState(currentKey())
 const [sessions,setSessions]=useState<TrainingRecord[]>([]),[chosenId,setChosenId]=useState('')
 const [products,setProducts]=useState<ProductRecord[]>([]),[gelId,setGelId]=useState(''),[powderId,setPowderId]=useState('')
 const [route,setRoute]=useState<RouteSummary|undefined>()
 const [msg,setMsg]=useState(''),[saving,setSaving]=useState(false)
 const [input,setInput]=useState<NutritionInput>(defaults)
 const [form,setForm]=useState<FuelProduct>({id:'',name:'',kind:'gel',servingGrams:40,carbsGrams:30,sodiumMg:0,waterMl:0})
 const [libraryOpen,setLibraryOpen]=useState(false)
 const [estimatedSpeed,setEstimatedSpeed]=useState(24)
 const [followups,setFollowups]=useState<FuelFollowup[]>([])
 const [actualCarbs,setActualCarbs]=useState(''),[actualFluid,setActualFluid]=useState(''),[giScore,setGiScore]=useState('0'),[gutNotes,setGutNotes]=useState('')
 const patch=(p:Partial<NutritionInput>)=>setInput(old=>({...old,...p}))
 useEffect(()=>{let live=true;void Promise.all([listRecords<ProductRecord>('settings'),listRecords<TrainingRecord>('plannedSessions')]).then(([ps,ss])=>{if(live){const filtered=ps.filter(x=>x.profileId===PROFILE_ID&&x.id.startsWith('fuel-product:'));setProducts(filtered);setSessions(ss.filter(x=>x.profileId===PROFILE_ID&&x.status==='geplant'));setGelId(old=>old||filtered.find(x=>x.kind==='gel')?.id||'');setPowderId(old=>old||filtered.find(x=>x.kind==='powder')?.id||'')}}).catch(error=>setMsg(String(error)));return()=>{live=false}},[])
 useEffect(()=>{let live=true;void listRecords<FuelFollowup>('fuelingFollowups').then(items=>{if(live)setFollowups(items.filter(x=>x.profileId===PROFILE_ID&&x.id.startsWith('fuel-followup:')).sort((a,b)=>b.date.localeCompare(a.date)))}).catch(()=>undefined);return()=>{live=false}},[])
 useEffect(()=>{let active=true;void getRecord<RouteRecord>('settings',settingsRouteId(date)).then(r=>{if(active){setRoute(r?.summary);setInput(old=>({...old,route:r?.summary}))}}).catch(()=>undefined);return()=>{active=false}},[date])
 const chosen=sessions.find(s=>s.id===chosenId)
 function chooseSession(id:string){setChosenId(id);const s=sessions.find(x=>x.id===id);if(s){setDate(s.date);patch({sport:sourceSport(s),durationMin:Math.max(20,s.durationMin||90),intensity:sourceIntensity(s)})}}
 const gel=products.find(x=>x.id===gelId),powder=products.find(x=>x.id===powderId)
 const plan=useMemo(()=>{try{return calculateFuel(input,gel,powder)}catch{return undefined}},[input,gel,powder])
 const baseCarbs=recommendCarbsHour(input),baseFluids=recommendFluidHour(input)
 const loadGpx=async(file?:File)=>{if(!file)return;setMsg('');try{const text=await file.text();const summary=parseGpx(text,file.name);setRoute(summary);patch({route:summary});await saveRecord('settings',{id:settingsRouteId(date),date,profileId:PROFILE_ID,summary,createdAt:'',updatedAt:''} satisfies RouteRecord);setMsg('GPX-Streckendaten für diesen Tag lokal gespeichert. Die Positionspunkte wurden nicht gespeichert.')}catch(error){setMsg(`GPX: ${String(error)}`)}}
 const saveProduct=async(e:FormEvent)=>{e.preventDefault();if(!productIsValid(form)){setMsg('Produktwerte prüfen: Portionsgröße, Kohlenhydrate und Natrium müssen plausibel sein.');return}
 try{const record:ProductRecord={...form,id:form.id||newId(),profileId:PROFILE_ID,createdAt:'',updatedAt:''};await saveRecord('settings',record);setProducts(old=>[...old.filter(x=>x.id!==record.id),record]);if(record.kind==='gel'&&!gelId)setGelId(record.id);if(record.kind==='powder'&&!powderId)setPowderId(record.id);setForm({id:'',name:'',kind:'gel',servingGrams:40,carbsGrams:30,sodiumMg:0,waterMl:0});setMsg('Produkt in deiner lokalen Bibliothek gespeichert.')}catch(error){setMsg(`Produkt konnte nicht gespeichert werden: ${String(error)}`)}}
 const removeProduct=async(id:string)=>{if(!window.confirm('Dieses Produkt aus der eigenen Fueling-Bibliothek entfernen?'))return;try{await deleteRecord('settings',id);setProducts(old=>old.filter(x=>x.id!==id));if(gelId===id)setGelId('');if(powderId===id)setPowderId('')}catch(error){setMsg(String(error))}}
 const savePlan=async()=>{if(!plan||!isoDate(date))return;setSaving(true);try{await saveRecord('fuelingLogs',{id:`fuel-plan:${PROFILE_ID}:${chosenId||date}`,profileId:PROFILE_ID,date,sessionId:chosenId||undefined,routeSummary:route,input:{...input,route:undefined},productIds:[gelId,powderId],plan,createdAt:'',updatedAt:''});setMsg('Fueling-Plan lokal gespeichert. Vor dem Training kannst du ihn jederzeit neu berechnen.')}catch(error){setMsg(`Speichern fehlgeschlagen: ${String(error)}`)}finally{setSaving(false)}}
 const saveFollowup=async()=>{const kh=Number(actualCarbs.replace(',','.')),fluid=Number(actualFluid.replace(',','.')),score=Number(giScore);if(!Number.isFinite(kh)||kh<0||kh>140||!Number.isFinite(fluid)||fluid<0||fluid>1500||!Number.isInteger(score)||score<0||score>5){setMsg('KH pro Stunde, Flüssigkeit und Verträglichkeitswert prüfen.');return}try{const record:FuelFollowup={id:`fuel-followup:${PROFILE_ID}:${chosenId||date}`,profileId:PROFILE_ID,date,actualCarbsHour:kh,actualFluidHour:fluid,giScore:score,notes:gutNotes.slice(0,700),sessionId:chosenId||undefined,createdAt:'',updatedAt:''};await saveRecord('fuelingFollowups',record);setFollowups(items=>[record,...items.filter(x=>x.id!==record.id)].sort((a,b)=>b.date.localeCompare(a.date)));setMsg('KH-Verträglichkeit gespeichert. So kann sich deine persönliche Trink- und Fueling-Strategie entwickeln.')}catch(error){setMsg(String(error))}}
 const num=(n:number|undefined,update:(v:number)=>void,min:number,max:number,step=1)=><input type="number" inputMode="decimal" min={min} max={max} step={step} value={n??''} onChange={e=>update(Number(e.target.value)||0)}/>
 return <div className="tempo30-page">
  <section className="panel tempo30-card"><div className="eyebrow">TEMPO · LEISTUNGSORIENTIERTE VERPFLEGUNG</div><h2>Fueling & Trinken</h2><p>Erstelle eine konkrete Trink- und Kohlenhydratstrategie für deine geplanten Radfahrten und Läufe – mit deinen eigenen Gels und KH-Pulvern. Die Berechnung ist transparent und kann jederzeit überschrieben werden.</p>
   <div className="tempo30-form-grid">
    <label>Trainingstag<input type="date" value={date} onChange={e=>{setDate(e.target.value);setChosenId('')}}/></label>
    <label>Geplante TEMPO-Einheit<select value={chosenId} onChange={e=>chooseSession(e.target.value)}><option value="">Freie Aktivität berechnen</option>{sessions.filter(s=>s.sessionType.includes('run')||['long','quality','endurance','commute','manual-cycling'].includes(s.sessionType)).map(s=><option key={s.id} value={s.id}>{s.date} · {s.title}</option>)}</select></label>
    <label>Sportart<select value={input.sport} onChange={e=>patch({sport:e.target.value as NutritionInput['sport']})}><option value="cycling">🚴 Rad</option><option value="running">🏃 Laufen</option></select></label>
    <label>Dauer (Minuten){num(input.durationMin,v=>patch({durationMin:v}),1,1800,5)}</label>
    <label>Intensität<select value={input.intensity} onChange={e=>patch({intensity:e.target.value as NutritionInput['intensity']})}><option value="easy">Locker / Z2</option><option value="tempo">Tempo / mittel</option><option value="hard">Hart / Intervalle</option></select></label>
    <label>Temperatur (°C){num(input.temperatureC,v=>patch({temperatureC:v}),-15,45)}</label>
    <label>KH-Verträglichkeit<select value={input.gutTraining} onChange={e=>patch({gutTraining:e.target.value as NutritionInput['gutTraining']})}><option value="start">Im Aufbau</option><option value="building">Regelmäßig 60–75 g/h</option><option value="trained">Hohe Zufuhr erprobt</option></select></label>
    <label>Flaschengröße (ml){num(input.bottleMl,v=>patch({bottleMl:v}),250,1500,50)}</label>
    <label>KH-Ziel (g/h){num(input.targetCarbsHour??baseCarbs,v=>patch({targetCarbsHour:v}),0,120,5)}<small>Vorschlag {baseCarbs} g/h · manuell überschreibbar</small></label>
    <label>Trinkziel (ml/h){num(input.targetFluidsHour??baseFluids,v=>patch({targetFluidsHour:v}),200,1200,50)}<small>Vorschlag {baseFluids} ml/h · ohne Schweißratentest nur Richtwert</small></label>
   </div>
   <div className="tempo30-gpx"><strong>🗺️ GPX-Strecke für {date}</strong><p>GPX vor der Tour hinzufügen, damit Streckenlänge und Höhenmeter für die Dauerplanung bekannt sind. Trackpunkte bleiben ausschließlich während der Auswertung im Browser.</p><input aria-label="GPX auswählen" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={e=>void loadGpx(e.target.files?.[0])}/>{route&&<div><p>✓ {route.fileName}: <strong>{route.distanceKm} km · {route.elevationGainM} hm</strong></p><label>Erwartete Durchschnittsgeschwindigkeit (km/h) <input type="number" min="4" max="55" step="0.5" value={estimatedSpeed} onChange={e=>setEstimatedSpeed(Number(e.target.value)||24)}/></label><p>Schätzung: ca. {Math.round(route.distanceKm/Math.max(4,estimatedSpeed)*60)} Minuten. Steile Anstiege können den Schnitt senken.</p><button type="button" onClick={()=>patch({durationMin:Math.max(1,Math.round(route.distanceKm/Math.max(4,estimatedSpeed)*60))})}>Geschätzte GPX-Dauer als Fueling-Dauer verwenden</button></div>}</div>
  </section>
  <section className="panel tempo30-card"><div className="tempo30-accordion-head"><h2>🧃 Deine Fueling-Produkte</h2><button type="button" onClick={()=>setLibraryOpen(o=>!o)}>{libraryOpen?'Schließen ▲':'Bibliothek bearbeiten ▼'}</button></div><p>{products.length} eigene Produkte gespeichert. Werte auf der Packung kontrollieren, insbesondere Angaben pro Portion gegenüber pro 100 g.</p>
   <div className="tempo30-form-grid"><label>Gel<select value={gelId} onChange={e=>setGelId(e.target.value)}><option value="">Kein Gel ausgewählt</option>{products.filter(p=>p.kind==='gel').map(p=><option key={p.id} value={p.id}>{p.name} · {p.carbsGrams} g KH</option>)}</select></label><label>KH-Pulver<select value={powderId} onChange={e=>setPowderId(e.target.value)}><option value="">Kein Pulver ausgewählt</option>{products.filter(p=>p.kind==='powder').map(p=><option key={p.id} value={p.id}>{p.name} · {p.carbsGrams} g KH / {p.servingGrams} g</option>)}</select></label></div>
   {libraryOpen&&<><div className="tempo30-product-list">{products.map(p=><div key={p.id}><span>{p.name} · {p.kind} · {p.carbsGrams} g KH/{p.servingGrams} g · {p.sodiumMg} mg Na</span><button type="button" onClick={()=>setForm({...p})}>Bearbeiten</button><button type="button" onClick={()=>void removeProduct(p.id)}>×</button></div>)}</div>
    <form className="tempo30-form-grid" onSubmit={e=>void saveProduct(e)}>
     <label>Produktname<input value={form.name} onChange={e=>setForm(old=>({...old,name:e.target.value}))} maxLength={80} required placeholder="z. B. Mein 30-g-Gel"/></label>
     <label>Produktart<select value={form.kind} onChange={e=>setForm(old=>({...old,kind:e.target.value as ProductType}))}><option value="gel">Gel</option><option value="powder">KH-Pulver</option><option value="bar">Riegel</option><option value="food">Sonstiges</option></select></label>
     <label>Portionsgewicht (g){num(form.servingGrams,v=>setForm(old=>({...old,servingGrams:v})),1,500)}</label>
     <label>KH pro Portion (g){num(form.carbsGrams,v=>setForm(old=>({...old,carbsGrams:v})),0,250,.1)}</label>
     <label>Natrium pro Portion (mg){num(form.sodiumMg,v=>setForm(old=>({...old,sodiumMg:v})),0,3000)}</label>
     <label>Getränkevolumen pro Portion (ml, optional){num(form.waterMl,v=>setForm(old=>({...old,waterMl:v})),0,1500)}</label>
     <button type="submit">{form.id?'Änderung speichern':'Produkt hinzufügen'}</button>
     {form.id&&<button type="button" onClick={()=>setForm({id:'',name:'',kind:'gel',servingGrams:40,carbsGrams:30,sodiumMg:0,waterMl:0})}>Abbrechen</button>}
    </form></>}
  </section>
  {plan&&<section className="panel tempo30-card"><div className="eyebrow">DEINE BERECHNETE STRATEGIE</div><h2>Verpflegungsplan · {formatMin(input.durationMin)}</h2>
   <div className="tempo30-stats"><div><strong>{plan.carbsHour}</strong><small>g KH / Stunde</small></div><div><strong>{plan.totalCarbs}</strong><small>g KH gesamt</small></div><div><strong>{plan.fluidHour}</strong><small>ml / Stunde</small></div><div><strong>{plan.totalFluidMl}</strong><small>ml gesamt</small></div></div>
   <h3>Packliste / Flaschenmischung</h3><p><strong>{plan.gelCount} Gels</strong>{gel?` à ${gel.carbsGrams} g KH`:''} · <strong>{plan.bottleCount} × {input.bottleMl} ml</strong> Flaschenvolumen · <strong>{plan.powderPerBottleGrams} g KH-Pulver/Flasche</strong>{powder?` (${powder.name})`:''}</p>
   <small>Gesamt KH aus Gels und Pulver: {Math.round(plan.gelCount*(gel?.carbsGrams??0)+plan.powderCarbsTotal)} von {plan.totalCarbs} g geplant. Flaschenanzahl beschreibt das Gesamtgetränkevolumen einschließlich möglicher Nachfüllungen.</small>
   <h3>Einnahmeplan</h3><div className="tempo30-timeline">{plan.events.map(event=><div key={event.minute}><strong>{formatMin(event.minute)}</strong><span>{event.label}</span><span>{event.waterMl} ml</span></div>)}</div>
   {plan.warnings.map(w=><p key={w} className="tempo30-warning">⚠ {w}</p>)}
   <button type="button" disabled={saving} onClick={()=>void savePlan()}>{saving?'Speichert …':'Diese Strategie speichern'}</button>
   <p className="tempo30-note">Richtwerte, keine individuelle Schweiß- oder metabolische Messung. Bei hohen KH-Mengen Verträglichkeit regelmäßig trainieren. Bei Rennen Verpflegungsstationen, Natriumzufuhr und tatsächliches Wetter zusätzlich berücksichtigen.</p>
  </section>}
  <section className="panel tempo30-card"><h2>📈 KH-Verträglichkeit trainieren</h2><p>Steigere die Kohlenhydrate über mehrere geeignete lange Trainingseinheiten. Erhöhe die Zufuhr erst, wenn die bisherige Menge zuverlässig vertragen wurde. 90 g/h sind keine Pflicht – dein Ziel ist eine funktionierende Strategie für deine langen Wettkämpfe.</p><div className="tempo30-form-grid"><label>Tatsächlich gegessene KH (g/h)<input type="number" min="0" max="140" value={actualCarbs} onChange={e=>setActualCarbs(e.target.value)}/></label><label>Tatsächlich getrunken (ml/h)<input type="number" min="0" max="1500" value={actualFluid} onChange={e=>setActualFluid(e.target.value)}/></label><label>Magen-/Darmbeschwerden<select value={giScore} onChange={e=>setGiScore(e.target.value)}>{Array.from({length:6},(_,i)=><option value={i} key={i}>{i} · {i===0?'keine':i===5?'stark':'Stufe '+i}</option>)}</select></label><label>Notizen<input value={gutNotes} maxLength={700} onChange={e=>setGutNotes(e.target.value)} placeholder="Was hat gut funktioniert?"/></label></div><button type="button" onClick={()=>void saveFollowup()}>Fueling-Erfahrung speichern</button>{followups.length>0&&<div className="tempo30-timeline">{followups.slice(0,6).map(x=><div key={x.id}><strong>{x.date}</strong><span>{x.actualCarbsHour} g KH/h · Magen {x.giScore}/5</span><span>{x.actualFluidHour} ml/h</span></div>)}</div>}</section>
  {msg&&<p className="tempo30-message" role="status">{msg}</p>}
 </div>
}
