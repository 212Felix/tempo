# TEMPO 38.2 – Alpine Startseite, Tagestraining, Kraftvorgaben und Navigation

Basis: **TEMPO 38.1** mit funktionierendem Kalender-Hotfix. Die bestehenden 20 IndexedDB-Stores, das Backup-Schema und der Datenbankname `tempo-local` bleiben unverändert.

## Sichtbare Änderungen

- **Startseite:** ausgewähltes Alpine-Design mit großem Hirschmotiv in einem eigenständigen, textfreien Headerbild; lebendiger, weiterhin kontrastreicher Kartenhintergrund. Inhalte und Button-Funktionen der Karten bleiben erhalten. Das kleine Hirschlogo oben rechts ist nur auf der Startseite ausgeblendet; im übrigen System bleibt es.
- **Tagestraining:** alpine Seitenatmosphäre; für Fahrrad, Lauftraining, Yoga/Mobility, Kraft und weitere Sportarten passende dezente Bild-/Farbflächen. Die eigentlichen Trainingsdaten und Aktionen bleiben live und interaktiv. Es werden ausschließlich dekorative, lokal ausgelieferte WebP-Dateien geladen; keine Netzwerk- oder Werbeeinbindung.
- **Kalender:** bewusst unverändert reduziert; Schutz für angebrochene Wochen und Zehntageansicht aus 38.1 bleibt erhalten.
- **Kraft:** bei Wiederholungsintervallen wird nun der aufgerundete Mittelwert als unmittelbar editierbare Vorgabe vorgeschlagen: 8–10 → 9, 5–6 → 6, 6–10 → 8. Die Zielobergrenze für Progressionsentscheidungen und die echte vorherige Leistung bleiben erhalten. Manuelle Überschreibungen bleiben möglich.
- **Navigation:** Scrollposition wird erst nach dem React-Seitenwechsel synchron und im nächsten Animation Frame nach oben zurückgesetzt statt vor dem Seitenwechsel animiert; auch der Wechsel aus Kalender/Dienst- und Trainingsansichten wird erfasst.

## Erhalten und geschützt

- Alle gespeicherten Trainings-, Dienst-, Garmin-, Readiness- und Kraftdaten bleiben unverändert; keine IndexedDB-Migration.
- Kein automatisches Speichern oder Überschreiben bestehender Einheiten.
- Keine Änderungen an der adaptiven Trainingsplanung oder den Sportarten in den Datenbankstrukturen.
- Der Fehler-Schutz des Kalenders aus 38.1 bleibt bestehen.

## Releaseprüfung

- `npm run test:security`: erfolgreich.
- `npm run test:logic`: 116/116 bestanden.
- 91 TS/TSX-Dateien syntaktisch mit TypeScript geprüft.
- Vollständiger Vite-/React-Build muss **nach Upload durch GitHub Actions** bestätigt werden (npm-Pakete für lokalen Build hier nicht installiert).

## Sicher hochladen

1. Optional aktuelles TEMPO-Backup **auf dem iPhone** lokal/iCloud sichern.
2. Das kleine ZIP entpacken und **alle Inhalte innerhalb von `tempo-main`** nach `main` in `212Felix/tempo` über `Add file → Upload files` übertragen.
3. Build **und** Deploy müssen in GitHub Actions grün werden.
4. Danach Version **V0.38.2** im Seitenmenü, Startseite, Tagestraining, Trainingseinheiten, Kalender und Kraftwerte auf iPhone kontrollieren.
5. App nicht deinstallieren, keine Browserdaten löschen und keine privaten JSON-Backups in GitHub hochladen.
