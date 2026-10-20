import TimeFields from '../time/TimeFields'
import SessionGarminReview from '../phase37/SessionGarminReview'
import OptionalFuelingNotes from '../phase37/OptionalFuelingNotes'
import {parseHms,durationFor,formatSeconds} from '../time/duration'
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react'
import {currentKey,friendlyDate,PROFILE_ID,type TrainingRecord} from '../planning/engine'
import {STRENGTH,restLabel} from './catalog'
import {strengthProposal,type StrengthProposal} from '../phase38/strength-progression'
import {alreadyDone,finalizeWorkout,isStrength,loadWorkoutData,numberField,readinessWarning,strengthSessionKey,workoutKind,type StrengthInput,type StrengthSet} from './sessionStore'
import {getRecord,listRecords,openTempoDatabase,saveRecord} from '../db/storage'
import {EQUIPMENT_SETTINGS_ID,exerciseOptions,placeName,selectEquipment,type EquipmentPreferences} from './equipment'
import {strengthSummary,type StrengthPlace} from '../stats/activity'
import './workouts.css'
import HelpDisclosure from '../ui/HelpDisclosure'
import {StrengthSessionTimer,TimedHold} from '../phase28/StrengthTimers'
import '../phase28/strength-timers.css'
import {deriveAdaptiveWeeks} from '../phase28/adaptive-planner'
import {suggestedStrengthSets,REGULAR_LEG_SETS,LEG_EXERCISE_IDS} from '../phase28/strength-dose'
import type {GoalEvent} from '../events/library'

const blank=(exerciseId:string,setIndex:number):StrengthInput=>({exerciseId,setIndex,reps:'',weightKg:'',holdSeconds:'',rir:''})
const stateKey=(id:string,index:number)=>`${id}:${index}`
const selectDate=(date:string)=>date || currentKey()

