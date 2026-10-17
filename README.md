# TEMPO – Train smarter · Phase 30

**Release-Paket vom 17.10.2026:** Vollständiger Projektstand zum direkten GitHub-Upload auf `main`, basierend auf der funktionierenden Phase 29. Ohne personenbezogene Trainingsbackups oder GPS-Tracks.

## Phase 30 – Neu

- **Intelligente Wochenumplanung:** Trainingseinheit innerhalb derselben Woche bewusst verschieben, ursprüngliche und vorgeschlagene Wochentage im 3/2/2-Kalender vergleichen, Tagesvorschläge bestätigen oder ablehnen, Alternativen vorschlagen lassen und den Gesamtplan erst nach ausdrücklicher Zustimmung atomar speichern. MUSS-Einheiten, Kraft und Laufen bleiben in der Vorschau erhalten; absolvierte und sonstige bereits manuell fixierte Trainingstage werden geschützt. Wenn es unlösbare Belastungskonflikte gibt, wird die Bestätigung gesperrt.
- **Fueling & Trinken:** Eigene Gel-/KH-Pulver-/Lebensmittelbibliothek, Fahr-/Lauf-Fueling-Rechner für Kohlenhydrate und Flüssigkeit, produktbezogene Packliste, Flaschenmischung, 20-Minuten-Einnahmeplan und Verträglichkeitsprotokoll. Geplante Tagesaktivitäten bieten einen ausklappbaren Fueling-Vorschlag.
- **GPX-Vorabplanung:** Datei auf dem Gerät auslesen, ausschließlich Distanz/Höhenmeter und Dateiname dem ausgewählten Trainingstag zuordnen; GPS-Koordinaten werden nicht in der Datenbank gespeichert oder an GitHub übertragen. Prognosezeit anhand der manuell festgelegten Geschwindigkeit, nicht aus Leistungsprofilen der GPX.
- **Kalender und Tagesansicht:** Sachsenweite Feiertage und Wochenenden dezent grün, Tag-vor/zurück-Schalter sowie frei erfassbares Yoga und Stabi – auch als extern vorgegebenes Training.
- **Blockperiodisierung:** Springen zu Saison-/Block-/Wochenabschnitten, aufklappbare Blockinhalte samt Workout-Beispielen, Rad/Lauf/Kraft-Umfang, manuell speicherbare Richtwerte für Wochenstunden und Radkilometer; Redundanzen in der Saisonansicht reduziert.
- **Krafttraining:** Kraft A/B bleiben zentrale Bestandteile; moderate, kontextabhängige Empfehlung für weniger Unterkörper-Arbeitssätze in besonderen Radwochen anstelle pauschaler Halbierung; absolvierte Sätze nie verändert.
- **Navigation:** Recovery & Mobility unter der aufklappbaren Navigation „Aktivitäten aufnehmen“.

Die bisherigen Funktionen aus Phase 28/29 bleiben enthalten (7-/14-Tage-Kalender, FIT/Garmin-Auswertung, Krafttimer, Blockperiodisierung, Trainigsziele und sicherer ergänzender Datenimport).

## Wichtige fachliche und technische Grenzen

- Die Wochenumplanung ist eine konservative, regelbasierte **erste Version**. Sie optimiert nur **innerhalb derselben Kalenderwoche**. Ein individueller sportwissenschaftlicher Last-/Leistungsmodellierer ist noch nicht enthalten; bei unvermeidbaren Konflikten wird nichts übernommen.
- Manuell eingetragene Wochenstunden und Kilometer dienen derzeit als sichtbare Zielwerte für die Blockübersicht. Der bestehende Tagesplan-Generator übernimmt sie noch **nicht automatisch als harte Vorgabe**.
- Die Gastrointestinal-Verträglichkeit wird protokolliert, fließt aber noch nicht automatisch aus historischen Protokollen in die Rechnerdefaults ein. Fluids sind Schätzungen und ersetzen keine individuelle Schweißratenmessung.
- GPX enthält nicht automatisch tatsächliche Fahrzeit, Wattprofil oder Trainingsintensität. Die Strecke beeinflusst in dieser Version vor allem Distanz-/Höhenmeter-Anzeige und die manuelle Dauerabschätzung.

## Daten- und Deploy-Schutz

Die Anwendung verwendet weiterhin **IndexedDB `tempo-local`, Version 1, Backup-Schema 1 sowie exakt 20 Object Stores**. Kein Datenbank-Reset, keine Löschung bestehender Trainings und keine automatische Backup-Rückspielung. Mac und iPhone haben weiterhin getrennte lokale Browserdaten. **Vor einem Update ein aktuelles iPhone-Backup in iCloud Drive anlegen** und die PWA nicht deinstallieren.

Tests und Produktions-Build bei verfügbaren npm-Abhängigkeiten:

```sh
npm install --no-audit --no-fund
npm run test:security
npm run test:logic
npm run build
```

Der Upload auf GitHub-`main` startet `.github/workflows/deploy.yml`. Nur wenn der Produktions-Build erfolgreich abgeschlossen ist, wird die neue Version veröffentlicht. **Im Arbeitscontainer waren die npm-Pakete nicht verfügbar**; die Node-Logiktests und eine offline durchgeführte syntaktische Typprüfung sind möglich. Ein realer Produktions-Build muss mit GitHub Actions bestätigt werden.

**Upload:** `UPLOAD-ANLEITUNG.txt`. Hintergrund: `docs/PHASE30-RELEASE.md`.
