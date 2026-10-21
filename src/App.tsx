import MetricsPanel from './metrics/MetricsPanel'
import { useEffect, useState, type ReactNode } from 'react'
import {getRecord} from './db/storage'
import type {TempoRecord} from './db/types'
import {evaluateReadiness} from './db/ReadinessPanel'
import { HelpProvider } from './ui/HelpDisclosure'
import DatabasePanel from './db/DatabasePanel'
import ReadinessPanel, { ReadinessHomeCard } from './db/ReadinessPanel'
import ShiftCalendarPanel, { ShiftHomeCard } from './db/ShiftCalendarPanel'
import CalendarSafeguard from './phase38/CalendarSafeguard'
import TrainingDayPanel, { HomeTrainingCard } from './planning/TrainingDayPanel'
import EventsPanel, { EventsHomeCard, RoutesPanel } from './events/EventsPanel'
import GarminLibraryPanel from './garmin/GarminLibraryPanel'
import BlocksPanel from './blocks/BlocksPanel'
import StrengthPanel from './workouts/StrengthPanel'
import RunningPanel from './workouts/RunningPanel'
import SwimmingPanel from './swimming/SwimmingPanel'
import CyclingPanel from './cycling/CyclingPanel'
import ProgressPanel from './stats/ProgressPanel'
import RecoveryPanel from './recovery/RecoveryPanel'
import FuelingPanel from './phase30/FuelingPanel'
import FuelLibraryPanel from './phase32/FuelLibraryPanel'
import { isRun, isStrength } from './workouts/sessionStore'
import WorkoutDetail from './phase36/WorkoutDetail'
import ManualTrainingPanel from './planning/ManualTrainingPanel'
import './phase36/phase36.css'
import './phase38/phase38.css'
import {currentKey, type TrainingRecord } from './planning/engine'
import { ensureCooperGoal } from './events/running'
import './phase33.css'
import './phase34/calendar-board.css'
import './phase34/phase34.css'

type PageId =
  | 'home' | 'readiness' | 'training' | 'calendar' | 'progress'
  | 'fueling' | 'fuel-library' | 'recovery' | 'strength' | 'metrics' | 'blocks'
  | 'events' | 'routes' | 'profile' | 'garmin' | 'running' | 'cycling' | 'swimming' | 'sportspiel' | 'golf' | 'workout-detail'

type PageInfo = { id: PageId; name: string; icon: IconName; description: string }
type IconName = 'home' | 'heart' | 'play' | 'calendar' | 'trend' | 'drop' | 'wind' | 'dumbbell' | 'gauge' | 'layers' | 'flag' | 'map' | 'user' | 'menu' | 'chevron' | 'arrow' | 'check' | 'clock' | 'close' | 'bike' | 'swim' | 'football' | 'golf'

