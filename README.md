# TEMPO – Train smarter · Phase 29

**Release-Paket vom 17.10.2026:** vollständiger Projektstand mit allen Phase-28-Funktionen, korrigierter Readiness-Typprüfung und einem einfachen Veröffentlichungsweg über den GitHub-Branch `main`.

## Enthalten

- 7-/14-Tage-Kalender im **3/2/2-Kachelraster** mit mehreren Trainingseinheiten pro Tag.
- Tagestraining mit zusammengeführter eigener Trainingsplanung und Direkteinstieg in geplante Einheiten.
- Pendel-Hin-/Rückweg als separate Information, keine Doppelzählung derselben Radfahrt.
- Start/Stopp-Gesamttimer beim Krafttraining und Countdown mit Erledigt-Haken für Halteübungen.
- Adaptive Blockperiodisierung für 52 Wochen: BASE, STRENGTH, MIT, HIT, VOLUME, MOUNTAIN, RUN, TAPER und RECOVERY. Hinweise zu Dienst, Readiness, Zielen und bestehenden Trainings.
- Empfehlungen zur Reduzierung der neuen Beinkraftsätze in Radvolumenblöcken. Vorhandene Kraftprotokolle bleiben unangetastet.
- Ergänzender statt überschreibender Import von TEMPO-Backups.

## Schutz bestehender Einträge

TEMPO verwendet weiterhin **IndexedDB `tempo-local`, Datenbankversion 1 und alle 20 bisherigen Object Stores**. Weder ein Datenbank-Reset noch ein automatischer Backup-Import ist Teil des Updates. Der Code enthält keine persönlichen Trainingseinträge, FIT-Dateien oder GPS-Tracks. **Lokale Browserdaten können dennoch verloren gehen**, z. B. durch Löschen von Website-Daten oder der installierten PWA. Deshalb vor dem Update auf dem iPhone ein aktuelles Originalbackup in iCloud Drive exportieren und gesondert aufbewahren. Mac und iPhone besitzen weiterhin voneinander getrennte Browser-Datenspeicher.

## Build und automatisierte Prüfungen

```sh
npm install --no-audit --no-fund
npm run test:security
npm run test:logic
npm run build
```

Ein Commit auf `main` startet `.github/workflows/deploy.yml`. **Nur nach erfolgreich bestandenen Sicherheits-/Logikprüfungen und Produktions-Build** erfolgt GitHub-Pages-Deployment. Bei einem roten Kreuz wird **keine neue Version ausgeliefert**. Andere offene Pull Requests werden dafür nicht zusammengeführt.

Im vorliegenden Arbeitscontainer stehen die npm-Pakete nicht vollständig zur Verfügung. Die ausführbare Node-Testreihe und die gezielte statische Typprüfung wurden geprüft, aber **der reale Produktions-Build muss über GitHub Actions bestätigt werden**.

Anleitung: `UPLOAD-ANLEITUNG.txt`. Weitere technische Details: `docs/PHASE29-RELEASE.md`.
