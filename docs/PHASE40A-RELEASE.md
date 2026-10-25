# TEMPO Phase 40A – Trainingssicherheit und Garmin-Dubletten

Dies ist **Paket A** der vereinbarten Phase 40, auf Basis von Phase 39. Keine vollständige Umsetzung aller Phase-40-Wünsche und keine Erweiterung der privaten Cloudflare-Schnittstelle.

## Neu

- Laufende Krafttrainings sichern ihren Eingabezustand (Sätze, Gewichte, Wiederholungen, RIR, Haltezeiten, Trainingsort, gewählte Geräte, RPE, Dauer, Notizen) nach Änderungen direkt lokal und zusätzlich in TEMPO IndexedDB mit 30-Sekunden-Intervall.
- Bei einem Wechsel ins Tagestraining bietet TEMPO den Einstieg **Aktives Training fortsetzen** an. Nach erneuter Öffnung können lokale Entwürfe wiederhergestellt werden.
- Der Kraft-Timer ist im Trainingsbereich sticky, startet/pausiert durch Antippen und merkt sich die bislang vergangene Zeit. Nach Reload und Rückkehr aus dem Hintergrund wird die Zeit neu berechnet. Die Symbole erscheinen beim Umschalten kurz als Wasserzeichen.
- Eingabefelder der Kraftsätze markieren bei Fokus ihren bisherigen Wert; iOS-Feldschrift mindestens 16 px zur Vermeidung des erzwungenen Zooms.
- Doppelt verknüpfte Garmin/FIT-Aktivitäten werden **vor dem Import** erkannt und die betroffenen Aktivitätskarten benannt und markiert. Ein Zurücksetzen einer einzelnen Verknüpfung ist direkt möglich.

## Bestehende Verhaltensweisen

- An der Cloudflare-Garmin-Worker-Datei und an Garmin-Secrets wurde **nichts geändert**.
- D1, Cloudflare- und Garmin-Zugang bleiben unberührt.
- Keine automatische Änderung von Plan-/Schicht- oder Readiness-Einträgen beim Garmin-Import.
- Das Schema der lokalen Datenbank (`DATABASE_VERSION = 1`, 20 Stores) bleibt unverändert. Trainingsentwürfe liegen unter getrennten IDs im bestehenden `settings`-Store und in diesem Browser.
- Trainingsentwürfe sind **kein Geräte-Backup** und werden nicht auf andere Geräte synchronisiert. TEMPO weiterhin regelmäßig über Profil & Daten sichern.
- Die Phase-39-Version bleibt technisch 0.39.0; das Seitenmenü zeigt ein Kennzeichen `Phase 40A`. Die endgültige Version 0.40 wird nach den weiteren Paketen vorbereitet.

## Prüfungen

- Security-Tests: bestanden.
- Logiktests: 132 bestanden.
- TypeScript- und JSX-Syntax geprüft (96 Module).
- Der vollständige Produktions-Build konnte in der Erstellung nicht ausgeführt werden, weil Node-Pakete in der Ausführungsumgebung nicht verfügbar waren. **Vor Veröffentlichung muss GitHub Actions alle drei Prüfungen (security, logic, build) mit grünem Haken abschließen.**

## Test auf dem iPhone nach erfolgreichem Build

1. Im Bereich Profil & Daten ein frisches JSON-Backup erstellen und sicher aufbewahren.
2. Ein geplantes Krafttraining starten und Satzwerte ändern, einschließlich RPE, Gewichte und Notizen.
3. Über Tagestraining navigieren. Die Schaltfläche **Aktives Training fortsetzen** öffnen und die Daten kontrollieren.
4. Den Timer starten, pausieren, fortsetzen und die Seite verlassen. Nach der Rückkehr darf die Zeit nicht auf null springen.
5. Garmin-Verbindung laden und zwei Garmin-Aktivitäten auf dieselbe FIT-Aktivität setzen. Beide Karten müssen eine Fehlermarkierung zeigen, der abschließende Import blockiert sein.
6. Eine doppelte Zuordnung wieder lösen. Der Import darf erst weitergehen, wenn die Entscheidungen eindeutig sind.
7. Prüfen, ob ältere FIT-Satzprotokolle und die Garmin-Verbindung erhalten geblieben sind.

## Weitere Pakete (nicht in dieser ZIP)

- B: vollständige Übungsbibliothek, Trainingsorte und Sportvarianten.
- C: präzisere Tagestrainings, adaptive Logik, chronologische Ziele.
- D: konsistentes Readiness-Akkudesign, zusätzliche Garmin-Schlaf-/Erholungsdaten und weitere Layoutverbesserungen.
- Keine Trainerplattform und keine Mehrbenutzerverwaltung.
