#!/usr/bin/env python3
"""Grey-hunter: remove backdrop remnants that survived chroma-keying.

The battle-raw backdrops are grey studio vignettes (pollinations ignores bg
instructions ~90% of renders). After corner-vote chroma-key, smooth grey
gradient remnants survive CONNECTED to the outer transparency (halo blobs,
ground slabs), while grey INSIDE the subject (steel armor, stone) is enclosed
and must survive.

Rule: flood low-saturation mid-value pixels starting from pixels adjacent to
transparency; everything reachable = backdrop residue -> cut. Enclosed grey
(armor) is never reachable (the saturated outline+subject ring blocks it).

Usage: python3 grey_hunter.py <key> [<key>...]    # process raw_battle/{key}.png
"""
import os, sys, json
import numpy as np
from PIL import Image
from collections import deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_battle_sprites import chroma_key, palette_snap

SPIKE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(SPIKE, 'raw_battle')
BOSS_KEYS = {'boss_goblin', 'boss_tide', 'boss_hollow', 'boss_storm',
             'boss_disgraced', 'boss_aldric_p1', 'boss_aldric_p2', 'boss_magma'}

def native_size(key):
    return 48 if key in BOSS_KEYS else 32

def hunt_grey(img, sat_max=0.17, val_min=0.2, val_max=0.93):
    """Remove low-sat mid-value px connected to transparency. Returns (img, n)."""
    a = np.asarray(img.convert('RGBA')).copy()
    alpha = a[:, :, 3] > 0
    r, g, b = a[:, :, 0] / 255, a[:, :, 1] / 255, a[:, :, 2] / 255
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    s = (mx - mn) / (mx + 1e-9)
    v = mx
    greyish = alpha & (s < sat_max) & (v > val_min) & (v < val_max)
    h, w = alpha.shape
    trans = ~alpha
    adj = greyish & (np.roll(trans, 1, 0) | np.roll(trans, -1, 0) |
                     np.roll(trans, 1, 1) | np.roll(trans, -1, 1))
    if not adj.any():
        return Image.fromarray(a, 'RGBA'), 0
    reach = adj.copy()
    q = deque(zip(*np.where(adj)))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not reach[ny, nx] and greyish[ny, nx]:
                reach[ny, nx] = True
                q.append((ny, nx))
    n = int(reach.sum())
    a[reach] = 0
    return Image.fromarray(a, 'RGBA'), n

def grey_stats(arr):
    alpha = arr[:, :, 3] > 0
    vis = arr[alpha][:, :3].astype(int)
    if not len(vis):
        return 0.0
    mx, mn = vis.max(axis=1) / 255, vis.min(axis=1) / 255
    s = (mx - mn) / (mx + 1e-9)
    return float(((s < 0.14) & (mx > 0.2)).mean())

def process(key, pal_rgb):
    """chroma-key (v1) -> grey-hunt -> quantize -> snap -> deploy."""
    src = f'{RAW}/{key}.png'
    if not os.path.exists(src):
        return f'{key}: MISSING raw'
    img = chroma_key(Image.open(src))
    img, hunted = hunt_grey(img)
    tmp = f'/tmp/hunt_{key}.png'
    img.save(tmp)
    nat = native_size(key)
    subprocess_run = __import__('subprocess').run
    subprocess_run(['magick', tmp, '-filter', 'point', '-resize', f'{nat}x{nat}!',
                    '+dither', '-colors', '24', f'/tmp/hunt_{key}_q.png'],
                   check=True, timeout=30)
    snapped = palette_snap(Image.open(f'/tmp/hunt_{key}_q.png'), pal_rgb)
    bbox = snapped.getbbox()
    if not bbox:
        return f'{key}: EMPTY after hunt (over-hunted — check key)'
    trimmed = snapped.crop(bbox)
    canvas = Image.new('RGBA', (nat, nat), (0, 0, 0, 0))
    canvas.paste(trimmed, ((nat - trimmed.width) // 2, (nat - trimmed.height) // 2))
    canvas.save(f'{SPIKE}/../public/sprites/battle/{key}.png')
    g0 = grey_stats(np.array(img))
    return f'{key}: OK {nat}px hunted={hunted}px grey-residue {g0:.1%} (content {trimmed.width}x{trimmed.height})'

if __name__ == '__main__':
    pal_rgb = [tuple(v) for v in json.load(open(os.path.join(SPIKE, 'palette', 'master_palette.json'))).values()]
    keys = sys.argv[1:]
    if not keys:
        keys = sorted(f[:-4] for f in os.listdir(RAW) if f.endswith('.png')
                      and '_scene' not in f and '_try' not in f)
    for k in keys:
        print(process(k, pal_rgb))