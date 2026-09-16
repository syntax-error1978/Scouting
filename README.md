# Plantworld Scout-app

Plaagscouting-app voor op de telefoon, voor gebruik tijdens het scouten van plaaginsecten in de kwekerij.

**Live app: https://syntax-error1978.github.io/Scouting/**

## Wat kan de app?

- **Scouten-tab**: kies een afdeling en een vak. Per vak zie je de status van de vangkaart (welke
  kant, hoeveel dagen in gebruik) en kun je een telling invoeren voor trips, luis, wolluis en witte
  vlieg, met optionele notitie.
- Een vangkaart mag **max. 2 weken per kant** gebruikt worden (instelbaar). De app toont een
  waarschuwing zodra die termijn is verstreken, met knoppen "Kaart gedraaid" en "Kaart vervangen".
- Per afdeling staan **Duponchelia-vangbakken** (aantal zelf in te stellen). Deze tel je wekelijks;
  het feromoon wordt om de **6 weken** vervangen (instelbaar) — ook hiervoor geeft de app een
  waarschuwing.
- **Afdelingen zijn vrij instelbaar**: naam, aantal vakken en aantal Duponchelia-vangbakken staan
  per afdeling in ⚙️ Instellingen → Afdelingen & indeling, en afdelingen zijn toe te voegen of te
  verwijderen. Zo werkt dezelfde app voor elke kwekerij, ongeacht de eigen indeling.
- **Analyse-tab**: overzicht per afdeling (of alle afdelingen samen) over een gekozen periode, met
  totalen per insect, aandachtspunten (kaarten/feromonen die aan vervanging toe zijn) en een
  grafiek per vak en per Duponchelia-vangbak. De volledige cijfers per vak staan alleen in de
  e-mail/CSV-export, niet los op het scherm.
- **Heatmap-plattegrond**: bij "Insecten per vak" kan gewisseld worden tussen de staafgrafiek en een
  plattegrond-heatmap (één cel per vak, per afdeling), gekleurd van geen kleur tot pastel rood naar
  gelang de insectendruk. Wisselen kan met de knoppen of door te swipen op mobiel.
- **Delen/mailen**: de analyse kan als tekst + CSV-bestand gedeeld worden via het native deelvenster
  van de telefoon (WhatsApp, Mail, etc.), met een e-mail-fallback als delen niet beschikbaar is.
- **Alles lokaal**: alle data wordt opgeslagen in de browser op de telefoon zelf (geen server,
  geen account nodig). Maak wel regelmatig een back-up via ⚙️ Instellingen → Back-up exporteren.

## Installeren op je telefoon (als app-icoon, werkt ook offline)

De app is een PWA (Progressive Web App), staat al live op GitHub Pages en heeft geen appstore nodig.

1. Open **https://syntax-error1978.github.io/Scouting/** op je telefoon in de browser.
2. Zet 'm op je startscherm:
   - **Android (Chrome)**: menu (⋮) → "App installeren" / "Toevoegen aan startscherm".
   - **iPhone (Safari)**: deelknop (□↑) → "Zet op beginscherm".
3. De app verschijnt als icoon op je startscherm en start als volledige app (geen browserbalk).
4. Na de eerste keer openen werkt de app ook **zonder internetverbinding**, omdat alle bestanden
   lokaal gecachet worden. Zie je een update niet verschijnen, gebruik dan ⚙️ Instellingen →
   "Controleer op updates", of sluit de app volledig af en open 'm opnieuw.

### Lokaal testen zonder online hosting

```bash
cd Scouting
python3 -m http.server 8080
```

Open daarna `http://<ip-van-je-computer>:8080` op je telefoon (moet op hetzelfde wifi-netwerk
zitten). Let op: `mailto:`/deelfunctie werkt het prettigst via `https://`, lokaal testen via `http`
werkt voor het invoeren en analyseren van data.

## Back-up

Omdat alle data lokaal op het toestel staat (localStorage), kan deze verloren gaan als de
browsergegevens gewist worden. Maak daarom regelmatig een back-up:

⚙️ Instellingen → **Back-up exporteren** (downloadt een `.json`-bestand) en bewaar dit ergens
veilig (bijv. mail het naar jezelf of zet het in een cloudmap). Via **Back-up importeren** kun je
een eerder gemaakte back-up terugzetten, bijvoorbeeld op een nieuwe telefoon.

## Zelf hosten (in ontwikkeling)

Meerdere collega's met een eigen kwekerij willen de app gaan gebruiken. Deze branch is de
werkbranch voor de doorontwikkeling richting zelf hosten op de eigen (Docker-)server van
Plantworld, met als stip op de horizon gedeelde data per kwekerij in plaats van alleen lokale
opslag per telefoon. Zie het architectuurvoorstel dat hierover met ICT is gedeeld voor de
overwogen aanpak (server, database, toegang en fasering).

### Fase 1: gedeelde backend (`server/`)

Er staat nu een werkende, geteste backend in `server/`: een lichte Node.js/Express-API met een
SQLite-database, gedraaid in Docker. Elke kwekerij (locatie) krijgt een eigen toegangscode; alle
scouts van die kwekerij delen dezelfde afdelingen, tellingen, vangkaart- en Duponchelia-status via
deze ene database, in plaats van elk hun eigen lokale kopie.

**Belangrijk:** dit is voorlopig een zelfstandige, los te testen backend — de app zelf
(`index.html`/`app.js`) praat er nog niet mee en blijft dus voorlopig lokale opslag gebruiken. Het
koppelen van de app aan deze API (inclusief offline wachtrij, zodat scouten zonder bereik blijft
werken) is de volgende stap.

**Draaien met Docker:**

```bash
cp .env.example .env        # vul een eigen ADMIN_TOKEN in
docker compose up --build
```

De app + API zijn dan bereikbaar op `http://localhost:8080` (of de servernaam, in productie achter
HTTPS). Data staat in een Docker-volume (`scouting-data`), dus overleeft een herstart van de
container.

**Een kwekerij (locatie) aanmaken**, met het `ADMIN_TOKEN` uit je `.env`:

```bash
curl -X POST http://localhost:8080/api/locations \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Kwekerij Voorbeeld"}'
# → {"id":"...","name":"Kwekerij Voorbeeld","accessCode":"a1b2c3d4"}
```

De teruggegeven `accessCode` is wat een kwekerij straks in de app invoert om verbinding te maken
met zijn eigen gedeelde data (header `X-Access-Code` op elke API-aanroep).

**Beschikbare endpoints** (alle behalve `/api/locations` en `/api/health` vereisen de header
`X-Access-Code: <code>`):

| Methode | Pad | Doel |
|---|---|---|
| POST | `/api/locations` | (admin) nieuwe kwekerij + toegangscode aanmaken |
| GET | `/api/bootstrap` | locatie + afdelingen ophalen |
| POST | `/api/departments` | afdeling toevoegen |
| PATCH | `/api/departments/:id` | afdeling hernoemen/aantallen wijzigen |
| DELETE | `/api/departments/:id` | afdeling en bijbehorende data verwijderen |
| GET | `/api/sync?since=<ISO-tijd>` | alles ophalen dat gewijzigd is sinds `since` |
| POST | `/api/push` | lokale tellingen/status naar de server sturen |

`push` is idempotent (tellingen hebben een client-gegenereerd id, dubbel versturen dupliceert niet)
en kaart-/feromoonstatus gebruikt "laatste wijziging wint" op basis van tijdstip, zodat twee scouts
die tegelijk werken elkaar niet in de wielen rijden.
