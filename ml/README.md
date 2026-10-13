# Vangkaart-AI: zelf een model trainen

Met deze map train je thuis een model dat insecten op vangkaartfoto's herkent en telt. Het
resultaat is één bestand (`vangkaart.onnx`) dat later op de server, of in de app, gebruikt kan
worden.

```
foto's maken → labelen (Label Studio) → prepare_dataset.py → trainen → exporteren → predict.py
```

| Bestand | Wat |
|---|---|
| `prepare_dataset.py` | Zet een Label Studio-export om naar een trainingsset: verdeling train/val, foto's in tegels knippen, `data.yaml`. |
| `predict.py` | Telt insecten op hele foto's met een getraind model. Maakt een CSV, foto's met hokjes en eventueel labels om mee verder te labelen. |
| `requirements.txt` | Benodigde Python-pakketten (behalve PyTorch, zie installatie). |

---

## 1. Foto's maken

**Liefst de hele kaart.** Later in de app fotografeer je ook de hele kaart. Het model leert
insecten herkennen op het formaat waarop ze op zo'n foto staan, dus de trainingsfoto's moeten
daarop lijken.

**Een stukje van de kaart mag ook, maar:**
- **Label dan elk insect op dat stukje**, niet alleen het insect waar het je om ging. Een insect
  zonder hokje leert het model "dit is géén insect".
- **Neem het van dezelfde afstand als een foto van de hele kaart** en knip het stukje er later op
  de pc uit. Ga niet dichterbij staan of inzoomen: dan worden de insecten groter dan het model ze
  later te zien krijgt.

Een stukje is vooral handig om **zeldzame soorten bij te voeren**: heb je weinig wolluis, knip dan
stukjes met wolluis uit extra foto's.

**Tips voor een goede foto:**
- recht boven de kaart, de kaart vlak en helemaal in beeld;
- gelijkmatig licht, geen flits-reflectie en geen harde schaduw van je hand of telefoon;
- de hoogste resolutie, en de hoofdcamera in plaats van de groothoeklens;
- elke keer ongeveer dezelfde afstand;
- controleer een foto ingezoomd op de pc: herken je zelf een trips? Dan is de foto goed genoeg.
- Neem ook kaarten mee met veel vuil, stof en andere beestjes, en van beide kanten. Dat maakt het
  model robuuster.

Zet alle foto's in één map, bijvoorbeeld `~/vangkaarten/`.

## 2. Installatie

### 2a. NVIDIA-kaart (bv. laptop met RTX 4070)

```bash
# Driver controleren: je kaart moet in de lijst staan
nvidia-smi

# Python-omgeving met een door PyTorch ondersteunde Python-versie
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv --python 3.12 ~/vangkaart-env
source ~/vangkaart-env/bin/activate

# PyTorch (de standaardversie bevat CUDA al) en de rest
uv pip install torch torchvision
uv pip install -r requirements.txt

# Test, verwacht: True  NVIDIA GeForce RTX 4070 Laptop GPU
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

Op een laptop: stekker erin, energieprofiel op *Prestaties*, en voeg bij het trainen `workers=4`
toe als je 16 GB werkgeheugen hebt. Met 8 GB videogeheugen: `yolo26s` met `batch=16`, of
`yolo26m` met `batch=8`.

### 2b. AMD-kaart (Nobara/Fedora, RX 6700)

```bash
# GPU-rechten (daarna uitloggen en opnieuw inloggen)
sudo usermod -aG render,video $USER

# Python-omgeving met een door PyTorch ondersteunde Python-versie
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv --python 3.12 ~/vangkaart-env
source ~/vangkaart-env/bin/activate

# PyTorch met ROCm: neem het actuele commando van https://pytorch.org
# (Linux, Pip, ROCm). Het lijkt op:
uv pip install torch torchvision --index-url https://download.pytorch.org/whl/rocm6.4

