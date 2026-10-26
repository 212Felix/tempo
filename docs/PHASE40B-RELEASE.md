# TEMPO Phase 40B – Trainingsintelligenz & Oberfläche

Stand: 26. Oktober 2026. Ausgangspunkt: vollständig ausgelieferte Phase 40A.

## Umgesetzt

1. **Sportartspezifische Übungsauswahl** (`sportExercises.ts`): kuratierte 16 Zusatzübungen für Radfahren, Laufen, Explosivkraft und Rumpfstabilität einschließlich Übungs-Cues und Unilateral-Markierung. Nicht die umfangreiche allgemeine Kraftbibliothek.
2. **Übungswechsel während der laufenden Krafteinheit**: Vorlage A/B/C bleibt Basis; Übungen können hinzugefügt und ersetzt werden. Die individuelle Übungsliste wird in den schon vorhandenen lokalen Phase-40A-Zwischenstand integriert, ohne Datenbankschema-Änderung. Bestehende Sätze werden nicht gelöscht. Nach einem Wechsel werden nicht mehr aktive Übungen aus dem neuen Satzabschluss ausgeschlossen, alte bereits gespeicherte Sätze bleiben in der Datenbank. Vor Ersetzen einer Übung mit gespeicherten Sätzen wird gewarnt.
3. **Tagestraining**: rein lesende, aus dem tatsächlich gespeicherten Trainingsdatensatz abgeleitete Vorgaben für Dauer, Distanz, Intervalle, Wattleistung (wenn persönliche FTP existiert), HF-Zielorientierung (wenn persönliche HFmax existiert), RPE und bestehende Trainer-/Planhinweise. Bestehende persönliche Zielwerte werden nicht überschrieben. Ohne FTP/HFmax gibt es keinen erfundenen absoluten Watt- oder Pulswert.
4. **Adaptive Kraftdosierung**: Trainingstage, Blockphase, bereits geplantes/dokumentiertes Rad- und Laufvolumen, Einsatztage und lokal erfasste Erholung geben nachvollziehbare Empfehlungen; keine automatische Datenlöschung, keine eigenmächtige Trainingsfreigabe. Nur lesender Algorithmus und Anzeige. Bereits gespeicherte Sätze bleiben im Training sichtbar.
5. **Zielreihenfolge**: kommende Ziele chronologisch zuerst; zeitlich offene Ziele dahinter; abgeschlossene/abgelaufene Ziele zuletzt.
6. **Readiness**: gemeinsame qualitative Akkuanzeige in Start- und Readiness-Ansicht, ausdrücklich **keine** Garmin Body Battery.
7. **Startseite**: Hirsch im Begrüßungskopfbereich, nicht wiederholt in Readiness- und Tagestrainings-Kacheln; einheitliches Blaugrün-Farbschema.
8. **Mobile Stabilität**: flexible Container, begrenzte Breiten, 16px Eingabefelder gegen iOS-Safari-Fokuszoom. Nur echte Tests am iPhone können jede Layout-Konstellation bestätigen.
9. **Bestehende Garmin-Dopplungen**: konservative Vorschläge anhand ID oder Startzeit/Sport/Dauer, manuelle individuelle Entscheidung, reversibles weiches Ausblenden aus Statistiken (`duplicateOf`). Beide vollständigen lokalen Originaldatensätze inklusive FIT-Verläufe bleiben erhalten. Für Garmin-Import/Quellenverwaltung bleibt der Zugang zu allen Rohdatensätzen bestehen.

## Unverändert bzw. später

- Komplettes Kraftbibliotheks- und Excel-Programm-Import-System später.
- Garmin Schlaf/HRV/Body-Battery später; Worker, Secret-Namen und API-Schlüssel unverändert.
- Trainer-/Teilnehmer-/Mehrbenutzerplattform nicht enthalten.
- Datenbank Version 1 mit 20 Stores unverändert, kein Lösch- oder Migrationsskript.
- Phase 40A mit 30-Sekunden-Autosave und Timer bleibt enthalten.

## Testumfang

- 142 lokale Node-Logiktests: erfolgreich.
- Sicherheitscheck der Veröffentlichungsquellen: erfolgreich.
- TypeScript-Syntax der 101 TS-/TSX-Dateien: geprüft.
- Wichtige nicht-React-Typen mit TypeScript `strict`: geprüft.
- **Vollständiger `npm run build` in der Erstellungsumgebung nicht möglich**, weil `registry.npmjs.org` hier nicht aufgelöst wird und Node-Abhängigkeiten nicht installiert sind. GitHub Actions muss den vollständigen Build bestätigen, bevor `main` zusammengeführt wird.
- Neuer GitHub-Actions-Workflow `.github/workflows/verify-phase40b.yml`: Auslösung bei Push auf `phase40b-test`, bei Pull Requests gegen `main`, manuell.

## Sicheres Aktualisieren mit GitHub Desktop

1. TEMPO auf dem iPhone im Menü **Profil & Daten** als JSON-Datei exportieren und separat sichern.
2. GitHub Desktop → Repository `tempo` → **Fetch origin**. Dann neuen Zweig `phase40b-test` von `main` erstellen.
3. Dieses ZIP entpacken. Nur seinen Inhalt (nicht die ZIP selbst) in das **lokal geklonte** Repo übertragen. **Keinesfalls `.git` überschreiben oder Ordner löschen.** Robuste Kopie bei Standardpfaden (bitte entpackten Ordnernamen anpassen):

   ```sh
   rsync -a --exclude='.git' --exclude='.DS_Store' "$HOME/Downloads/tempo-main/" "$HOME/Documents/GitHub/tempo/"
   ```

4. GitHub Desktop → **Changes** und alle Änderungen kontrollieren; `.DS_Store` und persönliche Dateien niemals committen. Commit mit `TEMPO Phase 40B – Trainingsintelligenz und Design` erstellen; **Publish branch**.
5. GitHub **Actions** → **TEMPO Phase 40B – Test vor Veröffentlichung** prüfen. Nur wenn der vollständige Build grün ist, Pull Request in `main` zusammenführen. Danach muss **TEMPO veröffentlichen** ebenfalls grün sein.
6. Anschließend iPhone-Tests: Trainingssicherung, fortgesetztes Krafttraining mit Zusatzübung, individuelle Trainingsziele, Garmin-Synchronisation, Dubletten-Wiederherstellung und Lesbarkeit.

Wenn GitHub Actions fehlschlägt: nicht zusammenführen, Fehlermeldung im Chat bereitstellen. Der Testzweig kann jederzeit verworfen werden; `main` bleibt unverändert.
