import {germanDate} from '../phase40c/date'
import {validateWellness,type Wellness} from '../phase40c/wellness'
import TimeFields from '../time/TimeFields'
import SessionGarminReview from '../phase37/SessionGarminReview'
import OptionalFuelingNotes from '../phase37/OptionalFuelingNotes'
import {parseHms,durationFor,formatSeconds} from '../time/duration'
import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react'
import {currentKey,friendlyDate,PROFILE_ID,type TrainingRecord} from '../planning/engine'
import {STRENGTH,restLabel,type Exercise} from './catalog'
import {SPORT_EXERCISES,SPORT_FOCI,exercisePool,validSessionExercises,type SportFocus} from './sportExercises'
import {strengthProposal,type StrengthProposal} from '../phase38/strength-progression'
import {alreadyDone,finalizeWorkout,isStrength,loadWorkoutData,numberField,readinessWarning,strengthSessionKey,workoutKind,type StrengthInput,type StrengthSet} from './sessionStore'
import {getRecord,listRecords,openTempoDatabase,saveRecord} from '../db/storage'
import {EQUIPMENT_SETTINGS_ID,exerciseOptions,placeName,selectEquipment,type EquipmentPreferences} from './equipment'
import {strengthSummary,type StrengthPlace} from '../stats/activity'
import './workouts.css'
import HelpDisclosure from '../ui/HelpDisclosure'
import {StrengthSessionTimer,TimedHold,clearStrengthTimer,readStrengthTimer} from '../phase28/StrengthTimers'
import {archiveStrengthDraft,clearStrengthDraft,loadStrengthDraft,readActiveStrengthDraft,readLocalStrengthDraft,rememberStrengthDraft,type StrengthDraft} from './strengthDraft'
import '../phase28/strength-timers.css'
import {deriveAdaptiveWeeks} from '../phase28/adaptive-planner'
import {suggestedStrengthSets,REGULAR_LEG_SETS,LEG_EXERCISE_IDS} from '../phase28/strength-dose'
import type {GoalEvent} from '../events/library'
import type {TrainingBlock} from '../blocks/library'
import type {ReadinessRecord,ShiftRecord} from '../planning/engine'

const blank=(exerciseId:string,setIndex:number):StrengthInput=>({exerciseId,setIndex,reps:'',weightKg:'',holdSeconds:'',rir:''})
const stateKey=(id:string,index:number)=>`${id}:${index}`
const selectDate=(date:string)=>date || currentKey()