// PHASE 38.1: version is intentionally displayed only in the navigation menu, never in the top header.
const pages: PageInfo[] = [
  { id: 'workout-detail', name: 'Trainingseinheit', icon: 'play', description: 'Dein Workout direkt öffnen.' },
  { id: 'home', name: 'Startseite', icon: 'home', description: 'Alles Wichtige für deinen Tag.' },
  { id: 'readiness', name: 'Readiness', icon: 'heart', description: 'Dein täglicher Check-in.' },
  { id: 'training', name: 'Tagestraining', icon: 'play', description: 'Die nächste geplante Einheit.' },
  { id: 'calendar', name: 'Kalender', icon: 'calendar', description: 'Training und Dienste gemeinsam planen.' },
  { id: 'fueling', name: 'Fueling', icon: 'drop', description: 'Kohlenhydrate, Flüssigkeit und Verträglichkeit.' },
  { id: 'fuel-library', name: 'Produktbibliothek', icon: 'layers', description: 'Gels, Pulver, Riegel und Lebensmittel mit Nährwerten und Preisen.' },
  { id: 'recovery', name: 'Recovery & Mobility', icon: 'wind', description: 'Routinen, Beweglichkeit und Erholung.' },
  { id: 'cycling', name: 'Radfahren', icon: 'bike', description: 'Watt- und Pulszonen, Indoor und Outdoor.' },
  { id: 'strength', name: 'Krafttraining', icon: 'dumbbell', description: 'Ganzkörper A/B und Satzprotokoll.' },
  { id: 'running', name: 'Laufen', icon: 'play', description: 'Locker laufen, dokumentieren und entwickeln.' },
  { id: 'sportspiel', name: 'Sportspiel', icon: 'football', description: 'Spontane Sportspiele ohne Einfluss auf die Trainingssteuerung.' },
  { id: 'golf', name: 'Golf', icon: 'golf', description: 'Golfrunden dokumentieren, ohne andere Trainingstage zu beeinflussen.' },
  { id: 'swimming', name: 'Schwimmen', icon: 'swim', description: 'Freies Schwimmen protokollieren, ohne feste Termine.' },
  { id: 'progress', name: 'Fortschritt', icon: 'trend', description: 'Deine langfristige Entwicklung.' },
  { id: 'metrics', name: 'Leistungswerte', icon: 'gauge', description: 'Rad, Lauf und Kraft in einer Bibliothek.' },
  { id: 'blocks', name: 'Blockübersicht', icon: 'layers', description: 'Umsetzung und Kennzahlen je Trainingsblock.' },
  { id: 'events', name: 'Ziele & Events', icon: 'flag', description: 'Fixe Rennen und flexible Challenges.' },
  { id: 'routes', name: 'Strecken & Challenges', icon: 'map', description: 'GPX-Routen und persönliche Herausforderungen.' },
  { id: 'garmin', name: 'Garmin-Datenimport', icon: 'layers', description: 'Garmin-Aktivitäten lokal importieren und als Leistungsbibliothek nutzen.' },
  { id: 'profile', name: 'Profil & Daten', icon: 'user', description: 'Persönliche Werte lokal speichern und sichern.' },
]

const primary: PageId[] = ['home', 'readiness', 'training', 'calendar']
const activityPages: PageId[] = ['cycling', 'running', 'strength', 'swimming', 'sportspiel', 'golf', 'recovery']

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const drawings: Record<IconName, ReactNode> = {
    football: <><circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-2 5h-5l-2-5zM5 8l3 2m12-2-4 2M9 15l-2 5m8-5 2 5"/></>,
    golf: <><path d="M7 22V3m0 1 11 2-5 5H7"/><path d="M4 22h14"/><circle cx="17" cy="17" r="2"/></>,
    swim: <><circle cx="7" cy="5" r="2"/><path d="m8 11 5-3 6 3M3 16c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 3-2M3 20c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 3-2M13 8l-3 6"/></>,
    bike: <><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m5 17 5-9 4 9h-9m9 0 5-6h-8m-2-3h5m-6-2H9"/></>,
    home: <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>,
    heart: <><path d="M20.8 8.5c0 5-8.8 11-8.8 11S3.2 13.5 3.2 8.5a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z"/></>,
    play: <><path d="m8 5 11 7-11 7z"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    trend: <><path d="m3 17 6-6 4 3 8-9"/><path d="M15 5h6v6"/></>,
    drop: <><path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z"/></>,
    wind: <><path d="M3 8h12a3 3 0 1 0-3-3M3 12h17a3 3 0 1 1-3 3M3 16h7a3 3 0 1 1-3 3"/></>,
    dumbbell: <><path d="M6 8 4 10m0 4 2 2m12-8 2 2m0 4-2 2M7 7l10 10M5 9l10 10M9 5l10 10"/></>,
    gauge: <><path d="M5 18a9 9 0 1 1 14 0"/><path d="m12 13 4-4"/><circle cx="12" cy="13" r="1"/></>,
    layers: <><rect x="4" y="4" width="16" height="5" rx="1"/><rect x="4" y="11" width="16" height="5" rx="1"/><path d="M4 18h16"/></>,
    flag: <><path d="M5 21V4m0 1c6-4 8 4 15 0v11c-7 4-9-4-15 0"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    chevron: <><path d="m7 10 5 5 5-5"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
    close: <><path d="M5 5 19 19M19 5 5 19"/></>,
  }
  return <svg {...common}>{drawings[name]}</svg>
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>
}

