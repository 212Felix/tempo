# Phase 37 · Trainingsintervalle und Pausen

Wissenschaftliche Basis (öffentlich):

- Buchheit & Laursen, Sports Medicine 2013, PMID 23539308 (Intervallstruktur, Intensität und Erholung) sowie PMID 23832851.
- Systematic Review, Sports Medicine Open 2024, PMID 38443585: Bei Aktiv- versus Passivpausen gibt es keine universell überlegene langfristige Methode. Pausenwahl abhängig vom Reiz, Intensität und Erholungsdauer.
- Training Session Models in Endurance Sports: A Norwegian Perspective on Best Practice Recommendations, Sports Medicine 2024, DOI 10.1007/s40279-024-02067-4: Belastungs- und Entlastungsdauer und -intensität sind explizite Stellgrößen des Intervalltrainings.
- Meta-Analyse im Journal of Science and Medicine in Sport 2025, PMID 39788807: Umfang und Polarisierung allein garantieren nicht automatisch größere Leistungszuwächse; zwischen Intensitätsverteilungen fanden sich ähnliche Effekte.
- Galán-Rioja et al., IJSPP 2023, PMID 36640771: kein eindeutig überlegenes Periodisierungsmodell; individuelle Belastung und Periodisierung berücksichtigen.

Implementierungsentscheidungen: Zwischenerholung beim Rad benötigt Zeit und FTP-relative Leistung. Für ein vorhandenes, klar definiertes 2×8-Tempo-Workout sind explizite Phasen mit Gesamtzeitabgleich hinterlegt. Andere lückenhafte Workouts bleiben gekennzeichnet und erhalten keine erfundenen Werte. Laufintervalle können aktiv (Pace), passiv (Dauer) oder nutzerdefiniert nach HF-Grenze geplant werden; eine HF-basierte Pause wird im Browser nicht automatisch gemessen oder beendet. 135 bpm ist nur ein mögliches Beispiel, kein universell validierter Zielwert.

Garmin-Import: Vorschläge nur bei eindeutiger Datums-/Sportart-/Zeitnähe. Zuordnung per ausdrücklicher Auswahl (Haken/Kreuz) und anschließendem Gesamtspeichern; keine Doppelzählung, keine automatische Übernahme ohne Bestätigung.
