# TEMPO Phase 39 – Garmin Personal API & Designkorrekturen

Basis: vollständig erhaltenes TEMPO Phase 38.2, inklusive Kalender-Hotfix 38.1 und aller 20 IndexedDB-Stores (Schema 1). Kein Neubau, keine Migration, kein Lovable.

## Neu

- Offizielle Garmin Connect Personal API (`personal.connectapi.garmin.com`), kein Garmin-Login-Scraping.
- Separater Cloudflare Worker mit ausschließlich privaten Secrets `GARMIN_PERSONAL_API_KEY` und `TEMPO_BRIDGE_TOKEN`.
- Separate, private D1-Datenbank. Nur freigegebene Zusammenfassungswerte für Rad, Lauf, Schwimmen, keine FIT-Dateien oder GPS-Tracks in Cloudflare.
- Automatischer Cloudflare-Cron alle 6 Stunden sowie manuell anstoßbare Synchronisierung.
- Private Bridge-Abfrage mit Token, HTTPS, CORS-Pinning, `no-store` und deaktivierter Worker-Observability.
- Eindeutige neue Garmin-Aktivitäten werden beim Abruf auf dem iPhone automatisch lokal importiert; potentielle Überschneidungen mit CSV/FIT werden einzeln zur Entscheidung angeboten.
- Stabile Garmin-Aktivitäts-ID, Dublettenschutz, atomare lokale Imports, konservatives Matching.
- Aufnahme in die bestehende Garmin-Bibliothek, Fortschritt, Leistungswerte, Rad-/Lauf-/Schwimmstatistik und vorhandenen Trainingsabgleich.
- Import verändert ausschließlich den IndexedDB-Store `externalActivities`. Kein Schreibzugriff auf zukünftige Trainings, Schichten, Readiness, Kraftsätze oder bestehende abgeschlossene Trainingseinträge.
- Bestehender lokaler FIT-/CSV-Import bleibt voll nutzbar.

## Design aus dem zuletzt freigegebenen TEMPO-Entwurf

- Abstraktes goldenes Hirschmotiv statt Bergkulisse auf der Startseite.
- Großer persönlicher Tagesgruß auf Basis von ProfildisplayName und Uhrzeit; keine zweite Grußzeile.
- Schlusszeile: „TEMPO · dein Training, dein System“.
- Fitnessstudio-/Langhantel-Motiv für alle Kraftkacheln auf Startseite und Tagestraining.
- Weitere Dark-Mode-Korrekturen für weiße Schaltflächen/Outline-Elemente.
- Kalender bleibt absichtlich ohne Bildhintergrund.

## Betriebsgrenzen

Diese Version ist ohne einen vom Nutzer eingerichteten Cloudflare Worker *nicht* mit Garmin Connect verbunden. Der öffentliche GitHub-Pages-Code darf den Garmin-API-Key niemals kennen.

Cloudflare Cron fragt Garmin im Hintergrund ab; im Cloudflare D1 liegen die Zusammenfassungen privat. Um die geschützten Daten ins lokale iPhone-IndexedDB zu übernehmen, muss der Nutzer beim Öffnen nach einem Neustart seinen **separaten Bridge-Zugangscode** eingeben. Den Garmin-Key selbst hat nur Cloudflare. Vollständig unbeaufsichtigter Geräteimport nach einem App-Neustart ist in dieser Version bewusst noch nicht verfügbar – dafür wäre eine sichere persistente Geräteauthentifizierung nötig.

Es werden nur die jeweils letzten 45 Tage abgefragt (maximal 100 Aktivitäten je Cloud-Abfrage). Ältere Historie bleibt wie bisher über CSV/FIT importierbar. Der Hintergrunddienst speichert keine Tracks oder Original-FIT-Dateien.

## Tests

- Lokale Node-Funktionstests und Sicherheitsprüfung.
- TypeScript/TSX-Syntaxprüfung sämtlicher Quelldateien.
- Realer Vite-/React-Produktions-Build muss durch GitHub Actions bestätigt werden (keine lokal installierten npm-Pakete im Testcontainer).
- API-Liveabruf und Cloudflare-Deploy erfordern den Nutzer-Key und dessen eigene Cloudflare-Einrichtung; wurden vor Auslieferung nicht vorgetäuscht.

Einrichtung im Detail: `docs/PHASE39-GARMIN-EINRICHTUNG.md`.
