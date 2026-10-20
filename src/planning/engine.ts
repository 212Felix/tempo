import type { ProfileRecord, TempoRecord } from '../db/types'
import {matchingBlock,tailorSession, type TrainingBlock} from '../blocks/library'
import {blockDayForDate,isTrainingFree,type BlockDayPlan} from '../blocks/days'
import { createLoadCalendar, type LoadCalendar } from './load'
import { buildEventInfluences, type EventInfluence, type GoalEvent, type RouteEntry } from '../events/library'
import { upcomingCooper } from '../events/running'
import {deriveAdaptiveWeeks,adjustSuggestedSession,plannedEvents,type AdaptiveWeek} from '../phase28/adaptive-planner'
import type {RestDayRecord} from '../phase31/rest-days'
import {availabilityFlag} from './availability'
import {rhythmPenalty,rhythmForDate,type WeekRhythm} from '../phase35/weekly-rhythm'

/** Conservative starter scheduling rules, intentionally transparent and changeable. */
export const PLANNER_VERSION = 'tempo-planner-v1'
export const PROFILE_ID = 'local-primary-profile'
export type ShiftKind = 'offen' | 'frei' | 'tagdienst' | 'einsatz'
export type CommuteKind = 'nein' | 'hin' | 'zurueck' | 'beide'
export type Priority = 'MUSS' | 'SOLL' | 'KANN'
export type SessionKind = 'long' | 'quality' | 'endurance' | 'commute' | 'strength-a' | 'strength-b' | 'strength-c' | 'run' | 'recovery'
export type ManualSessionKind = 'manual-cycling' | 'manual-running' | 'manual-strength' | 'manual-swimming' | 'manual-martial' | 'manual-mobility' | 'manual-yoga' | 'manual-stabi' | 'manual-sportspiel' | 'manual-golf'

export type ShiftRecord = TempoRecord & {
  date: string
  shift?: ShiftKind
  commute?: CommuteKind
  homeIntervals?: boolean
  possibleStrength?: boolean
  possibleRun?: boolean
  possibleYoga?: boolean
  possibleStabi?: boolean
  workStrength?: boolean
  workRun?: boolean
  afterWorkStrength?: boolean
  afterWorkRun?: boolean
  afterWorkCycling?: boolean
  afterWorkRide?: 'egal' | 'indoor' | 'outdoor'
}
export type ReadinessRecord = TempoRecord & {
  date: string
  ratings?: { sleep?: number; energy?: number; stress?: number; fatigue?: number; legs?: number }
  illness?: '' | 'ja' | 'nein'
}
export type TrainingRecord = TempoRecord & {
  date: string
  sessionType: SessionKind | ManualSessionKind
  title: string
  durationMin: number
  durationSec?: number
  priority: Priority
  description: string
  target: string
  notes?: string
  expectedKm?: number
  elevationM?: number
  rpe?: number
  commuteLeg?: 'hin' | 'rueck' | 'beide'
  cyclingEnvironment?: 'indoor' | 'outdoor' | 'unknown'
  strengthLocation?: 'studio' | 'arbeit'
  strengthVariant?:'A'|'B'|'C'
  swimEnvironment?: 'pool' | 'openwater'
  swimFocus?: 'technik' | 'ausdauer' | 'intervalle' | 'locker'
  sessionOrigin?: 'self'|'extern'
  status: 'geplant' | 'erledigt' | 'nicht-erledigt'
  createdBy?: string
  locked?: boolean
}
export type CompletedRecord = TempoRecord & {
  date: string
  plannedSessionId?: string
  sessionType?: SessionKind | ManualSessionKind
  title?: string
  durationMin?: number
  durationSec?: number
  distanceKm?: number
  elevationM?: number
  rpe?: number
  notes?: string
  commuteLeg?: 'hin' | 'rueck' | 'beide'
  cyclingEnvironment?: 'indoor' | 'outdoor' | 'unknown'
  strengthLocation?: 'studio' | 'arbeit'
  strengthVariant?:'A'|'B'|'C'
  swimEnvironment?: 'pool' | 'openwater'
  swimFocus?: 'technik' | 'ausdauer' | 'intervalle' | 'locker'
  sessionOrigin?: 'self'|'extern'
  source?: 'manuell' | 'plan' | 'import'
}
export type PlanDay = { date: string; confirmed: boolean; shift: ShiftKind; session?: TrainingRecord; protected: boolean; recoveryFlag?: 'none' | 'caution' | 'recovery'; recoveryReasons?: string[]; eventInfluence?: EventInfluence; blockIntention?:BlockDayPlan; seasonEvent?: string; seasonEventTentative?:boolean }

