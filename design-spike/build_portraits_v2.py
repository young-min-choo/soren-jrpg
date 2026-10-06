#!/usr/bin/env python3
"""Portrait slice (B): 20 dialogue portraits as 64x64 painterly param-busts.

Late-FF ambition on a deterministic pipeline: Pollinations went 402 (payment
required — free tier dead), no local image-gen model exists, and the skill
mandates deterministic hand-pixel discipline anyway. So: busts on a 64x64
canvas with real face construction — 3-tone skin shading, eyebrow shadow,
nose, mouth, per-face hair geometry (8 shapes), beard variants, hats/hoods/
helmets, layered clothing with collar/shoulder shading, plum outline, and
per-character identity specs derived from the battle roster + NPC v2 specs.

Upgrade wiring (separate commit touches DialogueScene): portrait slot grows
48→64px and draws the full-resolution source into it.

Output: public/sprites/portraits/<key>.png (20) at 64x64. Manifest + keys
unchanged; BootScene loads them the same way.
"""
import numpy as np
from PIL import Image
import os, json

SPIKE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(SPIKE, '..', 'public', 'sprites', 'portraits')
os.makedirs(PUB, exist_ok=True)

PW, PH = 64, 64

MP = {k: tuple(v) for k, v in json.load(open(os.path.join(SPIKE, 'palette', 'master_palette.json'))).items()}
MP.setdefault('skin_hi', (248, 224, 192))
MP.setdefault('skin_mid', (232, 184, 144))
MP.setdefault('skin_sh', (184, 128, 88))
MP.setdefault('light', (244, 250, 255))
SKIN, SKIN_M, SKIN_S = MP['skin_hi'], MP['skin_mid'], MP['skin_sh']
DARK = MP['outline']
DEEP = MP.get('deep_shadow', (36, 24, 40))

def _H(a, y, x0, x1, c):
    h, w = a.shape[:2]
    if y < 0 or y >= h: return
    x0, x1 = max(0, x0), min(w - 1, x1)
    a[y, x0:x1+1, 0] = c[0]; a[y, x0:x1+1, 1] = c[1]
    a[y, x0:x1+1, 2] = c[2]; a[y, x0:x1+1, 3] = 255

def _P(a, y, x, c):
    h, w = a.shape[:2]
    if 0 <= y < h and 0 <= x < w:
        a[y, x, 0], a[y, x, 1], a[y, x, 2], a[y, x, 3] = c[0], c[1], c[2], 255

def add_outline(a):
    alpha = a[:, :, 3] > 0
    ring = alpha & (np.roll(~alpha, 1, 0) | np.roll(~alpha, -1, 0) |
                    np.roll(~alpha, 1, 1) | np.roll(~alpha, -1, 1))
    a[ring, 0] = DARK[0]; a[ring, 1] = DARK[1]; a[ring, 2] = DARK[2]; a[ring, 3] = 255

def ramp(fam):
    """3-tone (hi, mid, sh) ramp from the master palette by family name."""
    if fam == 'skin': return (SKIN, SKIN_M, SKIN_S)
    if f'{fam}_hi' in MP: return (MP[f'{fam}_hi'], MP[f'{fam}_mid'], MP.get(f'{fam}_sh') or MP.get(f'{fam}_hi'))
    if f'{fam}_mid' in MP:
        hi = MP.get(f'{fam}_mid')
        sh = MP.get(f'{fam}_deep') or MP.get(f'{fam}_mid')
        return (hi, hi, sh)
    return ((200, 200, 210), (150, 150, 165), (100, 100, 115))

# ── Face-geometry building blocks (all at 64x64) ───────────────────────
def ellipse_fill(a, cx, cy, rx, ry, col):
    for dy in range(-ry, ry + 1):
        wx = int(round(rx * np.sqrt(max(0.0, 1 - (dy / ry) ** 2)))) if ry else 0
        _H(a, cy + dy, cx - wx, cx + wx, col)

# Portrait framing: head center ~ (32, 26), head rx 14 ry 16; neck (29-35, 42-47);
# shoulders from y=48 down (bust cut at 64).

