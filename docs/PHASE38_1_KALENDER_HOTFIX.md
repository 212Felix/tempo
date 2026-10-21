# TEMPO Phase 38.1 · Kalender-Stabilisierung

In Phase 38 begann die rollierende Ansicht am heutigen Tag, aber die Wochenüberschrift
verwendete `week[6]`. Bei angebrochenen Wochen war dieser Tag nicht vorhanden;
der Kalender stürzte beim Rendern ab.

Die neue Ansicht gruppiert sichtbare Tage sicher, setzt die Wochenüberschrift auf den letzten
**tatsächlich vorhandenen Tag**, und verwendet bei vollen Wochen das Raster 3/2/2.
Ein CalendarSafeguard zeigt bei anderen Renderfehlern einen Rückweg zur Startseite
statt einer schwarzen Oberfläche. Regressionstests prüfen alle sieben Startwochentage,
Jahreswechsel, 7-, 10- und 14-Tage-Ansichten.

Der lokale Datenbankvertrag bleibt unverändert (`tempo-local`, 20 Stores, Schema 1).
Die persönlichen Aktivitäten sind nicht in den Upload-Dateien enthalten.
Version im Seitenmenü: `V0.38.1`.