# De rest
uv pip install -r requirements.txt
```

De RX 6700 (gfx1031) staat niet op AMD's officiële lijst, maar werkt als je ROCm laat denken dat
het een gfx1030 is. Zet deze regel in je `~/.bashrc`:

```bash
export HSA_OVERRIDE_GFX_VERSION=10.3.0
```

Test:

```bash
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
# Verwacht: True  AMD Radeon RX 6700 ...
```

PyTorch noemt een AMD-kaart onder ROCm ook `cuda`, dat klopt.

## 3. Labelen met Label Studio

```bash
uv pip install label-studio      # in dezelfde of een aparte omgeving
label-studio start                # opent http://localhost:8080
```

1. Maak een account aan (dat blijft lokaal) en daarna een nieuw project.
2. **Labeling Setup** → *Computer Vision* → **Object Detection with Bounding Boxes**.
3. Verwijder de voorbeeldlabels en maak deze labels aan:
   `trips`, `luis`, `wolluis`, `witte_vlieg`, `overig`
   - `overig` is voor alles wat geen plaag is maar er wel op lijkt (andere insecten, sluipwespen,
     vuil). Zo leert het model wat het **niet** moet tellen.
4. **Import** → sleep je foto's erin.
5. Trek per foto om elk insect een strak hokje en kies de soort. Zoom flink in (scrollwiel).
6. Klaar met een ronde? **Export** → **YOLO** (met afbeeldingen) en pak de zip uit, bijvoorbeeld
   naar `~/export-ronde1/`. Daarin staan `images/`, `labels/` en `classes.txt`.

**Beginnen:** label eerst 20 à 30 hele kaarten volledig. Twijfel je over een insect, label het dan
als `overig` of sla die foto over. Een fout label is erger dan geen label.

## 4. Trainingsset maken

```bash
cd ml
python prepare_dataset.py --export ~/export-ronde1 --out ~/dataset
```

Het script:
- verdeelt de foto's over **train (80%)** en **val (20%)**. Val gebruikt het model niet om van te
  leren, maar om te controleren hoe goed het is;
- knipt elke foto in **tegels van 640×640** met 20% overlap, anders zijn trips te klein om te
  zien;
- schrijft `~/dataset/data.yaml`;
- laat per soort zien hoeveel voorbeelden er zijn. **Mik op minstens een paar honderd per
  soort.** Bij een soort met veel minder voorbeelden wordt het model daar slecht in.

## 5. Trainen

```bash
yolo train model=yolo26s.pt data=~/dataset/data.yaml imgsz=640 epochs=100 batch=16
```

- `yolo26s.pt` is een voorgetraind model in maat *small*, dat wordt automatisch gedownload. Met
  12 GB kun je later ook `yolo26m.pt` (medium) proberen.
- Krijg je een geheugenfout, zet dan `batch=8`.
- Valt de training uit met vage HIP-, MIOpen- of NaN-fouten, voeg dan `amp=False` toe.
- De eerste keer duurt het opstarten lang, omdat MIOpen zijn rekenkernels compileert. Daarna gaat
  het sneller.

De resultaten staan in `runs/detect/train/`. Kijk vooral naar:
- `results.png`: de lijnen voor **mAP50** moeten oplopen en afvlakken;
- `confusion_matrix.png`: welke soorten het model met elkaar verwart;
- `val_batch0_pred.jpg`: de voorspellingen van het model naast de echte labels.

## 6. Testen op hele foto's

```bash
python predict.py --model runs/detect/train/weights/best.pt --save-images ~/nieuwe-fotos/
```

Je krijgt `voorspellingen/tellingen.csv` met de aantallen per foto, en de foto's met gekleurde
hokjes. **Vergelijk die tellingen met je eigen tellingen**, dat is de echte test.

`--conf` (standaard 0.25) bepaalt hoe zeker het model moet zijn. Lager betekent meer gevonden,
maar ook meer valse meldingen.

## 7. Volgende rondes: vooraf laten labelen

Handmatig alles labelen is het meeste werk. Vanaf ronde 2:

```bash
python predict.py --model runs/detect/train/weights/best.pt --save-labels --conf 0.15 ~/nieuwe-fotos/
```

Dat geeft in `voorspellingen/labels/` per foto een labelbestand met de voorstellen van het model.
Die kun je in Label Studio importeren als voorlabels (zie de documentatie van
`label-studio-converter import yolo`), zodat je alleen nog hoeft te **verbeteren**. Exporteer
daarna alles opnieuw, draai `prepare_dataset.py` opnieuw en train opnieuw. Elke ronde wordt het
model beter en het labelen sneller.

**Gebruik bij elke ronde dezelfde `--seed`** (standaard 42), zodat de oude foto's in dezelfde
train/val-verdeling blijven.

## 8. Exporteren naar ONNX

```bash
yolo export model=runs/detect/train/weights/best.pt format=onnx imgsz=640
cp runs/detect/train/weights/best.onnx ~/vangkaart.onnx
```

Dit bestand gaat later naar de server. `predict.py` werkt er ook mee:
`python predict.py --model ~/vangkaart.onnx foto.jpg`.

> **Licentie:** Ultralytics YOLO valt onder AGPL-3.0. Voor eigen gebruik binnen het bedrijf is dat
> geen probleem. Wil je het model als dienst aanbieden aan andere bedrijven, kijk dan eerst naar
> de licentievoorwaarden.
