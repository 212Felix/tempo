import {useEffect,useState,type FormEvent} from 'react'
import {deleteRecord} from '../db/storage'
import {PROFILE_ID} from '../planning/engine'
import {loadExperiences,loadFuelProducts,saveProductSettings} from './fuel-storage'
import {freshProduct,nutritionFromOcr,piecePrice,statusForProduct,validateEnrichedProduct,saltGramsToSodiumMg,type EnrichedProduct,type FuelExperience,type FuelUnit, type TrafficLight} from './fuel-model'
import './phase32.css'
const categories=[['powder','🥤 Pulver'],['gel','🧃 Gels'],['bar','🍫 Riegel'],['food','🍌 Andere Produkte']] as const
const money=(v:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(v)
export default function FuelLibraryPanel(){
 const [products,setProducts]=useState<EnrichedProduct[]>([]),[experiences,setExperiences]=useState<FuelExperience[]>([])
 const [section,setSection]=useState<EnrichedProduct['kind']>('powder'),[focused,setFocused]=useState(''),[form,setForm]=useState<EnrichedProduct|null>(null),[mode,setMode]=useState<'manual'|'photo'|null>(null)
 const [ocrRaw,setOcrRaw]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function refresh(){const [p,e]=await Promise.all([loadFuelProducts(),loadExperiences()]);setProducts(p);setExperiences(e)}
 useEffect(()=>{void refresh().catch(e=>setMessage(String(e)));const handler=()=>{void refresh().catch(()=>undefined)};window.addEventListener('tempo:fuel-change',handler);return()=>window.removeEventListener('tempo:fuel-change',handler)},[])
 const change=(x:Partial<EnrichedProduct>)=>setForm(f=>f?{...f,...x}:f)
 function create(type:'manual'|'photo'){setMode(type);setForm({...freshProduct(),kind:section});setFocused('');setOcrRaw('');setMessage('')}
 function edit(product:EnrichedProduct){setMode('manual');setForm({...product});setFocused('');setMessage('')}
 async function persist(e:FormEvent){e.preventDefault();if(!form)return;const error=validateEnrichedProduct(form);if(error){setMessage(error);return}setBusy(true);try{
   const item={...form,id:form.id||`fuel-product:${crypto.randomUUID?.()??Date.now()}`,profileId:PROFILE_ID};await saveProductSettings(item)
   await refresh();setSection(item.kind);setForm(null);setFocused(item.id);setMessage('Produkt lokal gespeichert.')
 }catch(ex){setMessage(`Speichern fehlgeschlagen: ${String(ex)}`)}finally{setBusy(false)}}
 async function remove(product:EnrichedProduct){if(!window.confirm(`„${product.name}“ aus der Bibliothek löschen? Vergangene Trainingsprotokolle bleiben erhalten, das Produkt steht zukünftigen Plänen nicht mehr zur Verfügung.`))return
 try{await deleteRecord('settings',product.id);await refresh();setFocused('');setMessage('Produkt gelöscht. Bereits erfasste Trainingsprotokolle wurden nicht geändert.');window.dispatchEvent(new Event('tempo:fuel-change'))}catch(e){setMessage(String(e))}}
 async function block(product:EnrichedProduct,blocked:boolean){try{await saveProductSettings({...product,manuallyBlocked:blocked,manualTolerance:!blocked&&product.manualTolerance==='red'?'unset':product.manualTolerance});await refresh();setMessage(blocked?'Produkt sofort für zukünftige Fueling-Pläne gesperrt.':'Manuelle Sperre aufgehoben; automatisch festgestellte Probleme können weiterhin sperren.')}catch(e){setMessage(String(e))}}
 async function scanPhoto(file?:File){if(!file||!form)return;if(!file.type.startsWith('image/')||file.size>8_000_000){setMessage('Bitte ein Foto bis 8 MB verwenden.');return}
 setBusy(true);setMessage('Das Foto wird auf deinem Gerät ausgelesen. Bei der ersten Nutzung müssen ggf. OCR-Sprachdateien geladen werden.');try{
   const {createWorker}=await import('tesseract.js');const worker=await createWorker('deu+eng')
   let raw='';try{const result=await worker.recognize(file);raw=result.data.text}finally{await worker.terminate()}
   setOcrRaw(raw);change(nutritionFromOcr(raw));setMessage('Texterkennung abgeschlossen. Die Tabelle kann Angaben pro 100 g enthalten: Werte und Portion bitte unbedingt prüfen.')
 }catch(error){setMessage(`Automatisches Auslesen fehlgeschlagen: ${String(error)}. Du kannst die Nährwerte unten manuell eintragen.`)}finally{setBusy(false)}}
 const selected=products.find(x=>x.id===focused)
 return <div className="tempo32-page">
 <section className="panel tempo32-card"><div className="eyebrow">TEMPO · DEINE VERPFLEGUNG</div><h2>Meine Produktbibliothek</h2><p>Alle Produkte und Nährwertangaben bleiben lokal auf diesem Gerät. Gelb bedeutet beobachten, Rot bedeutet gesperrt. Ein Produkt wird nach zwei unterschiedlichen unverträglichen Trainingserfahrungen automatisch gesperrt oder sofort auf deinen Wunsch.</p>
 <div className="tempo32-category-grid">{categories.map(([kind,label])=><button type="button" key={kind} className={section===kind?'tempo32-selected':''} onClick={()=>{setSection(kind);setFocused('');setForm(null)}}>{label}<small>{products.filter(p=>p.kind===kind).length} Produkte</small></button>)}</div>
 <div className="tempo32-actions"><button type="button" onClick={()=>create('manual')}>＋ Manuell hinzufügen</button><button type="button" onClick={()=>create('photo')}>📷 Per Foto hinzufügen</button></div>
 <div className="tempo32-products">{products.filter(p=>p.kind===section).map(product=>{const s=statusForProduct(product,experiences);return <button type="button" key={product.id} className="tempo32-product-row" onClick={()=>{setFocused(product.id);setForm(null)}}><span><strong>{product.brand?`${product.brand} · `:''}{product.name}</strong><small>{product.carbsGrams} g KH/Portion · {piecePrice(product)===null?'Preis offen':money(piecePrice(product)!)} pro Portion</small></span><span className={`tempo32-light ${s.tone}`}/><span>›</span></button>})}{!products.some(p=>p.kind===section)&&<p>In dieser Kategorie sind noch keine Produkte gespeichert.</p>}</div>
 </section>
 {selected&&!form&&<section className="panel tempo32-card"><div className="tempo32-detail-top"><div><div className="eyebrow">PRODUKTDETAILS</div><h2>{selected.brand&&`${selected.brand} · `}{selected.name}</h2></div><button type="button" onClick={()=>setFocused('')}>✕</button></div>
  <div className="tempo32-nutrients">{[['Portion',`${selected.servingGrams} ${selected.servingUnit==='ml'?'ml':selected.servingUnit==='piece'?'Stück':'g'}`],['Kohlenhydrate',`${selected.carbsGrams} g`],['Glukose : Fruktose',selected.glucoseFructoseRatio||'Nicht bekannt'],['Natrium',`${selected.sodiumMg} mg`],['Koffein',`${selected.caffeineMg??0} mg`],['Eiweiß',`${selected.proteinGrams??0} g`],['Fett',`${selected.fatGrams??0} g`],['Wasser zum Mischen',selected.waterMl?`${selected.waterMl} ml`:'–'],['Packungspreis',selected.packagePriceEuro!==undefined?money(selected.packagePriceEuro):'–'],['Preis pro Portion',piecePrice(selected)===null?'–':money(piecePrice(selected)!) ]].map(([label,v])=><div key={label}><small>{label}</small><strong>{v}</strong></div>)}</div>
  <p className={`tempo32-status ${statusForProduct(selected,experiences).tone}`}>{statusForProduct(selected,experiences).reason}</p>
  <div className="tempo32-actions"><button type="button" onClick={()=>edit(selected)}>Bearbeiten</button><button type="button" onClick={()=>void block(selected,!(selected.manuallyBlocked||selected.manualTolerance==='red'))}>{selected.manuallyBlocked||selected.manualTolerance==='red'?'Manuelle Sperre aufheben':'🔒 Produkt sperren'}</button><button type="button" className="tempo32-danger" onClick={()=>void remove(selected)}>Produkt löschen</button></div>
  <p>Eine automatische Sperre nach zwei Unverträglichkeitserfahrungen kann nicht allein durch das Aufheben der manuellen Sperre aufgehoben werden. Eine erneute Freigabe muss bewusst nach Prüfung der dokumentierten Erfahrungen erfolgen.</p>
 </section>}
 {form&&<section className="panel tempo32-card"><div className="tempo32-detail-top"><h2>{form.id?'Produkt bearbeiten':mode==='photo'?'📷 Produkt per Foto':'✏️ Produkt manuell erfassen'}</h2><button type="button" onClick={()=>setForm(null)}>✕</button></div>
 {mode==='photo'&&<div className="tempo32-photo"><label>Foto der Nährwerttabelle aufnehmen oder auswählen<input type="file" accept="image/*" capture="environment" onChange={e=>void scanPhoto(e.target.files?.[0])} disabled={busy}/></label><small>Die Aufnahme wird auf dem Gerät verarbeitet, nicht als Foto in der Datenbank gespeichert. Automatisch erkannte Werte sind nur Vorschläge.</small>{ocrRaw&&<details><summary>Erkannten Text ansehen</summary><pre>{ocrRaw.slice(0,4000)}</pre></details>}</div>}
 <form onSubmit={e=>void persist(e)} className="tempo32-form">
 <label>Hersteller<input value={form.brand??''} onChange={e=>change({brand:e.target.value.slice(0,80)})}/></label>
 <label>Produktname *<input required maxLength={80} value={form.name} onChange={e=>change({name:e.target.value})}/></label>
 <label>Kategorie<select value={form.kind} onChange={e=>change({kind:e.target.value as EnrichedProduct['kind']})}>{categories.map(([k,t])=><option key={k} value={k}>{t}</option>)}</select></label>
 <div className="tempo32-form-pair"><label>Portionsgröße *<input type="number" min="0.01" max="2000" step="any" required value={form.servingGrams} onChange={e=>change({servingGrams:Number(e.target.value)})}/></label><label>Einheit<select value={form.servingUnit||'g'} onChange={e=>change({servingUnit:e.target.value as FuelUnit})}><option value="g">g</option><option value="ml">ml</option><option value="piece">Stück</option></select></label></div>
 <label>Kohlenhydrate pro Portion (g) *<input type="number" min="0" step="any" value={form.carbsGrams} onChange={e=>change({carbsGrams:Number(e.target.value)})}/></label>
 <label>Glukose-/Fruktose-Verhältnis (falls vom Hersteller angegeben)<select value={form.glucoseFructoseRatio||''} onChange={e=>change({glucoseFructoseRatio:e.target.value})}><option value="">Unbekannt</option><option value="2:1">2:1</option><option value="1:0.8">1:0,8</option><option value="1:0.7">1:0,7</option><option value="1:1">1:1</option><option value="glucose-only">Nur Glukosequelle</option></select></label>
 <div className="tempo32-form-pair"><label>Natrium (mg/Portion)<input type="number" min="0" step="any" value={form.sodiumMg} onChange={e=>change({sodiumMg:Number(e.target.value),sodiumSource:'label'})}/></label><label>Alternativ: Salz (g/Portion)<input type="number" min="0" step="any" placeholder="Salz auf dem Etikett" onChange={e=>{if(e.target.value!=='')change({sodiumMg:saltGramsToSodiumMg(Number(e.target.value)),sodiumSource:'salt-converted'})}}/></label></div>
 <div className="tempo32-form-pair"><label>Eiweiß (g)<input type="number" min="0" step="any" value={form.proteinGrams??0} onChange={e=>change({proteinGrams:Number(e.target.value)})}/></label><label>Fett (g)<input type="number" min="0" step="any" value={form.fatGrams??0} onChange={e=>change({fatGrams:Number(e.target.value)})}/></label></div>
 <div className="tempo32-form-pair"><label>Koffein (mg)<input type="number" min="0" step="any" value={form.caffeineMg??0} onChange={e=>change({caffeineMg:Number(e.target.value)})}/></label><label>Mischwasser (ml)<input type="number" min="0" value={form.waterMl} onChange={e=>change({waterMl:Number(e.target.value)})}/></label></div>
 <div className="tempo32-form-pair"><label>Packungsgröße<input type="number" min="0" step="any" value={form.packageQuantity??''} onChange={e=>change({packageQuantity:e.target.value?Number(e.target.value):undefined})}/></label><label>Packungseinheit<select value={form.packageUnit||'piece'} onChange={e=>change({packageUnit:e.target.value as FuelUnit})}><option value="piece">Stück/Portionen</option><option value="g">g</option><option value="ml">ml</option></select></label></div>
 <label>Preis der gesamten Packung (€)<input type="number" min="0" step="0.01" value={form.packagePriceEuro??''} onChange={e=>change({packagePriceEuro:e.target.value?Number(e.target.value):undefined})}/></label>
 <p>Errechneter Portionspreis: <strong>{piecePrice(form)===null?'Noch nicht berechenbar':money(piecePrice(form)!)}</strong></p>
 <label>Meine Verträglichkeit<select value={form.manualTolerance||'unset'} onChange={e=>change({manualTolerance:e.target.value as TrafficLight|'unset'})}><option value="unset">Noch nicht bewertet</option><option value="green">🟢 Sehr gut</option><option value="yellow">🟡 Okay / beobachten</option><option value="red">🔴 Nicht verträglich / sperren</option></select></label>
 <label>Notiz<input maxLength={500} value={form.notes??''} onChange={e=>change({notes:e.target.value})}/></label>
 <button type="submit" disabled={busy}>{busy?'Bitte warten …':form.id?'Produkt aktualisieren':'Produkt lokal speichern'}</button>
 </form></section>}
 {message&&<p role="status" className="tempo32-message">{message}</p>}
 </div>
}
