#!/usr/bin/env python3
"""Terrain redesign (slice D): overworld strip ×10, town strip ×6 (+4 spare),
dungeon floor variants ×2 per theme (appended as tiles 10-11 → strips 384px).

Design language: muted, moody, matching hero/NPC/portrait families —
ash-grass, ink water, dark pines; cobble + timber + slate town; each
dungeon theme gets 2 floor variants (crack speckle + moss/feature) built
on its own floor base. All colors from master_palette.json, plum outline
accents. Deterministic: no random module.
"""
import numpy as np
from PIL import Image
import os, json

SPIKE = os.path.dirname(os.path.abspath(__file__))
TILES = os.path.join(SPIKE, '..', 'public', 'sprites')
TS = 32

MP = {k: tuple(v) for k, v in json.load(open(os.path.join(SPIKE, 'palette', 'master_palette.json'))).items()}
DARK = MP['outline']

def _H(a, y, x0, x1, c):
    h, w = a.shape[:2]
    if y < 0 or y >= h or x1 < x0: return
    x0, x1 = max(0, x0), min(w - 1, x1)
    a[y, x0:x1+1, 0] = c[0]; a[y, x0:x1+1, 1] = c[1]
    a[y, x0:x1+1, 2] = c[2]; a[y, x0:x1+1, 3] = 255

def _P(a, y, x, c):
    h, w = a.shape[:2]
    if 0 <= y < h and 0 <= x < w:
        a[y, x, 0], a[y, x, 1], a[y, x, 2], a[y, x, 3] = c[0], c[1], c[2], 255

# deterministic hash-driven speckle
def h32(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2654435761) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return (n ^ (n >> 16)) & 0xFFFFFFFF

def speckle(a, cols, density, seed):
    for y in range(TS):
        for x in range(TS):
            r = h32(x, y, seed)
            if (r % 100) < density:
                c = cols[r % len(cols)]
                _P(a, y, x, c)

def edge_outline(a):
    alpha = a[:, :, 3] > 0
    ring = alpha & (np.roll(~alpha, 1, 0) | np.roll(~alpha, -1, 0) |
                    np.roll(~alpha, 1, 1) | np.roll(~alpha, -1, 1))
    a[ring, 0] = DARK[0]; a[ring, 1] = DARK[1]; a[ring, 2] = DARK[2]; a[ring, 3] = 255


def _F(a, c):
    for y in range(TS):
        _H(a, y, 0, TS-1, c)

def tile(fn):
    a = np.zeros((TS, TS, 4), np.uint8)
    fn(a)
    return a

G = MP['leaf_mid']; G_HI = MP['leaf_hi']; G_SH = MP['leaf_sh']
W_HI, W_M, W_SH = MP['water_hi'], MP['water_mid'], MP['water_sh']
ST_HI, ST_M, ST_SH = MP['steel_hi'], MP['steel_mid'], MP['stone_sh']
STN_HI, STN_M = MP['stone_hi'], MP.get('stone_mid', ST_M)
WOOD, WOOD_SH = MP.get('wood_mid', (104, 68, 40)), MP.get('wood_sh', (96, 60, 36))
PLUM_SH = MP['plum_sh'] = MP.get('plum_sh', (44, 36, 52))

# ── OVERWORLD (10 tiles) ─────────────────────────────────────────────
def ow_grass_dark(a):
    _F(a, G)
    # sparse tufts only — no confetti
    for y in range(5, TS, 11):
        for x in range(2 + (y % 5), TS, 10):
            _H(a, y, x, x+1, G_SH)
            _P(a, y-1, x, G_SH)
    _H(a, TS-1, 4, TS-5, G_SH)


def ow_grass_light(a):
    _F(a, MP.get('leaf_hi', G_HI))
    # keep it muted: blend rows of mid-grass over half the tile
    _H(a, 0, 0, TS-1, G)
    for y in range(1, TS, 2):
        _H(a, y, 0, TS-1, MP.get('leaf_hi', G_HI))
    for y in range(5, TS, 12):
        for x in range(4 + (y % 7), TS, 11):
            _H(a, y, x, x+1, G_SH)
    _P(a, 9, 9, G_SH); _P(a, 22, 20, G_SH)


