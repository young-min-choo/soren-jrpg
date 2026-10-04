#!/usr/bin/env python3
"""Tile post-processing: quantize raws to 32x32, palette-snap, seam-fix,
assemble themed strips, deploy to public/sprites/tiles/.

Strips (tile index order per BootScene mapping):
  town_tiles.png:    cobble, stonewall, path, bldgwall, bldgroof, wood,
                     door, boss, dungeonexit, exitmark  (indices 0-9)
  dgn_ember.png:     floor, wall, hazard, door, chest
  dgn_tide.png:      floor, wall, hazard, door, chest
  dgn_hollow.png:    floor, wall, hazard, door, chest
  dgn_spire.png:     floor, wall, hazard, door, chest
  dgn_ruins.png:     floor, wall, pit, chest, door
"""
import subprocess, os, json, sys
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))

OUT = 'tiles_final'
PUB = '/home/min/dev/soren-jrpg/public/sprites/tiles'
os.makedirs(OUT, exist_ok=True)
os.makedirs(PUB, exist_ok=True)

palette = json.load(open('palette/master_palette.json'))
pal_rgb = [tuple(v) for v in palette.values()]

def palette_snap(img):
    img = img.convert('RGBA')
    out = img.copy()
    px = out.load()
    w, h = img.size
    cache = {}
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a == 0: continue
            key = (r, g, b)
            if key not in cache:
                best = min(pal_rgb, key=lambda c: (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2)
                cache[key] = best
            nr, ng, nb = cache[key]
            px[x, y] = (nr, ng, nb, a)
    return out

def edge_diff(img, axis):
    im = list(img.getdata()); w, h = img.size
    total, n = 0, 0
    if axis == 'h':
        for y in range(h):
            pl, pr = im[y*w], im[y*w + w - 1]
            total += sum(abs(a-b) for a, b in zip(pl[:3], pr[:3])); n += 3
    else:
        for x in range(w):
            pt, pb = im[x], im[(h-1)*w + x]
            total += sum(abs(a-b) for a, b in zip(pt[:3], pb[:3])); n += 3
    return total / n

def make_seamless(img, blend=4):
    w, h = img.size
    out = img.copy()
    px = out.load()
    for y in range(h):
        for i in range(blend):
            r, g, b = px[w-blend+i, y][:3]
            r2, g2, b2 = px[i, y][:3]
            px[w-1-i, y] = ((r+r2)//2, (g+g2)//2, (b+b2)//2, 255)
    for x in range(w):
        for i in range(blend):
            r, g, b = px[x, h-blend+i][:3]
            r2, g2, b2 = px[x, i][:3]
            px[x, h-1-i] = ((r+r2)//2, (g+g2)//2, (b+b2)//2, 255)
    return out

def process_tile(src_path, name):
    """Quantize -> snap -> seam-fix. Returns final 32x32 RGB or None."""
    dst = f'{OUT}/{name}.png'
    try:
        subprocess.run(['magick', src_path, '-filter', 'point', '-resize', '32x32!',
                        '+dither', '-colors', '16', dst], check=True, timeout=30)
    except Exception as e:
        return None
    img = Image.open(dst).convert('RGBA')
    img = palette_snap(img)
    # seam fix if needed
    if edge_diff(img.convert('RGB'), 'h') > 40 or edge_diff(img.convert('RGB'), 'v') > 40:
        img = make_seamless(img)
    img.save(dst)
    return img

STRIPS = {
    'town_tiles': ['raw_town_tiles/tn_cobble', 'raw_town_tiles/tn_stonewall', 'raw_town_tiles/tn_path',
                    'raw_town_tiles/tn_bldgwall', 'raw_town_tiles/tn_bldgroof', 'raw_town_tiles/tn_wood',
                    'raw_town_tiles/tn_door', 'raw_town_tiles/tn_boss', 'raw_town_tiles/tn_dungeonexit',
                    'raw_town_tiles/tn_exitmark'],
    'dgn_ember':  ['raw_dgn_tiles/dg_ember_floor', 'raw_dgn_tiles/dg_ember_wall', 'raw_dgn_tiles/dg_ember_hazard',
                   'raw_town_tiles/tn_door', 'raw_dgn_tiles/dg_chest'],
    'dgn_tide':   ['raw_dgn_tiles/dg_tide_floor', 'raw_dgn_tiles/dg_tide_wall', 'raw_dgn_tiles/dg_tide_hazard',
                   'raw_town_tiles/tn_door', 'raw_dgn_tiles/dg_chest'],
    'dgn_hollow': ['raw_dgn_tiles/dg_hollow_floor', 'raw_dgn_tiles/dg_hollow_wall', 'raw_dgn_tiles/dg_hollow_hazard',
                   'raw_town_tiles/tn_door', 'raw_dgn_tiles/dg_chest'],
    'dgn_spire':  ['raw_dgn_tiles/dg_spire_floor', 'raw_dgn_tiles/dg_spire_wall', 'raw_dgn_tiles/dg_spire_hazard',
                   'raw_town_tiles/tn_door', 'raw_dgn_tiles/dg_chest'],
    'dgn_ruins':  ['raw_dgn_tiles/dg_ruins_floor', 'raw_dgn_tiles/dg_ruins_wall', 'raw_dgn_tiles/dg_ruins_pit',
                   'raw_dgn_tiles/dg_chest', 'raw_dgn_tiles/dg_ruins_door'],
}

results = {}
FALLBACK_COLORS = {
    # palette-approximate solid colors per tile type when the AI tile is missing
    'default': (90, 86, 100),
    'path': (200, 190, 160), 'floor': (120, 100, 90), 'wall': (70, 70, 80),
    'hazard': (40, 80, 140), 'pit': (20, 18, 28), 'door': (110, 70, 40),
    'chest': (140, 100, 50), 'boss': (140, 40, 40), 'exit': (80, 120, 190),
    'save': (220, 190, 90), 'block': (110, 100, 95), 'switch': (130, 120, 110),
    'dungeonexit': (80, 90, 110), 'exitmark': (90, 120, 190),
}
def fallback_for(name):
    for k in FALLBACK_COLORS:
        if k != 'default' and k in name:
            return FALLBACK_COLORS[k]
    return FALLBACK_COLORS['default']

def solid_tile(rgb):
    return Image.new('RGBA', (32, 32), rgb + (255,))

for strip_name, tiles in STRIPS.items():
    strip_imgs = []
    missing = []
    for t in tiles:
        src = t + '.png'
        name = os.path.basename(t)
        img = None
        if os.path.exists(src):
            img = process_tile(src, name)
        if img is None:
            missing.append(name)
            img = solid_tile(fallback_for(name))
        strip_imgs.append(img)
    TS = 32
    strip = Image.new('RGB', (TS * len(strip_imgs), TS))
    for i, im in enumerate(strip_imgs):
        strip.paste(im.convert('RGB'), (i * TS, 0))
    strip.save(f'{PUB}/{strip_name}.png')
    note = f" (fallbacks: {missing})" if missing else ""
    results[strip_name] = f"OK {strip.size[0]}x{strip.size[1]}{note}"

for k, v in results.items():
    print(f"{k}: {v}")