const sDate = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}
const isWeekend = (key: string) => [0,6].includes(sDate(key).getDay())
export const currentKey = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export const friendlyDate = (key: string) => new Intl.DateTimeFormat('de-DE', {weekday: 'short', day: '2-digit', month: '2-digit'}).format(sDate(key))
export const isConfirmed = (shift?: ShiftRecord) => Boolean(shift && shift.shift && shift.shift !== 'offen')

export function readinessLevel(entry?: ReadinessRecord): 'offen' | 'gruen' | 'gelb' | 'rot' {
  const r = entry?.ratings
  if (!r || !([r.sleep, r.energy, r.stress, r.fatigue, r.legs].every(x => Number.isInteger(x) && x! >= 1 && x! <= 5)) || !entry?.illness) return 'offen'
  if (entry.illness === 'ja') return 'rot'
  const unfavorable = Number(r.sleep! <= 2) + Number(r.energy! <= 2) + Number(r.stress! >= 4) + Number(r.fatigue! >= 4) + Number(r.legs! >= 4)
  if (unfavorable >= 3 || (r.energy! <= 2 && r.fatigue! >= 4)) return 'rot'
  const middling = [r.sleep, r.energy, r.stress, r.fatigue, r.legs].filter(n => n === 3).length
  return unfavorable > 0 || middling >= 3 ? 'gelb' : 'gruen'
}

function session(date: string, type: SessionKind, title: string, durationMin: number, priority: Priority, description: string, target: string, notes?: string, expectedKm?: number): TrainingRecord {
  return {
    id: `auto:${PROFILE_ID}:${date}`,
    profileId: PROFILE_ID, date, sessionType: type,
    title, durationMin, priority, description, target, notes, expectedKm,
    status: 'geplant', createdBy: PLANNER_VERSION,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }
}
const wattText = (ftp?: number, lower = 0, upper = 0) => ftp && ftp > 0 ? `${Math.round(ftp * lower)}–${Math.round(ftp * upper)} W` : 'RPE / lockere Atmung (FTP noch offen)'
function candidate(date: string, type: SessionKind, profile?: ProfileRecord, commuteKm?: number, homeIntervals?: boolean, weekIndex = 0): TrainingRecord {
  const ftp = profile?.ftpWatts
  if (type === 'commute') {
    const km = commuteKm || 0
    return session(date, type, 'Radpendeln', 0, 'SOLL',
      'Arbeitsweg zählt als vollständiger Ausdauerreiz, kein zusätzliches Radtraining.',
      `Hinfahrt locker · Z2 auf geeigneten Abschnitten (${wattText(ftp, .56, .73)})`,
      homeIntervals ? 'Optional: Heimfahrt mit moderaten Belastungsabschnitten, nur bei Licht, sicherem Verkehr und guter Tagesform. Die Hinfahrt bleibt locker.' : 'Ohne Pflichtintervalle. Stadtabschnitte immer nach Verkehr und Sicherheit.',
      km || undefined)
  }
  switch (type) {
    case 'long': return session(date, type, 'Lange Grundlage', weekIndex ? 135 : 105, 'MUSS', 'Ausdauer und Belastungsverträglichkeit; kontrollierter Wiedereinstieg.', wattText(ftp, .56, .73), 'Keine Jagd nach Durchschnittswatt. Fueling üben. Nach hoher Vorbelastung verkürzen.')
    case 'quality': return session(date, type, 'Tempo-Einstieg 2 × 8', 60, 'MUSS', 'Dosierter Qualitätsreiz; keine maximale Belastung.', `15 min Einrollen · 2 × 8 min bei ${wattText(ftp, .80, .88)} · 5 min locker · Ausrollen`, 'Nur bei guter Tagesform; auf der Rolle oder sicheren, zusammenhängenden Abschnitten.')
    case 'strength-a': return session(date, type, 'Kraft A · Ganzkörper', 55, 'SOLL', 'Knie-/hüftdominant, Rücken, Brust, Core und Schulterpflege.', 'Saubere Technik, 2–3 Wiederholungen in Reserve', 'Mit Copenhagen Plank und Lateral Step-Down; kein schweres Überkopfdrücken.')
    case 'strength-b': return session(date, type, 'Kraft B · Ganzkörper', 55, 'SOLL', 'Unilateral/Hüfte, Rücken, Brust, Core und Schulterpflege.', 'Kontrolliert, keine Sätze bis zum Versagen', 'Mit Cossack Squat und Side Plank mit Beinheben; Belastung vor Schlüssel-Radtraining reduzieren.')
    case 'strength-c': return session(date, type, 'Kraft C · Oberkörper', 70, 'SOLL', 'Brust, Rücken, Bizeps, Trizeps und Schultern, keine direkte Beinbelastung.', '22 Arbeitssätze, gute Technik, 1–3 Wiederholungen in Reserve', 'Kann mit lockerem Rad-/Lauftraining am gleichen Tag kombiniert werden, wenn die Gesamtbelastung passt.')
    case 'run': return session(date, type, 'Easy Run · Wiedereinstieg', weekIndex ? 35 : 30, 'SOLL', 'Ruhiger Lauf, keine Intervalle; Belastungsverträglichkeit aufbauen.', 'Herzfrequenz: locker / kontrolliert · RPE 3–4', 'Bei Unbehagen Gehpausen einbauen. Pace nicht erzwingen.')
    case 'endurance': return session(date, type, 'Lockere Z2-Einheit', 65, 'SOLL', 'Grundlage ohne übermäßige Ermüdung.', wattText(ftp, .56, .73), 'Indoor oder draußen, bei Zeitdruck auf 40–45 min kürzbar.')
    case 'recovery': return session(date, type, 'Recovery oder Pause', 15, 'KANN', 'Leichte Mobility; vollständige Pause ist ebenso sinnvoll.', 'Kein Trainingsdruck', 'Schulter/Brustöffnung, Hüfte, sanfte Bewegungen.')
  }
}

