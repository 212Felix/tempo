/** Phase 40B – bewusst kleine sportartspezifische Übungsauswahl, keine umfassende Bibliothek. */
import type {Exercise} from './catalog'
export type SportFocus='Radfahren'|'Laufen'|'Explosivkraft'|'Rumpfstabilität'
export const SPORT_EXERCISES:ReadonlyArray<Exercise&{focus:SportFocus}>= [
 {id:'sport-split-squat',name:'Bulgarian Split Squat',focus:'Radfahren',sets:2,reps:'6–8 je Bein',restSec:105,unilateral:true,cue:'Einbeinig / unilateral. Becken waagerecht halten, kontrolliert absenken; erst Stabilität, dann Gewicht.'},
 {id:'sport-hexbar',name:'Hexbar-Kreuzheben',focus:'Radfahren',sets:2,reps:'4–6',restSec:150,cue:'Neutraler Rücken; schwere Sätze nicht am Tag vor der langen Radfahrt.'},
 {id:'sport-soleus',name:'Soleus-Wadenheben',focus:'Laufen',sets:2,reps:'12–15',restSec:60,cue:'Mit gebeugtem Knie, langsam auf- und absenken; Sehnenreaktion beachten.'},
 {id:'sport-step-up',name:'Step-up unilateral',focus:'Radfahren',sets:2,reps:'6–8 je Bein',restSec:90,unilateral:true,cue:'Über das Standbein aufsteigen, ohne mit dem hinteren Bein abzustoßen.'},
 {id:'sport-single-rdl',name:'Einbeiniger RDL',focus:'Laufen',sets:2,reps:'6–8 je Seite',restSec:90,unilateral:true,cue:'Hüfte stabil und Knie leicht gebeugt, Bewegung aus dem Hüftgelenk.'},
 {id:'sport-nordic',name:'Nordic Hamstring',focus:'Laufen',sets:2,reps:'3–5',restSec:135,cue:'Nur kontrollierte exzentrische Ausführung mit Sicherung; langsam steigern.'},
 {id:'sport-calf',name:'Wadenheben stehend',focus:'Laufen',sets:3,reps:'8–12',restSec:75,cue:'Volle kontrollierte Bewegungsamplitude, schrittweise Belastungssteigerung.'},
 {id:'sport-copenhagen',name:'Copenhagen Plank',focus:'Laufen',sets:2,reps:'15–25 s je Seite',restSec:65,hold:true,unilateral:true,cue:'Kurzer Hebel zum Einstieg, Adduktoren nicht direkt vor intensiven Läufen ermüden.'},
 {id:'sport-clean',name:'Power Clean (Technik)',focus:'Explosivkraft',sets:3,reps:'2–3',restSec:150,cue:'Technisch anspruchsvoll: nur bei erlernter Hebetechnik, moderat und ausgeruht.'},
 {id:'sport-pushpress',name:'Clean & Push Press',focus:'Explosivkraft',sets:3,reps:'2–4',restSec:150,cue:'Nur bei sicherer Technik; explosiv aber nicht bis zum Muskelversagen.'},
 {id:'sport-hop',name:'Niedrige Sprungserie',focus:'Explosivkraft',sets:2,reps:'4–6',restSec:105,cue:'Wenige saubere Landungen, ausreichend Pause; bei Achillessehnenbeschwerden auslassen.'},
 {id:'sport-abwheel',name:'Ab Wheel',focus:'Rumpfstabilität',sets:2,reps:'6–10',restSec:70,cue:'Bauch fest, Rippen kontrolliert, nur so weit rollen wie ohne Hohlkreuz möglich.'},
 {id:'sport-pallof',name:'Pallof Press',focus:'Rumpfstabilität',sets:2,reps:'8–12 je Seite',restSec:60,unilateral:true,cue:'Anti-Rotation; Hüfte und Brustkorb ruhig, Widerstand kontrollieren.'},
 {id:'sport-plank-ball',name:'Pezziball-Plank',focus:'Rumpfstabilität',sets:2,reps:'20–40 s',restSec:60,hold:true,cue:'Rumpfspannung halten, kein Durchhängen.'},
 {id:'sport-side-plank',name:'Seitstütz',focus:'Rumpfstabilität',sets:2,reps:'20–35 s je Seite',restSec:60,unilateral:true,hold:true,cue:'Becken stabil, Schulter nicht einsinken lassen.'},
 {id:'sport-ghd',name:'GHD Sit-up (verkürzt)',focus:'Rumpfstabilität',sets:2,reps:'6–8',restSec:75,cue:'Nur bei geübter Ausführung; kontrollierte Teilbewegung ohne Schwung.'},
]
export const SPORT_FOCI:SportFocus[]=['Radfahren','Laufen','Explosivkraft','Rumpfstabilität']
export function exercisePool(exercises:ReadonlyArray<Exercise>):Exercise[]{
 const known=new Set<string>()
 return [...exercises,...SPORT_EXERCISES].filter(ex=>{if(known.has(ex.id))return false;known.add(ex.id);return true})
}
export function validSessionExercises(raw:unknown):raw is Exercise[]{
 return Array.isArray(raw)&&raw.length>0&&raw.length<=30&&new Set(raw.map(ex=>ex?.id)).size===raw.length&&raw.every(ex=>ex&&typeof ex==='object'&&typeof ex.id==='string'&&ex.id.length<80&&typeof ex.name==='string'&&ex.name.length<130&&Number.isInteger(ex.sets)&&ex.sets>=1&&ex.sets<=6&&typeof ex.reps==='string'&&typeof ex.cue==='string'&&Number.isFinite(ex.restSec)&&ex.restSec>=0&&ex.restSec<=360)
}
