#!/usr/bin/env python3
"""NPC field sprites v2 — rebuild the 16 field-roster NPCs on the HERO v6 template.

Why: the current NPC template is a v4-era chibi (huge round beige head,
hair-blob, flat saturated gowns) that reads as a different artist than the
battle roster + v6 hero (plum/charcoal, moody, outlined). v6.2 established
the visual grammar; this script extends it with a parameterized NPC body:

  - NARROWER heads (10px face band like hero, not 10px skin slab)
  - plum outline everywhere, muted 3-tone ramps for hair + clothing
  - posture variety: stoop (elder), upright (warden), broad (quarry chief)
  - role identity via silhouette + muted palette, not color alone
  - standing single-pose frames (16x24) — NPCs are static talkers
  - ALL drawn with the hero's same _H/_P/add_outline helpers

Keeps: keys (elder, job_master…), sizes, manifest + TownScene wiring — zero
game-code churn. Portraits are NOT touched here (separate slice B).
"""
import numpy as np
from PIL import Image
import os, json

SPIKE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(SPIKE, '..', 'public', 'sprites')

FW, FH = 16, 24

# Master palette (29 colors) — same file the battle roster uses
MP = json.load(open(os.path.join(SPIKE, 'palette', 'master_palette.json')))
MP = {k: tuple(v) for k, v in MP.items()}

# 3-tone ramps per material family
RAMP = {
    'steel': ('steel_hi', 'steel_mid', 'stone_sh'),
    'brown': ('brown_mid', 'brown_sh', 'brown_deep') if 'brown_deep' in MP else ('brown_mid', 'brown_sh', 'brown_sh'),
    'gold':  ('gold_hi', 'gold_mid', 'gold_sh'),
    'leaf':  ('leaf_hi', 'leaf_mid', 'leaf_sh') if 'leaf_hi' in MP else ('leaf_mid', 'leaf_sh', 'leaf_sh'),
    'water': ('water_hi', 'water_mid', 'water_sh'),
    'red':   ('red_hi', 'red_mid', 'red_sh'),
    'fire':  ('fire_hi', 'fire_mid', 'fire_sh') if 'fire_hi' in MP else ('red_hi', 'fire_mid', 'red_sh'),
    'stone': ('steel_hi', 'stone_mid', 'stone_sh') if 'stone_mid' in MP else ('steel_hi', 'stone_sh', 'stone_sh'),
    'plum':  ('plum_hi', 'plum_mid', 'plum_sh') if 'plum_hi' in MP else ('plum_mid', 'plum_sh', 'outline'),
}

def ramp_colors(ramp, hi_idx, md_idx, sh_idx):
    hi, md, sh = ramp
    return MP[hi], MP[md], MP[sh]

# Palette-key aliases resolved at import (defensive: drop missing keys)
def mp(*names):
    for n in names:
        if n in MP: return tuple(MP[n])
    raise KeyError(names)

RAMP['steel'] = (mp('steel_hi'), mp('steel_mid'), mp('stone_sh', 'steel_sh'))
RAMP['brown'] = (mp('brown_hi'), mp('brown_mid'), mp('brown_sh'))
RAMP['gold']  = (mp('gold_hi'), mp('gold_mid'), mp('gold_sh'))
RAMP['leaf']  = (mp('leaf_hi', 'grass_hi'), mp('leaf_mid', 'grass_mid'), mp('leaf_sh', 'grass_sh', 'leaf_mid'))
RAMP['water'] = (mp('water_hi'), mp('water_mid'), mp('water_sh'))
RAMP['red']   = (mp('red_hi'), mp('red_mid'), mp('red_sh'))
RAMP['fire']  = (mp('fire_hi'), mp('fire_mid'), mp('fire_deep'))
RAMP['stone'] = (mp('steel_hi'), mp('stone_mid', 'stone_sh'), mp('stone_sh'))
RAMP['plum']  = (mp('plum_hi'), mp('plum_mid'), mp('plum_sh'))

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
    a[ring, 0] = MP['outline'][0]; a[ring, 1] = MP['outline'][1]
    a[ring, 2] = MP['outline'][2]; a[ring, 3] = 255

SKIN = MP.get('skin_mid', (232, 184, 144))
SKIN_SH = MP.get('skin_sh', (184, 128, 88))
DARK = MP['outline']

