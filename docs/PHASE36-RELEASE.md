# TEMPO Phase 36 — Navigation und Trainingsdirektzugriff

## Oberfläche

- Kein doppelter großer Seitentitel. Im festen Header ist TEMPO zurückhaltend, die aktive Seite hell und fett; rechts erscheint das vorhandene TEMPO-Hirschsymbol.
- Die Versionsnummer befindet sich ausschließlich am unteren Ende des Hauptmenüs (V0.36), nicht im Header.
- Die vier dauerhaft sichtbaren Tabs heißen Startseite, Readiness, Tagestraining und Kalender. Fortschritt bleibt im Hauptmenü.
- Die Startseite zeigt kompakt Readiness, alle gespeicherten heutigen Einheiten, den heutigen Dienst und das **zeitlich nächstgelegene datierte** Ziel. Keine zusätzliche Schnellzugriffsliste.
- Trainingseinheiten sind von Startseite und Tagestraining direkt anklickbar, ohne einen zusätzlichen Button innerhalb der Kachel.
- Für Radtraining zeigt die Detailseite den vorhandenen Trainingsauftrag sowie Indoor-/Outdoor-Auswahl. Für Indoor werden die bekannten Teilschritte in lesbarer Reihenfolge dargestellt, geeignet zum manuellen Übertragen nach Garmin Connect. Es wird **keine automatische Garmin-Workout-Datei** erzeugt.
- Lauf- und Krafttermine öffnen die vorhandene Trainingsmaske mit dem gewählten gespeicherten Training.
- Im Tagestraining steht das Tagesdatum zwischen den Pfeilen. Der Recoverytag ist nur noch eine kompakte Aktion; doppelte Listen und die zusätzliche Readiness-Karte entfallen. Eine eigene Einheit lässt sich auf Wunsch hinzufügen.

## Sonstige Sportarten

- Sportspiel und Golf erscheinen unter „Aktivitäten aufnehmen“ sowie in den manuellen Aktivitätseingaben und Kalender-Icons.
- Golf, Sportspiel und (wie zuvor festgelegt) Schwimmen werden dokumentiert, fließen aber vorerst weder in Erholungssperren noch in den adaptiven Wochenumfang ein.

## Schutz bisheriger Daten

- Persistenz: `tempo-local`, Version 1, 20 Stores, Backup-Schema 1 — unverändert.
- Keine erzwungene Migration, keine Datenbanklöschung, keine Veränderung vorhandener Trainings, Diensttage oder Wettkampfziele.
- Der Upload enthält ausschließlich öffentliche Programm- und Testdateien, keine individuellen FIT/GPX-/Backupdaten.

## Prüfung

- Quellcode-Sicherheitscheck und automatisierte Funktionstests über `npm run test:security` und `npm run test:logic`.
- TypeScript-/TSX-Syntaxprüfung; vollständiger Produktions-Build durch GitHub Actions bei Upload erforderlich.