def draw_head(a, spec):
    """Narrow face: rx 12 / chin taper; crown-left lit, sides shaded."""
    cx, cy, rx, ry = 32, 29, 12, 14
    ellipse_fill(a, cx, cy - 1, rx, ry - 1, SKIN_M)
    ellipse_fill(a, cx - 2, cy - 4, rx - 4, ry - 6, SKIN)
    ellipse_fill(a, cx + 2, cy + 6, rx - 4, 7, SKIN_M)      # jaw
    ellipse_fill(a, cx, cy + 10, 5, 3, SKIN)                # chin
    _H(a, cy + 3, cx + 5, cx + 9, SKIN_S)                   # right cheek shade
    _H(a, cy + 2, cx - 9, cx - 6, SKIN_S)                   # left cheek core-sh
    _P(a, cy + 2, cx - 5, SKIN)
    return (cx, cy, rx, ry)


def draw_eyes(a, spec, cx, cy):
    """Almond eyes: lash line, white, iris, pupil, catchlight — READS at 64px."""
    ey = cy + 3
    for side in (-1, 1):
        ex = cx + side * 6
        hh, hm, hs_ = ramp(spec['hair'])
        if spec['hair'] == 'stone':
            hh, hm, hs_ = MP.get('steel_mid', hh), MP.get('stone_mid', hm), MP.get('stone_sh', hs_)
        # brow: 3px arc, slight outer lift — dark, not hair_sh-light
        _H(a, ey - 6, ex - 3, ex + 3, hs_)
        _H(a, ey - 7, ex - 1, ex + 2, hs_)          # inner thick
        # upper lash: dark 5px line
        _H(a, ey - 2, ex - 3, ex + 3, DARK)
        _P(a, ey - 3, ex + side * 3, DARK)          # outer lash tick
        # eye body: white sclera with iris block
        _H(a, ey - 1, ex - 3, ex + 3, MP.get('light', (244, 250, 255)))
        _H(a, ey, ex - 3, ex + 3, MP.get('light', (244, 250, 255)))
        _H(a, ey - 1, ex - 1, ex + 1, MP.get('water_sh', (32, 64, 128)))
        _H(a, ey, ex - 1, ex + 1, MP.get('water_sh', (32, 64, 128)))
        _P(a, ey - 1, ex, DARK); _P(a, ey, ex, DARK)          # pupil
        _P(a, ey - 1, ex - 2, MP.get('light', (255, 255, 255)))  # catchlight
        # lower lid
        _H(a, ey + 1, ex - 2, ex + 2, SKIN_S)
    # nose: vertical shade line + nostrils
    _H(a, cy + 4, cx, cx, SKIN_S)
    _H(a, cy + 5, cx - 1, cx + 1, SKIN_S)
    _P(a, cy + 6, cx - 2, SKIN_S); _P(a, cy + 6, cx + 2, SKIN_S)  # nostrils
    _P(a, cy + 5, cx - 2, SKIN)


def draw_mouth(a, spec, cx, cy):
    my = cy + 10
    lip_hi = MP.get('fire_hi', (200, 120, 112))
    if spec.get('beard') == 'full':
        hh, hm, hs_ = ramp(spec['hair'])
        if spec['hair'] == 'stone':
            hh, hm, hs_ = MP.get('steel_mid', hh), MP.get('stone_mid', hm), MP.get('stone_sh', hs_)
        # cheek beard panels + mustache + chin: face center stays visible
        slim = spec.get('beard_slim')
        px = 3 if slim else 4                      # panel thickness
        po = 8 if slim else 7                      # panel inner edge offset
        _H(a, my - 3, cx - 11, cx - po, hm); _H(a, my - 3, cx + po, cx + 11, hm)
        for y in range(my - 2, my + (5 if slim else 6)):
            _H(a, y, cx - 12, cx - po - 0, hm); _H(a, y, cx + po, cx + 12, hm)
        _H(a, my - 2, cx - (5 if slim else 6), cx + (5 if slim else 6), hm)  # mustache
        _H(a, my, cx - (2 if slim else 4), cx + (2 if slim else 4), DARK)    # mouth
        _H(a, my + 1, cx - 3, cx + 3, SKIN_S)      # lower lip
        _H(a, my + 3, cx - (3 if slim else 5), cx + (3 if slim else 5), hs_)  # chin rows
        _H(a, my + 4, cx - (3 if slim else 5), cx + (3 if slim else 5), hm)
        if not slim:
            _H(a, my + 5, cx - 4, cx + 4, hs_)
            _H(a, my + 6, cx - 3, cx + 3, hm)
    elif spec.get('beard') == 'stubble':
        _H(a, my, cx - 3, cx + 3, DARK)
        _H(a, my - 1, cx - 4, cx + 4, lip_hi)
        for x in range(cx - 5, cx + 6, 2): _P(a, my + 2, x, SKIN_S)
        for x in range(cx - 4, cx + 5, 2): _P(a, my + 3, x, SKIN_S)
    elif spec.get('mood') == 'grim':
        _H(a, my - 1, cx - 4, cx + 4, SKIN_S)
        _H(a, my, cx - 4, cx + 4, DARK)
        _P(a, my, cx - 5, DARK); _P(a, my, cx + 5, DARK)
        _H(a, my + 1, cx - 2, cx + 2, SKIN_S)
    elif spec.get('mood') == 'smile':
        _H(a, my - 1, cx - 4, cx + 4, DARK)
        _P(a, my - 1, cx - 5, DARK); _P(a, my - 1, cx + 5, DARK)
        _H(a, my, cx - 3, cx + 3, lip_hi)
        _H(a, my + 1, cx - 2, cx + 2, SKIN_S)
    else:
        _H(a, my - 1, cx - 3, cx + 3, SKIN_S)
        _H(a, my, cx - 3, cx + 3, DARK)