type Data=Awaited<ReturnType<typeof loadWorkoutData>>
export default function StrengthPanel({focusId}:{focusId?:string}){
  const previousDraft=useRef(focusId?null:readActiveStrengthDraft())
  const [data,setData]=useState<Data>({planned:[],completed:[],readiness:[],sets:[]})
  const [dataLoaded,setDataLoaded]=useState(false)
  const [date,setDate]=useState(previousDraft.current?.date??currentKey())
  const [variant,setVariant]=useState<'A'|'B'|'C'>(previousDraft.current?.variant??'A')
  const [location,setLocation]=useState<StrengthPlace>(previousDraft.current?.location??'studio')
  const [equipment,setEquipment]=useState<Record<StrengthPlace,Record<string,string>>>(previousDraft.current?.equipment??{studio:{},arbeit:{}})
  const [plannedId,setPlannedId]=useState(focusId??previousDraft.current?.plannedId??'')
  const [inputs,setInputs]=useState<Record<string,StrengthInput>>({})
  const dirtyInputs=useRef(new Set<string>())
  const activeStrengthKey=useRef('')
  const [proposals,setProposals]=useState<Record<string,StrengthProposal>>({})
  const [completedHolds,setCompletedHolds]=useState<Record<string,boolean>>({})
  const [goals,setGoals]=useState<GoalEvent[]>([])
  const [trainingBlocks,setTrainingBlocks]=useState<TrainingBlock[]>([])
  const [weekShifts,setWeekShifts]=useState<Record<string,ShiftRecord>>({})
  const [readiness,setReadiness]=useState<ReadinessRecord|undefined>()
  const [garminWellness,setGarminWellness]=useState<Wellness|undefined>()
  const [sportFocus,setSportFocus]=useState<SportFocus>('Radfahren')
  const [addedExercise,setAddedExercise]=useState('')
  const [sessionExerciseMap,setSessionExerciseMap]=useState<Record<string,Exercise[]>>(()=>{const d=previousDraft.current;return d?.exercises?{[d.sessionKey]:d.exercises}:{}})
  const [duration,setDuration]=useState(previousDraft.current?.duration??'00:55:00')
  const [rpe,setRpe]=useState(previousDraft.current?.rpe??'5')
  const [notes,setNotes]=useState(previousDraft.current?.notes??'')
  const [hydratedSession,setHydratedSession]=useState('')
  const touched=useRef(Boolean(previousDraft.current))
  const latestDraft=useRef<StrengthDraft|null>(null)
  const lastArchived=useRef('')
  const [touchRevision,setTouchRevision]=useState(0)
  const manuallySetDuration=useRef(false)
  const completedSuccessfully=useRef(false)
  const markTouched=()=>{touched.current=true;setTouchRevision(value=>value+1)}
  const [autoSaveMessage,setAutoSaveMessage]=useState('Noch keine Eingabe – automatische Sicherung startet mit dem Training.')
  const [message,setMessage]=useState('Einheiten werden geladen …')
  const [busy,setBusy]=useState(false)
  const planned=data.planned.filter(isStrength).sort((a,b)=>a.date.localeCompare(b.date))
  const selected=planned.find(x=>x.id===plannedId)
  const kind=selected?workoutKind(selected):variant
  const template=STRENGTH[kind]
  const onDate=selected?.date??date
  const sessionKey=strengthSessionKey(onDate,kind,selected?.id)
  const exercises=sessionExerciseMap[sessionKey]??template.exercises
  const exerciseSignature=exercises.map(ex=>ex.id).join('|')
  const coachingWeek=useMemo(()=>deriveAdaptiveWeeks({start:onDate,weeks:1,events:goals,blocks:trainingBlocks,completed:data.completed,planned:data.planned,shifts:weekShifts,readiness,regularLegSets:REGULAR_LEG_SETS,wellness:garminWellness})[0],
    [onDate,goals,trainingBlocks,data.completed,data.planned,weekShifts,readiness,garminWellness])
  const preservedCounts=useMemo(()=>Object.fromEntries(exercises.map(ex=>[ex.id,
    data.sets.filter(x=>x.sessionKey===sessionKey&&x.exerciseId===ex.id).reduce((n,x)=>Math.max(n,x.setIndex),0)])),[sessionKey,exerciseSignature,data.sets])
  const suggestedCounts=useMemo(()=>suggestedStrengthSets(exercises,coachingWeek?.legSets??REGULAR_LEG_SETS,preservedCounts),
    [exerciseSignature,coachingWeek?.legSets,preservedCounts])
  const suggestedCountKey=exercises.map(ex=>suggestedCounts[ex.id]).join(',')
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
  useEffect(()=>{let alive=true
    const load=()=>void Promise.all([listRecords<TrainingBlock>('trainingBlocks'),listRecords<ShiftRecord>('shifts'),getRecord<ReadinessRecord>('readinessEntries',`${PROFILE_ID}:${onDate}`)]).then(([blocks,shifts,ready])=>{
      if(!alive)return
      setTrainingBlocks(blocks.filter(b=>b.profileId===PROFILE_ID))
      setWeekShifts(Object.fromEntries(shifts.filter(x=>x.profileId===PROFILE_ID).map(x=>[x.date,x])))
      setReadiness(ready)
    }).catch(()=>undefined)
    load();window.addEventListener('tempo:training-change',load);window.addEventListener('tempo:readiness-change',load)
    return()=>{alive=false;window.removeEventListener('tempo:training-change',load);window.removeEventListener('tempo:readiness-change',load)}
  },[onDate])
  useEffect(()=>{let live=true
    const load=()=>void getRecord('settings',`garmin-wellness:${PROFILE_ID}:${onDate}`).then(row=>{if(live)setGarminWellness(validateWellness(row?.wellness)??undefined)}).catch(()=>undefined)
    load();window.addEventListener('tempo:garmin-wellness-change',load)
    return()=>{live=false;window.removeEventListener('tempo:garmin-wellness-change',load)}
  },[onDate])
  useEffect(()=>{void getRecord<EquipmentPreferences>('settings',EQUIPMENT_SETTINGS_ID).then(record=>{if(record?.favourites&&!previousDraft.current?.equipment)setEquipment({studio:record.favourites.studio??{},arbeit:record.favourites.arbeit??{}})}).catch(()=>undefined)},[])
  useEffect(()=>{
    let active=true
    const refresh=()=>void loadWorkoutData().then(next=>{
      if(!active)return
      setData(next)
      setDataLoaded(true)
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
    if(!dataLoaded)return
    let stillHere=true
    const sessionChanged=activeStrengthKey.current!==sessionKey
    if(sessionChanged){activeStrengthKey.current=sessionKey;dirtyInputs.current.clear();touched.current=false;setHydratedSession('')}
    const recovered=sessionChanged?readLocalStrengthDraft(sessionKey):null
    const existing=data.sets.filter(x=>x.sessionKey===sessionKey)
    const next:Record<string,StrengthInput>={}
    const nextProposals:Record<string,StrengthProposal>={}
    const savedHolds:Record<string,boolean>={}
    const activeExercises=(recovered?.exercises&&validSessionExercises(recovered.exercises))?recovered.exercises:exercises
    if(recovered?.exercises&&validSessionExercises(recovered.exercises)&&!sessionExerciseMap[sessionKey])setSessionExerciseMap(old=>({...old,[sessionKey]:recovered.exercises!}))
    for(const ex of activeExercises)for(let i=1;i<=Math.max(0,suggestedCounts[ex.id]??ex.sets);i++){
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
    const useDraft=recovered&&!done
    if(useDraft){
      for(const [key,row] of Object.entries(recovered.inputs)){
        if(next[key]){next[key]={...row};dirtyInputs.current.add(key)}
      }
      Object.assign(savedHolds,recovered.completedHolds)
      setLocation(recovered.location)
      if(recovered.equipment)setEquipment(recovered.equipment)
      manuallySetDuration.current=Boolean(recovered.durationEdited)
      setDuration(recovered.duration);setRpe(recovered.rpe);setNotes(recovered.notes)
      touched.current=true
      setAutoSaveMessage(`Zwischenstand vom ${new Date(recovered.savedAt).toLocaleTimeString('de-DE')} wiederhergestellt.`)
    }
    setInputs(next);setProposals(nextProposals);setCompletedHolds(previous=>sessionChanged?savedHolds:{...savedHolds,...previous})
    setHydratedSession(sessionKey)
    // IndexedDB fallback if Safari did not allow localStorage.
    if(sessionChanged&&!useDraft&&!done)void loadStrengthDraft(sessionKey).then(saved=>{
      if(!stillHere||!saved||activeStrengthKey.current!==sessionKey||touched.current)return
      touched.current=true
      for(const key of Object.keys(saved.inputs))dirtyInputs.current.add(key)
      setInputs(prev=>({...prev,...saved.inputs}));setCompletedHolds(prev=>({...prev,...saved.completedHolds}))
      if(saved.exercises&&validSessionExercises(saved.exercises))setSessionExerciseMap(prev=>({...prev,[sessionKey]:saved.exercises!}))
      setLocation(saved.location);if(saved.equipment)setEquipment(saved.equipment)
      manuallySetDuration.current=Boolean(saved.durationEdited)
      setDuration(saved.duration);setRpe(saved.rpe);setNotes(saved.notes)
      setAutoSaveMessage('Gesichertes Training aus der lokalen Datenbank wiederhergestellt.')
    })
    return()=>{stillHere=false}
  },[dataLoaded,sessionKey,data.sets,data.completed,suggestedCountKey,location,equipment,exerciseSignature])

  // Every edit is immediately saved in local browser storage. The same snapshot
  // is archived in TEMPO IndexedDB after a short debounce and every 30 seconds.
  useEffect(()=>{
    if(!dataLoaded||hydratedSession!==sessionKey||done||completedSuccessfully.current||!touched.current)return
    const draft:StrengthDraft={version:1,sessionKey,profileId:PROFILE_ID,date:onDate,plannedId:selected?.id??'',
      variant:kind,location,inputs,completedHolds,equipment,exercises,durationEdited:manuallySetDuration.current,duration,rpe,notes,savedAt:new Date().toISOString()}
    latestDraft.current=draft
    const localOK=rememberStrengthDraft(draft)
    setAutoSaveMessage(localOK?'Automatisch gesichert · '+new Date(draft.savedAt).toLocaleTimeString('de-DE'):'Speicherung in der TEMPO-Datenbank wird vorbereitet …')
    const later=window.setTimeout(()=>{if(completedSuccessfully.current)return;void archiveStrengthDraft(draft).then(()=>{lastArchived.current=draft.savedAt}).catch(()=>setAutoSaveMessage('Speichern derzeit nicht möglich – bitte Speicherplatz kontrollieren.'))},1200)
    return()=>clearTimeout(later)
  },[dataLoaded,hydratedSession,sessionKey,done,onDate,selected?.id,kind,location,inputs,completedHolds,equipment,exerciseSignature,duration,rpe,notes,touchRevision])
  useEffect(()=>{
    const flush=()=>{
      const snapshot=latestDraft.current
      if(snapshot&&!completedSuccessfully.current&&snapshot.sessionKey===sessionKey&&touched.current&&hydratedSession===sessionKey){
        rememberStrengthDraft(snapshot)
        if(document.visibilityState==='hidden')void archiveStrengthDraft(snapshot).catch(()=>undefined)
      }
    }
    const interval=window.setInterval(()=>{
      const snapshot=latestDraft.current
      if(snapshot&&!completedSuccessfully.current&&snapshot.sessionKey===sessionKey){
        const refreshed={...snapshot,savedAt:new Date().toISOString()}
        latestDraft.current=refreshed
        rememberStrengthDraft(refreshed)
        void archiveStrengthDraft(refreshed).then(()=>{lastArchived.current=refreshed.savedAt}).catch(()=>undefined)
      }
    },30_000)
    document.addEventListener('visibilitychange',flush)
    window.addEventListener('pagehide',flush)
    return()=>{flush();clearInterval(interval);document.removeEventListener('visibilitychange',flush);window.removeEventListener('pagehide',flush)}
  },[sessionKey,hydratedSession])

  const patch=(id:string,index:number,key:'reps'|'weightKg'|'holdSeconds'|'rir',value:string)=>setInputs(previous=>{
    const k=stateKey(id,index)
    dirtyInputs.current.add(k)
    touched.current=true
    return {...previous,[k]:{...(previous[k]??blank(id,index)),[key]:value}}
  })
  const updateExercises=(next:Exercise[])=>{if(done||!validSessionExercises(next))return;markTouched();setSessionExerciseMap(prev=>({...prev,[sessionKey]:next}))}
  const swapExercise=(oldId:string,nextId:string)=>{
    if(!nextId||nextId===oldId)return
    if(exercises.some(ex=>ex.id===nextId)){setMessage('Diese Übung ist in der Einheit bereits enthalten.');return}
    const candidate=exercisePool([...template.exercises]).find(ex=>ex.id===nextId)
    if(!candidate)return
    const hasSets=data.sets.some(row=>row.sessionKey===sessionKey&&row.exerciseId===oldId)
    if(hasSets&&!window.confirm('Für diese Übung sind bereits Sätze gespeichert. Sie bleiben erhalten, werden nach dem Austausch aber nicht mehr in der aktuellen Übungsliste angezeigt. Trotzdem wechseln?'))return
    updateExercises(exercises.map(ex=>ex.id===oldId?candidate:ex))
  }
  const chosen=(id:string,name:string)=>selectEquipment(id,location,name,equipment[location])
  const selectVariant=(id:string,value:string)=>{touched.current=true;setEquipment(previous=>({...previous,[location]:{...previous[location],[id]:value}}))}
  const rememberEquipment=async()=>{
    const now=new Date().toISOString()
    await saveRecord('settings',{id:EQUIPMENT_SETTINGS_ID,profileId:PROFILE_ID,createdAt:now,updatedAt:now,favourites:equipment} as EquipmentPreferences)
  }
  const collect=():StrengthSet[]=>{
    const now=new Date().toISOString()
    return exercises.flatMap(ex=>Array.from({length:setsForExercise(ex.id)},(_,i)=>inputs[stateKey(ex.id,i+1)]).filter((v):v is StrengthInput=>Boolean(v))).flatMap(row=>{
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
        date:onDate,plannedSessionId:selected?.id,exerciseId:row.exerciseId,setIndex:row.setIndex,reps,weightKg,holdSeconds,completed:completedHolds[stateKey(row.exerciseId,row.setIndex)]??false,rir,exerciseVariant:chosen(row.exerciseId,exercises.find(x=>x.id===row.exerciseId)?.name??row.exerciseId),trainingLocation:location,createdAt:now,updatedAt:now}
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
      const timer=readStrengthTimer(sessionKey)
      const time=parseHms(!manuallySetDuration.current&&timer&&timer.elapsedSeconds>0?formatSeconds(timer.elapsedSeconds):duration)
      const durationMin=time.minutes
      const effort=numberField(rpe,'RPE',10,true)!
      await finalizeWorkout({date:onDate,planned:selected,title:selected?.title??template.title,
        durationMin,durationSec:time.seconds,rpe:effort,notes,sessionType:'manual-strength',strengthVariant:kind,strengthLocation:location,sets,freeKey:sessionKey})
      completedSuccessfully.current=true
      await rememberEquipment().catch(()=>undefined)
      await clearStrengthDraft(sessionKey)
      clearStrengthTimer(sessionKey)
      latestDraft.current=null;touched.current=false
      setData(await loadWorkoutData())
      setMessage('Krafttraining abgeschlossen ✓ · Satzprotokoll und tatsächliche Belastung gespeichert.')
    }catch(err){setMessage(`Nicht abgeschlossen: ${err instanceof Error?err.message:String(err)}`)}finally{setBusy(false)}
  }
  const warning=readinessWarning(onDate,data.readiness)
  return <div className="tw-stack">
    <div className="tempo40-pinned-timer"><StrengthSessionTimer sessionId={sessionKey} disabled={done} onToggle={markTouched} onStop={seconds=>{if(seconds>0&&!manuallySetDuration.current)setDuration(formatSeconds(seconds))}}/></div>
    <section className="panel tw-panel">
      <div className="eyebrow">KRAFT · TRAINING STARTKLAR</div><h2>Kraft A / B / C · Oberkörper</h2>
      <p className="tempo40-autosave" role="status">{autoSaveMessage} · Automatische Sicherung alle 30 Sekunden und nach Eingaben.</p>
      <HelpDisclosure id="strength-intro"><p>Schwerpunkt Beine und Rumpf mit Oberkörper-Ausgleich, Adduktoren-/Abduktorenübungen ohne Maschinen und schonender Schulterarbeit. <strong>Fixierter Start-/Pausen-Timer für das Gesamttraining und Countdown für Halteübungen; keine Töne.</strong> Die Satzpausen stehen bei jeder Übung.</p></HelpDisclosure>
      <div className="tw-form-grid">
        <label>Geplantes Training<select value={plannedId} onChange={e=>{
          const id=e.target.value;touched.current=true;setPlannedId(id)
          const item=planned.find(x=>x.id===id)
          if(item){setDate(item.date);setVariant(workoutKind(item));setDuration(durationFor(item))}else setDuration('00:55:00')
        }}><option value="">Eigene Einheit – unabhängig vom Plan</option>{planned.map(x=><option key={x.id} value={x.id}>{germanDate(x.date)} · {x.title}{x.status==='erledigt'?' ✓':''}</option>)}</select></label>
        {!selected&&<><label>Datum<input type="date" value={date} onChange={e=>{touched.current=true;setDate(selectDate(e.target.value))}}/></label><label>Programm<select value={variant} onChange={e=>{touched.current=true;setVariant(e.target.value as 'A'|'B'|'C')}}><option value="A">Kraft A</option><option value="B">Kraft B</option><option value="C">Kraft C · Oberkörper</option></select></label></>}
      </div>
      <div className="tw-location"><strong>Trainingsort</strong><div className="tw-location-choices">{(['studio','arbeit'] as const).map(place=><button type="button" key={place} className={location===place?'selected':''} disabled={done} onClick={()=>{touched.current=true;setLocation(place)}}>{placeName[place]}</button>)}</div><p>Gerätevarianten werden für jeden Ort separat gemerkt und mit den Sätzen protokolliert.</p></div>
      <div className="tw-info"><strong>{template.title} · {friendlyDate(onDate)}</strong><span>{template.focus}</span><span>{template.warmup}</span></div>
      {coachingWeek&&kind!=='C'&&<div className="tw-info"><strong>Adaptive Kraftdosierung · {coachingWeek.kind}{coachingWeek.deload?' / Entlastung':''}</strong><span>Empfehlung für die Unterkörperübungen: ca. {coachingWeek.legSets} Arbeitssätze über Kraft A und B zusammen pro Woche (regulär {REGULAR_LEG_SETS}). Oberkörper bleibt erhalten.</span><span>Bereits protokollierte Sätze bleiben sichtbar und werden nicht reduziert oder gelöscht. Dienst, Müdigkeit und Schmerzen haben Vorrang.</span></div>}
      {coachingWeek?.notes?.length>0&&<details className="tempo40b-coach-notes"><summary>Warum diese Kraftdosierung?</summary><p>{[...coachingWeek.notes,...coachingWeek.safeguards].join(' · ')}</p></details>}
      {warning&&<div className="tw-warning" role="status">{warning} Keine automatische Trainingsfreigabe.</div>}
      {done&&<div className="tw-success">Diese Einheit ist bereits als absolviert gespeichert. Satzprotokoll bleibt lesbar; ein erneuter Abschluss wird verhindert.</div>}
    </section>
    {selected&&<OptionalFuelingNotes session={selected}/>}
    <form onSubmit={finish} className="tw-stack">
      <section className="panel tw-panel tempo40b-exercise-picker">
        <div className="eyebrow">SPORTARTSPEZIFISCH · FLEXIBEL</div><h3>Übungen ergänzen oder austauschen</h3>
        <p>Dein A/B/C-Plan ist der Ausgangspunkt. Ergänzungen werden mit dem laufenden Training zwischengespeichert und lassen sich später fortsetzen. Erfasste Sätze werden nicht gelöscht.</p>
        <label>Trainingsfokus<select disabled={done} value={sportFocus} onChange={e=>{setSportFocus(e.target.value as SportFocus);setAddedExercise('')}}>{SPORT_FOCI.map(f=><option key={f}>{f}</option>)}</select></label>
        <div className="tempo40b-picker-actions"><label>Übung auswählen<select value={addedExercise} disabled={done} onChange={e=>setAddedExercise(e.target.value)}><option value="">Bitte auswählen</option>{SPORT_EXERCISES.filter(ex=>ex.focus===sportFocus&&!exercises.some(current=>current.id===ex.id)).map(ex=><option key={ex.id} value={ex.id}>{ex.name}</option>)}</select></label><button type="button" disabled={done||!addedExercise} onClick={()=>{const ex=SPORT_EXERCISES.find(x=>x.id===addedExercise);if(ex){updateExercises([...exercises,ex]);setAddedExercise('')}}}>+ Übung hinzufügen</button></div>
        <small>Technische Hebeübungen nur mit entsprechender Erfahrung durchführen. Vorschläge sind keine Pflicht und passen sich deinem Wochenbudget an.</small>
      </section>
      {exercises.map((ex,index)=><section className="panel tw-exercise" key={ex.id}>
        <div className="tw-exercise-head"><span className="tw-number">{String(index+1).padStart(2,'0')}</span><div><h3>{ex.name}</h3><p>{ex.cue}</p></div></div>
        <label className="tw-variant">Übung austauschen<select disabled={done} value={ex.id} onChange={e=>swapExercise(ex.id,e.target.value)}>{exercisePool(exercises.concat(template.exercises)).map(candidate=><option key={candidate.id} value={candidate.id} disabled={candidate.id!==ex.id&&exercises.some(x=>x.id===candidate.id)}>{candidate.name}</option>)}</select></label>
        <label className="tw-variant">Übung / Gerät an diesem Ort<select value={chosen(ex.id,ex.name)} disabled={done} onChange={event=>selectVariant(ex.id,event.target.value)}>{exerciseOptions(ex.id,location,ex.name).map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        {!done&&SPORT_EXERCISES.some(item=>item.id===ex.id)&&<button type="button" className="tempo40b-remove" onClick={()=>{if(exercises.length>1)updateExercises(exercises.filter(x=>x.id!==ex.id))}}>Zusatzübung entfernen</button>}
        <div className="tw-tags"><span>{setsForExercise(ex.id)} Sätze · {ex.reps}{LEG_EXERCISE_IDS.has(ex.id)&&setsForExercise(ex.id)!==ex.sets?' · an Radblock angepasst':''}</span><span>Pause: {restLabel(ex.restSec)}</span>{ex.unilateral&&<span>Je Seite</span>}</div>
        <div className="tw-sets"><div className="tw-set-head"><span>Satz</span><span>{ex.hold?'Halten (s)':'Wdh.'}</span><span>Gewicht (kg)</span><span>RIR</span></div>
          {Array.from({length:setsForExercise(ex.id)},(_,i)=>i+1).map(i=>{
            const value=inputs[stateKey(ex.id,i)]??blank(ex.id,i)
            const recommendation=proposals[stateKey(ex.id,i)]
            return <div className="tw-set" key={i}><span>{i}</span>
              <input disabled={done} onFocus={e=>e.currentTarget.select()} aria-label={`${ex.name} Satz ${i} ${ex.hold?'Haltezeit':'Wiederholungen'}`} type="text" inputMode="numeric" min="0" max={ex.hold?900:200} step="1" value={ex.hold?value.holdSeconds:value.reps} onChange={e=>patch(ex.id,i,ex.hold?'holdSeconds':'reps',e.target.value)} placeholder={ex.hold?'20':'8'}/>
              <input disabled={done} onFocus={e=>e.currentTarget.select()} aria-label={`${ex.name} Satz ${i} Gewicht`} type="text" inputMode="decimal" min="0" max="800" step="0.5" value={value.weightKg} className={recommendation?.increased&&!data.sets.some(row=>row.sessionKey===sessionKey&&row.exerciseId===ex.id&&row.setIndex===i)?'tempo38-progress-weight':''} title={recommendation?.previousWeight!==undefined?`Zuletzt ${recommendation.previousWeight} kg → Vorschlag ${recommendation.weightKg} kg. ${recommendation.reason}`:'Kein vergleichbares vorheriges Gewicht'} onChange={e=>patch(ex.id,i,'weightKg',e.target.value)} placeholder="–"/>
              <input disabled={done} onFocus={e=>e.currentTarget.select()} aria-label={`${ex.name} Satz ${i} Reserve`} type="text" inputMode="numeric" min="0" max="5" step="1" value={value.rir} onChange={e=>patch(ex.id,i,'rir',e.target.value)} placeholder="2"/>
              {ex.hold&&<TimedHold exerciseId={ex.id} setNumber={i} targetSeconds={Number(value.holdSeconds)||20} checked={Boolean(completedHolds[stateKey(ex.id,i)])} onDone={checked=>{touched.current=true;setCompletedHolds(prev=>({...prev,[stateKey(ex.id,i)]:checked}));if(checked&&!value.holdSeconds)patch(ex.id,i,'holdSeconds','20')}}/>}
            </div>
          })}</div>
          {proposals[stateKey(ex.id,1)]?.increased&&<small className="tempo38-weight-note">Letztes Training: {proposals[stateKey(ex.id,1)].previousWeight} kg → Empfehlung: {proposals[stateKey(ex.id,1)].weightKg} kg. Falls du das Gewicht anders ausführst, bitte ändern.</small>}
      </section>)}
      <section className="panel tw-panel"><div className="eyebrow">ABSCHLUSS · DEINE IST-WERTE</div><h3>Training dokumentieren</h3>
        <div className="tw-form-grid"><TimeFields label="Trainingsdauer (vom Timer übernommen, bei Bedarf korrigieren)" value={duration} onChange={v=>{manuallySetDuration.current=true;touched.current=true;setDuration(v)}} required disabled={Boolean(done)}/><label>RPE 1–10<select disabled={done} value={rpe} onChange={e=>{touched.current=true;setRpe(e.target.value)}}>{Array.from({length:10},(_,i)=><option value={i+1} key={i}>{i+1}</option>)}</select></label></div>
        <label className="tw-notes">Bemerkungen<textarea disabled={done} value={notes} maxLength={1500} onChange={e=>{touched.current=true;setNotes(e.target.value)}} placeholder="Schultergefühl, Adduktoren, Kraftreserve …"/></label>
        <div className="tw-actions"><button type="button" disabled={busy||done} className="tw-secondary" onClick={()=>void saveDraft()}>Sätze zwischenspeichern</button><button type="submit" disabled={busy||done}>{busy?'Speichere …':'Training abschließen ✓'}</button></div>
        <div className="tw-feedback" role="status">{message}</div>
      </section>
    </form>
    {selected&&<SessionGarminReview session={selected}/>}
    <section className="panel tw-panel"><div className="eyebrow">KRAFT · LETZTE EINHEITEN</div><h3>Dein Verlauf nach Trainingsort</h3><div className="tw-location-summary"><span>Fitnessstudio <strong>{locationTotals.studio}</strong></span><span>Arbeit <strong>{locationTotals.arbeit}</strong></span><span>Nicht erfasst <strong>{locationTotals.unknown}</strong></span></div>{history.length?history.map(x=><div className="tw-history" key={x.id}><strong>{friendlyDate(x.date)} · {x.title}</strong><span>{durationFor(x)} · RPE {x.rpe??'–'} · {x.strengthLocation==='studio'?'Studio':x.strengthLocation==='arbeit'?'Arbeit':'Ort offen'}</span></div>):<p>Noch keine Kraft-Einheit protokolliert. Du kannst auch spontan ohne geplanten Termin beginnen.</p>}</section>
    {recentExerciseVariants.length>0&&<section className="panel tw-panel"><div className="eyebrow">ÜBUNGSVERLAUF NACH GERÄT</div><h3>Zuletzt verwendete Varianten</h3><p>Gewichte und Wiederholungen sind je Trainingsort und Gerät nachvollziehbar. Verschiedene Maschinen werden nicht als identische Last verglichen.</p>{recentExerciseVariants.map(row=><div className="tw-history" key={`${row.id}:${row.exerciseVariant}`}><strong>{row.exerciseVariant} · {row.trainingLocation==='studio'?'Fitnessstudio':'Arbeit'}</strong><span>{friendlyDate(row.date)} · {row.weightKg==null?'ohne Gewicht':`${row.weightKg} kg`} · {row.reps??row.holdSeconds??'–'} {row.holdSeconds?'s':'Wdh.'}</span></div>)}</section>}
  </div>
}
