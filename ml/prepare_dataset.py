#!/usr/bin/env python3
"""Zet een YOLO-export uit Label Studio om naar een trainingsset met tegels.

Wat het doet:
  1. Verdeelt de gelabelde foto's over train/val (per foto, zodat tegels van
     dezelfde kaart nooit in allebei terechtkomen).
  2. Knipt elke foto in overlappende tegels (standaard 640x640 px) en rekent de
     labels om naar die tegels. Zo blijven kleine insecten als trips zichtbaar.
  3. Schrijft data.yaml met de klassenamen uit classes.txt.

Gebruik:
  python prepare_dataset.py --export ~/labelstudio-export --out ~/dataset
"""

import argparse
import random
import sys
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--export", required=True, type=Path,
                   help="map van de Label Studio YOLO-export (met images/, labels/ en classes.txt)")
    p.add_argument("--out", required=True, type=Path, help="doelmap voor de trainingsset")
    p.add_argument("--val", type=float, default=0.2, help="deel van de foto's voor validatie (standaard 0.2)")
    p.add_argument("--tile", type=int, default=640, help="tegelgrootte in pixels (standaard 640)")
    p.add_argument("--overlap", type=float, default=0.2, help="overlap tussen tegels, 0-0.5 (standaard 0.2)")
    p.add_argument("--min-visible", type=float, default=0.5,
                   help="insect telt mee in een tegel als minstens dit deel erin valt (standaard 0.5)")
    p.add_argument("--empty-keep", type=float, default=0.2,
                   help="deel van de tegels zonder insecten dat bewaard wordt als achtergrondvoorbeeld (standaard 0.2)")
    p.add_argument("--seed", type=int, default=42, help="vaste seed, zodat de verdeling herhaalbaar is")
    return p.parse_args()


def read_classes(export_dir):
    path = export_dir / "classes.txt"
    if not path.exists():
        sys.exit(f"classes.txt niet gevonden in {export_dir}")
    names = [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not names:
        sys.exit("classes.txt is leeg")
    return names


def read_labels(label_path, width, height):
    """Lees een YOLO-labelbestand en geef boxen terug in pixels: (klasse, x1, y1, x2, y2)."""
    boxes = []
    if not label_path.exists():
        return boxes
    for line in label_path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) != 5:
            continue
        cls = int(parts[0])
        cx, cy, w, h = (float(v) for v in parts[1:])
        boxes.append((cls,
                      (cx - w / 2) * width, (cy - h / 2) * height,
                      (cx + w / 2) * width, (cy + h / 2) * height))
    return boxes


def tile_starts(length, tile, step):
    if length <= tile:
        return [0]
    starts = list(range(0, length - tile, step))
    starts.append(length - tile)
    return starts


def tile_image(img, boxes, tile, overlap, min_visible):
    """Geef (x, y, tegelbeeld, boxen-in-tegel) terug voor elke tegel."""
    width, height = img.size
    step = max(1, int(tile * (1 - overlap)))
    for y in tile_starts(height, tile, step):
        for x in tile_starts(width, tile, step):
            tw, th = min(tile, width - x), min(tile, height - y)
            tile_boxes = []
            for cls, x1, y1, x2, y2 in boxes:
                area = (x2 - x1) * (y2 - y1)
                ix1, iy1 = max(x1, x), max(y1, y)
                ix2, iy2 = min(x2, x + tw), min(y2, y + th)
                if ix2 <= ix1 or iy2 <= iy1 or area <= 0:
                    continue
                if (ix2 - ix1) * (iy2 - iy1) / area < min_visible:
                    continue
                tile_boxes.append((cls,
                                   ((ix1 + ix2) / 2 - x) / tw, ((iy1 + iy2) / 2 - y) / th,
                                   (ix2 - ix1) / tw, (iy2 - iy1) / th))
            yield x, y, img.crop((x, y, x + tw, y + th)), tile_boxes


def main():
    args = parse_args()
    names = read_classes(args.export)
    image_dir, label_dir = args.export / "images", args.export / "labels"
    if not image_dir.is_dir():
        sys.exit(f"map {image_dir} niet gevonden")

    images = sorted(p for p in image_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    if not images:
        sys.exit(f"geen foto's gevonden in {image_dir}")
    unlabeled = [p.name for p in images if not (label_dir / f"{p.stem}.txt").exists()]
    if unlabeled:
        print(f"Let op: {len(unlabeled)} foto('s) zonder labelbestand worden overgeslagen, bv. {unlabeled[0]}")
        images = [p for p in images if p.name not in unlabeled]
    if len(images) < 2:
        sys.exit("minstens 2 gelabelde foto's nodig (1 voor train, 1 voor val)")

    rng = random.Random(args.seed)
    rng.shuffle(images)
    n_val = min(len(images) - 1, max(1, round(len(images) * args.val)))
    splits = {"val": images[:n_val], "train": images[n_val:]}

    stats = {}
    for split, files in splits.items():
        out_img = args.out / "images" / split
        out_lbl = args.out / "labels" / split
        out_img.mkdir(parents=True, exist_ok=True)
        out_lbl.mkdir(parents=True, exist_ok=True)
        counts, n_tiles = Counter(), 0
        for path in files:
            # Telefoons slaan de draaiing vaak alleen in EXIF op; Label Studio toont de
            # foto rechtop, dus de labels horen bij de rechtop gezette versie.
            with Image.open(path) as raw:
                img = ImageOps.exif_transpose(raw).convert("RGB")
            boxes = read_labels(label_dir / f"{path.stem}.txt", *img.size)
            for cls, *_ in boxes:
                if cls >= len(names):
                    sys.exit(f"{path.name}: klasse {cls} staat niet in classes.txt")
            for x, y, tile_img, tile_boxes in tile_image(img, boxes, args.tile, args.overlap, args.min_visible):
                if not tile_boxes and rng.random() >= args.empty_keep:
                    continue
                stem = f"{path.stem}_x{x}_y{y}"
                tile_img.save(out_img / f"{stem}.jpg", quality=95)
                (out_lbl / f"{stem}.txt").write_text(
                    "".join(f"{c} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}\n" for c, cx, cy, w, h in tile_boxes),
                    encoding="utf-8")
                counts.update(c for c, *_ in tile_boxes)
                n_tiles += 1
        stats[split] = (len(files), n_tiles, counts)

    yaml_lines = [f"path: {args.out.resolve()}", "train: images/train", "val: images/val", "names:"]
    yaml_lines += [f"  {i}: {name}" for i, name in enumerate(names)]
    (args.out / "data.yaml").write_text("\n".join(yaml_lines) + "\n", encoding="utf-8")

    print(f"\nKlaar: {args.out / 'data.yaml'}")
    for split, (n_photos, n_tiles, counts) in stats.items():
        per_class = ", ".join(f"{names[i]}: {counts.get(i, 0)}" for i in range(len(names)))
        print(f"  {split:5s} {n_photos} foto's -> {n_tiles} tegels | {per_class}")
    print("\nInsecten op de rand van twee tegels tellen in beide tegels mee; dat is normaal.")


if __name__ == "__main__":
    main()
