# TEMPO Phase 28 – Referenzbackup & Freigabesicherheit

**Stand: 15.10.2026 (iPhone-Export 17:14:10 UTC / 19:14:10 MESZ)**

Das Referenzbackup verbleibt AUSSERHALB des Quellcodes, ausschließlich im privaten Speicher. Diese Datei enthält **keine** privaten GPS-Daten oder Kopien aus dem JSON-Backup.

## Technische Bestandsaufnahme

- Format: `tempo-backup`; `schemaVersion`: `1`
- Datenspeicher: **20**, Gesamtdatensätze: **164**
- Im Backup selbst keine doppelten Datensatz-IDs festgestellt.
- SHA-256 der privaten Original-JSON-Datei: `d4e42ac94d13704ce1c609da8fbf10110983e80bc58e34bf9beb9ae38a9b0be0`
- Einzelaufteilung:

| IndexedDB-Store | Datensätze |
|---|---:|
| `profiles` | 1 |
| `performanceEntries` | 16 |
| `trainingPriorities` | 0 |
| `shifts` | 14 |
| `availability` | 0 |
| `events` | 3 |
| `routes` | 0 |
| `trainingBlocks` | 0 |
| `plannedSessions` | 4 |
| `completedSessions` | 5 |
| `readinessEntries` | 4 |
| `exerciseCatalog` | 0 |
| `strengthSets` | 18 |
| `fuelingLogs` | 0 |
| `fuelingFollowups` | 0 |
| `recoverySessions` | 0 |
| `bodyMetrics` | 0 |
| `externalActivities` | 94 |
| `importBatches` | 3 |
| `settings` | 2 |

## Vergleich zum Backup vom 13.10.

- Zusätzlich: 2 geplante Einheiten, 2 absolvierte Einheiten, 2 Readiness-Einträge, 18 Kraftsätze und 1 Einstellung.
- Geändert: 2 Dienstplan-Einträge (14. und 15.10.).
- Im neuen Backup nicht mehr vorhanden: eine Teststrecke „Test – Gravel Challenge“ (`routes`). Ursache durch die Backups allein nicht feststellbar; nicht automatisch zurückkopieren.
- Vorhandene absolvierte und geplante Einheiten sind erhalten.

## Freigaberegeln

1. Vor *jedem* produktiven Update neues iPhone-Backup exportieren, **privat** nach iCloud Drive sichern, außerdem unabhängige zweite Kopie behalten.
2. Phase 28 in Testumgebung prüfen; private Backups niemals in GitHub hochladen.
3. **Keine** Löschung/Neuinstallation der Home-Bildschirm-App und kein Zurücksetzen von Safari-Websitedaten.
4. Programmversion aktualisieren; lokale IndexedDB unberührt lassen.
5. Nach dem Update unmittelbar erneut exportieren. Folgenden **strengen** Vergleich auf dem Mac ausführen:

```bash
node scripts/verify-data-preservation.mjs "/privater/pfad/backup-vorher.json" "/privater/pfad/backup-nachher.json"
```

6. Jedes fehlende bzw. unerwartet veränderte Datensatzobjekt führt zu Exitcode 1; keine Freigabe bei Fehlern.
7. Neues Backup wird als neuer Referenzstand geführt, sobald geprüft.

## Teststatus

- `npm run test:phase28`: **8 von 8** Tests bestanden (4 Kalender-/Planlogik, 4 Backup-Vergleich).
- Backup-Referenz (Datei gegen unveränderte Kopie): **20 Bereiche, 0 fehlend, 0 verändert**.
- Noch offen: `npm install`, produktiver `npm run build`, Test auf iPhone/Safari, Garmin-FIT-Rundlauf, vollständige Trainingsplanung und visueller App-Test.

**Kein Freigabestatus:** Dieses Paket ist ein Entwicklungsstand, kein fertig validiertes Update für das iPhone.