# ── Head painter — hero-v6 grammar: domed crown, hair ramp, 2px eye pair ──
def npc_head(a, spec):
    """Head rows 1-9 STRICT (row 10+ belongs to the body/neck). Hero-v6 grammar:
    domed crown w/ 2 glints, narrow face, 2px eyes, side-hair framing."""
    hair_hi, hair_md, hair_sh = RAMP[spec['hair']]
    hs = spec['hairshape']

    if hs == 'bald':
        _H(a, 1, 6, 9, SKIN); _H(a, 2, 5, 10, SKIN); _H(a, 3, 4, 11, SKIN)
        _P(a, 2, 4, SKIN_SH); _P(a, 2, 11, SKIN_SH)
        _P(a, 3, 4, hair_sh); _P(a, 3, 11, hair_sh)      # side tufts
        face_y = 4
    elif hs == 'hood':
        _H(a, 1, 4, 11, hair_md); _H(a, 2, 3, 12, hair_md)
        _H(a, 3, 2, 13, hair_sh)
        for y in range(4, 10):
            _P(a, y, 2, hair_md); _P(a, y, 13, hair_md)
        _H(a, 4, 3, 12, hair_sh)                          # hood opening shadow
        face_y = 5
    elif hs == 'helmet':
        _H(a, 1, 4, 11, hair_hi); _H(a, 2, 3, 12, hair_md)
        _H(a, 3, 3, 13, hair_sh); _H(a, 4, 3, 12, hair_md)
        _P(a, 2, 5, hair_hi); _P(a, 2, 10, hair_hi)
        face_y = 5
    elif hs == 'hat':
        _H(a, 1, 6, 9, hair_md); _H(a, 2, 5, 10, hair_md)
        _H(a, 3, 2, 13, hair_sh)                          # wide brim
        face_y = 4
    elif hs == 'cap':
        _H(a, 1, 5, 10, hair_md); _H(a, 2, 4, 11, hair_md)
        _H(a, 3, 3, 13, hair_sh)                          # brim forward
        _H(a, 4, 4, 11, hair_md)                          # hair under cap
        face_y = 5
    else:   # short / long / ponytail
        _H(a, 1, 5, 10, hair_md); _H(a, 2, 4, 11, hair_md)
        _H(a, 3, 3, 12, hair_md); _P(a, 2, 5, hair_hi); _P(a, 2, 10, hair_hi)
        if hs == 'long':
            for y in range(3, 11):
                _P(a, y, 2, hair_md); _P(a, y, 13, hair_md)
            _P(a, 10, 2, hair_sh); _P(a, 10, 13, hair_sh)
        elif hs == 'ponytail':
            _P(a, 1, 12, hair_md); _P(a, 2, 13, hair_md)
            _P(a, 3, 13, hair_sh); _P(a, 4, 13, hair_sh)
        face_y = 4

    # face band rows face_y..face_y+3 (ALWAYS ends by row 9)
    _H(a, face_y, 4, 11, SKIN)
    _H(a, face_y+1, 4, 11, SKIN)
    _P(a, face_y, 6, DARK); _P(a, face_y, 9, DARK)        # eyes
    _P(a, face_y+1, 7, SKIN_SH); _P(a, face_y+1, 8, SKIN_SH)
    if spec.get('beard'):
        _H(a, face_y+2, 4, 11, hair_md)
        _H(a, face_y+3, 5, 10, hair_sh)
        _P(a, face_y+2, 6, SKIN); _P(a, face_y+2, 9, SKIN)
    else:
        _H(a, face_y+2, 5, 10, SKIN)
        _H(a, face_y+3, 6, 9, SKIN_SH)
    # side hair framing on face rows (skip for hood/bald)
    if hs not in ('hood', 'bald'):
        _P(a, face_y, 4, hair_sh if hs not in ('cap','helmet') else hair_md)
        _P(a, face_y, 11, hair_sh if hs not in ('cap','helmet') else hair_md)

