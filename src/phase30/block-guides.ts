import type {AdaptiveKind,AdaptiveWeek} from '../phase28/adaptive-planner'
export type BlockGuide={bikeSessions:[number,number];runSessions:[number,number];strengthSessions:[number,number];exampleRides:string[];exampleRuns:string[];character:string}
export const GUIDES:Record<AdaptiveKind,BlockGuide>={
 BASE:{bikeSessions:[3,4],runSessions:[1,2],strengthSessions:[2,2],exampleRides:['75–120 Min Z2','Lange Ausfahrt 2–3 h','Optional Tritttechnik 6 × 2 Min'],exampleRuns:['Easy Run 25–40 Min','Optional Lauf-ABC, nach Verträglichkeit'],character:'Aerobe Basis bei Radfokus, Laufverträglichkeit und Kraft A/B erhalten.'},
 STRENGTH:{bikeSessions:[2,4],runSessions:[1,2],strengthSessions:[2,2],exampleRides:['Z2 60–90 Min','Lange ruhige Grundlage 2 h'],exampleRuns:['Easy Run 25–40 Min'],character:'Progressives Krafttraining als Schlüsselreiz; Radgrundlage und Cooper-Laufen bleiben integriert.'},
 MIT:{bikeSessions:[3,4],runSessions:[1,2],strengthSessions:[2,2],exampleRides:['Schwelle 3 × 10 Min','Sweet Spot 2 × 20 Min','Lange Z2-Fahrt'],exampleRuns:['Easy Run 30–45 Min'],character:'Intervallzeit progressiv erhöhen, nicht unnötig zusätzliche harte Einheiten ergänzen.'},
 HIT:{bikeSessions:[3,4],runSessions:[1,2],strengthSessions:[2,2],exampleRides:['VO₂max 4 × 3 Min','Z2 75–120 Min','Lange Grundlage'],exampleRuns:['Easy Run 25–35 Min'],character:'Ein gezielter harter Radreiz, angemessene Erholung und tragfähige Kraft- und Laufroutine.'},
 VOLUME:{bikeSessions:[4,6],runSessions:[1,2],strengthSessions:[2,2],exampleRides:['Z2 2–3 h','Lange Ausfahrt 4–6 h (nur nach Aufbau)','Zusätzliche lockere Radkilometer / Pendeln'],exampleRuns:['Easy Run 20–35 Min'],character:'Mehr Radvolumen und Fueling-Training; schwere Beineinheiten klug platzieren, nicht Krafttraining streichen.'},
 MOUNTAIN:{bikeSessions:[3,5],runSessions:[1,2],strengthSessions:[2,2],exampleRides:['Anstieg 3 × 12 Min','Lange Bergrunde 3–5 h','Pacing & Fueling'],exampleRuns:['Easy Run 25–40 Min'],character:'Anstiegsausdauer, Höhenmeter, Ötztaler-spezifische Belastung.'},
 RUN:{bikeSessions:[3,4],runSessions:[2,3],strengthSessions:[2,2],exampleRides:['Z2 60–120 Min','Kontrollierte Radqualität nach Gesamtbelastung'],exampleRuns:['Cooper-Pace 6 × 400 m (erst nach Basisaufbau)','Easy Run 35–45 Min','Lauf-ABC / Steigerungen'],character:'Cooper-spezifische Laufentwicklung, während Radfahren aerober Hauptumfang bleibt.'},
 RECOVERY:{bikeSessions:[1,3],runSessions:[0,1],strengthSessions:[0,1],exampleRides:['Locker rollen 30–60 Min'],exampleRuns:['Kurzer lockerer Lauf nur nach Befinden'],character:'Geplante Erholung; keine neuen Leistungsreize erzwingen.'},
 TAPER:{bikeSessions:[2,3],runSessions:[0,1],strengthSessions:[0,1],exampleRides:['Kurze Z2 mit Aktivierungen','Wettkampfspezifische Schärfung'],exampleRuns:['Sehr kurz / locker'],character:'Frische erhalten, Ermüdung senken. Keine neue Umfangssteigerung.'},
}
export function estimateWeek(week:AdaptiveWeek,override?:{hours?:number;bikeKm?:number}){
 const guide=GUIDES[week.kind]
 const defaultHours=week.hoursRange?Math.round(((week.hoursRange[0]+week.hoursRange[1])/2)*2)/2:week.kind==='VOLUME'||week.kind==='MOUNTAIN'?8:week.kind==='RECOVERY'||week.kind==='TAPER'?4:6
 const hours=override?.hours??(week.deload?Math.round(defaultHours*.75*2)/2:defaultHours)
 const bikeHours=Math.max(1,hours-(guide.runSessions[0]*.5)-(guide.strengthSessions[0]*.8))
 const bikeKm=override?.bikeKm??Math.round(bikeHours*24/5)*5
 const runMin=guide.runSessions[0]*30
 return {hours,bikeKm,bikeHours:Math.round(bikeHours*10)/10,runMin,guide,fromHistory:!!week.hoursRange,manual:override?.hours!==undefined||override?.bikeKm!==undefined}
}
