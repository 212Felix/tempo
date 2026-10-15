# TEMPO Phase 28 – Release-Freigabe

## Vorbereitete und erledigte Prüfungen (15.10.2026)

- [x] Kompletter Quellcode von `tempo-main.zip` als Grundlage übernommen.
- [x] Neues iPhone-Referenzbackup `Phase 27 + Daten .json` geprüft: exportiert 15.10.2026 17:14:10 UTC; **164 Datensätze in 20 Bereichen**.
- [x] `tempo-local`, Datenbankversion 1, Backupschema 1 und 20 Stores unverändert.
- [x] 27 automatisierte Logik-, Planungs-, Kalender- und Datenintegritätstests bestanden.
- [x] Simulierte IndexedDB-Importe getestet: vorhandene IDs unangetastet, neue ergänzt; doppelte IDs abgelehnt.
- [x] Tageskacheln führen zu eigenem Tagesbildschirm mit Dienst-, Pendel- und Trainingsbearbeitung.
- [x] Kalender 3/2/2 und 7-/14-Tage-Ansicht, adaptive Blöcke und Krafttimer integriert.
- [x] Quellcode-Audit: keine privaten Backup-Dateien, FIT-/GPX-Dateien oder geänderte Datenbankverträge.
- [x] GitHub-Workflow für `push` prüft; `deploy` ist ausschließlich manuell startbar.

## Offene technische Freigaben – unbedingt durchführen

- [ ] Frisches iPhone-Backup unmittelbar vor Release exportieren, iCloud plus unabhängige zweite Kopie.
- [ ] GitHub `phase28-test` Branch hochladen; GitHub-Actions-Prüfworkflow zeigt **grün**.
- [ ] Vollständiger TypeScript/Vite-Produktions-Build in GitHub Actions **grün**.
- [ ] Sichtprüfung einer separat gebauten Testversion vor dem Release: 7/14 Tage, 3/2/2 Raster, Diensteditor, Pendeln, mehrere Einheiten pro Tag.
- [ ] Timer Start/Stopp, Countdown und Kraftsatz-Speicherung an einem Testdatensatz kontrollieren.
- [ ] Manuell geplante, absolvierte und Garmin-verknüpfte Einheiten mit Testbackup auf einem **separaten Testgerät/-Browser** kontrollieren.
- [ ] Garmin-FIT-Import im echten Browser testen, Matching und Doppelzählung prüfen.
- [ ] GitHub Pull Request aus `phase28-test` nach `main` übernehmen, Testlauf erneut grün.
- [ ] Erst danach GitHub Actions **TEMPO Phase 28 - Bewusst veröffentlichen** manuell auslösen.
- [ ] Nach dem iPhone-Update sofort Nachher-Backup exportieren und streng mit Vorher-Backup vergleichen:

```bash
node scripts/verify-data-preservation.mjs vorher.json nachher.json
```

## Wichtige Grenzen

Der 15.10.-Referenzstand aus dem Chat kann bereits überholt sein. Für den Datenvergleich zählt immer das letzte iPhone-Backup **unmittelbar vor dem Update**. Private Sicherungen nicht zu GitHub hochladen. Ein Browserupdate soll IndexedDB erhalten, aber Browserdaten können durch App-Löschung/Website-Daten-Löschung trotzdem verloren gehen. Ein erfolgreiches Unit-Test-Ergebnis ersetzt keinen produktiven Build und keine Geräte-Abnahme.

**Status:** Release-Kandidat bereit zur isolierten GitHub-Buildprüfung; noch keine Freigabe zum produktiven iPhone-Update.
