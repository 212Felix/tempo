# TEMPO – Train smarter · Phase 28 (Release-Kandidat)

TEMPO ist eine lokale, responsive Trainings-PWA für Rad, Laufen, Kraft und Regeneration mit Schichtplanung, Garmin-Import und wissenschaftlich orientierter Blockperiodisierung.

**Status vom 15.10.2026:** 27 automatisierte Logik-/Integrationsprüfungen und Quellcode-Sicherheitsprüfung bestanden. **Produktions-Build und echter iPhone-Test stehen noch aus**; der Build kann automatisch über GitHub Actions ausgeführt werden. Dieses Paket wird **nicht allein durch den Upload** auf GitHub Pages veröffentlicht.

## Phase 28 – Funktionen

- 7-/14-Tage-Kalender mit **3 / 2 / 2** Kacheln je Woche und mehreren Aktivitäten pro Tag.
- Antippen einer Kachel öffnet den Tag mit geplanten Einheiten, Dienst-/Pendelbearbeitung und einer einheitlichen Eingabe für freie/abgeschlossene Trainings.
- Rückfahrt kann mit einem Radtraining als Pendelweg gekennzeichnet werden; keine doppelte Eintragung der Belastung.
- Krafttimer (Start/Stopp) und Satz-Countdown bei Halteübungen mit explizitem Erledigt-Haken.
- Adaptive Saisonübersicht mit 52 Wochen: BASE, STRENGTH, MIT, HIT, VOLUME, MOUNTAIN, RUN, TAPER und RECOVERY.
- Orientierung an persönlichen Zielen, eingetragenen Diensten, Readiness, bereits absolvierten Trainings und den vorhandenen Garmin-Daten.
- Dynamische Kraftsatz-Empfehlung: z.B. in VOLUME-Wochen weniger Beinsätze; bestehende Satzprotokolle bleiben erhalten.
- Nicht destruktiver Backup-Import (fehlende Datensätze ergänzen; vorhandene IDs nicht überschreiben).

## Datenschutz und Datenbeständigkeit

Der private Datenspeicher befindet sich **auf dem jeweiligen Gerät in IndexedDB** unter `tempo-local`, Datenbankversion `1` mit `20` bestehenden Stores. Ein Quellcode-Update über GitHub Pages ersetzt diese Datenbank nicht. Wenn Safari-Website-Daten oder die PWA-Daten gelöscht werden, können lokale Einträge jedoch verloren gehen. Deshalb sind separate Backups verpflichtend.

**Persönliche Backup-JSONs und Garmin-FIT-Dateien niemals in das öffentliche GitHub-Repository stellen.** Der Code enthält keine private Sicherung.

Backup-Import: Bestehende IDs werden nicht überschrieben; die Importtransaktion ist atomar. Das ist kein automatischer Live-Abgleich zwischen Mac und iPhone. Das iPhone ist die führende Eingabequelle für manuelle Daten.

## Entwicklung am Mac

```bash
npm install --no-audit --no-fund
npm run test:security
npm run test:logic
npm run build
npm run dev
```

Die Testskripte werden automatisch vor einer bewussten GitHub-Pages-Veröffentlichung ausgeführt. **Hier im Chat konnte `npm install` aufgrund fehlender DNS-/Netzverbindung nicht abgeschlossen werden.** Den fehlerfreien vollständigen Build muss daher GitHub Actions oder dein Mac bestätigen.

## Veröffentlichung

Siehe **`UPLOAD-ANLEITUNG.txt`** und **`docs/PHASE28-RELEASE-CHECKLIST.md`**. In `.github/workflows/verify.yml` läuft die automatische Quellcode-/Build-Prüfung. `.github/workflows/deploy.yml` wird ausschließlich per `workflow_dispatch` manuell gestartet; der Upload allein soll Phase 27 auf dem iPhone nicht ersetzen.

Bestehende manuelle/abgeschlossene Trainings werden von der neuen Planung nicht automatisch geändert. Neue Wochen und Trainingsvorschläge sind Vorschläge; eine Übernahme erfordert eine bewusste Bestätigung.
