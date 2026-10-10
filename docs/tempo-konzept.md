# TEMPO – fachliche Entscheidungen (Arbeitsstand)

## Grundprinzip
- **Neutraler App-Code:** frei konfigurierbares Benutzerprofil, Prioritäten und Ziele. Keine personenbezogenen Werte im Programmcode.
- **Local first:** später IndexedDB als lokale Datenbank; Export/Import als JSON. Kein Account/Server für V1 nötig.
- **Planungslogik:** Event/Challenge → Periodisierung → Trainingsreize → Dienst/Verfügbarkeit → bisherige Belastung → 14-Tage-Plan → Readiness → tatsächliche Einheit → Feedback → Neuplanung.
- Readiness und Dienststatus sind **verschiedene** Faktoren.
- Keine starre Wochentagsplanung; rollierende 14 Tage. Training in MUSS / SOLL / KANN priorisieren. Absagen sinnvoll verschieben, nicht blind nachholen.
- Eingaben in Blasen/Buttons, wo möglich; Apple-inspiriert, nicht identisch; dunkles Graphit/Titan, sparsame Statusfarben.

## Navigation
Schnellzugriff: Readiness, Training, 14 Tage, Fortschritt. Menü: Startseite, Tagestraining, 14-Tage-Plan, Fueling & Trinken, Recovery & Mobility, Krafttraining, Fortschritt, Leistungswerte, Blockübersicht, Ziele & Events, Strecken & Challenges, Profil & Daten.

## Readiness
5 Felder 1–5: Schlafqualität, Energie/Erholung (positiv); Stress, Müdigkeit, Beinempfinden/Schwere (negativ). Krankheit/Auffälligkeit, optionale Notiz. Ergebnisaussage Grün/Gelb/Rot **mit Begründung**, nicht primär Score. Garmin-Kennzahlen später ergänzend, nicht einzeln entscheidend.

## Dienst
- Frei: Zeit grundsätzlich verfügbar.
- Tagdienst: Kraft/Laufen auf Arbeit, Radpendeln oder Rad nach Dienst (Indoor/Zwift oder draußen) möglich.
- Einsatz: möglichst Recovery/Pause, häufig frühe Starts.
- Wochenenden standardmäßig Frei als **unbestätigter Vorschlag**, jederzeit überschreibbar; Werktage ohne Eingabe = Offen.
- Radpendeln mit **profilabhängiger Distanz je Strecke** und berechneter Hin-und-Rückfahrt. Hinfahrt tendenziell locker, Heimfahrt bevorzugt für strukturierte Abschnitte, wenn Verkehr, Licht und Bedingungen geeignet. Bei 96 km kein automatisches zusätzliches Workout.

## Training
- Tageskarte mit Sport, MUSS/SOLL/KANN, Dauer, Workout-Code, Ziel, schrittweisem Ablauf.
- Rad Watt aus FTP%; Lauf von Beginn an Ziel-Herzfrequenz, Pace/Intervall nicht relevant wenn keine Qualität. Keine pauschalen Pace-Vorgaben beim Lauf-Wiedereinstieg.
- Alternativen bei Zeitmangel, Müdigkeit, schweren Beinen, fehlender Ausrüstung.
- IST/PLAN getrennt, Garmin-Daten später der Einheit zuordnen.
- Abschluss: RPE 1–10, Gefühl, erledigt/nicht erledigt mit Grund.

## Kraft
- 2 Ganzkörpertage als Grundlage; Beine/Core betont, aber Brust/Rücken/Schultergesundheit enthalten; keine schwere klassische Overhead-Press als Standard.
- Satzweise Gewicht und Wiederholungen; Grün = steigern dürfen, Gelb = halten, Rot = reduzieren; Änderungen als Vorschlag, nicht heimlich.
- Adduktoren/Abduktoren ohne Geräte: Copenhagen Plank, Cossack Squat, Lateral Step-Down (Box), Side Plank mit Beinheben. Anpassbar nach Verträglichkeit und aktuellem Leistungsstand.
- Schriftliche Satzpausen, **kein Timer und kein Ton** beim Krafttraining. Dezente Übungsbilder/Animationen.
- Brustöffnung/vordere Schulter sowie Außenrotation/Schulterblattkontrolle berücksichtigen.

## Recovery & Mobility
- Zeit 5/10/15/20 Min; Fokus Ganzkörper, Hüfte/BWS, Beine, Schulter/Brustöffnung.
- Bekannte Yoga/Mobility-Übungen mit passender Illustration.
- Übung über Countdown; Bild hinter Zeitanzeige; nächste Übung darunter. 10s Positionswechsel mit „PAUSE“-Hintergrund. Töne 3/2/1 vor Start und Ende; verschiedene Start-/Endsignale.
- Feedback Grün besser, Gelb gleich, Rot schlechter.

## Fueling & Trinken
- Personalisierte Kohlenhydrat- und Flüssigkeitsplanung je Einheit. Schweißrate aus Startgewicht - Endgewicht + getrunken - Urin; Messbedingungen speichern. Nicht automatisch vollständigen Schweißverlust ersetzen.
- Natriumprofil zunächst „unbekannt“, keine Konzentration aus Schweißmenge ableiten.
- Nach Einheit KH, Getränk, Elektrolyte, Körpergewicht, Verträglichkeit Grün/Gelb/Rot (keine, leichte, deutliche Beschwerden). **Am Folgetag nachträglich bearbeitbar.** Produkt-/Gel-Datenbank später.

## Ziele, Routen und Challenges
- Fixes Event, Event unter Vorbehalt (Los/Urlaub), persönliche Challenge mit flexiblem Zeitfenster.
- Eventanzeige auf Startseite sehr **klein**: nächstes Event, Tage, aktueller Trainingsabschnitt; Dropdown: Eventname – Resttage.
- Route mit km, hm, Sport/Untergrund, Ziel-Dauer, Intensität, optional GPX/Quelle.
- Challenge zählt als Trainingsreiz und ersetzt lange/elevationsreiche Einheiten. Entlastung davor und Erholung danach; Ausprägung abhängig von Belastung, Priorität, tatsächlicher Readiness und Diensten. Keine fixes „immer X Tage“.
- Mehrtägiger Trainingsurlaub als Belastungsblock mit persönlicher Abschluss-Challenge nach reduzierter Vorbelastung/Ruhetag; Termin flexibel.

## Kalender, Fortschritt, Auswertung
- 14-Tage-Dienstvorausschau; offene Dienste gelbliche Ganzfeld-Hintergründe, bestätigt/eingetragen grün (getrennt von Trainingsstatus). Vollflächige Kalenderstatusfarben für Trainingserfüllung und ggf. nicht erledigte Einheiten. Geplante Ruhetage neutral.
- Trainingsblockübersicht als eigene Menüseite und kompakter Teaser unter 14-Tage-Plan.
- Verlauf: FTP, W/kg, VO2max, Laufpace bei vergleichbarer HF, 5-km-/Cooper-Tests, Kraft, Trainingszeit, km, Höhenmeter, Gewichts-7-Tage-Schnitt. Keine erfundenen Leistungswerte.
- Leistungsbibliothek: Rad FTP%↔Watt, Lauf HF/Pace, Kraft 1RM/Prozentübersichten.

## Roadmap
1. Design und Navigation (aktuelle Version)
2. Datenmodell + IndexedDB + Export/Import
3. Profile + Dienst + Ziele/Routen/Blöcke
4. regelbasierte Planungslogik + Tests
5. Seiten/Feedback/Workouts
6. PWA/Offline/Deployment
7. Garmin-Datenimport (Dateien, später mögliche autorisierte Schnittstelle)
