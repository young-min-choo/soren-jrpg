#!/usr/bin/env python3
"""Soren portrait fold — raw 512 painterly bust → 64×64 game portrait.

The plan-C recipe (approved 2026-10-07): keep the PAINTERLY source (the FE feel
comes from the painting), fold through the master palette + a 128-pixel-grid
snap so the result reads as painted-then-pixeled GBA art, not a blurry jpeg.

Chain per identity (design-spike/portrait_batch/<name>/):
  1. center-weighted square crop that keeps the head large (finds the
     brightest skin-mass centroid, then crops a fixed-ratio box around it)
  2. LANCZOS downscale to 128 (half-res pre-fold keeps detail)
  3. 2px pixel-grid snap: mean color per 2x2 block onto a 64 lattice
     (the 'pixel fold' — gives the chunky GBA texture)
  4. quantize to the 38-color master palette (same metric as gates)
  5. dark-plum background key: flood from corners → transparent corners
     + subtle vignette kill; output RGBA
  6. save fold64.png + metrics (colors, skin coverage, corner alpha)

Usage: python3 soren_portrait_fold.py --all [--name key] [--force]
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

REPO = "/home/min/dev/soren-jrpg"
ROOT = os.path.join(REPO, "design-spike", "portrait_batch")
PAL = os.path.join(REPO, "design-spike", "palette", "master_palette.json")


def find_head_box(img):
    """Square crop box centered on the face mass. Returns (x0, y0, size)."""
    a = np.asarray(img.convert("RGB")).astype(int)
    # skin-ish detector: warm bright pixels (the painting's face is the
    # brightest warm mass against dark clothes/background)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    skin = (r > 120) & (r > g + 15) & (g > b) & (r < 256) & (g < 230)
    ys, xs = np.where(skin)
    if len(xs) < 500:  # fallback: center crop
        cx, cy = a.shape[1] // 2, a.shape[0] // 2
    else:
        cx, cy = int(np.median(xs)), int(np.median(ys))
    # head is ABOVE the shoulders: bias the box upward from the skin centroid
    size = 300  # 512 * 0.586 — head+beard+shoulders, background margin
    x0 = max(0, min(a.shape[1] - size, cx - size // 2))
    y0 = max(0, min(a.shape[0] - size, cy - int(size * 0.55)))
    return x0, y0, size


def fold(img):
    x0, y0, size = find_head_box(img)
    crop = img.convert("RGB").crop((x0, y0, x0 + size, y0 + size))
    half = crop.resize((128, 128), Image.LANCZOS)
    # 2x2 block mean → 64 lattice (pixel fold)
    a = np.asarray(half).astype(float)
    blocks = a.reshape(64, 2, 64, 2, 3).mean(axis=(1, 3))  # (64,64,3)
    # quantize the 64-lattice blocks, THEN snap to the 128 grid (2x blocks)
    pal = np.array([tuple(v) for v in json.load(open(PAL)).values()], int)
    flat = np.round(blocks).astype(int).reshape(-1, 3)
    d = np.abs(flat[:, None, :] - pal[None, :, :]).sum(axis=2)
    q = pal[d.argmin(axis=1)].astype(np.uint8).reshape(64, 64, 3)
    snapped = np.asarray(np.repeat(np.repeat(q, 2, axis=0), 2, axis=1))  # 128x128
    # background key: flood-fill from 4 corners over color similarity
    alpha = np.ones((64, 64), bool)
    from collections import deque
    seen = np.zeros((64, 64), bool)
    seed_px = [q[0, 0], q[0, 63], q[63, 0], q[63, 63]]
    dq = deque()
    for (sy, sx) in [(0, 0), (0, 63), (63, 0), (63, 63)]:
        dq.append((sy, sx))
    while dq:
        y, x = dq.popleft()
        if seen[y, x]:
            continue
        seen[y, x] = True
        # match against ANY corner seed (plum bg varies slightly)
        if min(np.abs(q[y, x].astype(int) - s.astype(int)).sum() for s in seed_px) < 60:
            alpha[y, x] = False
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < 64 and 0 <= nx < 64 and not seen[ny, nx]:
                    dq.append((ny, nx))
    out = np.dstack([q, alpha.astype(np.uint8) * 255])
    return Image.fromarray(out, "RGBA"), dict(crop=(x0, y0, size), corner_alpha=int(alpha[0, 0] == 0 and alpha[63, 63] == 0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    names = sorted(os.listdir(ROOT)) if args.all else [args.name]
    if not args.all:
        names = [n for n in names if n]
    for n in names:
        raw = os.path.join(ROOT, n, "raw_512.png")
        out = os.path.join(ROOT, n, "fold64.png")
        if not os.path.exists(raw):
            print(f"[skip] {n}: no raw"); continue
        if os.path.exists(out) and not args.force:
            print(f"[skip] {n}: fold exists"); continue
        img = Image.open(raw)
        folded, info = fold(img)
        folded.save(out)
        arr = np.array(folded)
        vis = arr[arr[:, :, 3] > 0][:, :3]
        colors = len({tuple(x) for x in vis})
        print(f"[fold] {n}: colors={colors} corners_clear={info['corner_alpha']} crop={info['crop']}")
        json.dump(info, open(os.path.join(ROOT, n, "fold_info.json"), "w"))


if __name__ == "__main__":
    main()