/** Portable, user-neutral starter sessions. Training is always adjustable to readiness. */
export type Exercise = {
  id: string
  name: string
  sets: number
  reps: string
  restSec: number
  cue: string
  unilateral?: boolean
  hold?: boolean
  optional?: boolean
}
export type StrengthTemplate = {key:'A'|'B'|'C';title:string;focus:string;warmup:string;exercises:Exercise[]}

export const STRENGTH:Record<'A'|'B'|'C',StrengthTemplate> = {
  A: {key:'A',title:'Kraft A · Ganzkörper',focus:'Knie/Hüfte, Zug, Druck, Adduktoren und Schulter',warmup:'8–10 Minuten: lockere Bewegung, Hüftmobilität, Schulterkreisen, 2 leichte Vorbereitungssätze.',exercises:[
    {id:'squat',name:'Kniebeuge / Goblet Squat',sets:3,reps:'5–6',restSec:150,cue:'Kontrolliert absenken, Rumpf fest. Etwa 2–3 Wiederholungen in Reserve.'},
    {id:'rdl',name:'Rumänisches Kreuzheben',sets:3,reps:'6–8',restSec:150,cue:'Hüfte nach hinten, Rücken neutral. Keine erzwungenen Maximalgewichte.'},
    {id:'row',name:'Rudern mit Kurzhanteln',sets:3,reps:'8–10',restSec:100,cue:'Schulterblätter kontrollieren, kein Schwung.'},
    {id:'incline',name:'Schrägbank-Kurzhanteldrücken',sets:3,reps:'8–10',restSec:100,cue:'Nur schmerzfrei, keine starke Schulterüberstreckung; bei Beschwerden Liegestütze.'},
    {id:'copenhagen',name:'Copenhagen Plank (kurzer Hebel)',sets:2,reps:'15–25 s je Seite',restSec:60,cue:'Oberes Knie auf niedriger Box/Bank, Hüfte stabil. Kurz beginnen und langsam steigern.',unilateral:true,hold:true},
    {id:'side-abd',name:'Seitliches Beinheben in Seitenlage',sets:2,reps:'12–15 je Seite',restSec:50,cue:'Ohne Gerät. Oberes Bein langsam anheben, Becken ruhig halten.',unilateral:true},
    {id:'wall-slide',name:'Wall Slides / Brustöffnung',sets:2,reps:'8–12',restSec:45,cue:'Rücken an der Wand, schmerzfreier Schulterbogen. Danach sanfte Brustdehnung.'},
  ]},
  B: {key:'B',title:'Kraft B · Ganzkörper',focus:'Unilaterale Beine, Hüfte, Oberkörper, Abduktoren und Adduktoren',warmup:'8–10 Minuten: leichtes Rad oder Gehen, Hüfte, Sprunggelenke und Brustwirbelsäule mobilisieren.',exercises:[
    {id:'step-up',name:'Step-ups auf stabile Box',sets:3,reps:'6–8 je Bein',restSec:120,cue:'Niedrige stabile Box, über Standbein arbeiten, kontrolliert absteigen.',unilateral:true},
    {id:'hip-thrust',name:'Hip Thrust / Glute Bridge',sets:3,reps:'8–10',restSec:120,cue:'Gesäß aktiv, Becken nicht ins Hohlkreuz überstrecken.'},
    {id:'pull',name:'Klimmzug / unterstützter Klimmzug',sets:3,reps:'5–8',restSec:110,cue:'Nur schmerzfrei; alternativ Kurzhantelrudern.'},
    {id:'pushup',name:'Liegestütz / neutraler Kurzhantel-Druck',sets:3,reps:'8–12',restSec:90,cue:'Ellbogen in angenehmem Winkel, Schulter darf nicht schmerzen.'},
    {id:'cossack',name:'Cossack Squat',sets:2,reps:'6–8 je Seite',restSec:75,cue:'Breiter Seit-Ausfallschritt, nur so tief wie kontrolliert möglich. Adduktoren langsam aufbauen.',unilateral:true},
    {id:'side-plank-lift',name:'Side Plank mit oberem Beinheben',sets:2,reps:'6–10 je Seite',restSec:65,cue:'Seitstütz stabil halten und oberes Bein langsam heben. Alternative: Seitenlage-Beinheben.',unilateral:true},
    {id:'chest-open',name:'Brust-/vordere Schulteröffnung',sets:2,reps:'25–35 s je Seite',restSec:40,cue:'Türrahmen-Stretch ohne schmerzhaftes Ziehen; Schulter sanft bewegen.',unilateral:true,hold:true},
  ]},
  C: {key:'C',title:'Kraft C · Oberkörper',focus:'2 × Brust, 2 × Rücken, Bizeps, Trizeps, 2 × Schultern · ohne direkte Bein-Arbeitssätze',warmup:'8 Minuten Schultermobilität, leichtes Aufwärmen, 2 Vorbereitungssätze vor den großen Übungen.',exercises:[
    {id:'c-bench',name:'Flachbankdrücken',sets:3,reps:'6–10',restSec:120,cue:'Sauberer Bewegungsumfang, 1–3 Wiederholungen in Reserve.'},
    {id:'c-incline',name:'Schrägbank-Kurzhanteldrücken',sets:3,reps:'8–12',restSec:100,cue:'Schulterkontrolliert drücken, Brust gezielt belasten.'},
    {id:'c-pull',name:'Klimmzug / Latzug',sets:3,reps:'6–10',restSec:120,cue:'Volle Rumpfspannung, kontrollierte Schulterblattbewegung.'},
    {id:'c-row',name:'Brustgestütztes Rudern',sets:3,reps:'8–12',restSec:100,cue:'Brust abgestützt, keine zusätzliche Bein-/Rumpfermüdung durch stehendes Rudern.'},
    {id:'c-biceps',name:'Bizepscurls',sets:2,reps:'8–12',restSec:75,cue:'Kontrollierte Ellbogenposition, kein Schwung.'},
    {id:'c-triceps',name:'Trizepsdrücken am Kabel',sets:2,reps:'10–15',restSec:75,cue:'Oberarme stabil, Bewegungsumfang schmerzfrei.'},
    {id:'c-lateral',name:'Seitheben',sets:3,reps:'12–20',restSec:65,cue:'Langsam, ohne Schwung und ohne Überstreckung.'},
    {id:'c-reverse',name:'Reverse Flys / Face Pulls',sets:3,reps:'12–20',restSec:65,cue:'Hintere Schulter und Schulterblattkontrolle gezielt belasten.'},
  ]},
}

export const runInstructions = {
  title:'Easy Run · kontrollierter Wiedereinstieg',
  steps:[
    {name:'Einlaufen',detail:'5 Minuten zügiges Gehen, dann sehr locker anlaufen.'},
    {name:'Hauptteil',detail:'20–30 Minuten locker, RPE 3–4/10. Sprechen in ganzen Sätzen möglich; bei Bedarf Gehpausen.'},
    {name:'Auslaufen',detail:'5 Minuten locker traben oder gehen.'},
  ],
  note:'Aktuell keine harten Laufintervalle. Keine Pace erzwingen; zuerst Muskulatur, Sehnen und Laufverträglichkeit aufbauen. Bei Schmerzen stoppen.',
}

export function restLabel(sec:number){return sec>=60?`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')} min`:`${sec} s`}
export function paceLabel(durationMin:number, distanceKm:number):string {
  if (!Number.isFinite(distanceKm)||distanceKm<=0||!Number.isFinite(durationMin)||durationMin<=0)return '–'
  const seconds=Math.round(durationMin*60/distanceKm)
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} min/km`
}
