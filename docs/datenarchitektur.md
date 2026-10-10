# Geplante Datenarchitektur – noch nicht implementiert

## Trennung

1. **Katalog/Regeln**: Übungen, Workout-Vorlagen, Trainingsphasen, Defaults.
2. **Profil**: individuell editierbare FTP-/HF-/Kraft-Referenzen, Ziele, Verfügbarkeitspräferenzen.
3. **Plan**: Blöcke, priorisierte Sessions, Dienststatus, verfügbare Optionen, Events, Strecken.
4. **Durchführung**: tatsächliche Aktivitäten, Sätze, Belastung, Fueling, Rückmeldungen.
5. **Import/Rohdaten**: später Garmin/GPX/Dateien, mit Quellreferenzen; Rohdaten nicht überschreiben.
6. **Auswertung**: ableitbare Metriken/Trends; keine doppelte Wahrheit speichern.

## Vorgeschlagene Entitäten
`profiles`, `metric_history`, `training_priorities`, `shifts`, `availability`, `events`, `routes`, `training_blocks`, `planned_sessions`, `completed_sessions`, `readiness_entries`, `exercise_catalog`, `strength_sets`, `fueling_logs`, `fueling_followups`, `recovery_sessions`, `external_activities`, `import_batches`, `settings`.

## Regeln
- Jede Einheit hat eine eigene ID und ggf. Referenz zur ursprünglichen Planung.
- Planänderungen mit Grund/Zeitpunkt versionieren; keine abgeschlossenen Einheiten rückwirkend überschreiben.
- Alle Zeiten als eindeutige ISO-Zeitpunkte + lokale Anzeige; Datum ohne Uhrzeit separat modellieren.
- Maßeinheiten explizit: W, bpm, kg, km, m, ml, g KH, mg Na.
- FTP-Änderungen gelten für künftige Trainingsziele; abgeschlossene Sessions behalten historische Zielbereiche.
- Importierte Aktivitäten deduplizieren nach Quelle und Quellen-ID (oder Fallback-Fingerprint).
- JSON-Export braucht `schemaVersion`, eine Importprüfung und spätere Migrationsregeln.
- User-Daten auf origin-/browsergebundener IndexedDB sind nicht zwischen Geräten synchron; Backup/Import muss deutlich sichtbar sein.
- Der spätere Planer soll deterministisch und testbar sein; KI kann erklären/vorschlagen, aber Trainingsänderungen bleiben überprüfbar.