export function generatePlan(args: {
  days: string[]
  shifts: Record<string, ShiftRecord>
  profile?: ProfileRecord
  readiness?: ReadinessRecord
  existing: TrainingRecord[]
  completed: CompletedRecord[]
  events?: GoalEvent[]
  routes?: RouteEntry[]
  blocks?: TrainingBlock[]
  restDays?: RestDayRecord[]
  provisionalUnconfirmed?: boolean
  rhythm?:WeekRhythm
}): PlanDay[] {
  const { days, shifts, profile, existing, completed } = args
  const today = currentKey()
  const cooperGoal=upcomingCooper(args.events??[])
  const eventInfluences = buildEventInfluences(days, args.events ?? [], args.routes ?? [])
  const loadCalendar: LoadCalendar = createLoadCalendar(
    days, completed.filter(x => x.profileId === PROFILE_ID), existing.filter(x => x.profileId === PROFILE_ID), args.readiness
  )
  // Weeks are read-only coaching decisions derived from the athlete's saved goals.
  // They never replace the duty/load/saved-session safety rules below.
  const adaptiveWeeks=deriveAdaptiveWeeks({start:days[0]??today,weeks:Math.ceil(days.length/7)+1,events:args.events??[],
    blocks:args.blocks??[],completed,planned:existing,shifts,readiness:args.readiness,ftpWatts:profile?.ftpWatts})
  const coachingWeekFor=(date:string):AdaptiveWeek|undefined=>adaptiveWeeks.find(w=>w.startDate<=date&&w.endDate>=date)
  // Tentative events still reserve the date against automatically added sessions,
  // but do NOT create a fake completed activity or a confirmed race.
  const milestoneByDate=new Map(plannedEvents(args.events??[]).map(e=>[e.date!,e]))
  const lockedDates = new Set<string>()
  for (const item of existing) {
    if (item.profileId !== PROFILE_ID) continue
    if (!['manual-sportspiel','manual-golf'].includes(item.sessionType) && (item.createdBy !== PLANNER_VERSION || item.locked || item.status !== 'geplant')) lockedDates.add(item.date)
  }
  for (const item of completed) if (item.profileId === PROFILE_ID && item.date && !['manual-swimming','manual-sportspiel','manual-golf'].includes(item.sessionType??'')) lockedDates.add(item.date)
  for (const day of args.restDays??[]) if(day.profileId===PROFILE_ID)lockedDates.add(day.date)
  const map = new Map<string, PlanDay>()
  const preassigned = new Set<string>()
  const heavy = new Set<string>()
  const intensityDates = new Set<string>()
  const isRecordedQuality=(entry:{sessionType?:string;title?:string;target?:string;rpe?:number})=>
    entry.sessionType==='quality' ||
    (entry.sessionType==='manual-cycling' && (
      /schwelle|sweet.?spot|vo2|vo₂|intervall|sprint|threshold|hit/i.test(`${entry.title??''} ${entry.target??''}`) ||
      (entry.rpe??0)>=8))
  const fixedTypes = new Map<string, SessionKind[]>()
  const markFixed = (date: string, type: SessionKind) => {
    const list = fixedTypes.get(date) ?? []
    list.push(type)
    fixedTypes.set(date, list)
  }
  const normalize = (type?: TrainingRecord['sessionType'], min?: number, km?: number, variant?:'A'|'B'|'C'): SessionKind => {
    if (type === 'manual-strength') return variant==='C'?'strength-c':variant==='B'?'strength-b':'strength-a'
    if (type === 'manual-running') return 'run'
    if (type === 'manual-cycling') return (min ?? 0) >= 120 || (km ?? 0) >= 60 ? 'long' : 'endurance'
    if (type === 'manual-mobility' || type === 'manual-yoga' || type === 'manual-stabi') return 'recovery'
    if (type === 'manual-martial') return 'quality'
    if (type === 'manual-swimming') return 'endurance'
    return (type ?? 'recovery') as SessionKind
  }
  // Bereits eingetragene und absolvierte Belastungen beeinflussen auch Nachbartage.
  for (const item of existing) if (item.profileId === PROFILE_ID && days.includes(item.date) &&
    !['manual-sportspiel','manual-golf'].includes(item.sessionType) &&
    (item.createdBy !== PLANNER_VERSION || item.locked || item.status !== 'geplant')) {
    const type = normalize(item.sessionType, item.durationMin, item.expectedKm,item.strengthVariant)
    markFixed(item.date, type)
    if(isRecordedQuality(item))intensityDates.add(item.date)
    if (['long','quality','strength-a','strength-b','commute'].includes(type)) heavy.add(item.date)
  }
  for (const item of completed) if (item.profileId === PROFILE_ID && days.includes(item.date) && !['manual-swimming','manual-sportspiel','manual-golf'].includes(item.sessionType??'')) {
    const type = normalize(item.sessionType, item.durationMin, item.distanceKm,item.strengthVariant)
    markFixed(item.date, type)
    if(isRecordedQuality(item))intensityDates.add(item.date)
    if (['long','quality','strength-a','strength-b','commute'].includes(type) || ((item.rpe??0)>=7&&type!=='strength-c'&&!(item.sessionType==='manual-strength'&&item.strengthVariant==='C'))) heavy.add(item.date)
  }
  days.forEach(date => {
    const shift = shifts[date]
    const confirmed = isConfirmed(shift)
    map.set(date, {date, confirmed, shift: confirmed ? shift.shift! : args.provisionalUnconfirmed ? 'frei' : isWeekend(date) ? 'frei' : 'offen', protected: lockedDates.has(date), recoveryFlag: loadCalendar[date]?.level ?? 'none', recoveryReasons: loadCalendar[date]?.reasons ?? [], eventInfluence:eventInfluences[date],blockIntention:blockDayForDate(date,args.blocks??[]),seasonEvent:milestoneByDate.get(date)?.name,seasonEventTentative:milestoneByDate.get(date)?.status!=='bestaetigt'||milestoneByDate.get(date)?.vacation==='offen'})
  })
  const offsetDate=(date:string,diff:number)=>{const t=new Date(`${date}T12:00:00Z`);t.setUTCDate(t.getUTCDate()+diff);return t.toISOString().slice(0,10)}
  const put = (date: string, item: TrainingRecord) => {
    const day = map.get(date)!
    const active=matchingBlock(date,args.blocks??[])
    // Event taper and recovery always win over an overlapping voluntary focus block.
    const safeToTailor=!day.eventInfluence && !day.blockIntention && loadCalendar[date]?.level==='none' && !(date===today&&readinessLevel(args.readiness)==='rot')
    let adjusted=safeToTailor?tailorSession(item,active,profile?.ftpWatts):item
    // Schwimmen ist ausschließlich eine selbst ausgewählte freie Aktivität.
    if(safeToTailor&&active?.focus==='running'&&item.sessionType==='endurance'){
      const countRunning=completed.filter(c=>c.profileId===PROFILE_ID&&c.date<date&&c.date>=offsetDate(date,-28)&&(c.sessionType==='run'||c.sessionType==='manual-running')).length
      if(countRunning>=4 && (active.capacity==='more'||active.capacity==='much') && !nearType(date,['run'],2)) adjusted={...item,sessionType:'run',title:'Zusätzlicher lockerer Lauf',durationMin:25,target:'Sehr locker, RPE 2–3, bei Bedarf Gehpausen',description:'Nur bei etablierter Laufverträglichkeit; andernfalls lockeres Radfahren.',notes:`Fokusblock ${active.name}`}
    }
    if(safeToTailor&&active?.focus==='strength'&&item.sessionType==='endurance')adjusted={...item,sessionType:'recovery',title:'Beweglichkeit & leichte Rumpfaktivierung',durationMin:25,priority:'KANN',target:'Mobility und Schulterpflege ohne Ermüdung',description:'Keine dritte schwere Krafteinheit allein durch mehr Freizeit'}
    // A weekly budget is an upper bound for proposed workouts, never an obligation.
    if(active?.weeklyHours && !['commute','recovery'].includes(adjusted.sessionType)){
      const weekStart=days[Math.floor(days.indexOf(date)/7)*7]
      const weekDates=days.slice(Math.floor(days.indexOf(date)/7)*7,Math.floor(days.indexOf(date)/7)*7+7)
      const existingMinutes=existing.filter(x=>x.profileId===PROFILE_ID&&weekDates.includes(x.date)&&x.status==='geplant').reduce((n,x)=>n+Math.max(0,x.durationMin),0)
      const generatedMinutes=weekDates.filter(d=>d>=weekStart).reduce((n,d)=>n+(map.get(d)?.session?.durationMin??0),0)
      if(existingMinutes+generatedMinutes+adjusted.durationMin>active.weeklyHours*60)return
    }
    // Laufziel dient als Orientierung, nicht als Erlaubnis für sofortige harte Intervalle.
    if(adjusted.sessionType==='run'&&cooperGoal){
      const recentRuns=completed.filter(c=>c.profileId===PROFILE_ID && c.date<date && c.date>=offsetDate(date,-42) && ['run','manual-running'].includes(c.sessionType??'')).length
      const settled=recentRuns>=6 && loadCalendar[date]?.level==='none' && !nearType(date,['run'],2)
      const goalDate=cooperGoal.date && cooperGoal.date>=date?cooperGoal.date:undefined
      adjusted={...adjusted,title:settled?'Lockerer Lauf + Lauftechnik · Cooper-Aufbau':'Easy Run · Cooper-Aufbau',
        target:settled?'Locker, RPE 3–4. Optional 4 × 12 Sekunden Steigerung mit vollständiger Gehpause. Keine Tempovorgabe.':'Lockeres Gesprächstempo, RPE 3–4; Gehpausen erlaubt. Keine harten 800-m-Intervalle.',
        notes:[adjusted.notes,`Langfristiges Ziel: Cooper-Test 3.200 m in 12:00 (3:45 min/km). ${goalDate?`Testdatum: ${goalDate}.`:'Testdatum noch offen.'} Tempo erst nach ausreichender Laufverträglichkeit schrittweise aufbauen.`].filter(Boolean).join(' · ')}
    }
    const coaching=coachingWeekFor(date)
    // The user's explicit focus block has priority over the automatically inferred one.
    if(coaching && !active && !day.eventInfluence && !day.blockIntention &&
      loadCalendar[date]?.level==='none' && !(date===today&&readinessLevel(args.readiness)==='rot')) {
      adjusted=adjustSuggestedSession(adjusted,coaching,profile?.ftpWatts) as TrainingRecord
    }
    day.session = adjusted
    preassigned.add(date)
    if (['long', 'quality', 'strength-a', 'strength-b', 'commute'].includes(adjusted.sessionType)) heavy.add(date)
  }
  const canUse = (date: string) => {
    const day = map.get(date)
    const weekAdvice=coachingWeekFor(date)
    return weekAdvice?.kind!=='RECOVERY' && !!day && date >= today && (day.confirmed || args.provisionalUnconfirmed) && !day.protected && !preassigned.has(date) && day.shift !== 'einsatz' && ! (day.blockIntention && (isTrainingFree(day.blockIntention.kind)||day.blockIntention.kind==='challenge'))
  }
  const index = (key: string) => days.indexOf(key)
  const nearType = (date: string, types: SessionKind[], maxDistance: number) => {
    const i = index(date)
    return days.some((d,j) => Math.abs(i-j) <= maxDistance && (
      (map.get(d)?.session && types.includes(map.get(d)!.session!.sessionType as SessionKind)) ||
      (fixedTypes.get(d) ?? []).some(t => types.includes(t))
    ))
  }
  // First: real duty-related load is mandatory to account for.
  days.forEach(date => {
    const day = map.get(date)!
    const shift = shifts[date]
    if(milestoneByDate.has(date)){
      preassigned.add(date)
      heavy.add(date)
      return
    }
    if (date < today) return
    // Ein bestätigter Höhepunkt ist ein fester Kalendereintrag und wird nicht mit einem
    // zusätzlichen TEMPO-Workout überplant. Als absolvierte Aktivität separat protokollieren.
    if (day.eventInfluence?.phase === 'event') {
      preassigned.add(date)
      heavy.add(date)
      return
    }
    // Explicit holiday choices reserve the day. Protected manual work remains untouched.
    // For an unconfirmed shift keep the intention visible, but never schedule a workout.
    const intention=day.blockIntention
    if (intention && isTrainingFree(intention.kind)) { preassigned.add(date); return }
    if (intention?.kind==='challenge') { preassigned.add(date); heavy.add(date); return }
    if ((!day.confirmed && !args.provisionalUnconfirmed) || day.protected) return
    // Radpendeln ist echte Dienstbelastung und darf nicht als Erholung verbucht werden.
    // Wenn es auf eine Event-Entlastung fällt, wird im Kalender ein Konflikthinweis angezeigt.
    if (day.shift === 'tagdienst' && shift?.commute && shift.commute !== 'nein') {
      const km = (profile?.commuteOneWayKm ?? 0) * (shift.commute === 'beide' ? 2 : 1)
      put(date, candidate(date, 'commute', profile, km, Boolean(shift.homeIntervals)))
      return
    }
    // Vor und nach einem bestätigten Höhepunkt nur Recovery / Pause vorschlagen.
    if (day.eventInfluence?.phase === 'rest-before' || day.eventInfluence?.phase === 'recovery') {
      const item = candidate(date,'recovery',profile)
      item.description = day.eventInfluence.note
      item.notes = day.eventInfluence.note
      put(date,item)
      return
    }
    if (day.shift === 'einsatz') { put(date, candidate(date, 'recovery', profile)); return }
    if (intention && (intention.kind==='group-ride'||intention.kind==='ride-training') && !day.eventInfluence && loadCalendar[date]?.level==='none' && !(date===today&&readinessLevel(args.readiness)==='rot')) {
      const duration=Math.max(30,Math.min(480,intention.durationMin??90))
      const ride=candidate(date,duration>=120?'long':'endurance',profile)
      ride.title=intention.title||intention.routeName||(intention.kind==='group-ride'?'Gemeinsame Radtour':'Geplante Trainingstour')
      ride.durationMin=duration;ride.expectedKm=intention.routeDistanceKm
      ride.priority='SOLL'
      const power=profile?.ftpWatts
      const target=intention.effort==='tempo'?(power?`${Math.round(power*.76)}–${Math.round(power*.85)} W`:'RPE 5–6'):intention.effort==='threshold'?(power?`${Math.round(power*.88)}–${Math.round(power*.95)} W`:'RPE 6–7'):''
      ride.target=target?`Optionaler Abschnitt (${target}), nur bei sicherer Strecke und passender Tagesform. Nicht verpflichtend.`:'Locker mit der Gruppe fahren, Anstiege nach Gefühl.'
      ride.description='Vorab eingetragene Urlaubstour; keine automatische Trainingsfreigabe. Gruppensicherheit und Erholung haben Vorrang.'
      ride.notes=[intention.routeName?`Route: ${intention.routeName}`:undefined,(intention.climbIntervals?.length||intention.climbKey)?`${intention.climbIntervals?.length??1} historische Anstiege als optionale Abschnitte vorgemerkt (in Blockübersicht ansehen)`:undefined,intention.notes].filter(Boolean).join(' · ')
      put(date,ride); return
    }
    if (loadCalendar[date]?.level === 'recovery') {
      const item = candidate(date, 'recovery', profile)
      item.description = 'Regeneration nach dokumentierter Belastung oder aufgrund der Tagesform; vollständige Pause ist ebenfalls möglich.'
      item.notes = loadCalendar[date].reasons.join(' · ')
      put(date, item)
    }
  })
  const readinessToday = args.readiness?.date === today ? readinessLevel(args.readiness) : 'offen'
  if (map.has(today) && readinessToday === 'rot' && map.get(today)!.confirmed && !map.get(today)!.protected && !preassigned.has(today)) {
    put(today, candidate(today, 'recovery', profile))
  }
  // Rolling weeks (7 days each); entries are flexible, not fixed to weekdays.
  for (let offset = 0; offset < days.length; offset += 7) {
    const week = days.slice(offset, offset + 7)
    const weekNumber = Math.floor(offset / 7)
    const coaching=coachingWeekFor(week[0])
    const taper=coaching?.kind==='TAPER'
    const lowIntensityWeek=Boolean(coaching?.deload)
    const hasFixedType=(types:SessionKind[])=>week.some(d=>(fixedTypes.get(d)??[]).some(x=>types.includes(x)))
    const alreadyHard=week.some(d=>intensityDates.has(d))||hasFixedType(['quality'])
    const existingStrengthDays=week.filter(d=>(fixedTypes.get(d)??[]).some(x=>x==='strength-a'||x==='strength-b')).length
    const nearbyHeavy = (date: string, distance = 1) => {
      const i = index(date)
      return days.some((d,j) => Math.abs(i-j) <= distance && d !== date && heavy.has(d))
    }
    const select = (predicate: (date:string)=>boolean, score: (date:string)=>number,type?:SessionKind): string | undefined =>
      week.filter(date => canUse(date) && predicate(date)).sort((a,b) => score(b)-score(a) + rhythmPenalty({sessionType:type??'endurance',title:''},a,args.rhythm)-rhythmPenalty({sessionType:type??'endurance',title:''},b,args.rhythm) || a.localeCompare(b))[0]
    // Long bike ride prefers a confirmed free day and distance from commute.
    const longDate = select(date => !eventInfluences[date] && map.get(date)!.shift === 'frei' && loadCalendar[date]?.level === 'none' && !nearbyHeavy(date) && !nearType(date, ['commute'], 1), date => (isWeekend(date) ? 10 : 0) + index(date)/10,'long')
    if (longDate && !taper && !hasFixedType(['long'])) put(longDate, candidate(longDate, 'long', profile, undefined, false, weekNumber))
    // One controlled quality session, only if there is a suitable slot.
    const qualityDate = select(date => {
      const shift = shifts[date]
      return !eventInfluences[date] && loadCalendar[date]?.level === 'none' && (map.get(date)!.shift === 'frei' || (shift?.shift === 'tagdienst' && !!shift.afterWorkCycling)) &&
        !nearbyHeavy(date) && !nearType(date, ['commute','long'], 1) && !(date === today && readinessToday !== 'gruen')
    }, date => shifts[date]?.shift === 'tagdienst' ? 4 : 3,'quality')
    if (qualityDate && !lowIntensityWeek && !alreadyHard && (coaching?.qualityLimit??1)>0) put(qualityDate, candidate(qualityDate, 'quality', profile))
    // Up to two strength sessions if enough suitable days exist. Chronological
    // assignment and the last documented strength type determine A/B alternation.
    for (let slot = existingStrengthDays; slot < (coaching?.strengthSlots??2); slot++) {
      const strengthDate = week.filter(date => {
        const shift = shifts[date]
        return canUse(date) && !eventInfluences[date] && loadCalendar[date]?.level === 'none' &&
          (map.get(date)!.shift === 'frei' || (shift?.shift === 'tagdienst' && !!availabilityFlag(shift,'possibleStrength'))) &&
          !nearType(date, ['long','commute','quality'], 1) && !nearType(date, ['strength-a','strength-b'], 1) &&
          !(date === today && readinessToday === 'gelb')
      }).sort((a,b)=>rhythmPenalty({sessionType:'strength-a',title:''},a,args.rhythm)-rhythmPenalty({sessionType:'strength-a',title:''},b,args.rhythm)||a.localeCompare(b))[0]
      if (!strengthDate) break
      const last = [
        ...completed.filter(x => x.profileId === PROFILE_ID && x.date < strengthDate && normalize(x.sessionType, x.durationMin, x.distanceKm,x.strengthVariant).startsWith('strength')).map(x => ({date:x.date,type:normalize(x.sessionType, x.durationMin, x.distanceKm,x.strengthVariant)})),
        ...existing.filter(x => x.profileId === PROFILE_ID && x.date < strengthDate &&
          (x.createdBy !== PLANNER_VERSION || x.locked || x.status !== 'geplant') &&
          normalize(x.sessionType, x.durationMin, x.expectedKm,x.strengthVariant).startsWith('strength')).map(x => ({date:x.date,type:normalize(x.sessionType, x.durationMin, x.expectedKm,x.strengthVariant)})),
        ...[...map.values()].filter(x => x.date < strengthDate && x.session && x.session.sessionType.startsWith('strength')).map(x => ({date:x.date,type:x.session!.sessionType})),
      ].sort((a,b) => a.date.localeCompare(b.date)).at(-1)
      const type:SessionKind = last?.type === 'strength-a' ? 'strength-b' : 'strength-a'
      const item=candidate(strengthDate,type,profile)
      if(shifts[strengthDate]?.shift==='tagdienst'){
        // Unspecified location stays unspecified; availability is not a location assertion.
        item.strengthLocation=undefined
        item.notes=[item.notes,'Kraft trotz Dienst möglich – Trainingsort bei der Einheit wählen'].filter(Boolean).join(' · ')
      }
      put(strengthDate,item)
    }
    const runDate = select(date => {
      const shift = shifts[date]
      return loadCalendar[date]?.level !== 'recovery' && (map.get(date)!.shift === 'frei' || (shift?.shift === 'tagdienst' && !!availabilityFlag(shift,'possibleRun'))) &&
        !nearType(date, ['long','commute'], 1)
    }, date => shiftRunScore(shifts[date]),'run')
    if (runDate && !taper && !hasFixedType(['run'])) {
      const item=candidate(runDate, 'run', profile, undefined, false, weekNumber)
      if(shifts[runDate]?.shift==='tagdienst')item.notes=[item.notes,'Laufen trotz Dienst möglich – Trainingsort bei der Einheit wählen'].filter(Boolean).join(' · ')
      put(runDate,item)
    }
    const easyDate = select(date => {
      const shift = shifts[date]
      return loadCalendar[date]?.level !== 'recovery' && (map.get(date)!.shift === 'frei' || (shift?.shift === 'tagdienst' && !!shift.afterWorkCycling)) &&
        !nearType(date, ['long','commute'], 1)
    }, date => shifts[date]?.shift === 'tagdienst' ? 4 : 1,'endurance')
    if (easyDate) put(easyDate, candidate(easyDate, 'endurance', profile))
    // Additional free time is optional. Only regular riders get ONE extra easy ride;
    // never force intensity or crowd a key day/event. No extra workout during recovery.
    const focal=week.map(d=>matchingBlock(d,args.blocks??[])).find(b=>b?.enabled&&b.focus==='cycling'&&b.capacity==='much')
    if(focal){
      const firstDay=week[0]
      const recentCycling=completed.filter(c=>c.profileId===PROFILE_ID&&c.date<firstDay&&c.date>=offsetDate(firstDay,-28)&&
        ['long','endurance','quality','commute','manual-cycling'].includes(c.sessionType??'')).length
      if(recentCycling>=3){
        const optionalDate=select(date=>matchingBlock(date,args.blocks??[])?.id===focal.id&&!eventInfluences[date]&&
          loadCalendar[date]?.level==='none'&&!nearbyHeavy(date)&&
          (map.get(date)!.shift==='frei'||Boolean(shifts[date]?.afterWorkCycling)),date=>index(date))
        if(optionalDate){
          const extra=candidate(optionalDate,'endurance',profile)
          extra.title='Optionale lockere Radfahrt · Extra-Freizeit'
          extra.durationMin=45;extra.priority='KANN'
          extra.target='Z2 locker, keine zusätzlichen Intervalle'
          put(optionalDate,extra)
        }
      }
    }
    // All other confirmed days can be genuine rest days.
  }
  return days.map(d => map.get(d)!)
}
function shiftRunScore(shift?: ShiftRecord) { return shift?.shift === 'tagdienst' ? 6 : 2 }

