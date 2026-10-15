# Phase 28 – Freigabecheck (GitHub Pages)

Die bisherige Freigabe per Upload auf `main` bleibt erhalten. `.github/workflows/deploy.yml`
laeuft ausschliesslich bei `push` auf `main` (oder auf manuelle Ausloesung) und
veroeffentlicht NUR NACH erfolgreicher Sicherheitspruefung, 27 Trainingslogiktests
und `npm run build`.

## Vor dem Upload

- Aktuelles originales iPhone-Backup separat sichern (iCloud Drive und zweite Kopie).
- Original-Backup nicht ins Repo hochladen.
- `tempo-main`-Inhalte inklusive verstecktem `.github` auf oberster Repo-Ebene hochladen.
- Den bestehenden Pull Request #1 **nicht mergen**.

## Nach GitHub-Actions-Erfolg

- iPhone-PWA neu starten, Phase 28 anzeigen lassen.
- Trainingstagebuch, absolvierte und manuelle Einheiten, Readiness, Events und Garmin pruefen.
- Neues Backup exportieren und unveraenderte Bestandseintraege per IDs und Inhalten
  gegen Backup vor Update pruefen.

Bei fehlenden/veraenderten Datensaetzen nichts ueberschreiben; Originaldatei aufheben.