function Home({ go, openWorkout, openDuty }: { go: (id: PageId) => void; openWorkout: (session: TrainingRecord) => void; openDuty: () => void }) {
  return <div className="tempo36-home">
    <ReadinessHomeCard onOpen={() => go('readiness')}/>
    <HomeTrainingCard onOpen={() => go('training')} onOpenWorkout={openWorkout}/>
    <ShiftHomeCard onOpen={openDuty}/>
    <EventsHomeCard onOpen={() => go('events')}/>
  </div>
}

function Placeholder({ id, go }: { id: PageId; go: (id: PageId) => void }) {
  const page = pages.find(p => p.id === id)!
  const content: Partial<Record<PageId, string[]>> = {
    training: ['Geplantes Workout mit konkreten Watt-, Herzfrequenz- oder Kraftvorgaben', 'Alternative bei Zeitmangel, Müdigkeit oder Dienst', 'Abschluss mit RPE, Feedback und Fueling'],
    fueling: ['Kohlenhydrate, Flüssigkeit und Natrium', 'Schweißrate und persönliche Verträglichkeit', 'Nachcheck am Folgetag'],
    recovery: ['Zeitblasen: 5 · 10 · 15 · 20 Minuten', 'Yoga- und Mobility-Routinen, inklusive Schulter/Brustöffnung', 'Countdown, Übungsbild und 10-Sekunden-Wechselpause'],
    strength: ['Kraft A/B mit Adduktoren- und Abduktorenübungen ohne Maschinen', 'Gewicht und Wiederholungen pro Satz', 'Grün/Gelb/Rot und schriftliche Satzpausen'],
    progress: ['FTP · W/kg · Laufleistung · Kraftentwicklung', 'Monatskalender mit vollflächigen Statusfarben', 'Gewichtsverlauf und 7-Tage-Durchschnitt'],
    metrics: ['Rad: FTP-% ↔ Watt', 'Lauf: HF, Pace und Referenztests', 'Kraft: Maximalwerte und Prozenttabellen'],
    blocks: ['Erfüllte Einheiten und sinnvoll angepasste Trainings', 'Kilometer, Höhenmeter, Zeit und Konsistenz', 'Vergleich mehrerer Trainingsblöcke'],
    events: ['Feste Rennen, Startplatz/Urlaub noch offen und freie Challenges', 'Kompakter Countdown zum nächsten Ziel', 'Entlastung davor und Erholung danach'],
    routes: ['Strecken mit km, Höhenmetern, Untergrund und GPX', 'Orbit, Stoneman oder selbst gefahrene Herausforderungen', 'Challenge als Trainingsreiz im progressiven Aufbau'],
    profile: ['Leistungswerte und Ziele gehören ins Profil statt in den Code', 'Lokale persönliche Daten, kein öffentliches Nutzerprofil', 'Später: JSON-Backup und Import für Gerätewechsel'],
  }
  return <><Card className="placeholder-panel"><span className="feature-icon"><Icon name={page.icon} size={30}/></span><Eyebrow>MODUL VORBEREITET</Eyebrow><h2>{page.name}</h2><p>{page.description}</p><div className="feature-list">{content[id]?.map(item => <div key={item}><span className="tiny-check"><Icon name="check" size={13}/></span><span>{item}</span></div>)}</div><div className="coming-soon">Datenbank und Funktionen folgen in den nächsten Phasen.</div></Card><button className="secondary-button" onClick={() => go('home')}>Zurück zur Startseite <Icon name="arrow" size={17}/></button></>
}