def draw_hair(a, spec, cx, cy, rx, ry):
    """Crown + temple hair only. Hood = crescent rim shadow over the base face."""
    hh, hm, hs_ = ramp(spec['hair'])
    if spec['hair'] == 'stone':
        hh, hm, hs_ = MP.get('steel_mid', hh), MP.get('stone_mid', hm), MP.get('stone_sh', hs_)
    shape = spec.get('hairshape', 'short')
    if spec.get('hood'):
        rr, rm, rs = ramp(spec.get('cloth_ramp', 'plum'))
        # hood mass AROUND an existing face: draw rim shell, don't overwrite center
        ellipse_fill(a, cx, cy - 4, rx + 5, ry + 5, rm)
        # carve face opening (smaller, shifted toward lit side)
        ellipse_fill(a, cx - 2, cy + 1, rx - 1, ry - 1, SKIN_M)
        ellipse_fill(a, cx - 3, cy, rx - 4, ry - 5, SKIN)
        # rim shadow: thin inner edge only (no full brow bar)
        _H(a, cy - 5, cx - 11, cx + 9, rs)
        _H(a, cy - 4, cx - 10, cx - 9, rs); _H(a, cy - 4, cx + 8, cx + 9, rs)
        _H(a, cy - 6, cx - 10, cx + 9, rm)
        # point (attached to dome)
        _H(a, cy - ry - 6, cx - 3, cx + 1, rm)
        _P(a, cy - ry - 7, cx - 2, rm); _P(a, cy - ry - 7, cx, rm)
        _P(a, cy - ry - 6, cx + 2, rs)
        # drape tips on shoulders
        for y in range(cy + 6, cy + 18):
            w = 4 - (y - cy - 6) // 6
            _H(a, y, cx - rx - 5, cx - rx - 5 + max(0, w), rm)
            _H(a, y, cx + rx + 3, cx + rx + 3 + max(0, w - 1), rs)
        return
    if shape == 'bald':
        _H(a, cy - ry - 2, cx - 6, cx + 6, SKIN)
        _P(a, cy - ry - 1, cx - 8, SKIN_S); _P(a, cy - ry - 1, cx + 8, SKIN_S)
        _H(a, cy - ry + 2, cx - rx - 1, cx - rx, hs_)
        _H(a, cy - ry + 2, cx + rx, cx + rx + 1, hs_)
        return
    # crown sweep meets temples (no beanie gap): dome bottom = cy-3
    if spec.get('hat'):
        hr2 = spec.get('hat')
        ellipse_fill(a, cx, cy - 10, rx - 1, 7, hm)   # low-profile hair under hat
        _H(a, cy - 5, cx - rx + 1, cx - 6, hm); _H(a, cy - 5, cx + 6, cx + rx - 1, hm)
        _H(a, cy - 4, cx - rx, cx - rx + 2, hm); _H(a, cy - 4, cx + rx - 2, cx + rx, hm)
        return
    ellipse_fill(a, cx, cy - 6, rx + 1, 11, hm)             # rows cy-17..cy+5 clipped to head top
    # hairline fringe across the forehead top (kills the forehead gap)
    _H(a, cy - 7, cx - rx, cx + rx, hs_)
    _H(a, cy - 6, cx - rx + 1, cx - 7, hm); _H(a, cy - 6, cx + 7, cx + rx - 1, hm)
    _H(a, cy - 5, cx - rx, cx - rx + 2, hm); _H(a, cy - 5, cx + rx - 2, cx + rx, hm)
    _H(a, cy - 14, cx - 8, cx + 8, hs_)
    _P(a, cy - 13, cx - 6, hh); _P(a, cy - 12, cx - 7, hh); _P(a, cy - 12, cx + 5, hh)
    # temples merge into dome (no floating side px)
    _H(a, cy - 4, cx - rx - 1, cx - rx, hm); _H(a, cy - 3, cx - rx - 1, cx - rx, hs_)
    _H(a, cy - 4, cx + rx, cx + rx + 1, hm); _H(a, cy - 3, cx + rx, cx + rx + 1, hs_)
    if shape == 'long':
        for y in range(cy - 6, cy + 16):
            _H(a, y, cx - rx - 3, cx - rx, hm)
            _H(a, y, cx + rx + 1, cx + rx + 3, hm)
        _H(a, cy + 14, cx - rx - 3, cx - rx, hs_)
        _H(a, cy + 14, cx + rx + 1, cx + rx + 3, hs_)
    elif shape == 'ponytail':
        for y in range(cy - 6, cy + 14):
            sway = (y - (cy - 6)) // 5
            _H(a, y, cx + rx + 1 + sway, cx + rx + 2 + sway, hm)
        _P(a, cy - 8, cx + rx + 1, hh)


