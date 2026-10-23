# TEMPO Phase 39 – Offizielle Garmin Connect Personal API

## Zweck

Die bestehende TEMPO-App auf `https://212felix.github.io/tempo/` läuft weiter unverändert unter GitHub Pages. Die **zusätzliche** Garmin-Schnittstelle nutzt einen privaten Cloudflare Worker mit D1. Es gibt **keine** Garmin-Passwort-Anmeldung, kein OAuth-Scraping und keine Schlüssel in React, GitHub Pages oder im öffentlichen Repository.

**Garmin Personal API:** https://developer.garmin.com/gc-developer-program/personal/personal-api/

**API-Spezifikation:** https://developer.garmin.com/gc-developer-program/personal/swagger-docs/

**Offizieller Client:** https://github.com/garmin/connect-personal-api-python

Die offizielle Personal API ist „Pull only“. Der Worker fragt alle sechs Stunden ab, filtert Radfahren, Laufen, Schwimmen, lädt neue Aktivitäts-ZUSAMMENFASSUNGEN und legt sie privat in D1 ab. Die Garmin-Personal-API-Key erzeugt serverseitig ein kurzlebiges Zugriffstoken. Eindeutige neue Aktivitäten werden beim Abruf auf dem iPhone sofort in die bestehende lokale TEMPO-Datenbank geschrieben; mögliche Doppelungen werden zur Entscheidung vorgelegt. Bei Kandidaten für einen bestehenden FIT-/CSV-Eintrag wird gefragt, **nie** automatisch ein Duplikat erzeugt.

**Wichtig:** Die Garmin-Personal-API und dein privater Cloudflare-Worker sind noch NICHT verbunden, solange du die Schritte unten nicht selbst durchgeführt hast. Der lokale Garmin-FIT-/CSV-Import funktioniert auch ohne Cloudflare.

## A. Kostenloses Cloudflare-Konto und private Datenbank

1. Öffne `https://dash.cloudflare.com/` und wähle die **kostenlose** Variante. Aktiviere keinen kostenpflichtigen Tarif.
2. Gehe zu **Storage & Databases → D1 SQL Database** (Menünamen können leicht abweichen) und wähle **Create database**.
3. Name der Datenbank: exakt `tempo-garmin-private`.
4. Wähle, falls angeboten, die **EU** als Datenregion. Erstelle die Datenbank.
5. Öffne die Details dieser Datenbank und kopiere die **Database ID** (UUID) privat in deine Notizen. Sie gehört nicht in den Chat.
6. Gehe zum Cloudflare-Konto und notiere die **Account ID**. Diese ist nicht mit dem Garmin-Schlüssel identisch.

D1 auf Workers Free hat Nutzungsgrenzen. Falls diese erreicht werden, pausiert die Synchronisierung – es wird kein bezahlter Tarif aktiviert. Die Cloudflare-Daten liegen in DEINEM Cloudflare-Konto, nicht in GitHub.

## B. Cloudflare-API-Token für die GitHub-Bereitstellung

1. Cloudflare → Mein Profil → **API Tokens → Create Token → Create Custom Token**.
2. Vergib den Namen `TEMPO GitHub Worker Deployment`.
3. Beschränke die Berechtigungen auf dein Konto: **Workers Scripts: Edit** und **D1: Edit** (jeweils Account-Ebene). Falls die UI anders heißt, suche die entsprechenden Edit-Berechtigungen.
4. Lege die Ressource auf dein Cloudflare-Konto fest. Erstelle das Token und kopiere es privat. **Nicht hier im Chat einfügen.**

## C. Drei GitHub-Actions-Secrets einrichten

Im GitHub-Repository `212Felix/tempo`:

**Settings → Secrets and variables → Actions → New repository secret**

Erstelle exakt diese drei Secrets (jeweils Value in GitHub einfügen, niemals in den Quellcode):

- `CLOUDFLARE_API_TOKEN`: das in Schritt B erzeugte Cloudflare-Deployment-Token
- `CLOUDFLARE_ACCOUNT_ID`: deine Cloudflare Account ID aus A
- `CLOUDFLARE_D1_ID`: die UUID deiner privaten D1-Datenbank aus A

**Hier KEINEN Garmin-Schlüssel hinterlegen!** Die GitHub-Deployment-Action soll die Garmin-Trainingsdaten nie sehen.

## D. Privaten Worker über GitHub veröffentlichen

1. Das vollständige Phase-39-Upload-Paket zuerst wie gewohnt auf `main` hochladen. GitHub Pages baut TEMPO V0.39.
2. Auf GitHub im Tab **Actions** den neuen Workflow **TEMPO Phase 39 – Garmin Worker (privat)** auswählen.
3. **Run workflow → main → Run workflow**. Das ist eine einmalige, ausdrücklich manuelle Bereitstellung.
4. Nach erfolgreichem Durchlauf unter Cloudflare **Workers & Pages → tempo-garmin-private** öffnen.
5. Die Worker-URL notieren, etwa `https://tempo-garmin-private.<dein-subdomain>.workers.dev`. Sie darf später in TEMPO eingetragen werden.

Die Cloudflare-Worker-Dateien bleiben im Repository als **Quellcode ohne Geheimnisse**. Die getrennte Action verwendet D1-ID und Deployment-Token nur während der Ausführung. `schema.sql` enthält nur leere Tabellenstrukturen, keine Trainingsdaten.

