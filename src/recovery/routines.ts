export type RecoveryFocus = 'full'|'hip'|'legs'|'shoulders'
export type Movement = {name:string;instructions:string}
export type RoutineStep = Movement & {seconds:number;kind:'movement'|'transition'}
export const focusLabels:Record<RecoveryFocus,string>={full:'Ganzkörper',hip:'Hüfte & BWS',legs:'Beine',shoulders:'Schulter & Brustöffnung'}
const moves:Record<RecoveryFocus,Movement[]>={
 full:[
  {name:'Ruhig atmen & ankommen',instructions:'Ruhig durch die Nase einatmen, länger ausatmen. Nacken und Kiefer locker lassen.'},
  {name:'Katze–Kuh',instructions:'Im Vierfüßlerstand Wirbelsäule langsam runden und strecken, ohne ins Hohlkreuz zu drücken.'},
  {name:'90/90-Hüftwechsel',instructions:'Im Sitzen die Knie entspannt zur Seite bewegen. Hände dürfen abstützen.'},
  {name:'Brustwirbelsäule rotieren',instructions:'In Seitenlage oberen Arm langsam aufdrehen; Becken bleibt ruhig. Nach der Hälfte Seite wechseln.'},
  {name:'Sprunggelenke mobilisieren',instructions:'Im Ausfallschritt Knie langsam nach vorn über den Fuß bewegen, Ferse bleibt am Boden.'},
  {name:'Gesäßbrücke',instructions:'Becken kontrolliert heben und absenken; kein Schwung, ruhig atmen.'},
  {name:'Schulterblätter aktivieren',instructions:'Schulterblätter langsam nach hinten-unten ziehen und wieder lösen, ohne Schmerzen.'},
 ],
 hip:[
  {name:'Ruhige Bauchatmung',instructions:'Im Liegen ruhig ausatmen und den unteren Rücken entspannen.'},
  {name:'90/90-Hüftrotationen',instructions:'Knie langsam links-rechts kippen. Nur so weit, wie die Hüfte angenehm mitmacht.'},
  {name:'Hüftbeuger sanft dehnen',instructions:'Halb kniend Becken leicht nach hinten kippen und nach vorn verschieben. Seite wechseln.'},
  {name:'Brustwirbelsäule aufdrehen',instructions:'Seitenlage, oberes Knie abgestützt. Oberkörper ohne Zug langsam rotieren.'},
  {name:'Dead Bug leicht',instructions:'Rückenlage, Bauchspannung halten, je einen Fuß kontrolliert absetzen.'},
  {name:'Kindhaltung mit seitlicher Reichweite',instructions:'Gesäß Richtung Fersen, Hände locker nach vorn. Schultern schmerzfrei bewegen.'},
 ],
 legs:[
  {name:'Fuß- und Sprunggelenkkreise',instructions:'Beide Seiten langsam kreisen und die Zehen bewegen.'},
  {name:'Waden mobilisieren',instructions:'Mit Händen an der Wand Wade sanft dehnen, Ferse am Boden. Seite wechseln.'},
  {name:'Knie-zur-Wand Mobilität',instructions:'Knie kontrolliert nach vorn bewegen; Ferse bleibt am Boden.'},
  {name:'Beinrückseite sanft bewegen',instructions:'In Rückenlage ein Bein anheben und Knie vorsichtig beugen/strecken, ohne zu ziehen.'},
  {name:'90/90-Hüfte',instructions:'Beide Sitzknochen möglichst entspannt belasten, Seiten ruhig wechseln.'},
  {name:'Gesäßbrücke leicht',instructions:'Langsam aufrollen und wieder absenken. Keine Ermüdung anstreben.'},
  {name:'Locker ausschütteln',instructions:'Im Stand Gewicht verlagern, Beine lockern, tief ausatmen.'},
 ],
 shoulders:[
  {name:'Schulter locker atmen',instructions:'Schultern mit jeder Ausatmung bewusst sinken lassen.'},
  {name:'Brustwirbelsäulen-Rotation',instructions:'In Seitenlage sanft aufdrehen, Arme nur im schmerzfreien Bereich bewegen.'},
  {name:'Schulterblattkreisen',instructions:'Schulterblätter nach oben, hinten, unten und vorn bewegen – ohne Gewalt.'},
  {name:'Brustöffnung im Türrahmen',instructions:'Unterarm niedrig am Türrahmen platzieren und Oberkörper sanft aufdrehen. Kein Schulterschmerz.'},
  {name:'Außenrotation ohne Last',instructions:'Ellbogen am Körper halten und Unterarme langsam nach außen drehen.'},
  {name:'Wall Slides schmerzfrei',instructions:'Unterarme an die Wand, vorsichtig nach oben gleiten – nur bis zur angenehmen Höhe.'},
  {name:'Rücken entspannen',instructions:'Locker sitzen oder stehen, ruhige Atmung, Schultergürtel lösen.'},
 ],
}
/** Every minute is 50 s movement + 10 s transition; last movement takes full 60 s. */
export function buildRoutine(focus:RecoveryFocus,minutes:5|10|15|20):RoutineStep[] {
 const entries=moves[focus],result:RoutineStep[]=[]
 for(let i=0;i<minutes;i++){
   const m=entries[i%entries.length]
   result.push({...m,seconds:i===minutes-1?60:50,kind:'movement'})
   if(i!==minutes-1)result.push({name:'Übung wechseln',instructions:'Position ruhig lösen, nächste Übung vorbereiten.',seconds:10,kind:'transition'})
 }
 return result
}
export function routineAt(steps:RoutineStep[],elapsed:number):{index:number;remaining:number;step:RoutineStep}|null{
 let s=0
 for(let i=0;i<steps.length;i++) { const x=steps[i];if(elapsed<s+x.seconds)return{index:i,step:x,remaining:Math.max(0,s+x.seconds-elapsed)};s+=x.seconds }
 return null
}