def draw_headgear(a, spec, cx, cy, rx, ry):
    if spec.get('hat') == 'wizard':
        st, sm, ss = ramp(spec.get('cloth_ramp', 'steel'))
        for i in range(14):                                  # tall cone, base hugs dome
            w = 3 + i // 2
            _H(a, cy - ry - 14 + i, cx - w, cx + w, sm if i > 4 else ss)
        _P(a, cy - ry - 15, cx - 1, ss); _P(a, cy - ry - 15, cx, sm); _P(a, cy - ry - 15, cx + 1, ss)
        _H(a, cy - ry - 3, cx - rx - 2, cx + rx + 2, sm)     # brim ON the dome
        _H(a, cy - ry - 2, cx - rx - 2, cx + rx + 2, ss)
        _H(a, cy - ry - 6, cx - 5, cx + 5, MP.get('gold_mid', ss))  # band
        _P(a, cy - ry - 6, cx - 4, MP.get('gold_hi', ss))
    elif spec.get('hat') == 'cap':
        st, sm, ss = ramp(spec.get('cloth_ramp', 'water'))
        ellipse_fill(a, cx, cy - 13, rx + 2, 6, sm)
        _H(a, cy - 12, cx - rx - 2, cx + rx + 2, ss)
        _H(a, cy - 9, cx - 1, cx + rx + 5, ss)               # forward brim
    elif spec.get('hat') == 'circlet':
        _H(a, cy - 10, cx - rx + 1, cx + rx - 1, MP.get('gold_hi', (240, 208, 112)))
        _P(a, cy - 10, cx, MP.get('gold_mid', (200, 160, 64)))
        _P(a, cy - 9, cx, MP.get('gold_hi', (240, 208, 112)))


