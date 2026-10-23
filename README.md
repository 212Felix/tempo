# TEMPO Phase 33

Lokale Trainings-App mit adaptiver Rad-/Lauf-/Kraftplanung, regenerationsorientierter Wochenumplanung sowie Fueling und persönlicher Produktbibliothek.

## Release 33

- Kompakte Startseite und Readiness-Erklärungen
- Freiwillig ausklappbare Recovery-Erklärung
- Vereinfachte Dienst-Verfügbarkeit: Kraft, Laufen, Stabi, Yoga (+ Rad separat)
- Zwei voneinander getrennte Foto-Eingaben in der Produktbibliothek
- Kein Upgrade der Datenbankstruktur; alle vorhandenen Daten bleiben lokal

Mehr Informationen: `docs/PHASE33-RELEASE.md`.

Prüfen: `npm run test:security && npm run test:logic && npm run build`.

GitHub Pages wird ausschließlich nach erfolgreichem Build auf `main` veröffentlicht.


## Phase 35: Standardwoche und intelligente Umplanung

Im 14-Tage-Plan unter „Meine Standardwoche“ kann der Sportler für Mo–So einen bevorzugten Schwerpunkt
(Ausdauer, Kraft, Zusatz, Recovery oder flexibel) hinterlegen. Diese Vorgabe ist eine **weiche Präferenz**,
kein fest gebuchtes Workout und verändert keine Dienste. Nach einzelnen Ausnahmen orientieren sich neue
Vorschläge automatisch wieder an dieser wiederkehrenden Struktur.

Training per langem Drücken verschieben: TEMPO berechnet nach der Zielbestätigung einen Dreiwochenvorschlag
einschließlich bislang nur virtuell geplanter Trainings. Erst die ausdrückliche Gesamtbestätigung speichert
verschobene Einheiten. Nie werden Dienst-/Schichtdaten angefasst.

Kraft C: Oberkörper, 2 Brust-, 2 Rücken-, 2 Schulter-, 1 Bizeps-, 1 Trizepsübung, 22 Arbeitssätze.
Diese Einheit hat keine direkte Beintrainingsbelastung.


## Phase 38.2 – Alpine-Design und Kraftvorgaben

Neue alpine Startseite, sportartspezifische Hintergründe im Tagestraining (Kalender bewusst schlicht), Vorbelegung der Wiederholungen auf den oberen Mittelwert und zuverlässiges Scrollen zum Seitenanfang nach Seitenwechsel. Details: `docs/PHASE38_2_DESIGN_RELEASE.md`.

## Phase 39 – Garmin Connect Personal API (offiziell)

Über das Seitenmenü **Garmin Synchronisierung** können Aktivitäten von deinem privaten Cloudflare Worker über die offizielle Garmin Connect Personal API in TEMPO übernommen werden. Bereits bekannte Garmin-IDs werden nicht dupliziert, unklare Zuordnungen werden nicht still zusammengeführt und der Trainingsplan bleibt unverändert.

Die private Cloudflare-Bereitstellung erfolgt nur durch einen eigenen GitHub-Actions-Workflow auf ausdrücklichen manuellen Aufruf. Garmin-/Worker-Secrets niemals ins öffentliche Repository oder in `localStorage` eintragen.

Einrichtungsanleitung: `docs/PHASE39-GARMIN-EINRICHTUNG.md`.
Release: `docs/PHASE39-RELEASE.md`.
