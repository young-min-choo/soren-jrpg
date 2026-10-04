#!/usr/bin/env python3
"""Palette-pure desaturation: re-snap each tile pixel to the LEAST saturated
master-palette color within its hue family. Terrain keeps hue identity but
recedes behind sprites. Run AFTER fix_terrain.py (which re-saturated)."""
import os, json
import numpy as np
from PIL import Image

SPIKE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(SPIKE, '..', 'public', 'sprites', 'tiles')
TS = 32

pal = [tuple(v) for v in json.load(open(os.path.join(SPIKE, 'palette', 'master_palette.json'))).values()]

def sat(c):
    mx, mn = max(c), min(c)
    return (mx - mn) / (mx + 1e-9)

def hue(c):
    import colorsys
    return colorsys.rgb_to_hsv(c[0]/255, c[1]/255, c[2]/255)[0]

# pre-compute palette sat + hue
pal_sat = [sat(c) for c in pal]
pal_hue = [hue(c) for c in pal]

def hue_dist(h1, h2):
    d = abs(h1 - h2)
    return min(d, 1 - d)

def recessive_color(c):
    """Least-saturated palette color within 60° hue, else least-sat overall."""
    h = hue(c)
    candidates = [(hue_dist(h, ph), ps, i)
                  for i, (ph, ps) in enumerate(zip(pal_hue, pal_sat))
                  if hue_dist(h, ph) < 0.18]  # ~60°
    if candidates:
        candidates.sort(key=lambda t: (t[1], t[0]))  # least saturated first
        return pal[candidates[0][2]]
    # fallback: global least-saturated
    i = int(np.argmin(pal_sat))
    return pal[i]

for strip_name in ['town_tiles', 'dgn_ember', 'dgn_tide', 'dgn_hollow', 'dgn_spire', 'dgn_ruins']:
    path = os.path.join(TILES, strip_name + '.png')
    strip = np.array(Image.open(path).convert('RGBA'))
    ntiles = strip.shape[1] // TS
    cache = {}
    for i in range(ntiles):
        tile = strip[:, i*TS:(i+1)*TS, :]
        vis = tile[:,:,3] > 0
        colors = tile[:,:,:3].astype(int)
        for c in np.unique(colors[vis], axis=0):
            key = tuple(c)
            if key not in cache:
                cache[key] = recessive_color(c)
        for (r, g, b), (pr, pg, pb) in cache.items():
            m = vis & (colors[:,:,0] == r) & (colors[:,:,1] == g) & (colors[:,:,2] == b)
            tile[m, 0], tile[m, 1], tile[m, 2] = pr, pg, pb
        strip[:, i*TS:(i+1)*TS, :] = tile
    Image.fromarray(strip).save(path)
    print(f"{strip_name}: recessive re-snap done")