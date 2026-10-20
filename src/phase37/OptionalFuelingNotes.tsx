import {useEffect,useState} from 'react'
import {getRecord,saveRecord} from '../db/storage'
import {loadUsableProducts} from '../phase32/fuel-storage'
import type {EnrichedProduct} from '../phase32/fuel-model'
import type {TrainingRecord} from '../planning/engine'
import {PROFILE_ID} from '../planning/engine'
import type {TempoRecord} from '../db/types'
/** Optional neutral intake log for strength/other sessions (no cycling fueling prescription). */
export default function OptionalFuelingNotes({session}:{session:TrainingRecord}){
 const [products,setProducts]=useState<EnrichedProduct[]>([]),[id,setId]=useState(''),[extra,setExtra]=useState('0'),[water,setWater]=useState('0'),[noFuel,setNoFuel]=useState(false),[message,setMessage]=useState('')
 const recordId=`tempo37:optional-fuel:${session.id}`
 useEffect(()=>{let active=true;void Promise.all([loadUsableProducts(),getRecord<TempoRecord&{productId?:string;extraKh?:number;waterMl?:number;noFuel?:boolean}>('fuelingLogs',recordId)]).then(([p,r])=>{if(!active)return;setProducts(p);setId(r?.productId??'');setExtra(String(r?.extraKh??0));setWater(String(r?.waterMl??0));setNoFuel(Boolean(r?.noFuel))}).catch(()=>undefined);return()=>{active=false}},[session.id])
 async function save(){try{const kh=Number(extra),ml=Number(water);if(!Number.isFinite(kh)||kh<0||kh>500||!Number.isFinite(ml)||ml<0||ml>10000)throw Error('Mengen bitte prüfen.');await saveRecord('fuelingLogs',{id:recordId,profileId:PROFILE_ID,date:session.date,sessionId:session.id,kind:'optional-fueling',productId:noFuel?undefined:id||undefined,extraKh:noFuel?0:kh,waterMl:noFuel?0:ml,noFuel,createdAt:'',updatedAt:''});setMessage('Optionale Fueling-Angaben gespeichert. Kein Pflichtbestandteil des Trainingsabschlusses.')}catch(e){setMessage(String(e))}}
 return <details className="panel tempo37-optional-fuel"><summary>💧 Fueling (optional)</summary><label><input type="checkbox" checked={noFuel} onChange={e=>setNoFuel(e.target.checked)}/> Kein Fueling während dieser Einheit</label>{!noFuel&&<><label>Verwendetes Produkt<select value={id} onChange={e=>setId(e.target.value)}><option value="">Kein Produkt / nur zusätzliche Aufnahme</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Zusätzliche Kohlenhydrate (g)<input type="number" min="0" max="500" value={extra} onChange={e=>setExtra(e.target.value)}/></label><label>Getränke (ml)<input type="number" min="0" max="10000" value={water} onChange={e=>setWater(e.target.value)}/></label></>}<button type="button" onClick={()=>void save()}>Fueling-Eintrag speichern</button>{message&&<p role="status">{message}</p>}</details>
}
