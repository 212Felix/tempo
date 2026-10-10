# TEMPO – Train smarter

**Phase 1: technisches Grundgerüst und visuelle Navigation.**

TEMPO ist eine geplante, neutrale Trainings-PWA für Rad, Lauf, Kraft und Recovery. Persönliche Trainingsdaten werden **nicht** mit dem öffentlichen Quellcode ausgeliefert. Die späteren lokalen Profildaten werden von der App getrennt gespeichert.

## Aktueller Stand

- Responsive Graphit-/Titan-Design für Desktop und iPhone
- Seiten- und Hauptnavigation
- Readiness-Auswahl als **nicht gespeicherte Vorschau**
- 14-Tage-Dienstansicht als **nicht gespeicherte Vorschau** (Wochenenden vorläufig „Frei“)
- Platzhalter für alle weiteren TEMPO-Module

**Noch nicht integriert:** IndexedDB, Trainingssteuerung, persönliche Profile, automatische Workout-Erstellung, Garmin, PWA-Offlinebetrieb. Bitte keine wichtigen Trainingsdaten in dieser Version eingeben.

## Im Browser-Editor github.dev

GitHub.dev kann Dateien bearbeiten und committen. Es kann **keinen lokalen Build mit Node.js ausführen**. Deshalb sehen wir die laufende React-App später über einen GitHub-Actions-Build und eine veröffentlichte Vorschau.

## Lokale Entwicklung (auf einem neueren Computer)

```bash
npm install
npm run dev
```

Öffnen: `http://localhost:5173/`

Für einen Produktions-Build:

```bash
npm run build
```

Die GitHub-Pages-Veröffentlichung richten wir **erst im nächsten Schritt** ein. Für kostenlose GitHub Pages muss ein GitHub-Free-Repository normalerweise öffentlich sein; als Alternative kann ein anderer Hoster mit privatem Quellrepository dienen.

## Architektur

Die fachlichen Entscheidungen stehen in `docs/tempo-konzept.md`. Das Datenmodell ist noch nicht implementiert. Siehe `docs/datenarchitektur.md`.
