# TEMPO – Adaptive Trainingsplanung (Phase 28, Entwicklungsstand)

**Status: Quellcode integriert, Logiktests bestanden, Produktions-Build / iPhone-Freigabe noch offen.**

## Ziel und Geltungsbereich

Diese Phase ergänzt die bestehende TEMPO-App um blockorientierte, überprüfbare
Trainingsempfehlungen für Rad, Laufen, Kraft und Erholung. Programm-Updates sind
von den lokal gespeicherten Nutzerdaten getrennt. Der bestehende IndexedDB-Name
`tempo-local`, die Datenbankversion 1 und die 20 Stores bleiben unverändert.
Es werden keine Nutzerziele und keine Trainingsdatensätze im veröffentlichten
Programmcode gespeichert.

### Ziele als Eingaben – ausschließlich aus der lokalen Datenbank

- Langdistanzziel B: Mallorca 312 (laut aktuellem Backup Ende April 2027;
  Terminstatus flexibel / Urlaub offen). Event-Eigenschaft `kind:trainingsblock`
  wird **nicht** als abgehakter oder verbindlich stattfindender Wettkampf gelesen.
- Saisonhöhepunkt A: Ötztaler RM (Ende August 2027; Urlaub offen). Dieser Status
  bedeutet noch **keinen** garantierten Start oder freigegebenen Urlaub.
- Lauf-Nebenziel B: Cooper-Test 3.200 m / 12 Minuten (ohne gespeichertes Datum).
  Deshalb werden weder ein fiktiver Wettkampftag noch sofortige harte
  Laufintervalle erzeugt.

Diese Ziele bleiben in `events` unverändert, auch wenn die Wochenübersicht
aus ihren Angaben abgeleitet wird.

## Makro-, Meso- und Mikrozyklus

Die Menüseite **Blockübersicht → Adaptive Blockperiodisierung** zeigt
52 anklickbare Trainingswochen, beginnend mit dem Montag der aktuellen Woche.
Jede Woche trägt eine der folgenden Empfehlungen:

| Kürzel | Schwerpunkt | Typische Anpassung |
|---|---|---|
| BASE | Grundlagenausdauer | Z2-Routine und dosierte Qualität |
| STRENGTH | Kraftbasis | Zwei Krafttermine bei passender Belastung |
| MIT | Sweet Spot / Schwelle | Eine Qualitätseinheit mit längeren Intervallen |
| HIT | VO₂max | Maximal eine Qualitätsfahrt, nur mit passender Trainingshistorie |
| VOLUME | Radvolumen | Mehr lockere Zeit, reduzierte Beinkraftsätze |
| MOUNTAIN | Längere Berge | Anstiege, Verpflegung, Pacing |
| RUN | Laufblock | Schonender Laufaufbau, falls Nutzerblock gewählt |
| TAPER | Taper / Eventwoche | Deutlich weniger Umfang, keine Pflichtintervalle |
| RECOVERY | Erholung nach Event | Keine zusätzliche Belastung automatisch einplanen |

Grundsätzlich folgt auf je drei Trainingswochen eine Entlastungswoche. Die
Periodisierung wird relativ zu den aktuell im Profil gespeicherten Eventdaten
berechnet. Benutzerdefinierte Sonderblöcke übersteuern – außerhalb von Event-
und Erholungsfenstern – den allgemeinen Schwerpunkt.

**Schichtdienst und Verfügbarkeit bestimmen den realen Tag.** Unbestätigte
Schichten erhalten keine feste automatisch vorgeschlagene Einheit. Lange
Grundlagenfahrten werden bevorzugt an freien Tagen vorgeschlagen, Qualitäts-
training nur in geeigneten Fenstern. Hohe dokumentierte Belastung und aktuelle
Readiness schränken die Vorschläge ein. Pendeln zählt als Belastung und darf
bei gleichzeitiger Nutzung als Rad-Workout nicht doppelt gewertet werden.

### Krafttraining: aktiv reduzierte *neue Satzvorschläge*

Die Kraftvorlagen A und B enthalten zusammen regulär 20 Unterkörper-Arbeitssätze
und ergänzende Oberkörperübungen. In einer VOLUME-Woche empfiehlt die App 10
statt 20 Unterkörper-Arbeitssätze, auf A und B verteilt. Bei HIT oder MOUNTAIN
wird ebenfalls reduziert; die Oberkörperübungen bleiben unverändert. Die
bereits protokollierten Sätze behalten **immer** ihren bisherigen Umfang und
ihre Daten, selbst wenn sie die neue Empfehlung überschreiten. Der Coach gibt
keine verschärften Maximalgewichte oder Training bis zum Versagen vor.

Der Dosierungsalgorithmus ist eine **konservative Planungsheuristik**, kein
zwingendes medizinisches oder sportwissenschaftlich eindeutiges Soll.

### Intervallinhalte

Die Wattbereiche werden dynamisch aus dem lokal gespeicherten FTP berechnet,
nicht als fixe private Zahl im Quellcode hinterlegt. Beispiele:

- MIT: 2 × 10 min bei ca. 88–94 % FTP mit langer Pause und Ein-/Ausrollen.
- HIT: 4 × 3 min bei ca. 105–112 % FTP, **nur** bei ausreichender jüngerer
  Radtrainingshistorie. Bei wenig Daten wechselt der Schwerpunkt auf MIT.
