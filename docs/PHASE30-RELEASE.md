# TEMPO Phase 30 – Releasehinweise

## Ablauf und Kernziel

Phase 30 führt die von dir festgelegte Trainingswoche, eine transparente Vorschau zur Umplanung und sportartspezifisches Fueling zusammen. Intensitäten, Zielumfänge und die Wochenprioritäten dienen einer **leistungsorientierten Entwicklung**. Einzelne Tage dürfen verändert werden; dadurch sollen weder Schlüsselintervalle noch Dauerläufe oder bewährte Krafttrainings ohne Grund verschwinden.

## Implementierung

- Vollbilddialog für sieben Tage mit 3/2/2-Kacheln, gestrichenem Alt-Termin, grünem Neu-Termin, ✓/×, Tagesalternativen und finaler Bestätigung. Replannings geschehen nur nach Bestätigung in einer IndexedDB-Transaktion. Änderungen werden nur übernommen, wenn die Originaleinheiten noch unverändert vorliegen. Fixierte Trainingstermine werden ohne explizite Auswahl nicht verschoben.
- Fueling aus Dauer, Sportart, Intensität, Umgebungstemperatur und gewählter KH-Verträglichkeitsstufe. Nutzer kann KH/h, Trinkmenge/h, eigene Produkte und Flaschengröße ändern. Hinweise auf sehr konzentrierte Flaschenmischungen und hohe KH-Ziele.
- GPX wird clientseitig geparst und zu Streckensumme und Höhenmetern verdichtet. **Nur die Summen**, nicht Koordinatenpunkte, werden lokal gespeichert.
- Blockkarten enthalten Beispiele und unverbindliche, anpassbare Wochenkennzahlen. Krafttraining bei hohem Radvolumen wird nicht pauschal halbiert; der Schutz der echten Trainingshistorie hat Vorrang.

## Grenzen der ersten Implementierung

Der aktuelle Umplaner nutzt Regeln und verfügbare Dienst-/Trainingsdaten, **noch kein neuronales Optimierungsmodell**. Es gibt noch keine automatische Kalenderwochen-Übergreifung, keine freie Drag-and-Drop-Verschiebung und keine automatische Ableitung individueller KH-Toleranz aus früheren Verträglichkeitsprotokollen. GPX-Eigenschaften führen nicht automatisch zu Wattprofilen; die geplante Fahrzeit muss aus der Strecke und einem Geschwindigkeitswert geschätzt oder manuell angegeben werden. Bei nicht lösbaren Trainingskonflikten verlangt TEMPO eine manuelle Änderung.

## Sicherung

Vollständig unveränderte Datenbank `tempo-local` Version 1, Backup 1, 20 Stores. Alle neuen Einträge nutzen bestehende Object Stores (`settings`, `fuelingLogs`, `fuelingFollowups`, `plannedSessions`). Keine privaten Garmin-Daten oder Backups im Release. Vor Upload aktuelle Sicherung des iPhones erstellen.