## E. Erst jetzt: Garmin-Key sicher direkt in Cloudflare eintragen

In Cloudflare **Workers & Pages → tempo-garmin-private → Settings → Variables and Secrets**:

1. **Add secret:** Name `GARMIN_PERSONAL_API_KEY`. Als geheimen Wert DEINEN bereits generierten Garmin-Personal-API-Schlüssel einfügen. „Secret“ auswählen, nicht öffentliche Variable. Nicht in GitHub oder TEMPO eingeben.
2. **Add secret:** Name `TEMPO_BRIDGE_TOKEN`. Einen **anderen**, unabhängigen, möglichst zufällig generierten Zugangscode mit mindestens 32 Zeichen verwenden. Diesen Wert sicher im Passwortmanager merken. Der Code ist ausschließlich für den privaten Zugriff vom iPhone auf deinen Worker gedacht.
3. Werte speichern/deployen, falls die Cloudflare-Oberfläche danach fragt. Der Worker verwendet weiterhin `TEMPO_ALLOWED_ORIGIN=https://212felix.github.io`.

Einen starken Code erzeugst du auf deinem Mac z. B. lokal mit `openssl rand -base64 32` im Terminal. Die Ausgabe nicht in Chat, Screenshots oder GitHub teilen.

**Key-Ablauf:** Garmin Personal Keys können nach der gewählten Laufzeit ablaufen. Dann den Secret-Wert `GARMIN_PERSONAL_API_KEY` in Cloudflare ersetzen; die App muss dafür nicht neu gebaut werden.

## F. Auf dem iPhone verbinden

1. TEMPO öffnen und im Seitenmenü **Garmin Synchronisierung** wählen.
2. **Private Cloudflare-Worker-Adresse:** die Worker-URL aus D eintragen.
3. **TEMPO-Zugangscode:** den separaten `TEMPO_BRIDGE_TOKEN` eingeben – NICHT deinen Garmin-API-Key.
4. **Verbindung prüfen & Aktivitäten laden** antippen.
5. Bei Bedarf **Jetzt synchronisieren** antippen, um Garmin Connect sofort abzurufen.
6. Unklare Doppelungen auswählen: **Verknüpfen**, **als neue Aktivität speichern** oder **überspringen**.
7. Eindeutige neue Aktivitäten sind bereits automatisch in TEMPO übernommen. Für unklare Doppelungen **Geprüfte Aktivitäten lokal übernehmen** antippen. Die Daten erscheinen dann in Garmin-Bibliothek, Leistungswerten und Statistik.

Die Worker-URL speichert TEMPO lokal. Den separaten Zugangscode behält die App nur solange im **Arbeitsspeicher**, wie die Seite aktiv ist; nach Schließen/Neustart musst du ihn erneut eingeben. Das ist ein Sicherheitskompromiss: vollständig unbeaufsichtigter Import bis in den iPhone-Speicher beim nächsten Start erfordert eine zusätzliche sichere Geräteauthentifizierung. Die **Cloud-Abfrage alle sechs Stunden** läuft unabhängig davon automatisiert weiter.

## G. Sicherheits-/Kompatibilitätsregeln

- Kein `GARMIN_PERSONAL_API_KEY`, Bearer-Token, Passwort oder FIT/GPS in öffentlichem Code, öffentlichen GitHub-Artefakten oder Logs.
- GitHub Pages bleibt öffentlich, der Worker liefert Aktivitätsdaten ausschließlich nach Prüfung des **separaten** Zugangscodes. CORS ist auf `https://212felix.github.io` eingeschränkt; CORS allein ist **keine Authentifizierung**.
- Private D1 speichert nur reduzierte Aktivitätszusammenfassungen, keine GPS-Koordinaten.
- Garmin-IDs ergeben stabile Einträge, bestehende FIT-/CSV-Aktivitäten werden bei Übereinstimmung zur manuellen Verknüpfung angeboten.
- TEMPO ändert durch den Import keine `plannedSessions`, `shifts`, `readinessEntries`, `completedSessions`, `strengthSets` oder sonstige Trainingsplanungsdatensätze.
- Keine automatische Terminverschiebung, kein selbstständiges Stornieren oder Einführung von Ruhetagen.
- Alte FIT-/CSV-Dateien, alle 20 IndexedDB-Stores und die existierenden Backups bleiben kompatibel.
- **Niemals App löschen, IndexedDB zurücksetzen oder iOS Safari-Daten löschen.** Vor jedem Upload das TEMPO-JSON-Backup nach iCloud sichern.
- Falls Cloudflare oder Garmin ausfällt, bleibt TEMPO lokal vollständig benutzbar.

## Status

- ✅ Lokaler Code, Cloudflare-Worker und private Bereitstellungs-Action vorbereitet.
- ✅ Keine Garmin-Schlüssel im Quellcode oder Browser-LocalStorage.
- ✅ Server-Cron und manuelle Abfrage implementiert.
- ⚠️ Live-API-Verbindung und echter Cloudflare-Deploy können erst nach deinen Einstellungen getestet werden.
- ⚠️ Der erste GitHub Pages Produktions-Build muss unter **Actions** erfolgreich grün werden.
