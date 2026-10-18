# TEMPO Phase 32 – Persönliche Fueling-Bibliothek und Readiness-Follow-up

## Leistungsumfang
- Eigener Menüpunkt Produktbibliothek: Pulver, Gels, Riegel und andere Lebensmittel.
- Manuell eintragen oder per Kamera/Foto OCR-Vorschläge automatisch einlesen; Werte vor dem Speichern immer kontrollieren. Die Bilddatei wird nicht als Datensatz abgelegt.
- Portionsgröße g/ml/Stück, KH, explizites Glukose-/Fruktose-Verhältnis, Natrium (aus Salz optional berechnet), Eiweiß, Fett, Koffein, Mischwasser, Packungsgröße und Preis/Portion.
- Produktdetails mit manueller Sperre, gezieltem Löschen und Grün/Gelb/Rot-Status.
- Schlechtes Training: das tatsächlich verwendete Produkt nach der ersten **eigenständigen** Trainingserfahrung gelb, nach der zweiten unabhängigen negativen Trainingserfahrung rot. Hinweise sind keine Kausalitätsbeweise.
- Einträge im Abschluss-Feedback: tatsächlich verwendete Produkte, Anzahl Portionen, spontan zusätzlich konsumierte KH, Verträglichkeit. Nur neu abgeschlossene Rad-/Laufeinheiten öffnen den entsprechenden Bogen.
- Nacht-/Folgetag-Feedback nur in Readiness, nur am Morgen nach einer dokumentierten und abgeschlossenen Belastung mit Fueling-Eintrag.
- Konservative Erhöhung des KH-Ziels maximal 5 g/h nach mindestens zwei dokumentierten vollständig gut verträglichen Einheiten. Jede manuelle Zielvorgabe bleibt vorrangig.
- Intelligente Wochenumplanung: neues Datum durch Tippen auf Tageskachel wählen, per JA/NEIN vormerken, danach wie bisher gesamte Woche bestätigen.
- Trainingsblock-Plakette platzsparend rechts neben Datum in 14-Tage-Kacheln.

## Kompatibilität & Grenzen
- Datenbank `tempo-local`, Version 1, **alle bisherigen 20 Object Stores** und Backup-Format bleiben unverändert.
- Vorhandene `fuel-product:`-Einträge gelten weiter. Neue Felder sind optional.
- Historische Fueling- und Trainingsprotokolle bleiben unverändert; es gibt keine automatische Datenmigration.
- OCR via Tesseract.js lädt ggf. beim ersten Mal Sprachmodelle und rechnet danach auf dem Endgerät. Schlechte Bildqualität, pro-100-g-Angaben und Zutatenverhältnisse erfordern manuelle Kontrolle. Foto-Erfassung funktioniert daher nur mit Kamerafreigabe bzw. Dateiauswahl.
- Die automatische Gel-/Pulververteilung bleibt vorläufig das Kernmodell des Rechners. Andere Lebensmittel werden in der Bibliothek und tatsächlich konsumierte Portionen im Feedback erfasst; eine automatische Riegel-/Lebensmitteloptimierung ist eine spätere Erweiterung.
- Ein neuer Trainingsplan wird erst nach expliziter Gesamtbestätigung gespeichert. Vorerst werden nur tatsächlich gespeicherte Einheiten umverteilt, nicht dynamisch eingeblendete unverbindliche 14-Tage-Vorschläge.
- Der vollständige Produktions-Build erfordert `npm install` im GitHub-Workflow. Offline-Tests prüfen das Regelwerk; sie ersetzen nicht den Produktions-Build.
