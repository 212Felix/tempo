import {useEffect,useRef,useState} from 'react'
import {formatSeconds} from './duration'
import './time-fields.css'

/** iPhone-friendly, three-field editor. The outward contract stays hh:mm:ss for existing records. */
export default function TimeFields({value,onChange,label='Dauer',disabled=false,required=false,allowEmpty=false,maxHours=999}: {
  value:string;onChange:(value:string)=>void;label?:string;disabled?:boolean;required?:boolean;allowEmpty?:boolean;maxHours?:number
}) {
  const split=(raw:string):[string,string,string]=>{
    const m=/^(\d{1,4}):([0-5]\d):([0-5]\d)$/.exec(raw)
    return m?[m[1],m[2],m[3]]:['00','00','00']
  }
  const [parts,setParts]=useState<[string,string,string]>(()=>split(value))
  const lastEmitted=useRef(value)
  useEffect(()=>{if(value!==lastEmitted.current){setParts(split(value));lastEmitted.current=value}},[value])
  const change=(index:0|1|2,raw:string)=>{
    const clean=raw.replace(/[^\d]/g,'').slice(0,index===0?4:2)
    const next:[string,string,string]=[...parts]
    next[index]=clean
    setParts(next)
    const h=Math.min(maxHours,Number(next[0]||0)),m=Math.min(59,Number(next[1]||0)),s=Math.min(59,Number(next[2]||0))
    const formatted=h===0&&m===0&&s===0&&allowEmpty?'':formatSeconds(h*3600+m*60+s)
    lastEmitted.current=formatted
    onChange(formatted)
  }
  return <fieldset className="tempo-time-fields" disabled={disabled} aria-label={label}>
    <legend>{label}{required?' *':''}</legend>
    <div className="tempo-time-parts">
      {(['Stunden','Minuten','Sekunden'] as const).map((name,i)=><label key={name}>
        <span>{name}</span>
        <input type="text" maxLength={i===0?4:2} inputMode="numeric" pattern="[0-9]*"
          aria-label={`${label}: ${name}`} value={parts[i]} placeholder="00"
          onFocus={e=>e.currentTarget.select()} onChange={e=>change(i as 0|1|2,e.target.value)}/>
      </label>)}
    </div>
  </fieldset>
}
