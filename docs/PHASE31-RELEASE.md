# TEMPO Phase 31 — Geschützte Ruhetage und rollierende Vorschau

## Änderungen

- Unter **Tagestraining** ist jeder zukünftige Tag als **trainingsfrei** oder **Recoverytag** fixierbar, einschließlich optionaler Notiz (z. B. Sauna). Dies ist unabhängig von der Dienstfreigabe.
- Nach Auswahl erscheint die **intelligente Wochenumplanung** über die laufende Kalenderwoche hinaus: einschließlich der folgenden zwei Wochen, in einer 3/2/2-Kachelvorschau. Rot bedeutet alte Zuordnung, Grün bedeutet neuen Vorschlag. ✓, X und Alternativen bleiben vorhanden.
- **Bereits vorhandene geplante Rad-, Lauf- und Krafttermine** werden möglichst erhalten und neu verteilt. Gesperrte/manuell fixierte und abgeschlossene Trainings werden nicht still verändert. Wenn ein Konflikt nicht gelöst werden kann, bleibt Speichern deaktiviert.
- Ein angenommener Ruhetag wird im **bereits vorhandenen settings-Store** (kind `fixed-training-rest`) gespeichert. Alle Session-Verschiebungen und diese Tagesfestlegung werden zusammen in einer IndexedDB-Transaktion gespeichert.
- Unter 14 Tage gibt es zusätzlich **Rollierend 10+** (Standard). Der Kalender zeigt vollständige Kalenderwochen in der 3/2/2-Kacheldarstellung, sodass mindestens zehn zukünftige Tage sichtbar sind. **Vorläufige, ungespeicherte Trainingsvorschläge** sind ausdrücklich so markiert und werden aus Dienstplan, Zielen, vorhandenen Einheiten und geschützten Tagen abgeleitet.
- Farbliche Kennzeichnung der Blockschwerpunkte BASE, STRENGTH, MIT, HIT, VOLUME, MOUNTAIN, RUN sowie RECOVERY / TAPER. Wenn beim Verschieben ein Blockwechsel erfolgt, wird er angezeigt.
- Selbst angelegte Trainings auf bewusst freigehaltenen Tagen erfordern zunächst das Aufheben der Freigabesicherung.

## Grenzen

- Die Umplanung verteilt ausschließlich **bereits gespeicherte, geplante** Trainingseinheiten. Zukunftsvorschläge im rollierenden Kalender werden erst nach gesonderter Bestätigung gespeichert; offene Dienste werden nicht automatisch für tatsächlich frei gehalten.
- Fixierte Termine können Konflikte auslösen; TEMPO nimmt keine unsichtbaren Löschungen oder Überschreibungen vor.
- Der komplette Produktions-Build mit React/Vite muss GitHub Actions durchführen. In der Entwicklungsumgebung waren nur Logik-, Release- und gezielte Offline-TypeScript-Tests möglich.

## Datenintegrität

Keine Migration: `tempo-local`, DB-Version `1`, Backup-Schema-Version `1`, **20 Stores** unverändert. Bestehende Garmin-, Leistungs-, Kraft- und abgeschlossene Aktivitäten werden nicht modifiziert. Lokales iPhone-Backup vor Upload empfohlen. GitHub-ZIP enthält niemals lokale Backups oder private GPX/FIT-Aufzeichnungen.