/** Phase 28 safe publishing rule: a generated suggestion can only fill an EMPTY date.
 * No existing planned or completed record is ever deleted, even if it was generated.
 * Explicit manual editing still uses the separate user-controlled editor.
 */
export async function commitGeneratedPlan(days: PlanDay[], existing: TrainingRecord[], completed: CompletedRecord[]): Promise<number> {
  const { openTempoDatabase } = await import('../db/storage')
  const db = await openTempoDatabase()
  const occupiedDates = new Set<string>()
  for (const record of existing) if (record.profileId === PROFILE_ID) occupiedDates.add(record.date)
  for (const record of completed) if (record.profileId === PROFILE_ID) occupiedDates.add(record.date)
  const candidates = days.filter(day => day.session && day.confirmed && !day.protected && !occupiedDates.has(day.date)).map(day => day.session!)
  return new Promise((resolve, reject) => {
    const tx = db.transaction('plannedSessions','readwrite')
    const store = tx.objectStore('plannedSessions')
    let inserted = 0
    try {
      for (const item of candidates) {
        // A second open tab could have written the same ID; never overwrite it.
        const request = store.get(item.id)
        request.onsuccess = () => {
          if (request.result) return
          store.add(item)
          inserted++
        }
        request.onerror = () => tx.abort()
      }
      tx.oncomplete = () => {db.close(); resolve(inserted)}
      tx.onerror = () => {db.close(); reject(tx.error ?? new Error('Plan konnte nicht gespeichert werden'))}
      tx.onabort = () => {db.close(); reject(tx.error ?? new Error('Plan-Speicherung abgebrochen'))}
    } catch(error) {tx.abort();db.close();reject(error)}
  })
}
