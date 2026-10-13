# Roadmap: automatische vangkaart-monitoring

## Einddoel

Een vangkaart in de kas hangt in een vaste houder met een kleine camera. De camera wordt op
vaste tijden wakker, maakt een foto en uploadt die via wifi naar onze eigen server. Daar telt een
AI-model de plaaginsecten (trips, luis, wolluis, witte vlieg), en een dashboard laat per
afdeling en per kaart de aantallen en trends zien.

**Doel:** scoutingwerk efficiënter maken, met minder lopen en tellen, en plagen eerder zien.

```
[Kaarthouder in de kas]                        [Eigen server]                 [Dashboard]
 camera + LED + accu + zonnepaneel             upload-API                     per afdeling/kaart:
 wordt wakker → foto → wifi-upload  ───────►   model telt insecten   ───────► aantallen, trend,
 → weer slapen                                  → database                     foto met hokjes, alarm
```

## Uitgangspunten

- **Alles in eigen beheer:** de foto's, het model en de data staan op onze eigen server. Geen
  externe cloud.
- **Er is wifi in de kas** en die werkt goed. Het model draait daarom op de server, niet op het
  apparaat.
- **Eigen trainingsdata:** het model wordt getraind op foto's van onze eigen kaarten (Van Iperen,
  geel) en onze eigen plagen. Training gebeurt lokaal op een pc met NVIDIA-GPU (zie
  [`ml/README.md`](ml/README.md)).
- **De mens blijft controleren.** Tellingen van het model worden in het begin gecontroleerd.
  Correcties worden nieuwe trainingsdata.

---

## Fase 1: model trainen op telefoonfoto's *(bezig)*

- [x] Scripts voor dataset maken, tegels knippen, trainen en tellen (`ml/`)
- [x] Trainomgeving op de laptop (RTX 4070, PyTorch + CUDA)
- [x] Label Studio lokaal geïnstalleerd met startmenu-item
- [ ] 20–30 kaarten fotograferen in de kas en labelen (`trips`, `luis`, `wolluis`,
      `witte_vlieg`, `overig`)
- [ ] Eerste training en beoordeling (`results.png`, `confusion_matrix.png`)
- [ ] Doorlabelen met voorlabels van het model, tot minimaal enkele honderden voorbeelden per plaag

**Bevindingen tot nu toe:**
- Telefoonfoto's van de hele kaart geven ongeveer 15 pixels/mm. Daarop is trips met het oog te
  herkennen aan afmeting, kleur en vorm, dus deze resolutie is voldoende.
- Reflecties op de glanzende kaart zijn het grootste probleem. Fotografeer in de schaduw of met
  je rug naar het licht.
- Trips is zeldzaam tussen veel andere kleine, donkere insecten. Kies bewust ook kaarten met veel
  trips, zodat er genoeg voorbeelden zijn.

**Resultaat:** een startmodel (`vangkaart.onnx`) en ervaring met het hele traject.

## Fase 2: tellen via de Scout-app (telefoon)

Tussenstap die meteen tijd scheelt en het model laat groeien:

- [ ] Server-API: foto erin, tellingen per insect eruit (FastAPI + ONNX Runtime)
- [ ] HTTPS voor de server (eigen subdomein met certificaat, bv. via Caddy), want de app draait op
      https en browsers blokkeren anders de verbinding
- [ ] Fotoknop in de app: de foto gaat naar de server, het telformulier wordt vooraf ingevuld en
      de scout keurt goed of verbetert
- [ ] Gecorrigeerde foto's verzamelen als nieuwe trainingsdata

## Fase 3: prototype kaarthouder met camera

- [ ] Hardware kiezen en bestellen (zie hieronder)
- [ ] Houder ontwerpen: de kaart zit steeds exact op dezelfde plek, ook na vervangen of draaien
      (klemrail met aanslag)
- [ ] Eigen verlichting: LED-ring of twee LEDs schuin van opzij, eventueel een polarisatiefilter
      tegen glans
- [ ] Eerst op netstroom of adapter, met **dagelijks** een foto
- [ ] Camerafoto's labelen (met voorlabels van het startmodel) en het model daarop bijtrainen,
      want telefoon- en camerafoto's zien er anders uit

### Hardwarekeuze

Het gaat om **pixels per millimeter** op de kaart (ongeveer 25 × 10 cm):

| Camera | Resolutie | Pixels/mm | Geschikt voor trips (±1 mm)? |
|---|---|---|---|
| ESP32-CAM (OV2640) | 2 MP | ±6 | Nee |
| ESP32-S3 + OV5640 | 5 MP | ±10 | Twijfelachtig, eventueel goedkoop testen |
| **Raspberry Pi Zero 2 W + Camera Module 3** | 12 MP, autofocus | ±18 | **Ja, vergelijkbaar met een telefoon** |

**Voorkeur:** Raspberry Pi Zero 2 W met Camera Module 3, en een **timerschakeling** die de stroom
op vaste tijden aanzet. De Pi start op (±30 s), maakt een foto, uploadt die en schakelt zichzelf
uit. Daardoor is het energieverbruik minimaal.

Indicatieve kosten: €100–150 per unit (Pi, camera, timer, zonnepaneel, accu, behuizing). Dit is
een grove schatting; prijzen nog controleren.

## Fase 4: server en dashboard

- [ ] Upload-endpoint voor de camera-units (met een sleutel per apparaat)
- [ ] Database: per foto de kaart-ID, het tijdstip, de tellingen per insect en de foto met hokjes
- [ ] **Toename berekenen:** de kaart vangt cumulatief, dus het verschil met de vorige foto is de
      nieuwe vangst ("+12 trips sinds gisteren")
- [ ] Dashboard: per afdeling/kaart de aantallen en trends, de laatste foto met hokjes, en een
      alarm bij een sterke toename. Dit kan een tab in de Scout-app zijn of bv. Grafana.
- [ ] Koppeling met de bestaande afdelingen en vakken uit de Scout-app
- [ ] Melding als een kaart vervangen moet worden (bestaande regel: max. 2 weken per kant)

## Fase 5: autonome stroomvoorziening en behuizing

- [ ] Zonnepaneel, accu en laadregelaar. Kies **LiFePO4**: gewone Li-ion laadt slecht boven
      ±45 °C, en dat wordt het in een kas snel.
- [ ] Behuizing die tegen vocht en spatwater kan, met een maatregel tegen beslagen lenzen
- [ ] Bewaking op het dashboard: accuspanning en de laatste keer dat een unit iets stuurde, met
      een waarschuwing als een unit niet meer meldt
- [ ] Duurtest van een paar weken in de kas

## Fase 6: uitrollen

- [ ] Aantal posities per afdeling bepalen
- [ ] Meerdere units bouwen en installeren
- [ ] Het model periodiek bijtrainen met nieuwe, gecorrigeerde foto's

---

## Open vragen

- Hoeveel kaartposities willen we uiteindelijk automatiseren?
- Wat voor server hebben we (OS, CPU/RAM), en moet die alleen intern of ook van buitenaf bereikbaar
  zijn?
- Gebruiken we naast gele ook blauwe vangkaarten? Die vragen om eigen trainingsdata.
- Om de hoeveel tijd een foto: dagelijks (betere trend en vroege waarschuwing) of wekelijks?

## Ter vergelijking

Er bestaan commerciële systemen voor automatische vangkaart-monitoring (bijvoorbeeld Trapview).
Die hebben vaak abonnementskosten en slaan de data op in hun eigen cloud. Deze eigen oplossing
houdt alles in huis en wordt afgestemd op onze eigen kaarten en plagen.
