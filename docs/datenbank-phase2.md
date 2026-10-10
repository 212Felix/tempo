# TEMPO Phase 2 – lokale Datenbank (vorbereitet)

## Ziel
- Native Browser-IndexedDB: keine Cloud, kein Login, keine Laufzeitkosten.
- 20 getrennte Datenbereiche für neutrale Benutzerdaten, historische Messungen, Dienste, Events, Challenges, Planung, Training, Kraft, Fueling und externe Imports.
- `src/db/types.ts`: Datennamen und neutrale Grundtypen.
- `src/db/storage.ts`: Datenzugriff, Transaktionen und vollständiger JSON-Export/-Import.
- `src/db/DatabasePanel.tsx`: erste sichtbare Profil-/Backup-Oberfläche.
- `src/db/database-panel.css`: UI im Graphit-/Titan-Design.

## Aktivierung in der bestehenden App
Zunächst diese Dateien neu zu GitHub hochladen. Danach `src/App.tsx` an zwei Stellen bearbeiten:

1. Ganz oben ergänzen:
   `import DatabasePanel from './db/DatabasePanel'`
2. Die bedingte Seitenansicht erweitern:
   `: page === 'profile' ? <DatabasePanel/>` vor dem letzten Platzhalter.

Diese Aktivierung erfolgt unter Anleitung im nächsten Schritt. Nur neue Dateien hochzuladen verändert die Oberfläche nicht und zerstört nichts.

## Sicherheit und Datenhoheit
- Profil startet leer – keine persönlichen Werte im öffentlichen Repository.
- Erst beim Speichern entstehen Daten im Browser der jeweiligen Website-Adresse.
- Import ersetzt alle lokalen Daten nach deutlicher Bestätigung.
- JSON-Backup kann private Daten enthalten: **nicht zu GitHub hochladen**.
- Browser-Speicher ist keine verlässliche alleinige Langzeit-Sicherung; regelmäßige Exporte nötig.
- Kein automatischer geräteübergreifender Sync.
- Weitere Datenfelder, Planer, Messwert-Typen und Import-Regeln folgen in kommenden Phasen.
