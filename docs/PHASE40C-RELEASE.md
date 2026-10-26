# TEMPO Phase 40C – geplanter Testrelease

## Ziele

1. Horizontalwischen ausschließlich zwischen vier Hauptseiten, mit Schutz für Formulare, Sidebars, Intervallgrafiken und Safari-Randgesten. Animationsreduzierung respektiert.
2. Datumsangaben in den gewählten Trainingslisten und Trainingsdetails deutsch `TT.MM.JJJJ`; interne ISO-Daten bleiben unverändert.
3. Garmin-Dublettenentscheidung in lokalen `settings` speichern (ohne Zugangscode), Teilauswahl bestätigen, bewusste Überspringungen ausblenden und auf Wunsch erneut prüfen. FIT-Originale und Benutzertraining bleiben erhalten.
4. Letzter erfolgreicher Serverabruf und tatsächliche lokale Übernahme werden getrennt angezeigt. Keine Behauptung über Cloudflare-Cron-Erfolg ohne Status-Response.
5. Watt-Zeit-Säulengrafik aus vorhandenen Trainingsphasen inklusive Pausen; Watt nur bei hinterlegtem FTP-Wert, keine erfundenen Zielwerte.
6. Optionales Garmin Wellness: offizielle Personal-API-Endpunkte für Schlaf, HRV und Body Battery; Auth ausschließlich im Worker, Werte ohne sensible Details in privater D1-sync_meta-Tabelle zwischengespeichert und nach Anmeldung auf das iPhone kopiert. Ergänzende Hinweise auf Tagestraining/Readiness und vorsichtige wöchentliche Belastungsempfehlung bei niedrigem Body-Battery- oder Schlafwert. **Keine automatische Änderung** gespeicherter Pläne, Readiness-Einträge oder Trainingstagebücher.

## Wichtiger separater Schritt zum Garmin Wellness-Modul

GitHub Pages baut nur den React-Code. Nach erfolgreichem Phase-40C-Web-Build muss der bereits vorhandene private Worker **einmal separat** über den bestehenden GitHub Actions Workflow **TEMPO Phase 39 – Garmin Worker (privat)** manuell neu bereitgestellt werden, damit `/v1/wellness` verfügbar wird. Die drei bereits genutzten Cloudflare-Deployment-Secrets sind nötig. Es werden keine neuen Garmin-Schlüssel angelegt. Ohne Worker-Neuveröffentlichung läuft der bisherige Garmin-Aktivitätenabgleich unverändert, und die Erholungsanzeige meldet „nicht verfügbar“.

## Sicherheit und Daten

- `DATABASE_VERSION`, D1-Schema, Worker-Bearer-Token und Garmin-Token-Austausch unverändert.
- Review-Entscheidungen ausschließlich als lokale Einstellungen, niemals Secret oder Passwort.
- Aktivitäts-Daten nur atomar über vorhandenen `externalActivities`-Import; ungelöste Einträge werden nicht dupliziert.
- Body Battery/HRV/Schlaf werden nur angezeigt, soweit tatsächlich geliefert und plausibel validiert. Ohne Messwerte bleiben Felder leer.
- Die Garmin Personal API ist für die persönliche Nutzung gedacht, nicht für geplante kommerzielle Mehrbenutzerbereitstellung.

## Freigabe

Zuerst `phase40c-test` pushen, Actions-Test laufen lassen, danach PR nach `main` mergen. Backup vor praktischer iPhone-Prüfung erstellen. Worker separat aktualisieren. Falls Tests scheitern: NICHT mergen.
