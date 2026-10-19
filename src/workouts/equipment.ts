import type {TempoRecord} from '../db/types'
import type {StrengthPlace} from '../stats/activity'
export const EQUIPMENT_SETTINGS_ID='strength-equipment:local-primary-profile'
export type EquipmentPreferences=TempoRecord & {favourites?:Record<StrengthPlace,Record<string,string>>}
export const placeName:Record<StrengthPlace,string>={studio:'Fitnessstudio',arbeit:'Auf Arbeit'}
/** Exercise group ids stay stable across substitutions, so progression is comparable.
 * The variant actually used is saved with every set. No machine is assumed at work. */
const equipment:Record<string,Record<StrengthPlace,string[]>>={
 squat:{studio:['Langhantel-Kniebeuge','Goblet Squat (Kurzhantel)','Front Squat'],arbeit:['Goblet Squat (Kurzhantel)','Kniebeuge mit Körpergewicht','Split Squat']},
 rdl:{studio:['Rumänisches Kreuzheben (Langhantel)','Rumänisches Kreuzheben (Kurzhanteln)'],arbeit:['Rumänisches Kreuzheben (Kurzhanteln)','Einbeiniger RDL (Kurzhantel)']},
 row:{studio:['Kurzhantelrudern','Kabelrudern','Brustgestütztes Rudern'],arbeit:['Kurzhantelrudern','Rudern mit Widerstandsband','Inverted Row']},
 incline:{studio:['Schrägbank-Kurzhanteldrücken','Brustpresse (neutraler Griff)','Liegestütze'],arbeit:['Liegestütze','Kurzhantel-Floor-Press','Neutraler Kurzhantel-Druck']},
 copenhagen:{studio:['Copenhagen Plank (kurzer Hebel)','Copenhagen Plank mit Bank'],arbeit:['Copenhagen Plank (kurzer Hebel)','Adduktor-Seitenstütz']},
 'side-abd':{studio:['Seitliches Beinheben','Abduktion mit Miniband'],arbeit:['Seitliches Beinheben','Abduktion mit Miniband']},
 'wall-slide':{studio:['Wall Slides','Face Pull mit Seil','Außenrotation mit Band'],arbeit:['Wall Slides','Außenrotation mit Band','Schulterblatt-Retraktion']},
 'step-up':{studio:['Step-ups auf Box','Bulgarian Split Squat','Step-ups mit Kurzhanteln'],arbeit:['Step-ups auf stabile Stufe','Ausfallschritte','Step-ups mit Kurzhanteln']},
 'hip-thrust':{studio:['Hip Thrust (Langhantel)','Glute Bridge','Hip Thrust an Bank'],arbeit:['Glute Bridge','Einbeinige Glute Bridge','Hip Thrust mit Kurzhantel']},
 pull:{studio:['Klimmzüge','Latzug','Unterstützte Klimmzüge'],arbeit:['Klimmzüge (falls möglich)','Bandrudern','Einarmiges Kurzhantelrudern']},
 pushup:{studio:['Liegestütze','Neutrales Kurzhanteldrücken','Brustpresse (neutral)'],arbeit:['Liegestütze','Kurzhantel-Floor-Press','Erhöhte Liegestütze']},
 cossack:{studio:['Cossack Squat','Seitlicher Ausfallschritt'],arbeit:['Cossack Squat','Seitlicher Ausfallschritt']},
 'side-plank-lift':{studio:['Side Plank mit Beinheben','Seitliches Beinheben'],arbeit:['Side Plank mit Beinheben','Seitliches Beinheben']},
 'c-bench':{studio:['Langhantelbankdrücken','Kurzhantelbankdrücken','Brustpresse'],arbeit:['Kurzhantel-Floor-Press','Liegestütze','Kurzhantelbankdrücken']},
 'c-incline':{studio:['Schrägbank-Kurzhanteldrücken','Schrägbank-Multipresse'],arbeit:['Schrägbank-Kurzhanteldrücken','Erhöhte Liegestütze']},
 'c-pull':{studio:['Klimmzüge','Latzug','Assistierte Klimmzüge'],arbeit:['Klimmzüge','Rudern am Band']},
 'c-row':{studio:['Brustgestütztes Rudern','Rudermaschine'],arbeit:['Einarmiges Rudern mit Brustauflage','Bandrudern']},
 'c-biceps':{studio:['Kurzhantelcurls','Kabelcurls','Scott-Curls'],arbeit:['Kurzhantelcurls','Bandcurls']},
 'c-triceps':{studio:['Trizepsdrücken am Kabel','Überkopf-Trizepsstrecken'],arbeit:['Trizepsstrecken mit Kurzhantel','Trizepsdrücken am Band']},
 'c-lateral':{studio:['Seitheben mit Kurzhanteln','Kabel-Seitheben'],arbeit:['Kurzhantel-Seitheben','Band-Seitheben']},
 'c-reverse':{studio:['Reverse Flys','Face Pulls'],arbeit:['Reverse Flys mit Kurzhanteln','Face Pulls mit Band']},
 'chest-open':{studio:['Türrahmen-Brustdehnung','Brustöffnung an Wand'],arbeit:['Türrahmen-Brustdehnung','Brustöffnung an Wand']},
}
export function exerciseOptions(id:string,place:StrengthPlace,fallback:string):string[]{return equipment[id]?.[place]??[fallback]}
export function selectEquipment(id:string,place:StrengthPlace,fallback:string,prefs:Record<string,string>):string{
 const options=exerciseOptions(id,place,fallback)
 const saved=prefs[id]
 return saved&&options.includes(saved)?saved:options[0]
}
