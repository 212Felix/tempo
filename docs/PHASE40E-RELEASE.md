# TEMPO Phase 40E – Release, Grenzen und Tests

Basis: Phase 40D **inklusive** des nachträglichen TypeScript-Build-Fixes in `src/phase40d/zip-fit.ts`. Dieser Fix ist im Vollprojekt enthalten. Kein neues IndexedDB-Schema, kein neuer Schlüssel, keine automatische Löschung oder Migration alter Datensätze.

## Funktionen

1. Trainingsstatus für Pläne und zugeordnete Abschlüsse: offen, erledigt, teilweise (tatsächliche Dauer <75 % des Plans), ausgefallen, verschoben (`originalPlanDate` aus bestätigter Umplanung), Garmin-Vorschlag noch zu prüfen. Quelle sind unveränderte vorhandene Datensätze.
2. Einheitliche Trainingsdetails auf der Workout-Detailseite und aus der Kalendertagesansicht; auch frei absolvierte Einheiten. Garmin-Aktivitätszusammenfassung, verfügbare FIT-Kurven und privat gezeichnete GPS-Routenskizze. GPS-Daten verlassen den Browser nicht.
3. Interaktives SOLL/IST-Intervallprofil mit echter Zeitachse, veränderbarer Maßeinheit (Rad Watt / % FTP / HF, Lauf Pace / HF), dünn-blassem SOLL und kräftigem IST. Sensor-Lücken bleiben leer, die Balken sind mit Finger und Tastatur auswählbar.
4. Phasengenaue Intervallprüfung aus FIT-Zeitpunkten: Watt in geplanten Wattbereichen; Laufpace aus echten FIT-Distanz-Zeit-Differenzen. Keine künstlichen Puls-SOLL-Werte. Kleine und große Abweichungen werden unterschieden, beide Richtungen.
5. Vorsichtige SOLL/IST-Gesamtbetrachtung (Dauer, bewertbare Phasen, Abweichungen) und Hinweise ohne medizinische Diagnosen und ohne autonome Kalenderänderungen.
6. Sportartkennzeichnung in Kalenderkacheln.
7. Body Battery: private Worker-Antwort differenziert jetzt zwischen Abruffehler, fehlender verwertbarer Messung und vorhandener Messung. Der angefragte Garmin-Endpunkt kann ohne echte private Garmin-Antwort nicht abschließend diagnostiziert werden.
8. Fitness-, Ermüdungs- und Formtendenz aus vereinfachtem radwattbasiertem bzw. laufzeitbasiertem Belastungsproxy; ausdrücklich kein Garmin Training Load, TSS oder medizinische Readiness.
9. Rad-Power-Duration-Kurve aus FIT-Rollmittelwerten und, bei echten 5/20-Minuten-Bestwerten, vorsichtige CP/W′-Zweipunkt-Schätzung.
10. Durability: früher/später gemessene Leistung einer tatsächlichen Radfahrt >= 2 h; Unterschied ist nicht kausal als Ermüdung zu interpretieren.
11. Aerobe Effizienz: Änderung der Leistung/HF oder Geschwindigkeit/HF zwischen erster und zweiter Hälfte; keine validierte HF-Drift bei wechselnder Intensität.
12. Critical Speed ausschließlich auf Basis von zwei ausreichend unterschiedlichen Test-/Wettkampf-Läufen; fehlende Laufdynamik nicht schätzen.
13. Höhenanalyse der gespeicherten FIT-Messreihen und Zugang zur bestehenden Garmin-Anstiegsbibliothek. Vollständige Segment- und Kletter-Vergleiche bleiben mit weiterer GPS-/Höhendatenvalidierung ausbaufähig.

## Daten- und Sicherheitshinweise

- Alle Bestandseinträge bleiben in `tempo-local` und im selben Backup-Schema. Keine Änderung an `src/db/types.ts` DATABASE_VERSION, STORE_NAMES oder Login-Mitteln.
- Kein Verknüpfen nach bloß ähnlichem Datum: Fit-Verlauf nur durch explizit referenzierte `externalActivityId` oder bereits lokal gespeichertes `garmin-match`-Mapping. Bei widersprüchlichen Aktivitäts-IDs wird keine Aktivität ausgewählt.
- Automatische Garmin-Vorschläge sind **kein bestätigter Trainingsabschluss**. FIT-Daten können unvollständig oder zeitlich gegenüber dem Plan verschoben sein. Toleranzmarker sind Trainingstipps, keine objektive Ursache. Keine rückwirkende Änderung des Trainingsziels.
- Trainingseinheiten ohne explizite Watt-/Pace-Ziele erhalten keine erfundenen Grenzwerte. Ohne echte lokale FIT-Datei keine erfundenen IST-Balken. Das Starten eines Laufs aus dem Kalender führt jetzt zur Detailseite; die bestehende Laufen-Rubrik bleibt über die Navigation erreichbar.
- Private Schlüssel und D1-Daten bleiben beim Worker; keine neuen Secrets. Der Worker muss nur dann separat aktualisiert werden, wenn die zusätzlichen Body-Battery-Diagnosestatus genutzt werden sollen.
- Keine Trainer-/Mehrbenutzerfunktionen und kein automatischer Garmin-Workout-Export.

## Release – GitHub Browser oder Desktop

1. Auf dem iPhone TEMPO-JSON-Backup erstellen. **Niemals** in GitHub hochladen.
2. In GitHub `main` abrufen und **vorzugsweise** neuen Zweig `phase40e-test` anlegen. Klein-ZIP lokal entpacken und die enthaltenen geänderten Pfade passend zur Repo-Wurzel hochladen. Für Desktop: die entpackten Inhalte des Ordners `tempo-phase40e-update` ins bereits geklonte `tempo`-Repository kopieren; `.git` bleibt erhalten.
3. Vor `main`: GitHub Actions `TEMPO Phase 40E – Prüfung vor Veröffentlichung` (auf Branch `phase40e-test`) abwarten. Er führt `npm run verify` aus, also alle Logiktests, Sicherheit **und** vollständigen `tsc -b && vite build`. Ein rotes Kreuz nicht auf `main` mergen.
4. Bei grünem Test PR nach `main` mergen und grünen Hauptworkflow `TEMPO veröffentlichen` kontrollieren.
5. Für neue Diagnose-Felder des Garmin Workers separat `TEMPO Phase 39 – Garmin Worker (privat)` auf `main` ausführen; ohne erfolgreichen Worker-Deploy bleiben bereits vorhandene Aktivitäts- und Wellnessfunktionen unverändert, aber die neuen Diagnosefelder aus.
6. Auf dem iPhone prüfen: Tages- und Kalenderstatus, Öffnen echter absolvierter Einheiten, Watt/%FTP bzw. Pace/HF, FIT-Verläufe, GPS-Skizze, Fortschritt → Leistungsanalyse, Body Battery. Bei fehlenden Daten muss ein Strich bzw. ein ausdrücklicher Hinweis stehen.

## Teststand

Hier: 177/177 reine Node-Logiktests erfolgreich, Sicherheitsprüfung erfolgreich, 127 TS/TSX-Quelldateien syntaktisch durch TypeScript geparst, privater Worker per `node --check` erfolgreich. npm-Paketquelle nicht erreichbar, daher **kein vollständiger Produktions-Build in dieser Umgebung möglich**. GitHub-Actions-Grün ist eine notwendige zusätzliche Prüfung und ersetzt nicht den iPhone-Funktionstest.