def ow_forest(a):
    _F(a, G_SH)
    # one big conifer: layered dark fir w/ lit left edges
    PINE = MP.get('leaf_deep', (32, 64, 48)); LIT = MP.get('leaf_hi', G_HI)
    tx = 15
    for i, (y, half) in enumerate([(6, 2), (9, 4), (12, 6), (15, 8)]):
        _H(a, y, tx-half, tx+half, PINE)
        _P(a, y, tx-half, LIT)
    _H(a, 7, tx-3, tx+1, PINE)
    for y in (16, 17, 18):
        _H(a, y, tx-1, tx+1, WOOD)
    _H(a, 19, 3, 28, G_SH)


def ow_mountain(a):
    _F(a, STN_M)
    # big shaded ridge, stone tones only
    for i in range(26):                       # long dark ridge slope
        x = 1 + i
        _H(a, 6 + i // 2, x, x, ST_SH)
    for i in range(14):                       # lit face
        _H(a, 10 + i, 4 + i, 17 + i, STN_HI)
    _H(a, 7, 2, 8, ST_HI); _H(a, 6, 4, 12, ST_HI)
    _H(a, 30, 2, 30, ST_SH); _H(a, 31, 2, 30, ST_SH)
    _P(a, 8, 3, STN_HI); _P(a, 12, 6, ST_SH)


def ow_water(a):
    _F(a, W_M)
    # long ink-wave dashes, 2 lengths
    for (y, x0, ln) in [(5, 3, 9), (13, 12, 11), (21, 4, 8), (27, 18, 9)]:
        _H(a, y, x0, x0+ln-1, W_SH)
        _H(a, y, x0+2, x0+ln-3, W_HI)


def ow_path(a):
    _F(a, MP.get('sand_mid', (216, 192, 152)))
    for (x, y, w) in [(6, 6, 4), (20, 13, 5), (11, 24, 4), (25, 27, 3)]:
        _H(a, y, x, x+w, MP.get('sand_sh', ST_SH))
        _H(a, y+1, x+1, x+w-1, MP.get('sand_hi', (232, 216, 176)))


def ow_bridge(a):
    # horizontal planks w/ thin seams + corner rails
    _F(a, WOOD)
    for y in (7, 15, 23):
        _H(a, y, 0, TS-1, WOOD_SH)
    for yy in range(0, TS):
        _P(a, yy, 1, WOOD_SH); _P(a, yy, 30, WOOD_SH)
    _H(a, 0, 0, TS-1, WOOD_SH); _H(a, TS-1, 0, TS-1, WOOD_SH)
    _P(a, 11, 14, WOOD_SH); _P(a, 19, 22, WOOD_SH)   # knots


def ow_desert(a):
    _F(a, MP.get('sand_hi', (232, 216, 176)))
    for (x0, y, ln) in [(2, 8, 9), (15, 18, 11), (6, 27, 8)]:
        for i in range(ln):
            yy = y - (i * 3 - ln) // 4
            _P(a, yy, x0+i, MP.get('sand_mid', (216,192,152)))
        _P(a, y, x0, MP.get('sand_sh', ST_SH))


def ow_snow(a):
    _F(a, MP.get('light', (244, 250, 255)))
    for (x, y, w) in [(4, 10, 6), (18, 21, 7), (9, 27, 5)]:
        _H(a, y, x, x+w, ST_HI)
        _H(a, y+1, x+1, x+w-1, MP.get('water_hi', W_HI))


def ow_swamp(a):
    _F(a, MP.get('leaf_sh', G_SH))
    # murky pools with sheen
    for (x, y, w, h2) in [(4, 8, 8, 4), (17, 19, 9, 5)]:
        for dy in range(h2):
            _H(a, y+dy, x, x+w, W_SH)
        _H(a, y+1, x+2, x+w-2, MP.get('water_mid', W_M))
        _H(a, y+1, x+3, x+5, W_HI)
        _H(a, y+h2, x, x+w, MP.get('water_sh', W_SH))
    _P(a, 5, 27, PLUM_SH); _P(a, 26, 8, PLUM_SH)
    _H(a, 2, 24, 28, PLUM_SH)


# ── TOWN (redesign indices 0-5; 6-9 palette-friendly spares) ─────────
def tn_floor(a):                                    # cobble: warm stone, 2 courses
    _F(a, MP.get('sand_sh', ST_SH))                 # warm grout
    WARM = MP.get('sand_mid', (216, 192, 152))
    WARM_HI = MP.get('sand_hi', (232, 216, 176))
    for (yy, off) in [(1, 0), (9, 8), (17, 3), (25, 10)]:
        for gx in range(-off, TS, 16):
            x0, x1 = max(0, gx), min(TS-1, gx+13)
            _H(a, yy, x0, x1, WARM)
            _H(a, yy+1, x0, x1, WARM_HI)
            _H(a, yy+2, x0, x1, WARM_HI)
            _H(a, yy+3, x0, x1, WARM)
            _H(a, yy+4, x0, x1, WARM)
            _H(a, yy+5, x0, x1, WARM_HI)
            _H(a, yy+6, x0, x1, WARM)
    for gy in (0, 8, 16, 24):
        _H(a, gy, 0, TS-1, MP.get('sand_sh', ST_SH))


def tn_wall(a):                                     # masonry: 4 courses offset
    _F(a, ST_SH)
    for (yy, off) in [(0, 0), (8, 8), (16, 0), (24, 8)]:
        for gx in range(-off, TS, 14):
            x0, x1 = max(0, gx), min(TS-1, gx+12)
            _H(a, yy+1, x0, x1, ST_M)
            _H(a, yy+2, x0, x1, ST_M)
            _H(a, yy+3, x0, x1, STN_M)
            _H(a, yy+4, x0, x1, ST_M)
            _H(a, yy+5, x0, x1, ST_M)
            _H(a, yy+6, x0, x1, ST_HI)
            if x0 > 0: _P(a, yy+3, x0-1, ST_SH)
        _H(a, yy+7, 0, TS-1, ST_SH)


def tn_path(a):                                     # packed dirt
    _F(a, MP.get('sand_mid', (216, 192, 152)))
    for (x, y, w) in [(5, 7, 5), (18, 14, 6), (10, 25, 5), (24, 5, 4)]:
        _H(a, y, x, x+w, MP.get('sand_sh', ST_SH))
        _H(a, y+1, x+1, x+w-1, MP.get('sand_hi', (232,216,176)))


def tn_bldg(a):                                     # timber+plaster wall (subtle)
    _F(a, MP.get('sand_hi', (232, 216, 176)))       # warm plaster
    # soft plaster mottling (subtle, low contrast)
    for (x, y, w) in [(5, 6, 6), (18, 12, 7), (9, 24, 8), (24, 27, 5)]:
        _H(a, y, x, x+w, MP.get('sand_mid', (216, 192, 152)))
    # timber: corner posts + top/bottom sill (frame, not window)
    for xx in (0, 1, TS-3, TS-2):
        for yy in range(TS):
            _H(a, yy, xx, xx, WOOD)
    _H(a, 0, 0, TS-1, WOOD); _H(a, 1, 0, TS-1, WOOD_SH)
    _H(a, 30, 0, TS-1, WOOD_SH); _H(a, 31, 0, TS-1, WOOD)
    # thin diagonal brace in lower half
    for i in range(12):
        _P(a, 18 + i, 8 + i, WOOD_SH)
    # pegs at corners
    _P(a, 4, 3, WOOD_SH); _P(a, 27, 3, WOOD_SH); _P(a, 4, TS-4, WOOD_SH); _P(a, 27, TS-4, WOOD_SH)


def tn_roof(a):                                     # slate shingles (plum-slate)
    SLATE = MP.get('plum_mid', MP.get('water_sh', (32,64,128)))
    SL_D = MP.get('plum_sh', (44, 36, 52))
    SL_L = MP.get('steel_sh', ST_SH)
    _F(a, SLATE)
    for (yy, off) in [(0, 0), (6, 6), (12, 0), (18, 6), (24, 0)]:
        for gx in range(-off, TS, 11):
            x0, x1 = max(0, gx), min(TS-1, gx+9)
            _H(a, yy, x0, x1, SL_D)
            _H(a, yy+1, x0, x1, SLATE)
            _H(a, yy+2, x0, x1, SLATE)
            _H(a, yy+3, x0, x1, SL_D)
            _H(a, yy+4, x0, x1, SLATE)
            _H(a, yy+5, x0, x1, SL_L)
    _H(a, TS-2, 0, TS-1, SL_D); _H(a, TS-1, 0, TS-1, SL_D)


def tn_wood(a):                                     # wood planks (floor)
    _F(a, WOOD)
    for y in (7, 15, 23, 31):
        _H(a, y, 0, TS-1, WOOD_SH)
    # grain + knots
    for (x, y) in [(6, 3), (22, 11), (14, 19), (26, 27)]:
        _P(a, y, x, WOOD_SH); _P(a, y, x+1, WOOD_SH); _P(a, y+1, x, MP.get('gold_sh', (168,120,48)))


def tn_spare_doormat(a):
    _F(a, MP.get('sand_mid', (216,192,152)))
    _H(a, 4, 4, 27, MP.get('fire_mid', (200, 64, 56)))
    _H(a, 5, 4, 27, MP.get('fire_mid', (200, 64, 56)))
    _H(a, 26, 4, 27, MP.get('fire_mid', (200, 64, 56)))

def tn_spare_window(a):
    tn_bldg(a)
    _H(a, 8, 8, 23, MP.get('water_sh', (32, 64, 128)))
    _H(a, 9, 8, 23, MP.get('water_sh', (32, 64, 128)))
    _H(a, 12, 8, 23, MP.get('water_hi', W_HI))
    _H(a, 7, 8, 23, WOOD); _H(a, 13, 8, 23, WOOD)
    _H(a, 8, 15, 16, WOOD)

def tn_spare_banner(a):
    tn_wall(a)
    for y in range(6, 26):
        _H(a, y, 13, 18, MP.get('fire_mid', (200, 64, 56)))
    _H(a, 6, 13, 18, MP.get('gold_mid', (200, 160, 64)))
    _H(a, 25, 12, 19, MP.get('fire_de', (136, 36, 44)))

def tn_spare_flowers(a):
    ow_grass_light(a)
    for (x, y, c) in [(7, 9, MP.get('fire_hi', (240,136,112))), (19, 7, MP.get('gold_hi', (240,208,112))),
                      (13, 18, MP.get('fire_hi', (240,136,112))), (25, 15, MP.get('water_hi', W_HI))]:
        _P(a, y, x, c); _P(a, y+1, x, MP.get('fire_de', (136, 36, 44))); _P(a, y, x+1, c)

# ── DUNGEON floor base + variants ────────────────────────────────────
def load_theme_floor(theme):
    """Floor base = tile 0 of the current strip (palette-snapped already)."""
    p = os.path.join(TILES, 'tiles', f'dgn_{theme}.png')
    im = Image.open(p).convert('RGBA')
    return np.array(im.crop((0, 0, TS, TS)))

def floor_variant_crack(base, seed, accent_cols):
    a = base.copy()
    # cracks: 2 dark polylines
    for n in range(2):
        x, y = 4 + (h32(n, seed) % (TS - 8)), 4 + (h32(n + 9, seed) % (TS - 8))
        ln = 8 + h32(n, seed + 1) % 9
        for i in range(ln):
            _P(a, y, x, PLUM_SH)
            _P(a, y, x + 1, PLUM_SH)
            step = h32(x, y, n) % 3
            if step == 0: x += 1
            elif step == 1: y += 1
            else: x += 1; y += 1
            x = max(0, min(TS-2, x)); y = max(0, min(TS-2, y))
    speckle(a, accent_cols, 6, seed)
    return a

def floor_variant_moss(base, seed, moss_cols, accent_cols):
    a = base.copy()
    # moss patches: soft clusters
    for n in range(5):
        cx, cy = h32(n, seed + 2) % TS, h32(n, seed + 3) % TS
        c = moss_cols[n % len(moss_cols)]
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if h32(cx+dx, cy+dy, n) % 3 != 2:
                    _P(a, (cy+dy) % TS, (cx+dx) % TS, c)
    speckle(a, accent_cols, 4, seed)
    return a

THEME_VARIANTS = {
    'ember':  dict(crack_acc=[MP.get('fire_de', (136,36,44))],
                   moss_cols=[MP.get('fire_de', (136,36,44)), PLUM_SH], moss_acc=[MP.get('fire_hi', (240,136,112))]),
    'tide':   dict(crack_acc=[MP.get('water_sh', (32,64,128))],
                   moss_cols=[MP.get('water_sh', (32,64,128)), PLUM_SH], moss_acc=[MP.get('water_hi', W_HI)]),
    'hollow': dict(crack_acc=[PLUM_SH],
                   moss_cols=[PLUM_SH, MP.get('moss_mid', G_SH)], moss_acc=[G_SH]),
    'spire':  dict(crack_acc=[MP.get('plum_sh', (44,36,52))],
                   moss_cols=[MP.get('water_sh', (32,64,128)), ST_SH], moss_acc=[ST_HI]),
    'ruins':  dict(crack_acc=[ST_SH],
                   moss_cols=[MP['moss_mid'] if 'moss_mid' in MP else G_SH, G_SH], moss_acc=[G_HI]),
}

def build():
    # ── overworld strip ──
    ow = [ow_grass_dark, ow_grass_light, ow_forest, ow_mountain, ow_water,
          ow_path, ow_bridge, ow_desert, ow_snow, ow_swamp]
    strip = Image.new('RGBA', (10 * TS, TS))
    for i, fn in enumerate(ow):
        strip.paste(Image.fromarray(tile(fn)), (i * TS, 0))
    strip.save(os.path.join(TILES, 'overworld_tiles.png'))
    print('overworld 10 ✓')

    # ── town strip (0-5 redesigned, 6-9 spares) ──
    tn = [tn_floor, tn_wall, tn_path, tn_bldg, tn_roof, tn_wood,
          tn_spare_doormat, tn_spare_window, tn_spare_banner, tn_spare_flowers]
    strip = Image.new('RGBA', (10 * TS, TS))
    for i, fn in enumerate(tn):
        strip.paste(Image.fromarray(tile(fn)), (i * TS, 0))
    strip.save(os.path.join(TILES, 'tiles', 'town_tiles.png'))
    print('town 10 ✓ (0-5 live, 6-9 spares)')

    # ── dungeon strips: keep 10, append 2 floor variants → 384px ──
    for theme, tv in THEME_VARIANTS.items():
        p = os.path.join(TILES, 'tiles', f'dgn_{theme}.png')
        im = Image.open(p).convert('RGBA')
        w = im.width
        if w >= 384:   # already extended (idempotent) — regenerate variants anyway
            base = np.array(im.crop((0, 0, TS, TS)))
        else:
            base = np.array(im.crop((0, 0, TS, TS)))
        seed = sum(ord(c) for c in theme)
        vA = floor_variant_crack(base, seed, tv['crack_acc'])
        vB = floor_variant_moss(base, seed + 3, tv['moss_cols'], tv['moss_acc'])
        out = Image.new('RGBA', (12 * TS, TS))
        out.paste(im.crop((0, 0, w, TS)), (0, 0))
        out.paste(Image.fromarray(vA), (10 * TS, 0))
        out.paste(Image.fromarray(vB), (11 * TS, 0))
        out.save(p)
        print(f'dgn_{theme} 12 tiles ✓ (variants 10,11)')

if __name__ == '__main__':
    build()