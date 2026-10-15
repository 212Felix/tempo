import {useEffect,useMemo,useState,type FormEvent} from 'react'
import {deleteRecord,listRecords,saveRecord} from '../db/storage'
import {currentKey,PROFILE_ID,type CompletedRecord} from '../planning/engine'
import {dateLabel,dayDelta,plusDays,type GoalEvent} from '../events/library'
import {blockIsValid,capacityLabels,deriveSeasonPhases,describeBlock,focusLabels,matchingBlock,targetLabels,type BlockCapacity,type BlockSport,type BlockTarget,type TrainingBlock} from './library'
import HelpDisclosure from '../ui/HelpDisclosure'
import BlockDaysPanel from './BlockDaysPanel'
import './blocks.css'
import PeriodizationOverview from '../phase28/PeriodizationOverview'

type Fields={name:string;startDate:string;endDate:string;focus:BlockSport;target:BlockTarget;capacity:BlockCapacity;weeklyHours:string;eventId:string;notes:string;enabled:boolean}
const blank=():Fields=>({name:'',startDate:currentKey(),endDate:plusDays(currentKey(),13),focus:'cycling',target:'basis',capacity:'more',weeklyHours:'',eventId:'',notes:'',enabled:true})
const fieldsFrom=(b:TrainingBlock):Fields=>({name:b.name,startDate:b.startDate,endDate:b.endDate,focus:b.focus,target:b.target,capacity:b.capacity,weeklyHours:b.weeklyHours?.toString()??'',eventId:b.eventId??'',notes:b.notes??'',enabled:b.enabled})
const createId=()=>`custom-block:${PROFILE_ID}:${crypto.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`}`
const sortByDate=(a:TrainingBlock,b:TrainingBlock)=>a.startDate.localeCompare(b.startDate)
export default function BlocksPanel({onOpenEvents}:{onOpenEvents:()=>void}){
  const [blocks,setBlocks]=useState<TrainingBlock[]>([])
  const [events,setEvents]=useState<GoalEvent[]>([])
  const [completed,setCompleted]=useState<CompletedRecord[]>([])
  const [open,setOpen]=useState(false)
  const [editing,setEditing]=useState<TrainingBlock|null>(null)
  const [form,setForm]=useState<Fields>(blank)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const refresh=async()=>{
    const [stored,goals,done]=await Promise.all([listRecords<TrainingBlock>('trainingBlocks'),listRecords<GoalEvent>('events'),listRecords<CompletedRecord>('completedSessions')])
    setBlocks(stored.filter(x=>x.profileId===PROFILE_ID&&x.createdBy==='tempo-user').sort(sortByDate))
    setEvents(goals.filter(x=>x.profileId===PROFILE_ID))
    setCompleted(done.filter(x=>x.profileId===PROFILE_ID))
  }
  useEffect(()=>{let live=true;const load=async()=>{
    try{const [stored,goals,done]=await Promise.all([listRecords<TrainingBlock>('trainingBlocks'),listRecords<GoalEvent>('events'),listRecords<CompletedRecord>('completedSessions')]);if(live){setBlocks(stored.filter(x=>x.profileId===PROFILE_ID&&x.createdBy==='tempo-user').sort(sortByDate));setEvents(goals.filter(x=>x.profileId===PROFILE_ID));setCompleted(done.filter(x=>x.profileId===PROFILE_ID))}}
    catch(error){if(live)setMessage(`Daten konnten nicht geladen werden: ${String(error)}`)}
  };void load();return()=>{live=false}},[])
  const season=useMemo(()=>deriveSeasonPhases(events,currentKey()),[events])
  const upcomingAnchors=events.filter(e=>e.priority==='A'&&e.status!=='abgeschlossen'&&e.date&&e.date>=currentKey()).sort((a,b)=>a.date!.localeCompare(b.date!))
  const active=matchingBlock(currentKey(),blocks)
  const inFormEvent=events.find(x=>x.id===form.eventId)
  const patch=(values:Partial<Fields>)=>setForm(old=>({...old,...values}))
  const begin=()=>{setEditing(null);setForm(blank());setOpen(true);setMessage('')}
  const edit=(b:TrainingBlock)=>{setEditing(b);setForm(fieldsFrom(b));setOpen(true);setMessage('');document.getElementById('block-editor')?.scrollIntoView({behavior:'smooth',block:'start'})}
  const cancel=()=>{setOpen(false);setEditing(null);setForm(blank())}
  async function save(e:FormEvent){
    e.preventDefault();if(busy)return
    const budget=form.weeklyHours.trim()===''?undefined:Number(form.weeklyHours.replace(',','.'))
    const now=new Date().toISOString()
    const record:TrainingBlock={id:editing?.id??createId(),createdAt:editing?.createdAt??now,updatedAt:now,profileId:PROFILE_ID,createdBy:'tempo-user',
      name:form.name.trim(),startDate:form.startDate,endDate:form.endDate,focus:form.focus,target:form.target,capacity:form.capacity,weeklyHours:budget,eventId:form.eventId||undefined,notes:form.notes.trim()||undefined,enabled:form.enabled,days:editing?.days??[]}
    if(!record.name||record.name.length>85){setMessage('Bitte einen Namen mit höchstens 85 Zeichen eintragen.');return}
    if(!blockIsValid(record)){setMessage('Bitte gültige Daten angeben. Ein Sonderblock kann maximal 91 Tage umfassen.');return}
    if(budget!==undefined&&(!Number.isFinite(budget)||budget<1||budget>35)){setMessage('Das optionale Wochenzeitbudget muss zwischen 1 und 35 Stunden liegen.');return}
    if(form.eventId&&!inFormEvent){setMessage('Das verknüpfte Event existiert nicht mehr.');return}
    if(record.enabled&&blocks.some(b=>b.id!==record.id&&b.enabled&&record.startDate<=b.endDate&&record.endDate>=b.startDate)){
      setMessage('Zwei aktivierte Sonderblöcke dürfen sich nicht überschneiden. Bitte den Zeitraum ändern oder einen Block pausieren.');return
    }
    // Warn about an A event window, do not silently override taper.
    const collision=events.find(x=>x.priority==='A'&&x.status==='bestaetigt'&&x.date&&record.startDate<=x.date&&record.endDate>=x.date)
    if(collision&&!window.confirm(`Der Block umfasst dein A-Event „${collision.name}“. Eventtag und Taper bleiben geschützt. Sonderblock trotzdem speichern?`))return
    setBusy(true)
    try{await saveRecord('trainingBlocks',record);await refresh();window.dispatchEvent(new Event('tempo:blocks-change'));setMessage('Trainingsblock gespeichert ✓ · Künftige 14-Tage-Vorschläge berücksichtigen ihn erst nach deiner Prüfung und Bestätigung.');cancel()}
    catch(error){setMessage(`Speichern fehlgeschlagen: ${String(error)}`)}finally{setBusy(false)}
  }
  async function remove(b:TrainingBlock){
    if(!window.confirm(`Sonderblock „${b.name}“ entfernen? Bereits absolvierte und fest gespeicherte Trainings bleiben unverändert.`))return
    setBusy(true);try{await deleteRecord('trainingBlocks',b.id);await refresh();window.dispatchEvent(new Event('tempo:blocks-change'));setMessage('Sonderblock entfernt. Die Trainingshistorie bleibt bestehen.')}
    catch(error){setMessage(`Löschen fehlgeschlagen: ${String(error)}`)}finally{setBusy(false)}
  }
  const completedWithin=(startDate:string,endDate:string)=>completed.filter(c=>c.date>=startDate&&c.date<=endDate)
  return <div className="tempo-block-stack">
    <PeriodizationOverview events={events} blocks={blocks}/>
    <section className="panel tempo-block-overview">
      <div className="eyebrow">DEIN TRAININGSJAHR · FLEXIBEL</div><h2>Trainingsblöcke</h2>
      <HelpDisclosure id="blocks-intro"><p>Hauptevents bilden den langfristigen Rahmen. Eigene Sonderblöcke für Urlaub, Weihnachtsfreizeit, Schichtwechsel oder ein weiteres Rennen legen einen zusätzlichen Schwerpunkt fest. Sie verändern niemals abgeschlossene oder manuell geschützte Einheiten.</p></HelpDisclosure>
      <button type="button" className="tempo-block-add-bubble" onClick={begin}><span className="tempo-block-add-mark">＋</span> Trainingsblock</button>
      <p className="tempo-block-muted">Für mehr freie Zeit, besonderen Trainingsfokus oder eine kurze gezielte Vorbereitung.</p>
      {active&&<div className="tempo-block-current"><div className="eyebrow">HEUTE AKTIVER SONDERBLOCK</div><strong>{active.name}</strong><p>{describeBlock(active)}</p></div>}
    </section>
    {open&&<section className="panel tempo-block-editor" id="block-editor">
      <div className="tempo-block-heading"><div><div className="eyebrow">{editing?'SONDERBLOCK BEARBEITEN':'NEUER SONDERBLOCK'}</div><h3>{editing?'Trainingsblock anpassen':'Deinen Trainingsblock gestalten'}</h3></div><button type="button" className="tempo-block-close" onClick={cancel} aria-label="Schließen">×</button></div>
      <form onSubmit={e=>void save(e)}>
        <label>Name<input required maxLength={85} placeholder="z. B. Mehr Freizeit zwischen Weihnachten und Silvester" value={form.name} onChange={e=>patch({name:e.target.value})}/></label>
        <div className="tempo-block-two"><label>Beginn<input type="date" required value={form.startDate} onChange={e=>patch({startDate:e.target.value})}/></label><label>Ende<input type="date" required value={form.endDate} onChange={e=>patch({endDate:e.target.value})}/></label></div>
        <label>Sportlicher Schwerpunkt</label><div className="tempo-block-bubbles" role="group" aria-label="Sportart">
          {(Object.entries(focusLabels) as [BlockSport,string][]).map(([value,label])=><button key={value} type="button" className={form.focus===value?'chosen':''} onClick={()=>patch({focus:value})} aria-pressed={form.focus===value}>{label}</button>)}
        </div>
        <label>Gewünschter Trainingsreiz<select value={form.target} onChange={e=>patch({target:e.target.value as BlockTarget})}>{(Object.entries(targetLabels) as [BlockTarget,string][]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Verfügbare Trainingszeit<select value={form.capacity} onChange={e=>patch({capacity:e.target.value as BlockCapacity})}>{(Object.entries(capacityLabels) as [BlockCapacity,string][]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Maximales Wochenzeitbudget in Stunden (optional)<input type="number" inputMode="decimal" min="1" max="35" step="0.5" placeholder="z. B. 10" value={form.weeklyHours} onChange={e=>patch({weeklyHours:e.target.value})}/></label>
        <label>Auf welches Event ausrichten? (optional)<select value={form.eventId} onChange={e=>patch({eventId:e.target.value})}><option value="">Ohne Event – freier Trainingsblock</option>{events.filter(x=>x.status!=='abgeschlossen').map(x=><option key={x.id} value={x.id}>{x.name} · {x.priority}-Ziel</option>)}</select></label>
        <div className="tempo-block-event-link"><span>Ein weiteres Rennen oder eine Challenge?</span><button type="button" onClick={onOpenEvents}>＋ Event anlegen ↗</button></div>
        <label>Notiz (optional)<textarea rows={2} maxLength={500} placeholder="z. B. 27.–31.12. frei, Radschwerpunkt; kurze schnelle Reize vor einem Rennen" value={form.notes} onChange={e=>patch({notes:e.target.value})}/></label>
        <label className="tempo-block-check"><input type="checkbox" checked={form.enabled} onChange={e=>patch({enabled:e.target.checked})}/> In künftigen Planvorschlägen berücksichtigen</label>
        <div className="tempo-block-explanation"><strong>Was TEMPO daraus macht</strong><p>{describeBlock({...form,weeklyHours:form.weeklyHours?Number(form.weeklyHours):undefined} as TrainingBlock)}. Freie Zeit erlaubt zusätzliche passende Optionen, aber keine unkontrollierte Umfangssteigerung. Readiness, Dienste, Regeneration und bestätigte Eventtermine haben Vorrang.</p></div>
        <div className="tempo-block-actions"><button type="submit" disabled={busy}>{busy?'Speichern …':editing?'Änderungen speichern':'Block speichern'}</button><button type="button" className="outline" onClick={cancel}>Abbrechen</button></div>
      </form>
    </section>}
    <section className="panel tempo-block-overview"><div className="eyebrow">DEINE SONDERBLÖCKE</div><h3>Persönliche Zeitfenster</h3>
      {blocks.length===0?<p className="tempo-block-muted">Noch keine Sonderblöcke gespeichert. Tippe auf „＋ Trainingsblock“ für Urlaub, zusätzliche Trainingszeit oder eine neue Zielsetzung.</p>:blocks.map(b=>{
        const n=completedWithin(b.startDate,b.endDate).length
        return <article className="tempo-block-entry" key={b.id}><div className="tempo-block-heading"><strong>{b.name}</strong><span className={b.enabled?'tempo-block-enabled':'tempo-block-paused'}>{b.enabled?'Aktiviert':'Pausiert'}</span></div>
          <small>{dateLabel(b.startDate)} – {dateLabel(b.endDate)} · {Math.max(1,dayDelta(b.startDate,b.endDate)+1)} Tage</small>
          <p>{describeBlock(b)}</p><small>{n} absolvierte Trainings in diesem Zeitraum · bleiben unverändert</small>
          {b.eventId&&<p>Verknüpft mit {events.find(e=>e.id===b.eventId)?.name??'einem inzwischen entfernten Event'}</p>}
          <BlockDaysPanel key={b.id} block={b} onSaved={refresh}/>
          <div className="tempo-block-actions"><button type="button" onClick={()=>edit(b)}>Bearbeiten</button><button type="button" className="outline" onClick={()=>void remove(b)} disabled={busy}>Entfernen</button></div>
        </article>
      })}
    </section>
    <section className="panel tempo-block-overview"><div className="eyebrow">DEIN JAHRESRAHMEN · EVENTDATEN</div><h3>Langfristige Blockübersicht</h3>
      <div className="tempo-block-anchor-summary"><strong>A-Ziele als Jahresanker</strong>{upcomingAnchors.length===0?<p>Noch keine A-Ziele gespeichert. Trage deine private Langdistanz und deinen späteren Hauptevent unter „Ziele & Events“ mit Datum ein. Auch eine noch offene Anmeldung ist für einen vorläufigen Jahresrahmen möglich.</p>:upcomingAnchors.map(e=><p key={e.id}>{e.name} · {dateLabel(e.date)} · {e.status==='bestaetigt'?'Termin bestätigt':'Planungsanker – noch nicht endgültig bestätigt'}</p>)}<button type="button" onClick={onOpenEvents}>Ziele & Events verwalten ↗</button></div>
      <HelpDisclosure id="blocks-season-help"><p>Die Phasen werden anhand vorhandener Eventdaten berechnet. Auch ein offener Startplatz mit eingegebenem Zieldatum erzeugt einen vorläufigen Jahresrahmen. Erst bestätigte Eventtermine beeinflussen den Taper und die Tagesplanung unmittelbar. Bei geändertem Eventdatum verschieben sich die noch offenen Orientierungsphasen. Sonderblöcke ergänzen sie, statt sie zu löschen. Nur bestätigte Tagesplanvorschläge werden zu konkreten Trainingseinheiten.</p></HelpDisclosure>
      {season.length===0?<div className="tempo-block-muted">Noch keine zukünftigen Eventdaten gefunden. Hinterlege geplante A- und B-Ziele unter „Ziele & Events“, um einen vorläufigen Jahresrahmen zu erhalten.<button type="button" onClick={onOpenEvents}>Ziele & Events öffnen ↗</button></div>:season.map(phase=>{
        const now=currentKey(),isNow=phase.startDate<=now&&phase.endDate>=now,isPast=phase.endDate<now
        return <div className={`tempo-block-phase ${isNow?'current':''}`} key={phase.id}><span className="tempo-block-phase-code">{phase.id}</span><div><strong>{phase.title}</strong><p>{dateLabel(phase.startDate)} – {dateLabel(phase.endDate)}</p><small>{phase.detail}</small></div><span className="tempo-block-phase-status">{phase.tentative?'Vorläufig':isNow?'Aktuell':isPast?'Vergangen':'Geplant'}</span></div>
      })}
    </section>
    <p className="tempo-block-status" role="status">{message}</p>
  </div>
}
