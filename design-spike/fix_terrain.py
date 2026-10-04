#!/usr/bin/env python3
"""Terrain fixer per ART-BIBLE v2:
  1. DESATURATE: multiply saturation by 0.65 (terrain must recede behind sprites)
  2. CLUSTER CLEAN: remove orphan 1px speckle (the "AI noise" look) —
     replace isolated pixels with their dominant neighbor color
  3. RE-SNAP to master palette
  4. Re-run seam check (mirror-blend if needed)

Run: venv python3 fix_terrain.py    (all strips in public/sprites/tiles/)
"""
import os, sys, json
import numpy as np
from PIL import Image
import colorsys

SPIKE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(SPIKE, '..', 'public', 'sprites', 'tiles')
STRIP_NAMES = ['town_tiles', 'dgn_ember', 'dgn_tide', 'dgn_hollow', 'dgn_spire', 'dgn_ruins']
TS = 32

def desaturate(arr, factor=0.65):
    """Scale saturation by factor, keep hue/value. Works on RGB uint8."""
    out = arr.copy().astype(float) / 255.0
    mx = out[:,:,:3].max(axis=2)
    mn = out[:,:,:3].min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / (mx + 1e-9), 0)
    # target saturation
    newsat = sat * factor
    # apply: scale chroma around the value (per-pixel lerp toward gray)
    gray = (out[:,:,:3].sum(axis=2) / 3.0)[:, :, None]
    scaled = gray + (out[:,:,:3] - gray) * (newsat[:, :, None] / (sat[:, :, None] + 1e-9))
    out[:,:,:3] = np.clip(scaled, 0, 1)
    return (out * 255).astype(np.uint8)

def cluster_clean(arr):
    """Replace orphan pixels (no same-color 4-neighbor) with the most common
    neighbor color. Two passes for stubborn speckle."""
    rgb = arr[:,:,:3]
    alpha = arr[:,:,3]
    vis = alpha > 0
    for _ in range(2):
        # same-color neighbor masks per direction
        same = np.zeros(vis.shape, bool)
        for dy, dx in ((1,0),(0,1)):
            down = (np.abs(rgb.astype(int) - np.roll(rgb, dy, 0)) == 0).all(axis=2) & vis
            right = (np.abs(rgb.astype(int) - np.roll(rgb, dx, 1)) == 0).all(axis=2) & vis
            same |= down | right
        orphan = vis & ~same
        if not orphan.any():
            break
        # replace each orphan with its most common opaque neighbor color
        ys, xs = np.where(orphan)
        for y, x in zip(ys, xs):
            neighbors = []
            for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
                ny, nx = y+dy, x+dx
                if 0 <= ny < rgb.shape[0] and 0 <= nx < rgb.shape[1] and vis[ny, nx]:
                    neighbors.append(tuple(rgb[ny, nx]))
            if neighbors:
                from collections import Counter
                rgb[y, x] = Counter(neighbors).most_common(1)[0][0]
        # mark as same to avoid infinite loops
        same = np.zeros(vis.shape, bool)
        for dy, dx in ((1,0),(0,1)):
            same |= (np.abs(rgb.astype(int) - np.roll(rgb, dy, 0)) == 0).all(axis=2) & vis
            same |= (np.abs(rgb.astype(int) - np.roll(rgb, dx, 1)) == 0).all(axis=2) & vis
    arr[:,:,:3] = rgb
    return arr

def snap_palette(arr):
    pal = [tuple(v) for v in json.load(open(os.path.join(SPIKE, 'palette', 'master_palette.json'))).values()]
    out = arr.copy()
    vis = out[:,:,3] > 0
    colors = out[:,:,:3].astype(int)
    uniq = {}
    for c in np.unique(colors[vis], axis=0):
        uniq[tuple(c)] = min(pal, key=lambda p: sum((int(a)-int(b))**2 for a, b in zip(c, p)))
    for (r, g, b), (pr, pg, pb) in uniq.items():
        m = vis & (colors[:,:,0] == r) & (colors[:,:,1] == g) & (colors[:,:,2] == b)
        out[m, 0], out[m, 1], out[m, 2] = pr, pg, pb
    return out

def edge_diff(img, axis):
    im = np.array(img.convert('RGB')).astype(int)
    h, w = im.shape[:2]
    total, n = 0, 0
    if axis == 'h':
        total = np.abs(im[:, 0] - im[:, w-1]).sum(); n = h * 3
    else:
        total = np.abs(im[0, :] - im[h-1, :]).sum(); n = w * 3
    return total / n

def make_seamless(arr, blend=4):
    h, w = arr.shape[:2]
    out = arr.copy()
    for y in range(h):
        for i in range(blend):
            r, g, b = out[y, w-blend+i, :3]
            r2, g2, b2 = out[y, i, :3]
            out[y, w-1-i, :3] = ((r+r2)//2, (g+g2)//2, (b+b2)//2)
    for x in range(w):
        for i in range(blend):
            r, g, b = out[h-blend+i, x, :3]
            r2, g2, b2 = out[i, x, :3]
            out[h-1-i, x, :3] = ((r+r2)//2, (g+g2)//2, (b+b2)//2)
    return out

for strip_name in STRIP_NAMES:
    path = os.path.join(TILES, strip_name + '.png')
    strip = np.array(Image.open(path).convert('RGBA'))
    ntiles = strip.shape[1] // TS
    for i in range(ntiles):
        tile = strip[:, i*TS:(i+1)*TS, :]
        tile = desaturate(tile)
        tile = cluster_clean(tile)
        tile = snap_palette(tile)
        # seam check
        img = Image.fromarray(tile)
        if edge_diff(img, 'h') > 40 or edge_diff(img, 'v') > 40:
            tile = make_seamless(tile)
        strip[:, i*TS:(i+1)*TS, :] = tile
    Image.fromarray(strip).save(path)
    print(f"{strip_name}: desaturated + cluster-cleaned ({ntiles} tiles)")