- MOUNTAIN: 3 × 8 min bei ca. 80–90 % FTP, bergspezifisch und kontrolliert.
- RUN: zunächst locker; Cooper-Test ist ein langfristiges Ziel, kein Grund
  für sofortige maximale 800-m-Intervalle.

### Wochendauer

Das System leitet nur dann eine Orientierungsbandbreite ab, wenn mindestens
drei unterschiedliche Wochen mit dokumentierter Aktivität in den letzten
42 Tagen vorhanden sind. Bei weniger Daten wird **keine** willkürliche
Stundenzahl empfohlen und es gibt keine automatische Volumensteigerung.
Orientierungsstunden gelten nur für die nächsten vier Wochen, nicht als
scheinbar exakte Vorhersage für den Sommer 2027. Sehr lange Fahrten werden
nur vorsichtig gegenüber jüngster tatsächlich dokumentierter Belastung erhöht.

## Datensicherheit und Grenzen

1. `deriveAdaptiveWeeks` und `adjustSuggestedSession` sind reine Funktionen:
   sie lesen Eingaben, erzeugen Vorschläge und schreiben nicht in IndexedDB.
2. Bereits geplante bzw. absolvierte Einheiten belegen ihre Termine;
   `commitGeneratedPlan` ergänzt ausschließlich **noch unbelegte Tage** nach
   expliziter Bestätigung. Die bestehende Sicherung und deine manuellen
   Einheiten werden nicht ersetzt oder gelöscht.
3. Neue Kraft-Satzfelder werden blockabhängig reduziert; vorhandene
   `strengthSets` mit höherem Satzindex bleiben sichtbar und unberührt.
4. Ein vorläufiger Eventtag wird für die automatische Neubelegung reserviert;
   daraus entsteht kein protokollierter Wettkampf.
5. Die alte Datenbankstruktur bleibt bei Version 1. Ein Upgrade wird nicht
   automatisch als abgeschlossen betrachtet, bevor der native Build auf einem
   Mac und ein Vergleich zweier iPhone-Backups bestanden sind.
6. Der FIT-/iCloud-Transfer bleibt ein separates Arbeitspaket; diese
   Planungsphase implementiert noch **keine** automatische Mac→iPhone-Synchronisierung.

**Nicht implementiert:** verlässliche individuelle TSS-/CTL-/ATL-Modellierung
mit vollständiger Garmin-Power-Historie; eine personalisierte Laktatdiagnostik;
automatisch eskalierende verdichtete 5-HIT-Sessions-Perioden; automatisches
Verschieben bereits gespeicherter Trainings; Echtzeit-iCloud-Sync.

## Wissenschaftliche Einordnung

- Rønnestad et al., *Block periodization of high-intensity aerobic intervals
  provides superior training effects in trained cyclists*, Scand J Med Sci
  Sports (2014): Forschungsbeispiel zur konzentrierten HIT-Blockplanung.
  https://pubmed.ncbi.nlm.nih.gov/22646668/
- Mølmen et al., *Block periodization of endurance training – a systematic
  review and meta-analysis* (2019): positive, aber wegen kleiner Studien und
  Qualitätsmängel vorsichtig zu interpretierende Effekte.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC6802561/
- Pablos et al., *Resistance Training for Cyclists: Scientific Evidence and
  Practical Recommendations* (2026): zwei Krafttermine pro Woche und
  Kraft-Erhaltung in belastungsreichen Phasen können sinnvoll sein; konkrete
  optimale Satzanzahlen müssen individuell geprüft werden.
  https://onlinelibrary.wiley.com/doi/10.1111/sms.70377
- Rosa Klöser / SCYENCE: Coaching mit Periodisierung anhand A-/B-Zielen;
  exemplarischer öffentlicher vierwöchiger SCYENCE-Gravel-Trainingsplan.
  https://www.trainingpeaks.com/training-plans/cycling/gran-fondo-century/tp-556065/rosa-kloser-x-scyence-gravel-racing-plan-4-wochen
  https://roadmancycling.com/podcast/ep-9-the-smartest-way-to-train-for-more-speed-on-gravel-rosa-kl-s/transcript

Das **SCYENCE-Konzept** (korrekte Schreibweise) wird hier konzeptionell
aufgegriffen, ohne ein urheberrechtlich geschütztes Trainingsprodukt zu
reproduzieren oder Profiumfänge von 14–25 h/Woche unkritisch zu übertragen.
Die hier implementierte HIT-Woche ist bewusst deutlich zurückhaltender als
die im Rønnestad-Experiment gebündelten HIT-Blöcke. Sie ist eine sichere
Startheuristik, nicht der Anspruch, die Praxis von Rosa Klöser exakt
nachzubilden.

## Entwicklertests

Nach lokalem `npm install` auf dem Mac:

```bash
npm run test:logic
npm run build
```

`npm run test:logic` testet Kalender/Datenschutz, Saisonziele, Entlastung,
Trainingsempfehlungen und bestehende Planerschutzregeln. `npm run build`
benötigt die externen NPM-Abhängigkeiten inklusive `@garmin/fitsdk`.

Das Archiv ist eine **Entwicklungsversion**. Ohne erfolgreichen Build,
Test der realen PWA und Vorher-/Nachher-Backupvergleich **nicht bei GitHub
veröffentlichen**.
