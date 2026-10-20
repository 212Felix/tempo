# TEMPO Phase 38 – Readiness, Trainingskalender und Kraftprogression

## Neue Funktionen

- Readiness: fünf Bewertungen vor Krankheit/Auffälligkeit und farbigem Ergebnis. Andere Eingaben hinter einem aufklappbaren Bereich; Fueling-Morgencheck weiterhin vorhanden.
- Readiness-Symbol im unteren Schnellzugriff: Farbe nach **heutigem vollständigen, gespeichertem** Check-in. Automatisch neutral ab lokalem Mitternachtstermin; am neuen Tag erneut durch neue Angaben.
- Kalender: rollierender Modus beginnt **heute**, genau 10 Tage sichtbar, vergangene Wochentage ausgeblendet. Andere Zeitfenster behalten eigene Auswahl. Angebrochene Kalenderwochen werden ohne Vergangenheit gezeigt.
- Standardwoche: mehrere Präferenzen pro Wochentag über Symbole auswählbar; Kraft A/B/C getrennt. Alte Standardwochen-Einstellungen werden lesend in die neue Anzeige übernommen; dieselbe ID und derselbe Speicherbereich `settings`.
- Training aus schwebender Tageskachel: `Start` öffnet direkt die Einheit. Vorläufige Einheit wird nur nach explizitem Antippen „Übernehmen & Start“ gespeichert. Zwei unterschiedliche Trainings am selben Datum sind erlaubt.
- Kraft: echte editierbare Zahlen für Zielwiederholungen und RIR, nicht bloß Platzhalter. Letztes vergleichbares Gewicht derselben Übung, Gerätevariante und desselben Trainingsorts wird übernommen. Nur abgeschlossene Sessions zählen. Nach vollständigem Erreichen des oberen Wiederholungsziels bei RIR >= 2 kann TEMPO eine begrenzte Erhöhung vorschlagen; grün markiert mit altem und neuem Gewicht. Änderungen bleiben möglich. Kein vorgeschlagenes Gewicht gilt automatisch als erbrachte Leistung; dies erfolgt erst mit Training abschließen.
- Einheitliches Dunkel-Theme für die zuvor fehlerhaft hell gerenderten Aktions-/Pendelknöpfe.

## Datensicherheit

Unverändert: `tempo-local`, `DATABASE_VERSION=1`, `BACKUP_SCHEMA_VERSION=1`, 20 Object Stores. Keine Migration, keine automatische Änderung vorhandener absolvierter Trainings, Fitnesswerte, FIT-Aktivitäten, Dienstpläne oder gespeicherter Krafteinträge. Einstellungen in `settings` werden nur durch ausdrückliches Speichern einer Standardwoche aktualisiert.

## Prüfungen

- `npm run test:security`: bestanden.
- `npm run test:logic`: 108/108 bestanden.
- 88 TypeScript-/TSX-Quelldateien: Syntaxprüfung ohne Diagnosen.
- **Einschränkung:** Ein vollständiger TypeScript- und Vite-Produktions-Build konnte in der Offline-Umgebung nicht laufen, weil npm-Dependencies nicht heruntergeladen werden konnten. GitHub Actions muss `npm run build` nach Upload auf `main` ausführen. Vor einem grünen Build und Deploy ist das Release nicht live bestätigt.

## Manuelle Nachprüfung auf dem iPhone

1. Versionsanzeige V0.38 unten im Hauptmenü, Readiness-Herz an neuem Datum zunächst neutral.
2. Readiness-Skalen und Krankheit vollständig ohne Scrollen bei normaler Safari-Schriftgröße (geräteabhängig); nach Speichern Farbanzeige prüfen.
3. Kalender rollierend ab heute, 10 Tage, keine vergangenen Wochentage.
4. Standardwoche am selben Tag z.B. Rad + Kraft C auswählen, speichern, nach Navigieren erneut prüfen.
5. Im Kalendermodal eine gespeicherte Einheit direkt öffnen, bei einer vorläufigen Einheit bewusst „Übernehmen & Start“ verwenden.
6. In Kraft C 6–10 Wiederholungen / RIR 2 unmittelbar vorausgefüllt. Gewichtsprogression nur nach einem vergleichbaren absolvierten Satzprotokoll.
7. Gerät, Trainingsort und gewählte Übungsvariante wechseln: historische Gewichte dürfen nicht unpassend erscheinen.
8. Trainingsdaten, Garmin-Aktivitäten, Dienst und drei Ziele prüfen. Backup über iPhone und iCloud Drive weiterhin regelmäßig erstellen.