def npc_body(a, spec):
    """Rows 10-21 STRICT. Row 10 = neck/collar (connects head), torso 11-16,
    belt 17, legs 18-21 (hero grammar) or robe flare to hem."""
    o_hi, o_md, o_sh = RAMP[spec['outfit']]
    acc = spec.get('accent')

    if spec.get('robe'):
        robe_len = {'elder': 9, 'abbot': 9, 'warden': 8, 'windreader': 8,
                    'chronicler': 7, 'high_scholar': 8, 'job_master': 7}.get(spec['_key'], 7)
        _H(a, 10, 5, 10, o_md)                            # collar connects to head
        for i2, y in enumerate(range(11, 11 + robe_len)):
            t = i2 / max(1, robe_len - 1)
            half = 3 + int(round(2.0 * t))
            c = o_hi if i2 == 0 else (o_sh if i2 >= robe_len - 2 else o_md)
            _H(a, y, 7 - half, 8 + half, c)
            _P(a, y, 7 - half, o_sh if i2 else o_md)      # edge shade
        last = 10 + robe_len
        for y in range(last, 20):                          # hem extends to row 19
            _H(a, y, 3, 12, o_sh)
        _H(a, 20, 2, 13, o_sh)                             # bottom hem flare (full)
        _H(a, 21, 4, 6, DARK); _H(a, 21, 9, 11, DARK)      # feet peek (connected)
        if acc == 'gold-trim':
            _H(a, 13, 4, 11, MP.get('gold_hi', o_hi))
            _H(a, 18, 3, 12, MP.get('gold_mid', o_hi))
        if acc == 'glasses':
            _P(a, 7, 5, MP.get('steel_hi', o_hi)); _P(a, 7, 10, MP.get('steel_hi', o_hi))
        if acc == 'feather':
            _P(a, 0, 12, MP.get('water_hi', o_hi)); _P(a, 0, 13, MP.get('steel_hi', o_hi))
    else:
        _H(a, 10, 5, 10, o_md)                            # collar
        _H(a, 11, 4, 11, o_md)
        _H(a, 12, 3, 12, o_md); _P(a, 12, 3, o_hi); _P(a, 12, 12, o_sh)
        _H(a, 13, 3, 12, o_hi)
        _H(a, 14, 3, 12, o_md)
        _H(a, 15, 3, 12, o_sh)
        _H(a, 16, 4, 11, o_sh)
        _H(a, 17, 4, 11, MP.get('brown_sh', o_sh))        # belt
        _P(a, 17, 7, MP.get('gold_mid', o_hi))            # buckle
        # legs hero-grammar (knee light / mid / dark boot / sole)
        trou = o_sh
        _H(a, 18, 4, 6, trou); _H(a, 18, 9, 11, trou)
        _H(a, 19, 4, 6, o_md); _H(a, 19, 9, 11, o_md)
        _H(a, 20, 4, 6, MP.get('brown_sh', o_sh)); _H(a, 20, 9, 11, MP.get('brown_sh', o_sh))
        _H(a, 21, 4, 6, DARK);     _H(a, 21, 9, 11, DARK)
        if acc == 'apron-gold':
            _H(a, 12, 5, 10, MP.get('gold_hi', o_hi)); _H(a, 14, 5, 10, MP.get('gold_mid', o_hi))
            _H(a, 16, 5, 10, MP.get('gold_hi', o_hi))
        elif acc == 'apron-water':
            _H(a, 12, 5, 10, MP.get('water_hi', o_hi)); _H(a, 14, 5, 10, MP.get('water_mid', o_hi))
            _H(a, 16, 5, 10, MP.get('water_hi', o_hi))
        if acc == 'scarf':
            _H(a, 11, 4, 11, MP.get('red_hi', o_hi)); _P(a, 12, 5, MP.get('red_mid', o_hi))
            _P(a, 13, 10, MP.get('red_mid', o_hi)); _P(a, 14, 11, MP.get('red_mid', o_hi))


SPECS = {
    'elder':        dict(hair='steel', hairshape='long',    beard=True,  outfit='brown', robe=True),
    'job_master':   dict(hair='plum', hairshape='short',    beard=False, outfit='leaf',  robe=True),
    'shopkeeper':   dict(hair='brown', hairshape='short',   beard=False, outfit='brown', robe=False, accent='apron-gold'),
    'innkeeper':    dict(hair='gold',  hairshape='long',    beard=False, outfit='water', robe=False, accent='apron-water'),
    'townsfolk':    dict(hair='brown', hairshape='short',   beard=False, outfit='stone', robe=False),
    'dockhand':     dict(hair='brown', hairshape='cap',     beard=False, outfit='water', robe=False),
    'harbormaster': dict(hair='steel', hairshape='cap',     beard=True,  outfit='water', robe=False),
    'neve':         dict(hair='red',   hairshape='ponytail',beard=False, outfit='red',   robe=False, accent='scarf'),
    'quarry_chief': dict(hair='stone', hairshape='helmet',  beard=False, outfit='stone', robe=False),
    'warden':       dict(hair='plum',  hairshape='hood',    beard=True,  outfit='plum',  robe=True),
    'windreader':   dict(hair='steel', hairshape='short',   beard=False, outfit='water', robe=True, accent='feather'),
    'chronicler':   dict(hair='steel', hairshape='short',   beard=False, outfit='red',   robe=True, accent='glasses'),
    'abbot':        dict(hair='stone', hairshape='bald',    beard=True,  outfit='fire',  robe=True),
    'high_scholar': dict(hair='steel', hairshape='hat',     beard=True,  outfit='steel', robe=True, accent='gold-trim'),
    'villager':     dict(hair='brown', hairshape='short',   beard=False, outfit='leaf',  robe=False),
    'gareth':       dict(hair='red',   hairshape='short',   beard=True,  outfit='steel', robe=False),
}

def build():
    for key, spec in SPECS.items():
        spec['_key'] = key
        a = np.zeros((FH, FW, 4), np.uint8)
        npc_head(a, spec)
        npc_body(a, spec)
        add_outline(a)
        out = os.path.join(PUB, 'npc')
        os.makedirs(out, exist_ok=True)
        Image.fromarray(a).save(os.path.join(out, f'{key}.png'))
    print(f'built {len(SPECS)} NPC field sprites (v2 hero-language)')

if __name__ == '__main__':
    build()