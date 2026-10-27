# TEMPO Phase 40D – Release- und Prüfanleitung

Basis: erfolgreicher Stand Phase 40C. Keine neue Datenbankversion, keine Änderung der vorhandenen Schlüssel oder Secrets, keine automatische Löschung oder Überschreibung von Trainingshistorie. Trainer-/Mehrbenutzerfunktionen und das Senden von TEMPO-Trainings an Garmin sind **nicht** Teil dieses Updates.

## Neue Funktionen

1. Watt-Zeit-Profile direkt in den jeweiligen Radtrainingskarten und Pace-Zeit-Profile in Lauftrainingskarten. Balkenbreite = Dauer; Farben = Trainingsphase. Fehlende Leistungswerte werden nicht geschätzt. Die generierten individuellen Einheiten besitzen explizite Trainingsphasen.
2. Flüssigeres Wischen durch eine primär auf vier Hauptseiten beschränkte, geschwindigkeitsabhängige Touch-Navigation. Scrollen und aktive Eingabeelemente sollen nicht umgeleitet werden.
3. Automatischer Garmin-Pull: der private Worker wird auf einen 15-Minuten-Cron umgestellt; während einer auf dem iPhone authentifizierten und sichtbaren App-Sitzung erfolgt ein Abgleich ungefähr alle zwei Minuten und bei Wiederanzeige. Eindeutig neue Aktivitäten werden übernommen; mögliche Dubletten brauchen weiterhin menschliche Prüfung. Bei passenden neu importierten Aktivitäten werden eindeutig zuordenbare Trainingseinträge nur verlinkt, nicht auf „erledigt“ gesetzt oder überschrieben. Ein geschützter Endpunkt erlaubt das optionale Herunterladen echter FIT-Messreihen und deren Ablage in performanceEntries; FIT-ZIP-Dekompression hängt von der Browserunterstützung ab. Manuelle FIT-Einfuhr bleibt möglich.
4. Garmin-Schlaf, HRV, Body Battery werden für verfügbare Tage automatisiert geprüft und lokal auf diesem Gerät in settings gespeichert. Readiness: bei tatsächlichem Garmin-Schlafwert entfällt die manuelle Schlaf-Frage, bei vorhandenem Body-Battery-Wert oder ausreichender persönlicher HRV-Vergleichsbasis kann die generelle Erholungsfrage entfallen. Stress, subjektive Müdigkeit, Beinempfindlichkeit und Krankheit werden weiterhin abgefragt. Fehlende Garmin-Werte werden nicht geschätzt; die Originalmesswerte bleiben separat einsehbar.
5. Individuelles Wunschtraining auf Abruf für Rennrad und Laufen: Reiz (Z2, Schwelle, VO₂max, Sprint), Dauer und Datum auswählen. Intensitätsbereiche beruhen auf den gespeicherten Leistungswerten, soweit vorhanden; niemals auf einem zukünftigen Wettkampfziel. Regeneration, hochintensive Vorbelastung, Dienste, Trainingsblöcke und Ruhetage wirken als Begrenzung. Der Kalender zeigt eine **vorherige Bestätigungsstufe**. Ausschließlich ungesperrte automatisch erzeugte Einheiten dürfen nach expliziter Zustimmung verschoben werden. Direktstart führt zum vorhandenen Workout-Detail.

## Wichtige Grenzen und Datenschutz

- Garmin Personal API ist Pull-basiert; eine sekundengenaue Übernahme unmittelbar nach dem Speichern auf Garmin ist nicht garantiert.
- Cloudflare lädt Aktivitäten und zwei aktuelle Gesundheitstage auf dem Server; das iPhone ist eine lokale IndexedDB-Anwendung. Ohne geöffnete und angemeldete App findet **keine garantierte lokale Übernahme** statt. Der private TEMPO-Brückencode wird ausschließlich während der Sitzung im Arbeitsspeicher vorgehalten. Nach einem Reload muss er neu eingegeben werden.
- FIT-Detaildownload kann auf Geräten ohne `DecompressionStream('deflate-raw')` scheitern. Dann bleibt der Aktivitätsüberblick erhalten; bei Bedarf FIT manuell in TEMPO importieren. GPS/Höhen-/Puls-/Watt-Reihen gibt es nur, wenn Garmin und das aufzeichnende Gerät sie bereitstellen.
- TEMPO Readiness ist eine Trainingsentscheidungshilfe, kein medizinischer Diagnosewert. HRV benötigt mindestens fünf früher aufgezeichnete Vergleichstage.
- Die automatische Zuordnung geplanter Garmin-Aktivitäten ist informativ; sie darf abgeschlossene/gesperrte/selbst veränderte Trainings nicht überschreiben. Unklare Zuordnungen bleiben bei „Zur Prüfung“.
- Die über Garmin gespeicherten personenbezogenen Gesundheitsdaten verbleiben zusätzlich zur privaten Cloudflare-D1 in der **lokalen IndexedDB** des iPhones. Keine Daten ohne ausdrückliche Zustimmung an Trainer/Kunden weitergeben.

## Tests und Veröffentlichung

1. Vorhandene TEMPO-Daten auf dem iPhone über „Profil & Daten / Datenbank“ als JSON sichern; im GitHub-Repository **keine** privaten Backups, FIT-Dateien oder Zugangsdaten speichern.
2. GitHub Desktop: aktuellen `main` abrufen (Fetch/Pull), Branch `phase40d-test` anlegen. Entpacktes Änderungs-ZIP in den lokalen Repo-Ordner kopieren. Nur die Quellcodeänderungen committen und Branch veröffentlichen.
3. GitHub Actions „TEMPO Phase 40D – Prüfung“ abwarten: `npm run verify` umfasst Sicherheitsprüfung, alle Logiktests und den echten `tsc -b && vite build`; Worker-Syntaxcheck. Erst nach grünem Workflow Pull Request nach `main` mergen und GitHub Pages „TEMPO veröffentlichen“ auf `main` grün prüfen.
4. **Garmin Worker separat** aus `main` via GitHub Actions „TEMPO Phase 39 – Garmin Worker (privat)“ → `Run workflow` bereitstellen, grüne Prüfung abwarten. Erhält vorhandene Worker-Secrets und D1-Daten. Bei Deployfehler bleibt der bisherige Garmin-Dienst aktiv, die neuen Endpunkte fehlen aber.
5. iPhone: TEMPO aktualisieren, neue Trainingscharts und Wischgesten testen, Wunschtraining erst an einem konfliktfreien Termin speichern. Garmin-Verbindungsstatus mit separatem privatem TEMPO-Zugangscode erneut aufrufen; keine privaten Schlüssel in GitHub/Chat teilen. Schlaf/HRV/Body Battery nur als „verfügbar“ erwarten, falls Garmin tatsächlich Messwerte liefert. Deduplizierung und FIT-Detaildownload bei einer realen Aktivität testen.

## Prüfung in der vorbereitenden Umgebung

160/160 Logiktests erfolgreich, Sicherheitsprüfung erfolgreich, Worker-JavaScript syntaktisch gültig. Ein vollständiger Vite-Produktions-Build konnte hier mangels Zugang zur npm-Paketquelle nicht ausgeführt werden und **muss auf GitHub Actions grün** sein, bevor `main` aktualisiert wird. Dies ist noch kein echter iPhone-/Garmin-Ende-zu-Ende-Test.