def draw_shoulders(a, spec):
    """Rounded-shoulder bust: 8px neck, slow trapezoid, no cone."""
    ch, cm, cs = ramp(spec.get('cloth_ramp', spec.get('outfit', 'steel')))
    _H(a, 42, 29, 34, SKIN_S); _H(a, 43, 29, 34, SKIN_S)
    _H(a, 44, 28, 35, SKIN_M)
    _H(a, 45, 24, 39, cs)                                    # collar
    for i, y in enumerate(range(46, 64)):
        half = min(21, 9 + (i * 9) // 17)
        c = cm if i < 13 else cs
        _H(a, y, 32 - half, 32 + half, c)
        # shoulder rounding: clip top outer corners softly
        if i < 4:
            _P(a, y, 32 - half, DARK if i == 0 else cm)
    _H(a, 48, 28, 37, ch); _H(a, 49, 28, 37, ch)
    _P(a, 50, 32, cs)
    acc = spec.get('accent')
    if acc == 'gold_trim':
        _H(a, 53, 11, 52, MP.get('gold_mid', (200, 160, 64)))
        _H(a, 54, 12, 51, MP.get('gold_hi', (240, 208, 112)))
    if acc == 'pendant':
        _H(a, 47, 31, 33, MP.get('gold_hi', (240, 208, 112)))
        _P(a, 48, 32, MP.get('gold_mid', (200, 160, 64)))
    if acc == 'scarf':
        sr, sm2, ss2 = ramp('red')
        _H(a, 45, 24, 39, sm2); _H(a, 46, 26, 37, sm2)
        _H(a, 47, 38, 44, ss2)


# ── Identity specs (20) — battle/NPC identity anchors ───────────────────
GREY_HAIR = ('stone', 'steel_sh', 'steel')  # darker grey hair ramp via special-case

SPECS = {
    # party (battle-identity colors)
    'soren':   dict(hair='brown', hairshape='short', hood=True,  cloth_ramp='plum',  eye_w=4, mood='grim'),
    'aria':    dict(hair='leaf',  hairshape='long',   cloth_ramp='leaf',  eye_w=4, mood='smile', accent='pendant'),
    'kael':    dict(hair='brown', hairshape='ponytail', cloth_ramp='steel', eye_w=4, mood='grin'),
    'aldric':  dict(hair='stone', hairshape='short', beard='stubble', cloth_ramp='red', eye_w=4, mood='grim'),
    # townsfolk + roles
    'elder':        dict(hair='stone', beard_slim=True, hair_grey=True, hairshape='long', beard='full', cloth_ramp='brown'),
    'job_master':   dict(hair='plum',  hairshape='short', cloth_ramp='leaf', accent='gold_trim'),
    'shopkeeper':   dict(hair='brown', hairshape='short', beard='stubble', cloth_ramp='brown', accent='gold_trim'),
    'innkeeper':    dict(hair='gold',  hairshape='long', cloth_ramp='water'),
    'townsfolk':    dict(hair='brown', hairshape='short', cloth_ramp='stone'),
    'dockhand':     dict(hair='brown', hairshape='short', hat='cap', cloth_ramp='water', mood='grim'),
    'harbormaster': dict(hair='stone', hair_grey=True, hairshape='short', beard='full', hat='cap', cloth_ramp='water'),
    'neve':         dict(hair='red',   hairshape='ponytail', cloth_ramp='red', eye_w=4, mood='smile', accent='scarf'),
    'quarry_chief': dict(hair='stone', hairshape='short', beard='stubble', hat=None, cloth_ramp='stone', mood='grim'),
    'warden':       dict(hair='stone', hood=True, beard='full', beard_slim=True, cloth_ramp='plum'),
    'windreader':   dict(hair='stone', hair_grey=True, hairshape='short', hat='wizard', cloth_ramp='water'),
    'chronicler':   dict(hair='stone', hair_grey=True, hairshape='short', glasses=True, cloth_ramp='red'),
    'abbot':        dict(hair='stone', beard_slim=True, hairshape='bald', beard='full', cloth_ramp='fire'),
    'high_scholar': dict(hair='stone', hair_grey=True, hairshape='short', hat='circlet', beard='full', cloth_ramp='steel', accent='gold_trim'),
    'villager':     dict(hair='brown', hairshape='short', cloth_ramp='leaf'),
    'gareth':       dict(hair='red',   hairshape='short', beard='stubble', cloth_ramp='steel', mood='grim'),
}

def draw_glasses(a, spec, cx, cy):
    ey = cy + 2
    for side in (-1, 1):
        ex = cx + side * 6
        for dx in range(-3, 4):
            _P(a, ey - 3, ex + dx, MP.get('gold_mid', (200, 160, 64)))
            _P(a, ey + 2, ex + dx, MP.get('gold_mid', (200, 160, 64)))
        for dy in range(-3, 3):
            _P(a, ey + dy, ex - 3, MP.get('gold_mid', (200, 160, 64)))
            _P(a, ey + dy, ex + 3, MP.get('gold_mid', (200, 160, 64)))
        _P(a, ey - 2, ex - 1, MP.get('light', (240, 244, 250)))
    _H(a, ey - 1, cx - 3, cx + 3, MP.get('gold_mid', (200, 160, 64)))


def render(spec):
    a = np.zeros((PH, PW, 4), np.uint8)
    cx, cy, rx, ry = draw_head(a, spec)
    draw_hair(a, spec, cx, cy, rx, ry)          # hood/carve FIRST — features go on top
    draw_eyes(a, spec, cx, cy)
    draw_mouth(a, spec, cx, cy)
    draw_headgear(a, spec, cx, cy, rx, ry)
    draw_shoulders(a, spec)
    if spec.get('glasses'):
        draw_glasses(a, spec, cx, cy)
    add_outline(a)
    return a

def build():
    n = 0
    for key, spec in SPECS.items():
        img = Image.fromarray(render(spec))
        img.save(os.path.join(PUB, f'{key}.png'))
        n += 1
    print(f'built {n} 64x64 portraits')

if __name__ == '__main__':
    build()