import {useEffect,useMemo,useState} from 'react'
import {PROFILE_ID} from '../planning/engine'
import {getRecord,listRecords} from '../db/storage'
import type {TempoRecord} from '../db/types'
import {experienceId,loadFuelProducts,loadExperiences,saveExperience} from './fuel-storage'
import {productUsable,statusForProduct,type FuelExperience,type EnrichedProduct,type TrafficLight} from './fuel-model'
import './phase32.css'
const options:[TrafficLight,string][]=[['green','🟢 Sehr gut'],['yellow','🟡 Okay'],['red','🔴 Nicht verträglich']]
export default function FuelingExperienceForm({date,sessionId,durationMin=0,compact=false}:{date:string;sessionId?:string;durationMin?:number;compact?:boolean}){
 const [products,setProducts]=useState<EnrichedProduct[]>([]),[experiences,setExperiences]=useState<FuelExperience[]>([])
 const [selected,setSelected]=useState<string[]>([]),[servings,setServings]=useState<Record<string,number>>({}),[tone,setTone]=useState<TrafficLight|''>(''),[extra,setExtra]=useState('0'),[fluid,setFluid]=useState(''),[notes,setNotes]=useState(''),[message,setMessage]=useState('')
 const [open,setOpen]=useState(!compact)
 useEffect(()=>{let active=true;const id=experienceId(date,sessionId)
  void Promise.all([loadFuelProducts(),loadExperiences(),getRecord<FuelExperience&TempoRecord>('fuelingFollowups',id),listRecords<TempoRecord>('fuelingLogs')]).then(([p,e,existing,plans])=>{
   if(!active)return;setProducts(p);setExperiences(e)
   const planned=plans.find(x=>x.profileId===PROFILE_ID&&x.date===date&&(!sessionId||x.sessionId===sessionId))
   const planIds=Array.isArray(planned?.productIds)?planned.productIds.filter((x):x is string=>typeof x==='string'&&x.length>0):[]
   setSelected(existing?.productIds??planIds);setServings(existing?.productServings??Object.fromEntries((existing?.productIds??planIds).map(id=>[id,1])));setTone(existing?.tolerance??'');setExtra(String(existing?.additionalCarbsGrams??0));setFluid(existing?.actualFluidHour===undefined?'':String(existing.actualFluidHour));setNotes(existing?.notes??'')
  }).catch(()=>setMessage('Fueling-Protokoll konnte nicht geladen werden.'));return()=>{active=false}
 },[date,sessionId])
 const actualTotal=useMemo(()=>selected.reduce((sum,id)=>sum+(products.find(x=>x.id===id)?.carbsGrams??0)*(servings[id]??1),0)+Number(extra||0),[selected,products,servings,extra])
 const actualHour=durationMin>0?Math.round(actualTotal/durationMin*60*10)/10:undefined
 const validation=useMemo(()=>{const carbs=Number(extra),f=fluid===''?undefined:Number(fluid)
  if(!Number.isFinite(carbs)||carbs<0||carbs>1000)return 'Zusätzliche Kohlenhydrate zwischen 0 und 1000 g eingeben.'
  if(selected.some(id=>!Number.isFinite(servings[id]??1)||(servings[id]??1)<=0||(servings[id]??1)>100))return 'Portionen der verwendeten Produkte überprüfen.'
  if(!Number.isFinite(actualTotal)||actualTotal<0||actualTotal>3000)return 'Gesamt-Kohlenhydrate überprüfen.'
  if(f!==undefined&&(!Number.isFinite(f)||f<0||f>2000))return 'Trinkmenge überprüfen.'
  return ''},[extra,fluid,selected,servings,actualTotal])
 async function skipFueling(){
  try{await saveExperience({id:experienceId(date,sessionId),date,profileId:PROFILE_ID,sessionId,createdAt:'',updatedAt:'',productIds:[],productServings:{},tolerance:'green',noFueling:true,additionalCarbsGrams:0,actualTotalCarbsGrams:0,actualCarbsHour:0,actualFluidHour:0,notes:'Bewusst kein Fueling bei dieser Aktivität'});setSelected([]);setServings({});setExtra('0');setFluid('0');setTone('green');setMessage('Kein Fueling ✓ · 0 g KH dokumentiert. Keine unnötige Verträglichkeitsabfrage am nächsten Morgen.')}catch(error){setMessage(String(error))}
 }
 async function save(){if(!tone){setMessage('Bitte zunächst Grün, Gelb oder Rot auswählen.');return}if(validation){setMessage(validation);return}
  try{const entry:FuelExperience={id:experienceId(date,sessionId),date,profileId:PROFILE_ID,sessionId,createdAt:'',updatedAt:'',productIds:selected,productServings:Object.fromEntries(selected.map(id=>[id,servings[id]??1])),tolerance:tone,noFueling:false,additionalCarbsGrams:Number(extra),actualTotalCarbsGrams:actualTotal,actualCarbsHour:actualHour,actualFluidHour:fluid===''?undefined:Number(fluid),notes:notes.slice(0,700)}
   await saveExperience(entry);setExperiences(await loadExperiences());setMessage('Verträglichkeit gespeichert. Bei einem Training mit Fueling fragt TEMPO morgen im Readiness-Bogen erneut nach.')
  }catch(e){setMessage(`Speichern fehlgeschlagen: ${String(e)}`)}}
 return <section className="tempo32-feedback"><button type="button" className="tempo32-feedback-toggle" onClick={()=>setOpen(o=>!o)} aria-expanded={open}>🧃 Fueling-Feedback nach dem Training {open?'▲':'▼'}</button>
 {open&&<div className="tempo32-feedback-body"><p>Wie hast du die Ernährung während und nach der Einheit vertragen?</p>
 <button type="button" className="tempo32-save tempo34-no-fueling" onClick={()=>void skipFueling()}>⊘ Kein Fueling · 0 g KH dokumentieren</button>
 <div className="tempo32-bubbles">{options.map(([t,label])=><button key={t} type="button" className={`tempo32-bubble ${t} ${tone===t?'selected':''}`} aria-pressed={tone===t} onClick={()=>setTone(t)}>{label}</button>)}</div>
 <p>Welche Produkte hast du tatsächlich verwendet? Nur diese fließen in die Auswertung ein.</p>
 <div className="tempo32-checkboxes">{products.map(p=><div key={p.id} className="tempo32-used-product"><label><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,p.id]:ids.filter(id=>id!==p.id))}/><span>{p.name}{!productUsable(p,experiences)?' 🔒':statusForProduct(p,experiences).tone==='yellow'?' 🟡':''}</span></label>{selected.includes(p.id)&&<label>Portionen<input type="number" min="0.1" max="100" step="0.5" value={servings[p.id]??1} onChange={e=>setServings(old=>({...old,[p.id]:Number(e.target.value)}))}/></label>}</div>)}</div>
 <label>Zusätzliche KH (g), z. B. Kuchen oder Kaffee<input type="number" inputMode="decimal" min="0" max="1000" value={extra} onChange={e=>setExtra(e.target.value)}/></label><p><strong>Insgesamt {Number.isFinite(actualTotal)?Math.round(actualTotal):0} g KH</strong>{actualHour!==undefined?` · ${actualHour} g KH/h aus ${durationMin} min Training`:' · Dauer für eine g/h-Berechnung in der abgeschlossenen Einheit angeben'}</p>
 <label>Getrunken in ml/h (optional)<input type="number" min="0" max="2000" value={fluid} onChange={e=>setFluid(e.target.value)}/></label>
 <label>Weitere Ernährung, Beschwerden oder Bemerkungen<textarea rows={2} maxLength={700} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="z. B. Kaffee mit Zucker 20 g KH, Kuchen 40 g KH"/></label>
 <button type="button" className="tempo32-save" onClick={()=>void save()}>Fueling-Erfahrung speichern</button>
 <small>Eine rote Gesamtbewertung markiert verwendete Produkte nach dem ersten auffälligen Training gelb und nach zwei unterschiedlichen auffälligen Trainings automatisch rot. Sie beweist nicht, dass ein bestimmtes Produkt die Ursache war. Du kannst ein Produkt zusätzlich manuell in der Bibliothek sperren.</small>
 {message&&<p role="status">{message}</p>}</div>}
 </section>
}
