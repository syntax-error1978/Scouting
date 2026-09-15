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
