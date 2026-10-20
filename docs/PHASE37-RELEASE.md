# TEMPO Phase 37

- Vollständige geplante Rad-Intervallphasen (inklusive aktiver Pausen mit Wattvorgaben) am Beispiel Tempo-Einstieg 2×8 sowie Editor für individuelle Phasen.
- Laufintervallpausen: aktive Trabpause mit Pace, passive Pause nach Zeit, Pause bis individuell gesetzter HF-Grenze (nur manuelle Anzeige, keine live Verbindung).
- Training direkt aus der Tagesansicht dokumentierbar; eigene Rad-Ist-Daten mit Zwischenspeichern/Abschließen. Bestehende Kraft- und Laufprogramme mit konkreter Planung und Satz-/Distanzdokumentation; Ergänzung um Kraft-Fueling und Lauf-Entwurf.
- Garmin: eindeutige Zuordnungsvorschläge mit ✓/✕, Gesamt-Speichern; keine automatische Datenänderung ohne Bestätigung, keine Doppelzählung.
- Tagesdatum zwischen Pfeilen als direkt aktive Datumsauswahl, weiße Schaltflächen optisch korrigiert.
- 20 IndexedDB Stores und Backupschema unverändert.

102 automatisierte Tests bestanden, 87 TypeScript/TSX-Quelldateien syntaktisch geprüft. Vollständiger npm/Vite-Build war lokal mangels Paket-Download nicht möglich; auf GitHub Actions verifizieren.
