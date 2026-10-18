# TEMPO Phase 33 – kompakte Bedienung und Dienstoptionen

Basis: offiziell bestätigte TEMPO Phase 32. Dieses Release ändert die Anzeige und die optionalen Felder von `shifts`, aber weder Datenbankname noch Storeliste, Datenbank-/Backupversion oder abgeschlossene Trainings.

## Änderungen

- Startseite: bestehendes TEMPO-Logo kompakt rechts neben der Überschrift; überflüssiger Home-Slogan entfernt.
- Readiness auf Startseite und Tagestraining: vollständige Statusfarbe und Titel bleiben sichtbar, ausführliche Erklärung nur nach Tippen auf `?`; bestehende Warnhinweise bei Konflikten bleiben sofort sichtbar.
- Ruhetag: knapper Abschnitt, Erläuterung hinter `?`.
- Verfügbarkeit trotz Dienst: vier schnell wählbare, bebilderte Möglichkeiten `🏋️ Kraft`, `🏃 Laufen`, `🤸 Stabi`, `🧘 Yoga`; `🚴 Rad nach Dienst` bleibt als separate Radoption erhalten.
- Frühere Flags `workStrength`/`afterWorkStrength` und `workRun`/`afterWorkRun` bleiben gespeichert, falls schon vorhanden; neue `possible*`-Kennzeichen überschreiben nur die zusammengefasste zukünftige Verfügbarkeit, nicht die historische Trainingsort-Angabe.
- Fotoeingabe in der Fueling-Bibliothek: eigene Schaltflächen `Foto aufnehmen` (Kamera, `capture=environment`) und `Datei auswählen` (Bilder/Fotomediathek), gemeinsame geräteinterne OCR und manuelle Datenkontrolle.
- Version und Freigabeprüfung: `PHASE 33` / `0.33.0`.

## Grenzen

Yoga und Stabi sind auswählbare *Möglichkeiten*, keine automatisch zwangsläufig neuen Einheiten. Das bewahrt die belastungsorientierte Rad-/Lauf- und Kraftprogression. Der tatsächliche Trainingsort wird nach wie vor an der jeweiligen Einheit gepflegt. GitHub Actions muss den vollständigen Produktions-Build abschließend prüfen.

## Sichere Übernahme

Vor dem Upload lokales Backup über iPhone erstellen. Bei GitHub nur die Änderungspaketdateien *mit relativer Ordnerstruktur* in `main` übernehmen; die ausführbare App muss nach erfolgreichem Build auf `PHASE 33` stehen. Keine lokalen Daten in das Repository laden, niemals installierte App löschen oder Website-Daten leeren.
