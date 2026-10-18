# TEMPO Phase 34 — Änderungen

- Kalenderansicht: 3-3-2 (7 Tage plus Wochenbilanz) und eine schwebende Tageskarte mit Datumspfeilen; Tages-Dienststatus und Sportarten sichtbar.
- Eigenständiges + pro Tag: öffnet die manuelle Trainingsanlage für diesen Tag. Planung danach im Kalender sichtbar.
- Langdruck auf gespeicherte Trainingseinheit erlaubt Ziehen auf ein neues Datum. Bestätigungsdialog sowie intelligente Wochen-Umplanung. Alternativ über „Verschieben“ in Tagesdetails.
- Trainingstausch möglich, bestehende Dienst-Datensätze bleiben unverändert.
- 7-, 14- und rollierende Ansicht zeigen vorläufige Trainingsvorschläge; endgültige Übernahme nur nach Bestätigung.
- Kürzere lockere Läufe blockieren Krafttraining nicht pauschal; Belastungssicherheit bei harten Einheiten bleibt bestehen.
- „Kein Fueling“ mit tatsächlichen 0 g; keine unnötige Morgen-Abfrage.
- Fueling innerhalb der Einheit: Einnahme abhaken, lokale Speicherung und KH-/Flüssigkeits-Soll-Ist-Bilanz.
- Durchschnittspace bei manuell erfassten Läufen anhand tatsächlicher Dauer und Kilometer.
- Schwimmen bleibt bis auf weiteres nur im Protokoll; keine automatische Belastungsanpassung.
- Überschriften „Fueling“ statt „Fueling & Trinken“.

## Datenerhalt
Datenbank `tempo-local`, Version 1, 20 Stores und Backup-Version 1 bleiben unverändert. Keine Trainingsdaten in diesem GitHub-Paket enthalten. Kein automatisches Löschen oder Überschreiben gespeicherter Trainingseinträge.

## Validierung
`npm run test:security` und `npm run test:logic` laufen lokal mit den vorhandenen Prüfscripten. Vollständige TypeScript- und Vite-Prüfung mit allen npm-Abhängigkeiten erfolgt im GitHub-Actions-Workflow.
