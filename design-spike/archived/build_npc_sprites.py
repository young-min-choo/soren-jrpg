#!/usr/bin/env python3
"""Build ALL NPC field sprites (16x24) + dialogue portraits (48x48).

DETERMINISTIC hand-pixel pipeline (same family as build_walk_sheet_v4):
no AI raws — every NPC is drawn from one parametric chibi-GBA template +
per-character spec (hair color/shape, outfit ramp, accessories). One spec
drives BOTH the field frame and the portrait, so a character is consistent
across the two representations.

All colors come from the 29-color master palette (P4 — one game, one
palette). Plum outline, 2-tone shading, no pure black (ART-BIBLE v2).

Output:
  public/sprites/npc/<key>.png       (16x24 field frames, alpha bg)
  public/sprites/portraits/<key>.png (48x48 busts, alpha bg)
  design-spike/sheet_npc.png         (x6 cohesion sheet, for review)
"""
import numpy as np
from PIL import Image
import os

SPIKE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(SPIKE, '..', 'public', 'sprites')

MP = {  # master palette
    'outline':   (40, 32, 48),
    'shadow':    (36, 24, 40),
    'skin_hi':   (248, 224, 192), 'skin_mid': (232, 184, 144), 'skin_sh': (184, 128, 88),
    'red_hi':    (240, 136, 112), 'red_mid':  (200, 64, 56),   'red_sh':  (136, 36, 44),
    'brown_hi':  (200, 152, 96),  'brown_mid':(152, 104, 56),  'brown_sh': (96, 60, 36),
    'steel_hi':  (232, 232, 240), 'steel_mid':(160, 168, 192), 'steel_sh': (96, 100, 128),
    'gold_hi':   (248, 216, 112), 'gold_mid': (192, 144, 48),
    'leaf_hi':   (136, 192, 96),  'leaf_mid': (80, 136, 64),   'leaf_sh': (44, 88, 48),
    'stone_hi':  (176, 176, 184), 'stone_mid':(120, 120, 136), 'stone_sh': (72, 72, 88),
    'water_hi':  (136, 184, 232), 'water_mid':(72, 120, 184),  'water_sh': (40, 64, 128),
    'fire_hi':   (248, 216, 144), 'fire_mid': (240, 144, 48),  'fire_deep':(160, 72, 32),
    'light':     (248, 248, 248),
}

# Ramps: (hi, mid, shadow) triples from master palette
RAMP = {
    'brown': ('brown_hi', 'brown_mid', 'brown_sh'),
    'steel': ('steel_hi', 'steel_mid', 'steel_sh'),
    'gold':  ('gold_hi', 'gold_mid', 'brown_sh'),
    'red':   ('red_hi', 'red_mid', 'red_sh'),
    'leaf':  ('leaf_hi', 'leaf_mid', 'leaf_sh'),
    'stone': ('stone_hi', 'stone_mid', 'stone_sh'),
    'water': ('water_hi', 'water_mid', 'water_sh'),
    'fire':  ('fire_hi', 'fire_mid', 'fire_deep'),
}

