# TEMPO Phase 29 – Release-/Datenfreigabe

## Fehlerkorrekturen gegenüber Phase 28

- Readiness wird in `src/phase28/adaptive-planner.ts` ausdrücklich auf Vorhandensein geprüft, bevor `readiness.date` oder `readiness.illness` verwendet werden. Damit werden die drei bekannten TypeScript-Meldungen aus dem Build #35 vermieden.
- Erneute Übernahme des *vollständigen* App-Quellcodes statt eines Flickwerks verschiedener ZIP-Versionen.
- Einheitlicher sichtbarer Versionshinweis **PHASE 29** in `src/App.tsx` und `package.json` `0.29.0`.
- Nur **ein** automatischer Veröffentlichungsworkflow auf `main`. Der PR-Workflow bleibt separat nutzbar, reagiert aber nicht zusätzlich auf jeden main-Push.
- Automatische Quellcode-/Datenvertragsprüfung vor jedem Deployment; zusätzliche Phase-29-Release-Tests.

## Unveränderliche Datenvertragsbestandteile

- `DATABASE_NAME = 'tempo-local'`.
- `DATABASE_VERSION = 1`.
- `BACKUP_SCHEMA_VERSION = 1`.
- `STORE_NAMES` umfasst weiterhin alle 20 Object Stores.
- `importTempoBackup` ergänzt nur fehlende Datensatz-IDs und überschreibt keine bestehenden Einträge.
- Die Laufzeit-Kraft-Timer-Keys (`tempo.phase28...`) bleiben bewusst erhalten, damit die Umbenennung auf Phase 29 keine gespeicherten Timer-Zustände verwirft.

## Freigabegrenzen

Die Node-Logiktests und der statische Quellcheck laufen offline. Der vollständige Build mit React-, Vite- und Garmin-Abhängigkeiten muss über GitHub Actions erfolgen. Vor und nach dem Update bitte auf dem iPhone die Daten prüfen; ein grüner Build-Haken allein beweist keine 100-prozentige Integrität des Gerätespeichers.

## Keine privaten Daten im Repository

Keine Backup-JSONs, FIT-/GPX-Dateien, GPS-Standorte oder personenbezogenen Exporte hochladen. Das Repository enthält nur Anwendungscode, statische Icons und neutrale Beispiele.
