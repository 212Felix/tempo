import type {TempoRecord} from '../db/types'
import type {TrainingRecord} from '../planning/engine'

/** Persist a repeatable preference without fixing appointments. Legacy days are preserved. */
export type DayFocus='flexibel'|'ausdauer'|'kraft'|'zusatz'|'recovery'
export type WeekActivity='bike'|'run'|'strength-a'|'strength-b'|'strength-c'|'yoga'|'stabi'|'mobility'|'swim'|'martial'|'sportspiel'|'golf'|'recovery'
export type WeekRhythm=TempoRecord & {kind:'tempo-week-rhythm';days:DayFocus[];activityDays?:WeekActivity[][]}
export const RHYTHM_ID='tempo-week-rhythm:local-primary-profile'
export const RHYTHM_DAYS=['Mo','Di','Mi','Do','Fr','Sa','So'] as const
export const RHYTHM_CHOICES:Record<DayFocus,string>={flexibel:'Flexibel',ausdauer:'🚴 Ausdauer / Lauf',kraft:'🏋️ Kraft',zusatz:'🧘 Zusatz / Mobility',recovery:'🌿 Recovery bevorzugt'}
export const ACTIVITY_CHOICES:ReadonlyArray<{id:WeekActivity;icon:string;label:string}>=[
 {id:'bike',icon:'🚴',label:'Rad'}, {id:'run',icon:'🏃',label:'Laufen'},
 {id:'strength-a',icon:'🏋️',label:'Kraft A'},{id:'strength-b',icon:'🏋️',label:'Kraft B'},{id:'strength-c',icon:'🏋️',label:'Kraft C'},
 {id:'yoga',icon:'🧘',label:'Yoga'},{id:'stabi',icon:'🤸',label:'Stabi'},{id:'mobility',icon:'🌿',label:'Mobility'},
 {id:'swim',icon:'🏊',label:'Schwimmen'},{id:'martial',icon:'🥊',label:'Kampfsport'},
 {id:'sportspiel',icon:'⚽',label:'Sportspiel'},{id:'golf',icon:'⛳',label:'Golf'},
 {id:'recovery',icon:'💤',label:'Recovery'},
]
const allActivities=new Set(ACTIVITY_CHOICES.map(x=>x.id))
export const EMPTY_RHYTHM:DayFocus[]=Array(7).fill('flexibel')
export const EMPTY_ACTIVITY_DAYS:WeekActivity[][]=Array.from({length:7},()=>[])
export function validRhythm(value:unknown):value is DayFocus[]{return Array.isArray(value)&&value.length===7&&value.every(x=>Object.hasOwn(RHYTHM_CHOICES,x))}
export function validActivityDays(value:unknown):value is WeekActivity[][]{
 return Array.isArray(value)&&value.length===7&&value.every((day:unknown)=>Array.isArray(day)&&day.length<=ACTIVITY_CHOICES.length&&day.every((x:unknown)=>typeof x==='string'&&allActivities.has(x as WeekActivity)))
}
export function activitiesFromLegacy(focus:DayFocus):WeekActivity[]{
 return focus==='ausdauer'?['bike','run']:focus==='kraft'?['strength-a','strength-b','strength-c']:focus==='zusatz'?['yoga','stabi','mobility']:focus==='recovery'?['recovery']:[]
}
export function getRhythmActivities(week?:Pick<WeekRhythm,'days'|'activityDays'>|null):WeekActivity[][]{
 if(week&&validActivityDays(week.activityDays))return week.activityDays.map(day=>[...new Set(day)])
 return validRhythm(week?.days)?week!.days.map(activitiesFromLegacy):EMPTY_ACTIVITY_DAYS.map(()=>[])
}
export function rhythmForDate(date:string,week?:Pick<WeekRhythm,'days'>|null):DayFocus{
 if(!week||!validRhythm(week.days))return 'flexibel'
 const weekday=new Date(`${date}T12:00:00Z`).getUTCDay()
 return week.days[(weekday+6)%7]
}
export function focusForSession(s:Pick<TrainingRecord,'sessionType'|'title'>):DayFocus{
 if(/strength/i.test(s.sessionType))return 'kraft'
 if(/recovery|yoga|stabi|mobility/i.test(`${s.sessionType} ${s.title}`))return 'zusatz'
 return 'ausdauer'
}
export function activityForSession(s:Pick<TrainingRecord,'sessionType'|'title'>):WeekActivity{
 const t=`${s.sessionType} ${s.title}`.toLowerCase()
 if(/strength-c|kraft c\b/.test(t))return 'strength-c'
 if(/strength-b|kraft b\b/.test(t))return 'strength-b'
 if(/strength/.test(t))return 'strength-a'
 if(/golf/.test(t))return 'golf'
 if(/sportspiel/.test(t))return 'sportspiel'
 if(/swim|schwimm/.test(t))return 'swim'
 if(/martial|kampf/.test(t))return 'martial'
 if(/stabi/.test(t))return 'stabi'
 if(/yoga/.test(t))return 'yoga'
 if(/recovery|ruhetag/.test(t))return 'recovery'
 if(/mobility/.test(t))return 'mobility'
 if(/run|lauf/.test(t))return 'run'
 return 'bike'
}
/** Soft preference; sports that do not affect training load never force rearrangements. */
export function rhythmPenalty(session:Pick<TrainingRecord,'sessionType'|'title'>,date:string,week?:Pick<WeekRhythm,'days'|'activityDays'>|null):number{
 const activity=activityForSession(session)
 if(activity==='golf'||activity==='sportspiel'||activity==='swim')return 0
 if(week&&validActivityDays(week.activityDays)){
  const dow=(new Date(`${date}T12:00:00Z`).getUTCDay()+6)%7
  const choices=week.activityDays[dow]
  if(!choices.length)return 0
  if(choices.includes(activity))return -9
  if(choices.includes('recovery'))return 50
  if(activity.startsWith('strength-')&&choices.some(x=>x.startsWith('strength-')))return 3
  return 12
 }
 const chosen=rhythmForDate(date,week),focus=focusForSession(session)
 if(chosen==='flexibel')return 0
 if(chosen==='recovery')return focus==='zusatz'?8:50
 if(chosen===focus)return -9
 if(chosen==='zusatz')return focus==='kraft'?9:13
 return 12
}
export function makeRhythm(days:DayFocus[],previous?:WeekRhythm,activityDays?:WeekActivity[][]):WeekRhythm{
 if(!validRhythm(days))throw Error('Bitte die sieben Standard-Wochentage auswählen.')
 const chosen=activityDays??previous?.activityDays
 if(chosen!==undefined&&!validActivityDays(chosen))throw Error('Ungültige Aktivitätsauswahl.')
 const now=new Date().toISOString()
 return {id:RHYTHM_ID,kind:'tempo-week-rhythm',profileId:'local-primary-profile',createdAt:previous?.createdAt??now,updatedAt:now,days:[...days],...(chosen!==undefined?{activityDays:chosen.map(day=>[...new Set(day)])}:{})}
}
export function makeActivityRhythm(activityDays:WeekActivity[][],previous?:WeekRhythm):WeekRhythm{
 if(!validActivityDays(activityDays))throw Error('Bitte gültige Aktivitäten für sieben Tage auswählen.')
 const days=activityDays.map(day=>day.includes('recovery')?'recovery':day.some(x=>x.startsWith('strength-'))?'kraft':day.includes('bike')||day.includes('run')?'ausdauer':day.length?'zusatz':'flexibel') as DayFocus[]
 return makeRhythm(days,previous,activityDays)
}
