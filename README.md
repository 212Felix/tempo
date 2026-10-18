# TEMPO Phase 33

Lokale Trainings-App mit adaptiver Rad-/Lauf-/Kraftplanung, regenerationsorientierter Wochenumplanung sowie Fueling und persönlicher Produktbibliothek.

## Release 33

- Kompakte Startseite und Readiness-Erklärungen
- Freiwillig ausklappbare Recovery-Erklärung
- Vereinfachte Dienst-Verfügbarkeit: Kraft, Laufen, Stabi, Yoga (+ Rad separat)
- Zwei voneinander getrennte Foto-Eingaben in der Produktbibliothek
- Kein Upgrade der Datenbankstruktur; alle vorhandenen Daten bleiben lokal

Mehr Informationen: `docs/PHASE33-RELEASE.md`.

Prüfen: `npm run test:security && npm run test:logic && npm run build`.

GitHub Pages wird ausschließlich nach erfolgreichem Build auf `main` veröffentlicht.
