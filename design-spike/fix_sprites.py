#!/usr/bin/env python3
"""Sprite fixer — enforces ART-BIBLE v2 on battle sprites.

Passes (in order):
  1. RE-KEY: for assets whose corners are opaque (chroma-key missed),
     re-run edge-color chroma-key from the RAW.
  2. DESPILL: remove residual bg-color fringe on boundary pixels
     (pull them toward the sprite's interior colors).
  3. OUTLINE: add a continuous plum outline on the alpha boundary.
  4. Re-snap palette (outline color is a master-palette plum).

Run: venv python3 fix_sprites.py          # fixes all failing sprites in place
"""
import os, sys, json
import numpy as np
from PIL import Image

SPIKE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(SPIKE, 'raw_battle')
PUB = os.path.join(SPIKE, '..', 'public', 'sprites', 'battle')
BOSS = {'boss_goblin', 'boss_magma', 'boss_tide', 'boss_hollow', 'boss_storm',
        'boss_disgraced', 'boss_aldric_p1', 'boss_aldric_p2'}

sys.path.insert(0, SPIKE)
from process_battle_sprites import chroma_key  # reuse the auto-bg-detect keyer

PLUM = (42, 34, 51)  # master-palette plum outline

def load(p):
    return Image.open(p).convert('RGBA')

def boundary_mask(alpha):
    a = alpha > 0
    return a & (np.roll(~a, 1, 0) | np.roll(~a, -1, 0) |
                np.roll(~a, 1, 1) | np.roll(~a, -1, 1))

def rekey(key):
    """Re-chroma-key from raw at native size."""
    raw = os.path.join(RAW, key + '.png')
    if not os.path.exists(raw):
        return None
    nat = 48 if key in BOSS else 32
    img = chroma_key(Image.open(raw))
    # quantize to native grid
    import subprocess
    tmp = f'/tmp/rekey_{key}.png'
    img.save(tmp)
    subprocess.run(['magick', tmp, '-filter', 'point', '-resize', f'{nat}x{nat}!',
                    '+dither', '-colors', '24', tmp], check=True, timeout=30)
    q = Image.open(tmp).convert('RGBA')
    return np.array(q)

def despill(arr):
    """Boundary pixels: replace with the nearest NON-boundary opaque color."""
    alpha = arr[:,:,3]
    a = alpha > 0
    bnd = boundary_mask(alpha)
    if not bnd.any():
        return arr
    # interior mask (opaque, not boundary)
    interior = a & ~bnd
    if not interior.any():
        return arr
    interior_colors = arr[interior][:, :3].astype(float)
    bcolors = arr[bnd][:, :3].astype(float)
    # for each boundary px, nearest interior color (subsample interior for speed)
    if len(interior_colors) > 512:
        idx = np.random.default_rng(0).choice(len(interior_colors), 512, replace=False)
        ref = interior_colors[idx]
    else:
        ref = interior_colors
    # vectorized nearest
    d = ((bcolors[:, None, :] - ref[None, :, :]) ** 2).sum(axis=2)
    nearest = ref[d.argmin(axis=1)]
    arr[bnd, 0] = nearest[:, 0]
    arr[bnd, 1] = nearest[:, 1]
    arr[bnd, 2] = nearest[:, 2]
    return arr

def outline(arr, color=PLUM):
    """Draw a 1px outline in the transparent pixels adjacent to opaque ones,
    then re-trim so the outline fits inside the canvas with a margin."""
    alpha = arr[:,:,3]
    a = alpha > 0
    ring = ~a & (np.roll(a, 1, 0) | np.roll(a, -1, 0) |
                 np.roll(a, 1, 1) | np.roll(a, -1, 1))
    # clear wraparound rows/cols
    ring[0, :] &= False
    ring[-1, :] &= False
    ring[:, 0] &= False
    ring[:, -1] &= False
    arr[ring, 0], arr[ring, 1], arr[ring, 2] = color
    arr[ring, 3] = 255
    # re-trim: paste content centered on fresh canvas of same size
    ys, xs = np.where(arr[:,:,3] > 0)
    if len(ys):
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        trimmed = arr[y0:y1+1, x0:x1+1]
        h, w = arr.shape[:2]
        canvas = np.zeros_like(arr)
        oy = (h - trimmed.shape[0]) // 2
        ox = (w - trimmed.shape[1]) // 2
        # if the trim exceeds the canvas, nearest-point scale down is NOT allowed —
        # shrink by cropping to the largest centered square that fits
        th, tw = trimmed.shape[:2]
        if th >= h or tw >= w:
            crop = min(h, w) - 2
            cy, cx = th // 2, tw // 2
            trimmed = trimmed[max(0, cy - crop//2):cy - crop//2 + crop,
                              max(0, cx - crop//2):cx - crop//2 + crop]
            oy, ox = (h - trimmed.shape[0]) // 2, (w - trimmed.shape[1]) // 2
        canvas[oy:oy+trimmed.shape[0], ox:ox+trimmed.shape[1]] = trimmed
        return canvas
    return arr

def snap_palette(arr):
    pal = [tuple(v) for v in json.load(open(os.path.join(SPIKE, 'palette', 'master_palette.json'))).values()]
    vis = arr[:,:,3] > 0
    colors = arr[:,:,:3].astype(int)
    # map unique colors
    out = arr.copy()
    uniq = {}
    for c in np.unique(colors[vis], axis=0):
        uniq[tuple(c)] = min(pal, key=lambda p: sum((int(a)-int(b))**2 for a, b in zip(c, p)))
    # vector apply
    for (r, g, b), (pr, pg, pb) in uniq.items():
        m = vis & (colors[:,:,0] == r) & (colors[:,:,1] == g) & (colors[:,:,2] == b)
        out[m, 0], out[m, 1], out[m, 2] = pr, pg, pb
    return out

def fix(key, do_rekey=False):
    pub_path = os.path.join(PUB, key + '.png')
    arr = np.array(load(pub_path)) if os.path.exists(pub_path) else None
    if do_rekey or arr is None or (arr[0,0,3] != 0):
        fresh = rekey(key)
        if fresh is not None:
            arr = fresh
    if arr is None:
        return f"{key}: no source"
    h, w = arr.shape[:2]
    if arr[0,0,3] != 0 or arr[0,w-1,3] != 0 or arr[h-1,0,3] != 0 or arr[h-1,w-1,3] != 0:
        return f"{key}: corners still opaque after rekey"
    arr = despill(arr)
    arr = outline(arr)
    arr = snap_palette(arr)
    Image.fromarray(arr).save(pub_path)
    return f"{key}: fixed (despill+outline+snap)"

if __name__ == '__main__':
    keys = sys.argv[1:]
    if not keys:
        # all battle sprites
        keys = [f[:-4] for f in sorted(os.listdir(PUB)) if f.endswith('.png')]
    for k in keys:
        needs_rekey = k.startswith(('armored_knight', 'goblin', 'boss_storm', 'jellyfish'))
        print(fix(k, do_rekey=needs_rekey))