# ── Character specs ──────────────────────────────────────────────────────
# hair: ramp name | hairshape: short/long/bald/cap/hood/helmet/hat/bun/ponytail/spiky
# beard: bool | outfit: ramp | robe: bool (long hem vs tunic+trousers)
# skin: 'mid' default | accent: 'scarf-red'/'glasses'/'feather-steel'/'gold-trim'/'apron'
SPECS = {
    'elder':       dict(hair='steel', hairshape='long',  beard=True,  outfit='brown', robe=True,  accent=None),
    'job_master':   dict(hair='brown', hairshape='short', beard=False, outfit='leaf',  robe=True,  accent=None),
    'shopkeeper':  dict(hair='brown', hairshape='short', beard=False, outfit='brown', robe=False, accent='apron-gold'),
    'innkeeper':   dict(hair='gold',  hairshape='long',  beard=False, outfit='water', robe=False, accent='apron-water'),
    'townsfolk':   dict(hair='brown', hairshape='short', beard=False, outfit='stone', robe=False, accent=None),
    'dockhand':    dict(hair='brown', hairshape='cap',   beard=False, outfit='water', robe=False, accent=None),
    'harbormaster':dict(hair='steel', hairshape='cap',   beard=True,  outfit='water', robe=False, accent=None),
    'neve':        dict(hair='brown', hairshape='ponytail', beard=False, outfit='red', robe=False, accent='scarf'),
    'quarry_chief':dict(hair='stone', hairshape='helmet', beard=False, outfit='stone', robe=False, accent=None),
    'warden':      dict(hair='steel', hairshape='hood',  beard=True,  outfit='stone', robe=True,  accent=None),
    'windreader':  dict(hair='steel', hairshape='short', beard=False, outfit='water', robe=True,  accent='feather'),
    'chronicler':  dict(hair='steel', hairshape='short', beard=False, outfit='red',   robe=True,  accent='glasses'),
    'abbot':       dict(hair='stone', hairshape='bald',  beard=True,  outfit='fire',  robe=True,  accent=None),
    'high_scholar':dict(hair='steel', hairshape='hat',  beard=True,  outfit='steel', robe=True,  accent='gold-trim'),
    'villager':    dict(hair='brown', hairshape='short', beard=False, outfit='leaf',  robe=False, accent=None),
    'gareth':      dict(hair='steel', hairshape='short', beard=True,  outfit='steel', robe=False, accent=None),
    # Party portraits only (field art = soren_field_sheet / battle roster):
    'soren':       dict(hair='brown', hairshape='spiky', beard=False, outfit='water', robe=False, accent=None),
    'aria':        dict(hair='gold',  hairshape='long',  beard=False, outfit='leaf',  robe=True,  accent=None),
    'kael':        dict(hair='brown', hairshape='short', beard=False, outfit='steel', robe=False, accent=None),
    'aldric':      dict(hair='steel', hairshape='short', beard=True,  outfit='red',   robe=True,  accent=None),
}
FIELD_ONLY = set()          # every spec ships a field frame; party members use hero sheet — exclude:
FIELD_EXCLUDE = {'soren', 'aria', 'kael', 'aldric'}

# ── Pixel helpers (bounds derive from array shape — shared by field + portrait) ──
FW, FH = 16, 24
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