type Data=Awaited<ReturnType<typeof loadWorkoutData>>
export default function StrengthPanel({focusId}:{focusId?:string}){
  const [data,setData]=useState<Data>({planned:[],completed:[],readiness:[],sets:[]})
  const [date,setDate]=useState(currentKey())
  const [variant,setVariant]=useState<'A'|'B'|'C'>('A')
  const [location,setLocation]=useState<StrengthPlace>('studio')
  const [equipment,setEquipment]=useState<Record<StrengthPlace,Record<string,string>>>({studio:{},arbeit:{}})
  const [plannedId,setPlannedId]=useState('')
  const [inputs,setInputs]=useState<Record<string,StrengthInput>>({})
  const dirtyInputs=useRef(new Set<string>())
  const activeStrengthKey=useRef('')
  const [proposals,setProposals]=useState<Record<string,StrengthProposal>>({})
  const [completedHolds,setCompletedHolds]=useState<Record<string,boolean>>({})
  const [goals,setGoals]=useState<GoalEvent[]>([])
  const [duration,setDuration]=useState('00:55:00')
  const [rpe,setRpe]=useState('5')
  const [notes,setNotes]=useState('')
  const [message,setMessage]=useState('Einheiten werden geladen …')
  const [busy,setBusy]=useState(false)
  const planned=data.planned.filter(isStrength).sort((a,b)=>a.date.localeCompare(b.date))
  const selected=planned.find(x=>x.id===plannedId)
  const kind=selected?workoutKind(selected):variant
  const template=STRENGTH[kind]
  const onDate=selected?.date??date
  const sessionKey=strengthSessionKey(onDate,kind,selected?.id)
  const coachingWeek=useMemo(()=>deriveAdaptiveWeeks({start:onDate,weeks:1,events:goals,completed:data.completed,planned:data.planned,regularLegSets:REGULAR_LEG_SETS})[0],
    [onDate,goals,data.completed,data.planned])
  const preservedCounts=useMemo(()=>Object.fromEntries(template.exercises.map(ex=>[ex.id,
    data.sets.filter(x=>x.sessionKey===sessionKey&&x.exerciseId===ex.id).reduce((n,x)=>Math.max(n,x.setIndex),0)])),[sessionKey,template,data.sets])
  const suggestedCounts=useMemo(()=>suggestedStrengthSets(template.exercises,coachingWeek?.legSets??REGULAR_LEG_SETS,preservedCounts),
    [template,coachingWeek?.legSets,preservedCounts])
  const suggestedCountKey=template.exercises.map(ex=>suggestedCounts[ex.id]).join(',')
  const setsForExercise=(id:string)=>suggestedCounts[id]??0
  const done=alreadyDone(selected,data.completed,selected?undefined:sessionKey)
  const locationTotals=useMemo(()=>strengthSummary(data.completed),[data.completed])
  const recentExerciseVariants=useMemo(()=>{
    const rows=[...data.sets].filter(x=>x.exerciseVariant&&x.trainingLocation).sort((a,b)=>b.date.localeCompare(a.date)||b.setIndex-a.setIndex)
    const seen=new Set<string>()
    return rows.filter(row=>{const key=`${row.trainingLocation}:${row.exerciseId}:${row.exerciseVariant}`;if(seen.has(key))return false;seen.add(key);return true}).slice(0,9)
  },[data.sets])
  const history=useMemo(()=>data.completed.filter(x=>x.sessionType==='strength-a'||x.sessionType==='strength-b'||x.sessionType==='strength-c'||x.sessionType==='manual-strength').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8),[data.completed])

  useEffect(()=>{
    let active=true
    const refreshGoals=()=>void listRecords<GoalEvent>('events').then(rows=>{if(active)setGoals(rows.filter(x=>x.profileId===PROFILE_ID))}).catch(()=>undefined)
    refreshGoals();window.addEventListener('tempo:events-change',refreshGoals)
    return()=>{active=false;window.removeEventListener('tempo:events-change',refreshGoals)}
  },[])
  useEffect(()=>{void getRecord<EquipmentPreferences>('settings',EQUIPMENT_SETTINGS_ID).then(record=>{if(record?.favourites)setEquipment({studio:record.favourites.studio??{},arbeit:record.favourites.arbeit??{}})}).catch(()=>undefined)},[])
  useEffect(()=>{
    let active=true
    const refresh=()=>void loadWorkoutData().then(next=>{
      if(!active)return
      setData(next)
      setMessage('Kraft A/B/C bereit. Satzgewichte und Wiederholungen werden lokal gespeichert.')
    }).catch(e=>{if(active)setMessage(`Ladefehler: ${String(e)}`)})
    refresh();window.addEventListener('tempo:training-change',refresh)
    return()=>{active=false;window.removeEventListener('tempo:training-change',refresh)}
  },[])
  useEffect(()=>{
    if(!focusId)return
    const found=data.planned.find(x=>x.id===focusId && isStrength(x))
    if(found){setPlannedId(found.id);setDate(found.date);setVariant(workoutKind(found))}
  },[focusId,data.planned])
  useEffect(()=>{
    if(activeStrengthKey.current!==sessionKey){activeStrengthKey.current=sessionKey;dirtyInputs.current.clear()}
    const existing=data.sets.filter(x=>x.sessionKey===sessionKey)
    const next:Record<string,StrengthInput>={}
    const nextProposals:Record<string,StrengthProposal>={}
    const savedHolds:Record<string,boolean>={}
    for(const ex of template.exercises)for(let i=1;i<=setsForExercise(ex.id);i++){
      const stored=existing.find(x=>x.exerciseId===ex.id&&x.setIndex===i)
      const variantName=selectEquipment(ex.id,location,ex.name,equipment[location])
      const proposal=strengthProposal(ex,data.sets.filter(row=>data.completed.some(item=>item.plannedSessionId===row.sessionKey||item.id===`workout:${row.sessionKey}`)),location,variantName,onDate)
      const key=stateKey(ex.id,i)
      nextProposals[key]=proposal
      savedHolds[key]=Boolean(stored?.completed)
      next[key]=dirtyInputs.current.has(key)&&inputs[key]?inputs[key]:stored?{
        exerciseId:ex.id,setIndex:i,reps:stored.reps==null?'':String(stored.reps),weightKg:stored.weightKg==null?'':String(stored.weightKg),
        holdSeconds:stored.holdSeconds==null?'':String(stored.holdSeconds),rir:stored.rir==null?'':String(stored.rir),
      }:{exerciseId:ex.id,setIndex:i,reps:ex.hold?'':String(proposal.reps),weightKg:proposal.weightKg===undefined?'':String(proposal.weightKg),holdSeconds:ex.hold?String(proposal.holdSeconds):'',rir:String(proposal.rir)}
    }
    setInputs(next);setProposals(nextProposals);setCompletedHolds(savedHolds)
  },[sessionKey,data.sets,data.completed,suggestedCountKey,location,equipment])

  const patch=(id:string,index:number,key:'reps'|'weightKg'|'holdSeconds'|'rir',value:string)=>setInputs(previous=>{
    const k=stateKey(id,index)
    dirtyInputs.current.add(k)
    return {...previous,[k]:{...(previous[k]??blank(id,index)),[key]:value}}
  })
  const chosen=(id:string,name:string)=>selectEquipment(id,location,name,equipment[location])
  const selectVariant=(id:string,value:string)=>setEquipment(previous=>({...previous,[location]:{...previous[location],[id]:value}}))
  const rememberEquipment=async()=>{
    const now=new Date().toISOString()
    await saveRecord('settings',{id:EQUIPMENT_SETTINGS_ID,profileId:PROFILE_ID,createdAt:now,updatedAt:now,favourites:equipment} as EquipmentPreferences)
  }
  const collect=():StrengthSet[]=>{
    const now=new Date().toISOString()
    return Object.values(inputs).flatMap(row=>{
      const reps=numberField(row.reps,'Wiederholungen',200)
      const weightKg=numberField(row.weightKg,'Gewicht',800)
      const holdSeconds=numberField(row.holdSeconds,'Haltezeit',900)
      const rir=numberField(row.rir,'Reserve',10)
      if(reps!==undefined&&!Number.isInteger(reps))throw Error('Wiederholungen müssen ganzzahlig sein.')
      if(holdSeconds!==undefined&&!Number.isInteger(holdSeconds))throw Error('Haltezeit in ganzen Sekunden eingeben.')
      if(rir!==undefined&&(!Number.isInteger(rir)||rir>5))throw Error('RIR zwischen 0 und 5 eingeben.')
      if(reps===undefined&&weightKg===undefined&&holdSeconds===undefined&&rir===undefined&&!completedHolds[stateKey(row.exerciseId,row.setIndex)])return []
      if(!reps&&!holdSeconds)throw Error(`Satz ${row.setIndex} von ${row.exerciseId}: Wiederholungen oder Haltezeit fehlt.`)
      const record:StrengthSet={id:`strength:${sessionKey}:${row.exerciseId}:${row.setIndex}`,sessionKey,profileId:PROFILE_ID,
        date:onDate,plannedSessionId:selected?.id,exerciseId:row.exerciseId,setIndex:row.setIndex,reps,weightKg,holdSeconds,completed:completedHolds[stateKey(row.exerciseId,row.setIndex)]??false,rir,exerciseVariant:chosen(row.exerciseId,template.exercises.find(x=>x.id===row.exerciseId)?.name??row.exerciseId),trainingLocation:location,createdAt:now,updatedAt:now}
      return [record]
    })
  }
  async function saveDraft(){
    setBusy(true)
    try{
      if(done)throw Error('Diese Einheit ist bereits abgeschlossen.')
      const records=collect()
      const db=await openTempoDatabase()
      await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction('strengthSets','readwrite');const store=tx.objectStore('strengthSets')
        // Kein Löschen bestehender Sätze: leere Formulare überschreiben keine alten Protokolle.
        for(const value of records)store.put({...value,createdAt:data.sets.find(x=>x.id===value.id)?.createdAt??value.createdAt})
        tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error??Error('Sätze nicht gespeichert.'))};tx.onabort=()=>{db.close();reject(Error('Sätze nicht gespeichert.'))}
      })
      await rememberEquipment().catch(()=>undefined)
      setData(await loadWorkoutData())
      setMessage(`${records.length} Satz-/Haltezeit-Einträge zwischengespeichert. Du kannst später fortsetzen.`)
    }catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }
  async function finish(e:FormEvent){
    e.preventDefault();setBusy(true)
    try{
      if(done)throw Error('Diese Einheit ist bereits abgeschlossen.')
      const sets=collect()
      if(!sets.length)throw Error('Bitte mindestens einen Satz erfassen.')
      const time=parseHms(duration)
      const durationMin=time.minutes
      const effort=numberField(rpe,'RPE',10,true)!
      await finalizeWorkout({date:onDate,planned:selected,title:selected?.title??template.title,
        durationMin,durationSec:time.seconds,rpe:effort,notes,sessionType:'manual-strength',strengthVariant:kind,strengthLocation:location,sets,freeKey:sessionKey})
      await rememberEquipment().catch(()=>undefined)
      setData(await loadWorkoutData())
      setMessage('Krafttraining abgeschlossen ✓ · Satzprotokoll und tatsächliche Belastung gespeichert.')
    }catch(err){setMessage(`Nicht abgeschlossen: ${err instanceof Error?err.message:String(err)}`)}finally{setBusy(false)}
  }
  const warning=readinessWarning(onDate,data.readiness)
  return <div className="tw-stack">
    <section className="panel tw-panel">
      <div className="eyebrow">KRAFT · TRAINING STARTKLAR</div><h2>Kraft A / B / C · Oberkörper</h2><StrengthSessionTimer sessionId={sessionKey} onStop={seconds=>{if(seconds>0){setDuration(formatSeconds(seconds));setMessage('Timer gestoppt: Trainingsdauer wurde ins Abschlussformular übernommen. Bitte Training abschließen, um sie dauerhaft zu speichern.')}}}/>
      <HelpDisclosure id="strength-intro"><p>Schwerpunkt Beine und Rumpf mit Oberkörper-Ausgleich, Adduktoren-/Abduktorenübungen ohne Maschinen und schonender Schulterarbeit. <strong>Kleiner Start/Stopp-Timer für das Gesamttraining und Countdown für Halteübungen; keine Töne.</strong> Die Satzpausen stehen bei jeder Übung.</p></HelpDisclosure>
      <div className="tw-form-grid">
        <label>Geplantes Training<select value={plannedId} onChange={e=>{
          const id=e.target.value;setPlannedId(id)
          const item=planned.find(x=>x.id===id)
          if(item){setDate(item.date);setVariant(workoutKind(item));setDuration(durationFor(item))}else setDuration('00:55:00')
        }}><option value="">Eigene Einheit – unabhängig vom Plan</option>{planned.map(x=><option key={x.id} value={x.id}>{x.date} · {x.title}{x.status==='erledigt'?' ✓':''}</option>)}</select></label>
        {!selected&&<><label>Datum<input type="date" value={date} onChange={e=>setDate(selectDate(e.target.value))}/></label><label>Programm<select value={variant} onChange={e=>setVariant(e.target.value as 'A'|'B'|'C')}><option value="A">Kraft A</option><option value="B">Kraft B</option><option value="C">Kraft C · Oberkörper</option></select></label></>}
      </div>
      <div className="tw-location"><strong>Trainingsort</strong><div className="tw-location-choices">{(['studio','arbeit'] as const).map(place=><button type="button" key={place} className={location===place?'selected':''} disabled={done} onClick={()=>setLocation(place)}>{placeName[place]}</button>)}</div><p>Gerätevarianten werden für jeden Ort separat gemerkt und mit den Sätzen protokolliert.</p></div>
      <div className="tw-info"><strong>{template.title} · {friendlyDate(onDate)}</strong><span>{template.focus}</span><span>{template.warmup}</span></div>
      {coachingWeek&&kind!=='C'&&<div className="tw-info"><strong>Adaptive Kraftdosierung · {coachingWeek.kind}{coachingWeek.deload?' / Entlastung':''}</strong><span>Empfehlung für die Unterkörperübungen: ca. {coachingWeek.legSets} Arbeitssätze über Kraft A und B zusammen pro Woche (regulär {REGULAR_LEG_SETS}). Oberkörper bleibt erhalten.</span><span>Bereits protokollierte Sätze bleiben sichtbar und werden nicht reduziert oder gelöscht. Dienst, Müdigkeit und Schmerzen haben Vorrang.</span></div>}
      {warning&&<div className="tw-warning" role="status">{warning} Keine automatische Trainingsfreigabe.</div>}
      {done&&<div className="tw-success">Diese Einheit ist bereits als absolviert gespeichert. Satzprotokoll bleibt lesbar; ein erneuter Abschluss wird verhindert.</div>}
    </section>
    {selected&&<OptionalFuelingNotes session={selected}/>}
    <form onSubmit={finish} className="tw-stack">
      {template.exercises.map((ex,index)=><section className="panel tw-exercise" key={ex.id}>
        <div className="tw-exercise-head"><span className="tw-number">{String(index+1).padStart(2,'0')}</span><div><h3>{ex.name}</h3><p>{ex.cue}</p></div></div>
        <label className="tw-variant">Übung / Gerät an diesem Ort<select value={chosen(ex.id,ex.name)} disabled={done} onChange={event=>selectVariant(ex.id,event.target.value)}>{exerciseOptions(ex.id,location,ex.name).map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        <div className="tw-tags"><span>{setsForExercise(ex.id)} Sätze · {ex.reps}{LEG_EXERCISE_IDS.has(ex.id)&&setsForExercise(ex.id)!==ex.sets?' · an Radblock angepasst':''}</span><span>Pause: {restLabel(ex.restSec)}</span>{ex.unilateral&&<span>Je Seite</span>}</div>
        <div className="tw-sets"><div className="tw-set-head"><span>Satz</span><span>{ex.hold?'Halten (s)':'Wdh.'}</span><span>Gewicht (kg)</span><span>RIR</span></div>
          {Array.from({length:setsForExercise(ex.id)},(_,i)=>i+1).map(i=>{
            const value=inputs[stateKey(ex.id,i)]??blank(ex.id,i)
            const recommendation=proposals[stateKey(ex.id,i)]
            return <div className="tw-set" key={i}><span>{i}</span>
              <input disabled={done} aria-label={`${ex.name} Satz ${i} ${ex.hold?'Haltezeit':'Wiederholungen'}`} type="number" inputMode="numeric" min="0" max={ex.hold?900:200} step="1" value={ex.hold?value.holdSeconds:value.reps} onChange={e=>patch(ex.id,i,ex.hold?'holdSeconds':'reps',e.target.value)} placeholder={ex.hold?'20':'8'}/>
              <input disabled={done} aria-label={`${ex.name} Satz ${i} Gewicht`} type="number" inputMode="decimal" min="0" max="800" step="0.5" value={value.weightKg} className={recommendation?.increased&&!data.sets.some(row=>row.sessionKey===sessionKey&&row.exerciseId===ex.id&&row.setIndex===i)?'tempo38-progress-weight':''} title={recommendation?.previousWeight!==undefined?`Zuletzt ${recommendation.previousWeight} kg → Vorschlag ${recommendation.weightKg} kg. ${recommendation.reason}`:'Kein vergleichbares vorheriges Gewicht'} onChange={e=>patch(ex.id,i,'weightKg',e.target.value)} placeholder="–"/>
              <input disabled={done} aria-label={`${ex.name} Satz ${i} Reserve`} type="number" inputMode="numeric" min="0" max="5" step="1" value={value.rir} onChange={e=>patch(ex.id,i,'rir',e.target.value)} placeholder="2"/>
              {ex.hold&&<TimedHold exerciseId={ex.id} setNumber={i} targetSeconds={Number(value.holdSeconds)||20} checked={Boolean(completedHolds[stateKey(ex.id,i)])} onDone={checked=>{setCompletedHolds(prev=>({...prev,[stateKey(ex.id,i)]:checked}));if(checked&&!value.holdSeconds)patch(ex.id,i,'holdSeconds','20')}}/>}
            </div>
          })}</div>
          {proposals[stateKey(ex.id,1)]?.increased&&<small className="tempo38-weight-note">Letztes Training: {proposals[stateKey(ex.id,1)].previousWeight} kg → Empfehlung: {proposals[stateKey(ex.id,1)].weightKg} kg. Falls du das Gewicht anders ausführst, bitte ändern.</small>}
      </section>)}
      <section className="panel tw-panel"><div className="eyebrow">ABSCHLUSS · DEINE IST-WERTE</div><h3>Training dokumentieren</h3>
        <div className="tw-form-grid"><TimeFields label="Trainingsdauer (vom Timer übernommen, bei Bedarf korrigieren)" value={duration} onChange={setDuration} required disabled={Boolean(done)}/><label>RPE 1–10<select disabled={done} value={rpe} onChange={e=>setRpe(e.target.value)}>{Array.from({length:10},(_,i)=><option value={i+1} key={i}>{i+1}</option>)}</select></label></div>
        <label className="tw-notes">Bemerkungen<textarea disabled={done} value={notes} maxLength={1500} onChange={e=>setNotes(e.target.value)} placeholder="Schultergefühl, Adduktoren, Kraftreserve …"/></label>
        <div className="tw-actions"><button type="button" disabled={busy||done} className="tw-secondary" onClick={()=>void saveDraft()}>Sätze zwischenspeichern</button><button type="submit" disabled={busy||done}>{busy?'Speichere …':'Training abschließen ✓'}</button></div>
        <div className="tw-feedback" role="status">{message}</div>
      </section>
    </form>
    {selected&&<SessionGarminReview session={selected}/>}
    <section className="panel tw-panel"><div className="eyebrow">KRAFT · LETZTE EINHEITEN</div><h3>Dein Verlauf nach Trainingsort</h3><div className="tw-location-summary"><span>Fitnessstudio <strong>{locationTotals.studio}</strong></span><span>Arbeit <strong>{locationTotals.arbeit}</strong></span><span>Nicht erfasst <strong>{locationTotals.unknown}</strong></span></div>{history.length?history.map(x=><div className="tw-history" key={x.id}><strong>{friendlyDate(x.date)} · {x.title}</strong><span>{durationFor(x)} · RPE {x.rpe??'–'} · {x.strengthLocation==='studio'?'Studio':x.strengthLocation==='arbeit'?'Arbeit':'Ort offen'}</span></div>):<p>Noch keine Kraft-Einheit protokolliert. Du kannst auch spontan ohne geplanten Termin beginnen.</p>}</section>
    {recentExerciseVariants.length>0&&<section className="panel tw-panel"><div className="eyebrow">ÜBUNGSVERLAUF NACH GERÄT</div><h3>Zuletzt verwendete Varianten</h3><p>Gewichte und Wiederholungen sind je Trainingsort und Gerät nachvollziehbar. Verschiedene Maschinen werden nicht als identische Last verglichen.</p>{recentExerciseVariants.map(row=><div className="tw-history" key={`${row.id}:${row.exerciseVariant}`}><strong>{row.exerciseVariant} · {row.trainingLocation==='studio'?'Fitnessstudio':'Arbeit'}</strong><span>{friendlyDate(row.date)} · {row.weightKg==null?'ohne Gewicht':`${row.weightKg} kg`} · {row.reps??row.holdSeconds??'–'} {row.holdSeconds?'s':'Wdh.'}</span></div>)}</section>}
  </div>
}
