/** Optional Garmin measurements. Never use them as an automatic replacement for the TEMPO check-in. */
export type Wellness={date:string;fetchedAt:string;sleepHours?:number;hrvMs?:number;bodyBattery?:number;available?:string[];sources?:{sleep?:string;hrv?:string;bodyBattery?:string}}
export function validateWellness(data:unknown):Wellness|null{
 if(!data||typeof data!=='object')return null
 const x=data as Record<string,unknown>
 if(typeof x.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||typeof x.fetchedAt!=='string'||!Number.isFinite(Date.parse(x.fetchedAt)))return null
 const safe=(key:'sleepHours'|'hrvMs'|'bodyBattery',max:number)=>typeof x[key]==='number'&&Number.isFinite(x[key])&&x[key]>=0&&x[key]<=max?x[key] as number:undefined
 return {date:x.date,fetchedAt:x.fetchedAt,sleepHours:safe('sleepHours',24),hrvMs:safe('hrvMs',250),bodyBattery:safe('bodyBattery',100),available:Array.isArray(x.available)?x.available.filter((v):v is string=>typeof v==='string').slice(0,3):[],sources:x.sources&&typeof x.sources==='object'?Object.fromEntries(Object.entries(x.sources).filter(([key,value])=>['sleep','hrv','bodyBattery'].includes(key)&&['ok','empty','unavailable'].includes(String(value)))):{}}
}
export function wellnessAdvice(x:Wellness|null):string|null{
 if(!x)return null
 if(x.bodyBattery!==undefined&&x.bodyBattery<30)return 'Body Battery niedrig: heute die Intensität und das Kraft-Beinvolumen besonders kritisch prüfen.'
 if(x.sleepHours!==undefined&&x.sleepHours<6)return 'Kurzer Schlaf: Belastung heute nach Tagesform reduzieren; keine neue harte Einheit erzwingen.'
 if(x.bodyBattery!==undefined&&x.bodyBattery>=65)return 'Body Battery hoch: guter Erholungsindikator, aber dein eigener TEMPO-Check-in bleibt maßgeblich.'
 return x.hrvMs!==undefined||x.sleepHours!==undefined||x.bodyBattery!==undefined?'Garmin-Erholungswerte liegen vor. Nutze sie ergänzend zu deiner eigenen Tagesform.':null
}
