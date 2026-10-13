#!/usr/bin/env python3
"""Tel insecten op hele vangkaartfoto's met een getraind model (.pt of .onnx).

De foto wordt net als bij het trainen in overlappende tegels geknipt. Dubbele
detecties op de randen van tegels worden daarna samengevoegd.

Gebruik:
  python predict.py --model runs/detect/train/weights/best.pt foto.jpg
  python predict.py --model vangkaart.onnx ~/nieuwe-fotos/ --save-images --save-labels

Uitvoer (in --out, standaard ./voorspellingen):
  tellingen.csv          aantallen per foto per insect
  <foto>.jpg             foto met gekleurde hokjes  (met --save-images)
  labels/<foto>.txt      YOLO-labels om te controleren in het labelprogramma (met --save-labels)
"""

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from ultralytics import YOLO

from prepare_dataset import IMAGE_EXTS, tile_starts

COLORS = ["#e6194b", "#3cb44b", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6", "#bcf60c"]


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("inputs", nargs="+", type=Path, help="foto's of mappen met foto's")
    p.add_argument("--model", required=True, help="pad naar best.pt of vangkaart.onnx")
    p.add_argument("--out", type=Path, default=Path("voorspellingen"), help="uitvoermap")
    p.add_argument("--tile", type=int, default=640, help="tegelgrootte, gelijk aan die bij het trainen")
    p.add_argument("--overlap", type=float, default=0.2, help="overlap tussen tegels")
    p.add_argument("--conf", type=float, default=0.25, help="minimale zekerheid van een detectie (0-1)")
    p.add_argument("--iou", type=float, default=0.5, help="overlapdrempel voor het samenvoegen van dubbele detecties")
    p.add_argument("--save-images", action="store_true", help="sla foto's met hokjes op")
    p.add_argument("--save-labels", action="store_true", help="sla YOLO-labels op (voor vooraf labelen)")
    return p.parse_args()


def collect_images(inputs):
    files = []
    for item in inputs:
        if item.is_dir():
            files += sorted(p for p in item.iterdir() if p.suffix.lower() in IMAGE_EXTS)
        elif item.suffix.lower() in IMAGE_EXTS:
            files.append(item)
    return files


def nms(boxes, scores, iou_thr):
    """Simpele non-maximum suppression; geeft indexen van de te bewaren boxen."""
    x1, y1, x2, y2 = boxes.T
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.clip(xx2 - xx1, 0, None) * np.clip(yy2 - yy1, 0, None)
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-9)
        order = order[1:][iou < iou_thr]
    return keep


def detect(model, img, tile, overlap, conf, iou_thr):
    width, height = img.size
    step = max(1, int(tile * (1 - overlap)))
    offsets, crops = [], []
    for y in tile_starts(height, tile, step):
        for x in tile_starts(width, tile, step):
            offsets.append((x, y))
            crops.append(img.crop((x, y, min(x + tile, width), min(y + tile, height))))

    boxes, scores, classes = [], [], []
    for start in range(0, len(crops), 16):
        results = model.predict(crops[start:start + 16], imgsz=tile, conf=conf, verbose=False)
        for (x, y), res in zip(offsets[start:start + 16], results):
            if not len(res.boxes):
                continue
            boxes.append(res.boxes.xyxy.cpu().numpy() + [x, y, x, y])
            scores.append(res.boxes.conf.cpu().numpy())
            classes.append(res.boxes.cls.cpu().numpy().astype(int))
    if not boxes:
        return np.zeros((0, 4)), np.zeros(0), np.zeros(0, dtype=int)
    boxes, scores, classes = np.concatenate(boxes), np.concatenate(scores), np.concatenate(classes)

    keep = []
    for cls in np.unique(classes):
        idx = np.where(classes == cls)[0]
        keep += idx[nms(boxes[idx], scores[idx], iou_thr)].tolist()
    keep = np.array(sorted(keep), dtype=int)
    return boxes[keep], scores[keep], classes[keep]


def main():
    args = parse_args()
    files = collect_images(args.inputs)
    if not files:
        sys.exit("geen foto's gevonden")
    model = YOLO(args.model, task="detect")
    names = model.names
    args.out.mkdir(parents=True, exist_ok=True)
    if args.save_labels:
        (args.out / "labels").mkdir(exist_ok=True)

    rows = []
    for path in files:
        with Image.open(path) as raw:
            img = ImageOps.exif_transpose(raw).convert("RGB")
        boxes, scores, classes = detect(model, img, args.tile, args.overlap, args.conf, args.iou)
        counts = Counter(names[c] for c in classes)
        rows.append({"foto": path.name, **{names[i]: counts.get(names[i], 0) for i in sorted(names)}})
        print(f"{path.name}: " + (", ".join(f"{k} {v}" for k, v in sorted(counts.items())) or "niets gevonden"))

        if args.save_images:
            draw = ImageDraw.Draw(img)
            line = max(2, img.width // 800)
            for (x1, y1, x2, y2), cls in zip(boxes, classes):
                draw.rectangle((x1, y1, x2, y2), outline=COLORS[cls % len(COLORS)], width=line)
            img.save(args.out / f"{path.stem}.jpg", quality=90)

        if args.save_labels:
            w, h = img.size
            (args.out / "labels" / f"{path.stem}.txt").write_text("".join(
                f"{c} {(x1 + x2) / 2 / w:.6f} {(y1 + y2) / 2 / h:.6f} {(x2 - x1) / w:.6f} {(y2 - y1) / h:.6f}\n"
                for (x1, y1, x2, y2), c in zip(boxes, classes)), encoding="utf-8")

    with open(args.out / "tellingen.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["foto"] + [names[i] for i in sorted(names)])
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nTellingen opgeslagen in {args.out / 'tellingen.csv'}")


if __name__ == "__main__":
    main()
