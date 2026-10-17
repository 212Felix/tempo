/** User-fixed non-training days. Stored in the existing `settings` store; no schema migration. */
import {PROFILE_ID} from '../planning/engine'
import type {TempoRecord} from '../db/types'
export type RestMode='free'|'recovery'
export type RestDayRecord=TempoRecord&{date:string;profileId:string;kind:'fixed-training-rest';mode:RestMode;note:string}
export const restId=(date:string)=>`training-rest:${PROFILE_ID}:${date}`
export function makeRestDay(date:string,mode:RestMode,note='',previous?:RestDayRecord):RestDayRecord{
 if(!/^\d{4}-\d\d-\d\d$/.test(date)||Number.isNaN(Date.parse(`${date}T12:00:00Z`)))throw Error('Ungültiges Datum.')
 const now=new Date().toISOString()
 return {id:restId(date),profileId:PROFILE_ID,date,kind:'fixed-training-rest',mode,note:note.slice(0,250),createdAt:previous?.createdAt??now,updatedAt:now}
}
export const isRestDay=(row:unknown):row is RestDayRecord=>Boolean(row&&typeof row==='object'&&(row as RestDayRecord).kind==='fixed-training-rest'&&(row as RestDayRecord).profileId===PROFILE_ID&&/^(\d{4}-\d\d-\d\d)$/.test((row as RestDayRecord).date))
export function rollingCalendarWeeks(today:string,minimumFutureDays=10){
 const start=new Date(`${today}T12:00:00Z`)
 const day=(start.getUTCDay()+6)%7
 const required=day+minimumFutureDays
 return Math.max(2,Math.ceil(required/7))
}
