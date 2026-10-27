import type {Wellness} from '../phase40c/wellness'
export type SubjectiveRatings={sleep?:number;energy?:number;stress?:number;fatigue?:number;legs?:number}
export type HybridResult={level:'offen'|'gruen'|'gelb'|'rot';reason:string;mode:'garmin+checkin'|'checkin';used:string[]}
/** Recovery score is transparent and deliberately conservative; HRV without baseline isn't a health verdict. */
export function assessHybrid(ratings:SubjectiveRatings,illness:''|'ja'|'nein',wellness?:Wellness|null,hrvBaseline?:number):HybridResult{
 const hasSleep=wellness?.sleepHours!==undefined
 const hasRecovery=wellness?.bodyBattery!==undefined||wellness?.hrvMs!==undefined&&hrvBaseline!==undefined&&hrvBaseline>0
 const required:[keyof SubjectiveRatings,number][]=[['stress',4],['fatigue',4],['legs',4]]
 if(!hasSleep)required.push(['sleep',2])
 if(!hasRecovery)required.push(['energy',2])
 const used=[...required.map(([k])=>k),...(hasSleep?['garmin:schlaf']:[]),...(hasRecovery?['garmin:erholung']:[])]
 if(illness==='ja')return {level:'rot',reason:'Gesundheitliche Beschwerden eingetragen – harte Belastung vermeiden.',mode:hasSleep||hasRecovery?'garmin+checkin':'checkin',used}
 if(illness!=='nein'||required.some(([k])=>!Number.isInteger(ratings[k])||ratings[k]!<1||ratings[k]!>5))return {level:'offen',reason:'Bitte die noch offenen Angaben ergänzen.',mode:hasSleep||hasRecovery?'garmin+checkin':'checkin',used}
 const flags:number[]=[];let middling=0
 for(const [key,trigger] of required){const v=ratings[key]!;if(key==='sleep'||key==='energy'){if(v<=trigger)flags.push(1)}else if(v>=trigger)flags.push(1);if(v===3)middling++}
 if(hasSleep){if(wellness!.sleepHours!<6)flags.push(1);else if(wellness!.sleepHours!<7)middling++}
 if(wellness?.bodyBattery!==undefined){if(wellness.bodyBattery<30)flags.push(1);else if(wellness.bodyBattery<45)middling++}
 if(wellness?.hrvMs!==undefined&&hrvBaseline!==undefined&&hrvBaseline>0){if(wellness.hrvMs<hrvBaseline*.8)flags.push(1);else if(wellness.hrvMs<hrvBaseline*.9)middling++}
 const level=flags.length>=2?'rot':flags.length||middling>=2?'gelb':'gruen'
 return {level,reason:level==='rot'?'Deutlich eingeschränkte Erholung. Regeneration bevorzugen.':level==='gelb'?'Mindestens ein Belastungs-/Erholungssignal fällt auf; Umfang und Intensität prüfen.':'Keine deutlichen Warnsignale aus verfügbaren Daten. Das ist keine medizinische Freigabe.',mode:hasSleep||hasRecovery?'garmin+checkin':'checkin',used}
}
export function hrvReference(history:Wellness[],today:string):number|undefined{
 const values=history.filter(x=>x.date<today&&x.hrvMs!==undefined&&x.hrvMs>=10).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14).map(x=>x.hrvMs!).sort((a,b)=>a-b)
 if(values.length<5)return undefined
 return values[Math.floor(values.length/2)]
}