export default function App() {
  const [page, setPage] = useState<PageId>('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activitiesOpen,setActivitiesOpen]=useState(false)
  const [focusWorkout, setFocusWorkout] = useState('')
  const [detailWorkout, setDetailWorkout] = useState<TrainingRecord|null>(null)
  const [autoOpenShift,setAutoOpenShift]=useState(false)
  const [dayFocus,setDayFocus]=useState('')
  const [addFocus,setAddFocus]=useState('')
  const [todayReadiness,setTodayReadiness]=useState<'offen'|'gruen'|'gelb'|'rot'>('offen')
  const [activeDay,setActiveDay]=useState(currentKey())
  useEffect(()=>{
    let active=true
    const check=()=>{const now=new Date();const day=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      setActiveDay(day)
      setTodayReadiness('offen')
      void getRecord<TempoRecord&{ratings?:Record<string,number>;illness?:'nein'|'ja'|''}>('readinessEntries',`local-primary-profile:${day}`).then(entry=>{
        if(active)setTodayReadiness(evaluateReadiness({ratings:entry?.ratings??{},illness:entry?.illness??''}).level)
      }).catch(()=>{if(active)setTodayReadiness('offen')})
    }
    check()
    window.addEventListener('tempo:readiness-change',check);window.addEventListener('focus',check)
    const midnight=()=>{const now=new Date();const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);return Math.max(1000,next.getTime()-now.getTime()+50)}
    let timer:ReturnType<typeof setTimeout>
    const rollover=()=>{check();window.dispatchEvent(new Event('tempo:day-rollover'));timer=setTimeout(rollover,midnight())}
    timer=setTimeout(rollover,midnight())
    return()=>{active=false;clearTimeout(timer);window.removeEventListener('tempo:readiness-change',check);window.removeEventListener('focus',check)}
  },[])
  useEffect(()=>{void ensureCooperGoal().then(()=>window.dispatchEvent(new Event('tempo:events-change'))).catch(error=>console.warn('Cooper-Ziel konnte nicht angelegt werden:',error))},[])
  const active = pages.find(p => p.id === page)!
  function navigate(id: PageId) { if(activityPages.includes(id))setActivitiesOpen(true); if(id==='training'){setDayFocus('');setAddFocus('')} setFocusWorkout(''); setDetailWorkout(null);setAutoOpenShift(false); setPage(id); setMenuOpen(false); window.scrollTo({top:0,behavior:'smooth'}) }
  function openCalendarDay(date:string) {setAutoOpenShift(false);setDayFocus(date);setAddFocus('');setPage('training');setMenuOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  function addCalendarTraining(date:string){setAutoOpenShift(false);setDayFocus(date);setAddFocus(date);setPage('training');setMenuOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  function openWorkout(session: TrainingRecord) {
    setFocusWorkout(session.id)
    setDayFocus(session.date)
    if(!isStrength(session) && !isRun(session))setDetailWorkout(session)
    else setDetailWorkout(null)
    setPage(isStrength(session)?'strength':isRun(session)?'running':'workout-detail')
    window.scrollTo({top:0,behavior:'smooth'})
  }
  function openDuty(){setDayFocus(currentKey());setAutoOpenShift(true);setAddFocus('');setPage('training');setMenuOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  return <div className="app">
    <div className={`mobile-shade ${menuOpen ? 'visible' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><img className="tempo-sidebar-icon" src={`${import.meta.env.BASE_URL}tempo-icon-v22-192.png`} alt="TEMPO Hirsch"/><div><strong>TEMPO</strong><small>TRAIN SMARTER</small></div><button className="sidebar-close" onClick={()=>setMenuOpen(false)} aria-label="Menü schließen"><Icon name="close"/></button></div>
      <div className="sidebar-caption">DEIN WORKSPACE</div>
      <nav aria-label="Hauptmenü">{pages.map(item => {
        if(item.id==='cycling')return <div className="tempo-nav-activities" key="activities">
          <button type="button" className={`nav-item tempo-activities-toggle ${activityPages.includes(page)?'group-active':''}`} aria-expanded={activitiesOpen} aria-controls="tempo-activities-list" onClick={()=>setActivitiesOpen(open=>!open)}>
            <Icon name="layers" size={19}/><span>Aktivitäten aufnehmen</span><span className={`tempo-activities-arrow ${activitiesOpen?'expanded':''}`}><Icon name="chevron" size={17}/></span>
          </button>
          {activitiesOpen&&<div id="tempo-activities-list" className="tempo-activities-children" role="group" aria-label="Sportarten">
            {activityPages.map(id=>{const sport=pages.find(p=>p.id===id)!;return <button type="button" key={id} className={`nav-item tempo-activity-child ${page===id?'active':''}`} onClick={()=>navigate(id)} aria-current={page===id?'page':undefined}><Icon name={sport.icon} size={18}/><span>{sport.name}</span>{page===id&&<span className="active-marker"/>}</button>})}
          </div>}
        </div>
        if(activityPages.includes(item.id)||item.id==='workout-detail')return null
        return <button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={()=>navigate(item.id)}><Icon name={item.icon} size={19}/><span>{item.name}</span>{page===item.id&&<span className="active-marker"/>}</button>
      })}</nav>
      <div className="sidebar-footer"><span className="mini-dot good-dot"/> V0.38.1 · TEMPO</div>
    </aside>
    <div className="workspace"><header className="topbar"><button className="mobile-menu" onClick={()=>setMenuOpen(true)} aria-label="Menü öffnen"><Icon name="menu"/></button><div className="topbar-brand"><span className="tempo36-brand-name">TEMPO</span><span className="topbar-sep">/</span><strong className="tempo36-current-page">{active.name}</strong></div><img className="tempo36-nav-logo" src={`${import.meta.env.BASE_URL}tempo-icon-v22-192.png`} alt="TEMPO Hirsch"/></header>
      <main className={`content page-${page}`}>
      <HelpProvider key={page}>
      {page === 'home' ? <Home go={navigate} openWorkout={openWorkout} openDuty={openDuty}/> : page === 'readiness' ? <ReadinessPanel key={activeDay}/> : page === 'calendar' ? <CalendarSafeguard onBack={()=>navigate('home')}><ShiftCalendarPanel key={activeDay} onOpenDay={openCalendarDay} onAddDay={addCalendarTraining} onStartWorkout={openWorkout}/></CalendarSafeguard> : page === 'training' ? <TrainingDayPanel key={`${dayFocus}:${addFocus}:${autoOpenShift}`} autoOpenShift={autoOpenShift} autoAddDate={addFocus||undefined} initialDate={dayFocus||undefined} onOpenReadiness={() => navigate('readiness')} onOpenCalendar={() => navigate('calendar')} onOpenWorkout={openWorkout}/> : page === 'workout-detail' ? <WorkoutDetail session={detailWorkout} onBack={()=>openCalendarDay(detailWorkout?.date??currentKey())}/> : page === 'profile' ? <DatabasePanel/> : page === 'events' ? <EventsPanel/> : page === 'routes' ? <RoutesPanel/> : page === 'garmin' ? <GarminLibraryPanel/> : page === 'blocks' ? <BlocksPanel onOpenEvents={() => navigate('events')}/> : page === 'cycling' ? <CyclingPanel/> : page === 'progress' ? <ProgressPanel/> : page === 'strength' ? <StrengthPanel key={focusWorkout} focusId={focusWorkout}/> : page === 'running' ? <RunningPanel focusId={focusWorkout} onOpenEvents={()=>navigate('events')}/> : page === 'swimming' ? <SwimmingPanel/> : page === 'golf' || page === 'sportspiel' ? <ManualTrainingPanel autoStartDate={currentKey()} initialSport={page} autoStartMode="completed"/> : page === 'recovery' ? <RecoveryPanel/> : page === 'fueling' ? <FuelingPanel onOpenLibrary={()=>navigate('fuel-library')}/> : page === 'fuel-library' ? <FuelLibraryPanel/> : page === 'metrics' ? <MetricsPanel/> : <Placeholder id={page} go={navigate}/>}
      </HelpProvider>
      <footer className="content-footer">TEMPO · Local first · Dein Training, dein System.</footer></main>
      <nav className="bottom-tabs" aria-label="Schnellnavigation">{primary.map(id => {const item=pages.find(p => p.id === id)!; return <button key={id} className={`${page===id?'active':''} ${id==='readiness'?`tempo38-heart-${todayReadiness}`:''}`} onClick={()=>navigate(id)}><Icon name={item.icon} size={22}/><span>{item.name}</span></button>})}</nav>
    </div>
  </div>
}