# ── Field frame renderer ─────────────────────────────────────────────────
def field_frame(spec):
    a = np.zeros((FH, FW, 4), np.uint8)
    hair_hi, hair_md, hair_sh = (MP[k] for k in RAMP[spec['hair']])
    o_hi, o_md, o_sh = (MP[k] for k in RAMP[spec['outfit']])
    skin, skin_sh = MP['skin_mid'], MP['skin_sh']
    dark = MP['outline']
    hs = spec['hairshape']

    # — head band rows 1-10 (chibi: big head) —
    # hair dome
    _H(a, 1, 5, 10, hair_md); _H(a, 2, 4, 11, hair_md)
    _H(a, 3, 3, 12, hair_md); _H(a, 4, 3, 12, hair_hi); _H(a, 5, 3, 12, hair_md)
    # face
    _H(a, 6, 3, 12, skin); _H(a, 7, 3, 12, skin); _H(a, 8, 3, 12, skin)
    _H(a, 9, 4, 11, skin); _H(a, 10, 5, 10, skin_sh)
    _P(a, 7, 3, hair_md); _P(a, 8, 3, hair_sh)     # side hair
    _P(a, 7, 12, hair_md); _P(a, 8, 12, hair_sh)
    _P(a, 7, 6, dark); _P(a, 7, 9, dark)          # eyes
    _H(a, 9, 6, 9, skin)                            # mouth row stays skin

    if spec.get('beard'):  # beard replaces mouth row band
        _H(a, 9, 4, 11, hair_md); _P(a, 9, 7, skin); _P(a, 9, 8, skin)
        _H(a, 10, 4, 11, hair_sh)

    # hairshape overrides
    if hs == 'long':
        for y in range(7, 12):
            _P(a, y, 2, hair_md); _P(a, y, 13, hair_md)
        _P(a, 11, 2, hair_sh); _P(a, 11, 13, hair_sh)
    elif hs == 'bald':
        for y in range(1, 6):
            _H(a, y, max(3, 5 - y + 1), min(12, 10 + y - 1), skin)  # skin dome
        _P(a, 4, 3, hair_md); _P(a, 4, 12, hair_md)
        _P(a, 5, 3, hair_md); _P(a, 5, 12, hair_md)  # side fringe
    elif hs == 'cap':
        _H(a, 0, 5, 10, o_md); _H(a, 1, 4, 11, o_md); _H(a, 2, 3, 12, o_md)
        _H(a, 3, 3, 13, o_sh)                          # brim
        _H(a, 4, 3, 12, hair_md)                        # hair under cap
    elif hs == 'hood':
        _H(a, 0, 4, 11, o_md); _H(a, 1, 3, 12, o_md)
        _H(a, 2, 2, 13, o_md); _H(a, 3, 2, 13, o_sh)
        for y in range(4, 12):
            _P(a, y, 2, o_md); _P(a, y, 13, o_md)      # hood sides
        _H(a, 4, 3, 12, hair_md)
    elif hs == 'helmet':
        _H(a, 0, 4, 11, o_hi); _H(a, 1, 3, 12, o_md); _H(a, 2, 3, 12, o_md)
        _H(a, 3, 3, 13, o_sh); _H(a, 4, 3, 12, o_md)
    elif hs == 'hat':
        _H(a, 0, 6, 9, o_md)                            # crown
        _H(a, 1, 5, 10, o_md)
        _H(a, 2, 2, 13, o_sh)                           # wide brim
        _H(a, 3, 3, 12, hair_md)
    elif hs == 'ponytail':
        _P(a, 2, 12, hair_md); _P(a, 3, 13, hair_md); _P(a, 4, 13, hair_md)
        _P(a, 5, 13, hair_sh); _P(a, 6, 13, hair_sh)
    elif hs == 'spiky':
        for x in range(4, 12, 2): _P(a, 0, x, hair_md)

    # — torso rows 11-17 —
    robe = spec.get('robe')
    if robe:
        for i, y in enumerate(range(11, 22)):
            w = min(5 + (i // 6), 6)
            x0, x1 = 7 - w, 8 + w
            c = o_hi if y in (14,) else (o_sh if y >= 19 else o_md)
            _H(a, y, x0, x1, c)
        _H(a, 20, 1, 14, o_sh)                          # hem
        _H(a, 21, 2, 13, o_sh)
        _H(a, 22, 3, 6, dark); _H(a, 22, 9, 12, dark)   # feet peek
    else:
        _H(a, 11, 5, 10, o_md); _H(a, 12, 4, 11, o_md); _H(a, 13, 3, 12, o_md)
        _H(a, 14, 3, 12, o_hi); _H(a, 15, 3, 12, o_md); _H(a, 16, 4, 11, o_sh)
        _H(a, 17, 4, 11, MP['brown_sh'])                # belt
        _P(a, 12, 3, o_md); _P(a, 13, 2, o_md); _P(a, 12, 12, o_md); _P(a, 13, 13, o_md)
        # trousers + boots
        _H(a, 18, 4, 6, MP['stone_sh']); _H(a, 18, 9, 11, MP['stone_sh'])
        _H(a, 19, 4, 6, MP['stone_sh']); _H(a, 19, 9, 11, MP['stone_sh'])
        _H(a, 20, 4, 6, MP['brown_sh']); _H(a, 20, 9, 11, MP['brown_sh'])
        _H(a, 21, 4, 6, dark); _H(a, 21, 9, 11, dark)

    # accents
    acc = spec.get('accent')
    if acc == 'apron-gold':
        _H(a, 13, 5, 10, MP['gold_hi']); _H(a, 14, 5, 10, MP['gold_mid'])
        _H(a, 15, 5, 10, MP['gold_hi']); _H(a, 16, 5, 10, MP['gold_mid'])
        _H(a, 17, 5, 10, MP['gold_hi'])
    elif acc == 'apron-water':
        _H(a, 13, 5, 10, MP['water_hi']); _H(a, 14, 5, 10, MP['water_mid'])
        _H(a, 15, 5, 10, MP['water_hi']); _H(a, 16, 5, 10, MP['water_mid'])
        _H(a, 17, 5, 10, MP['water_hi'])
    elif acc == 'scarf':
        _H(a, 11, 4, 11, MP['red_hi']); _H(a, 12, 5, 10, MP['red_mid'])
        _P(a, 13, 9, MP['red_mid']); _P(a, 14, 10, MP['red_mid'])  # tail
    elif acc == 'feather':
        _P(a, 1, 11, MP['water_hi']); _P(a, 0, 12, MP['water_hi']); _P(a, 0, 11, MP['steel_hi'])
    elif acc == 'glasses':
        _P(a, 6, 5, MP['steel_hi']); _P(a, 6, 10, MP['steel_hi'])
    elif acc == 'gold-trim':
        _H(a, 11, 4, 11, MP['gold_hi'])

    add_outline(a)
    return a

# ── Portrait renderer (48x48 bust) ──────────────────────────────────────
PW, PH = 48, 48
def portrait(spec):
    a = np.zeros((PH, PW, 4), np.uint8)
    hair_hi, hair_md, hair_sh = (MP[k] for k in RAMP[spec['hair']])
    o_hi, o_md, o_sh = (MP[k] for k in RAMP[spec['outfit']])
    skin, skin_sh, skin_dk = MP['skin_mid'], MP['skin_sh'], MP['skin_hi']
    dark = MP['outline']
    hs = spec['hairshape']

    # head: oval rows 6-36, cols 14-34 (20 wide)
    for y in range(6, 37):
        # ellipse half-width
        t = (y - 6) / 30
        hw = int(10 * (1 - ((t - 0.45) ** 2) / 0.35))
        hw = max(4, min(10, hw))
        c = skin_dk if y < 10 else skin
        _H(a, y, 24 - hw, 24 + hw, c)
    # cheeks shading
    for y in range(28, 36):
        _P(a, y, 15, skin_sh); _P(a, y, 33, skin_sh)

    # eyes (rows 20-23): dark 3px + highlight
    for ex in (19, 28):
        _H(a, 20, ex, ex + 2, dark)
        _H(a, 21, ex, ex + 2, dark)
        _P(a, 21, ex, MP['light'])
    # brows
    _H(a, 17, 19, 21, hair_sh); _H(a, 17, 28, 30, hair_sh)
    # nose + mouth
    _P(a, 26, 23, skin_sh); _P(a, 27, 23, skin_sh)
    _H(a, 30, 21, 27, MP['red_sh'])

    if spec.get('beard'):
        for y in range(29, 37):
            hw = 9 - (y - 29) // 3
            _H(a, y, 24 - hw, 24 + hw, hair_md)
        _H(a, 37, 18, 30, hair_md); _H(a, 38, 17, 31, hair_sh)  # chin
        _H(a, 30, 21, 27, hair_sh)  # moustache over mouth

    # hair dome over top of head
    _H(a, 2, 17, 31, hair_md); _H(a, 3, 15, 33, hair_md)
    _H(a, 4, 14, 34, hair_md); _H(a, 5, 13, 35, hair_hi)
    for y in range(6, 16):
        w = 11 if y < 12 else 10
        _H(a, y, 24 - w, 13, hair_md); _H(a, y, 35, 24 + w, hair_md)
        _H(a, y, 14, 24 - w + 1, skin)  # keep face clear — re-draw face under fringe later

    # hairshape overrides
    if hs == 'long':
        for y in range(16, 40):
            _H(a, y, 11, 13, hair_md); _H(a, y, 35, 37, hair_md)
        _H(a, 39, 11, 13, hair_sh); _H(a, 39, 35, 37, hair_sh)
    elif hs == 'bald':
        for y in range(2, 8):
            _H(a, y, 17, 31, skin_dk)  # skin dome — wait, hair drawn above; clear it
        for y in range(2, 9):
            _H(a, y, 14, 34, (0, 0, 0, 0))
        for y in range(4, 9):
            hw2 = 10
            _H(a, y, 24 - hw2, 24 + hw2, skin_dk)
        _H(a, 9, 13, 14, hair_md); _H(a, 9, 34, 35, hair_md)  # side fringe
        _H(a, 10, 13, 14, hair_sh); _H(a, 10, 34, 35, hair_sh)
    elif hs == 'cap':
        for y in range(2, 9):
            hw2 = 12 if y > 3 else 10 - (y // 3)
            _H(a, y, 24 - hw2, 24 + hw2, o_md if y < 8 else o_sh)
        _H(a, 9, 12, 36, o_sh)   # brim
    elif hs == 'hood':
        for y in range(1, 12):
            hw2 = 13
            _H(a, y, 24 - hw2, 24 + hw2, o_md)
        for y in range(12, 38):
            _H(a, y, 10, 12, o_md); _H(a, y, 36, 38, o_md)
        _H(a, 12, 12, 13, o_sh); _H(a, 12, 35, 36, o_sh)
    elif hs == 'helmet':
        for y in range(1, 10):
            hw2 = 12 if y > 3 else 11
            _H(a, y, 24 - hw2, 24 + hw2, o_md)
        _H(a, 10, 11, 37, o_sh); _H(a, 9, 12, 36, o_hi)
    elif hs == 'hat':
        _H(a, 1, 20, 28, o_md); _H(a, 2, 18, 30, o_md); _H(a, 3, 17, 31, o_md)
        _H(a, 4, 12, 36, o_sh)   # wide brim
        _H(a, 4, 12, 36, o_sh)
        _H(a, 5, 13, 35, hair_md)
    elif hs == 'ponytail':
        _H(a, 10, 34, 37, hair_md); _H(a, 12, 36, 39, hair_md)
        _H(a, 15, 37, 40, hair_sh); _H(a, 18, 38, 40, hair_sh)
        _H(a, 20, 38, 39, hair_sh)
    elif hs == 'spiky':
        for x in range(16, 33, 4):
            _P(a, 0, x, hair_md); _P(a, 1, x, hair_hi); _P(a, 1, x + 1, hair_hi)

    # shoulders rows 38-47 in outfit
    for y in range(38, 48):
        w = 14 + (y - 38)  # widen
        w = min(w, 23)
        c = o_hi if y == 40 else (o_sh if y >= 45 else o_md)
        _H(a, y, 24 - w, 24 + w, c)
    # collar
    _H(a, 38, 18, 30, o_sh); _H(a, 37, 20, 28, skin)

    acc = spec.get('accent')
    if acc == 'apron-gold':
        _H(a, 41, 19, 29, MP['gold_hi']); _H(a, 42, 19, 29, MP['gold_mid'])
    elif acc == 'apron-water':
        _H(a, 41, 19, 29, MP['water_hi']); _H(a, 42, 19, 29, MP['water_mid'])
    elif acc == 'scarf':
        _H(a, 37, 17, 31, MP['red_hi']); _H(a, 38, 18, 30, MP['red_mid'])
        _H(a, 39, 26, 30, MP['red_mid']); _H(a, 40, 28, 32, MP['red_mid'])
    elif acc == 'feather':
        _P(a, 4, 32, MP['water_hi']); _P(a, 3, 34, MP['water_hi']); _P(a, 2, 36, MP['water_hi'])
    elif acc == 'glasses':
        _H(a, 20, 18, 22, MP['steel_hi']); _H(a, 20, 26, 30, MP['steel_hi'])
        _H(a, 21, 18, 22, MP['steel_hi']); _H(a, 21, 26, 30, MP['steel_hi'])
        _H(a, 20, 23, 25, dark); _H(a, 21, 24, 24, dark)
        _P(a, 20, 18, dark); _P(a, 20, 30, dark)
    elif acc == 'gold-trim':
        _H(a, 39, 16, 32, MP['gold_hi']); _H(a, 43, 12, 36, MP['gold_hi'])
        _H(a, 46, 10, 38, MP['gold_hi'])

    add_outline(a)
    return a

# ── Build all ────────────────────────────────────────────────────────────
def build():
    npc_dir = os.path.join(PUB, 'npc'); os.makedirs(npc_dir, exist_ok=True)
    por_dir = os.path.join(PUB, 'portraits'); os.makedirs(por_dir, exist_ok=True)
    for key, spec in SPECS.items():
        if key not in FIELD_EXCLUDE:
            Image.fromarray(field_frame(spec)).save(os.path.join(npc_dir, f'{key}.png'))
        Image.fromarray(portrait(spec)).save(os.path.join(por_dir, f'{key}.png'))
    # cohesion sheet: fields row 1, portraits row 2, x4
    keys = [k for k in SPECS if k not in FIELD_EXCLUDE]
    fw, fh = FW * 4, PH * 4
    sheet = Image.new('RGBA', (fw * len(keys), fh * 2), (24, 20, 32, 255))
    for i, k in enumerate(keys):
        f = Image.open(os.path.join(npc_dir, f'{k}.png')).resize((FW * 4, FH * 4), Image.NEAREST)
        p = Image.open(os.path.join(por_dir, f'{k}.png')).resize((PW * 4, PH * 4), Image.NEAREST)
        sheet.paste(f, (i * fw, 0), f)
        p2 = p.resize((fw, fh), Image.NEAREST)
        sheet.paste(p2, (i * fw, fh), p2)
    sheet.save(os.path.join(SPIKE, 'sheet_npc.png'))
    print(f"built {len(keys)} field frames + {len(SPECS)} portraits")

if __name__ == '__main__':
    build()