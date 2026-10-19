import type {TempoRecord} from '../db/types'
import type {TrainingRecord} from '../planning/engine'

/** A preference, NOT a fixed appointment. Shift, rest and athlete locks outrank it. */
export type DayFocus='flexibel'|'ausdauer'|'kraft'|'zusatz'|'recovery'
export type WeekRhythm=TempoRecord & {kind:'tempo-week-rhythm'; days:DayFocus[]}
export const RHYTHM_ID='tempo-week-rhythm:local-primary-profile'
export const RHYTHM_DAYS=['Mo','Di','Mi','Do','Fr','Sa','So'] as const
export const RHYTHM_CHOICES:Record<DayFocus,string>={flexibel:'Flexibel',ausdauer:'🚴 Ausdauer / Lauf',kraft:'🏋️ Kraft',zusatz:'🧘 Zusatz / Mobility',recovery:'🌿 Recovery bevorzugt'}
export const EMPTY_RHYTHM:DayFocus[]=Array(7).fill('flexibel')
export function validRhythm(value:unknown):value is DayFocus[]{return Array.isArray(value)&&value.length===7&&value.every(x=>Object.hasOwn(RHYTHM_CHOICES,x))}
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
/** Soft score: prefer the repeatable week, but never prohibit a workout. */
export function rhythmPenalty(session:Pick<TrainingRecord,'sessionType'|'title'>,date:string,week?:Pick<WeekRhythm,'days'>|null):number{
 const chosen=rhythmForDate(date,week),focus=focusForSession(session)
 if(chosen==='flexibel')return 0
 if(chosen==='recovery')return focus==='zusatz'?8:50
 if(chosen===focus)return -9
 if(chosen==='zusatz')return focus==='kraft'?9:13
 return 12
}
export function makeRhythm(days:DayFocus[],previous?:WeekRhythm):WeekRhythm{
 if(!validRhythm(days))throw Error('Bitte die sieben Standard-Wochentage auswählen.')
 const now=new Date().toISOString()
 return {id:RHYTHM_ID,kind:'tempo-week-rhythm',profileId:'local-primary-profile',createdAt:previous?.createdAt??now,updatedAt:now,days:[...days]}
}
