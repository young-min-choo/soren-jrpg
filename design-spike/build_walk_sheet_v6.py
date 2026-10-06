#!/usr/bin/env python3
"""v6 hero walk sheet — richer detail pass on the approved v5 identity.

User bar: the field hero should be "more detailed and similar to the battle
character." v5 established identity (hood mass, pale wedge, charcoal/plum
cloth, blue pendant/sash, steel buckle, brown boots). v6 adds:
  - 3-tone hood shading (hi rim, mid mass, deep under-shadow) + fabric folds
  - face: eyebrow shadow line, nose notch, sideburn shadow — still 8-px wedge
  - cloak: asymmetric hem with fold notches, shoulder cape-edge highlights
  - sword: hip scabbard visible from front/side (battle character carries one)
  - legs: knee highlights + boot cuffs + 3-tone cloak hem on ground row
Same contract: 48x96 sheet, 16x24 frames, 3 cols x 4 rows (down,left,right,up).
"""
import numpy as np
from PIL import Image
import os

SPIKE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SPIKE, '..', 'public', 'sprites')

FW, FH = 16, 24
PAL = {
    'outline':   (40, 32, 48),
    'deep':      (36, 24, 40),
    'deep_hi':   (56, 44, 64),    # NEW: cloth lit edge (deep+lighter plum)
    'hood':      (64, 52, 72),    # plum hood mid (battle head mass, lighter than outline)
    'hood_hi':   (96, 76, 104),   # hood rim highlight
    'hood_sh':   (44, 36, 52),    # hood under-shadow
    'hood_edge': (40, 32, 48),    # = outline plum — the DOMINANT battle head read
    'hair':      (96, 60, 36),    # tiny fringe tuft only
    'hair_hi':   (152, 104, 56),
    'skin':      (248, 224, 192),
    'skin_sh':   (232, 184, 144),
    'charcoal':  (72, 72, 88),
    'charcoal_d':(52, 52, 64),
    'charcoal_l':(96, 96, 112),   # NEW: trouser top highlight
    'blue':      (40, 64, 128),
    'blue_hi':   (72, 120, 184),
    'steel':     (160, 168, 192),
    'steel_sh':  (96, 100, 128),
    'steel_l':   (208, 216, 232), # NEW: blade glint
    'wood':      (104, 68, 40),   # NEW: scabbard/hilt wrap
}

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
    a[ring, 0] = PAL['outline'][0]; a[ring, 1] = PAL['outline'][1]
    a[ring, 2] = PAL['outline'][2]; a[ring, 3] = 255

# ── FRONT ──────────────────────────────────────────────────────────────
def head_front(a):
    _H(a, 1, 5, 10, PAL['hood'])
    _H(a, 2, 4, 11, PAL['hood'])
    _H(a, 3, 3, 12, PAL['hood_hi'])
    _H(a, 4, 3, 12, PAL['hood'])
    _P(a, 2, 5, PAL['hood_hi']); _P(a, 2, 9, PAL['hood_hi'])
    _H(a, 5, 4, 11, PAL['hood_sh'])
    # PALE FACE WEDGE (battle: 4-6 skin px) — rows 6-8, narrow
    _H(a, 6, 6, 9, PAL['skin'])
    _H(a, 7, 6, 9, PAL['skin'])
    _P(a, 6, 6, PAL['outline']); _P(a, 6, 9, PAL['outline'])
    _H(a, 8, 7, 8, PAL['skin_sh'])            # chin hint only
    # hood shadows frame the wedge
    _P(a, 6, 5, PAL['hood_sh']); _P(a, 7, 5, PAL['hood_sh'])
    _P(a, 8, 5, PAL['hood_sh']); _P(a, 8, 6, PAL['hood_sh'])
    _P(a, 8, 9, PAL['hood_sh'])
    _P(a, 6, 4, PAL['hood_edge']); _P(a, 7, 4, PAL['hood'])
    _P(a, 6, 10, PAL['hood_sh']); _P(a, 7, 10, PAL['hood_sh'])
    _P(a, 6, 11, PAL['hood_edge']); _P(a, 7, 11, PAL['hood'])
    _P(a, 8, 4, PAL['hood']); _P(a, 8, 10, PAL['hood']); _P(a, 8, 11, PAL['hood'])
    _P(a, 7, 5, PAL['hood_sh'])



def torso_front(a):
    # collar + cloak shoulders w/ edge highlights
    _H(a, 9, 4, 11, PAL['deep'])
    _H(a, 10, 3, 12, PAL['deep'])
    _P(a, 10, 3, PAL['deep_hi']); _P(a, 10, 12, PAL['deep_hi'])  # shoulder glints
    _H(a, 11, 3, 12, PAL['deep'])
    _P(a, 10, 7, PAL['blue']); _P(a, 10, 8, PAL['blue'])          # pendant
    _P(a, 11, 7, PAL['blue_hi'])
    _H(a, 12, 3, 12, PAL['deep'])
    _P(a, 11, 3, PAL['hair']); _P(a, 12, 2, PAL['hair'])          # shoulder cape spill
    _P(a, 12, 13, PAL['hair'])
    _P(a, 12, 3, PAL['deep_hi']); _P(a, 12, 12, PAL['deep_hi'])   # cape edge
    _H(a, 13, 3, 12, PAL['deep'])
    _H(a, 14, 3, 12, PAL['deep'])                                 # sash row
    _H(a, 14, 5, 10, PAL['blue'])                                 # blue sash band
    _P(a, 14, 5, PAL['blue_hi'])                                  # sash glint
    _H(a, 15, 3, 12, PAL['deep'])
    _H(a, 16, 4, 11, PAL['deep'])
    _H(a, 17, 4, 11, PAL['charcoal'])                             # belt row
    _P(a, 15, 8, PAL['steel'])                                    # belt buckle
    _P(a, 15, 7, PAL['steel_sh'])                                 # buckle shade
    # scabbard across left hip (front): wood + steel throat
    _P(a, 15, 10, PAL['wood']); _P(a, 16, 10, PAL['wood']); _P(a, 17, 10, PAL['wood_sh'] if 'wood_sh' in PAL else PAL['outline'])
    _P(a, 16, 11, PAL['wood'])
    # side hands/strap hints
    _P(a, 16, 2, PAL['deep_hero_hands'] if 'deep_hero_hands' in PAL else PAL['skin_sh'])
    _P(a, 17, 2, PAL['hair']); _P(a, 16, 13, PAL['deep']); _P(a, 17, 13, PAL['hair'])

def legs_front(a, ldx=0, rdx=0, bob=0):
    ly0 = 18 - bob
    for (x0, x1), dx, lift in (((4, 6), ldx, 1 if ldx else 0), ((9, 11), rdx, 1 if rdx else 0)):
        _H(a, ly0, x0+dx, x1+dx, PAL['charcoal_l'])   # knee top highlight
        _H(a, ly0+1, x0+dx, x1+dx, PAL['charcoal'])
        _H(a, ly0+2, x0+dx, x1+dx, PAL['charcoal_d'])  # shin shade
        boot_y = ly0+3
        if lift: boot_y -= 0
        _H(a, boot_y, x0+dx, x1+dx, PAL['wood'])       # dark boot body
        _H(a, boot_y+1, x0+dx, x1+dx, PAL['outline'])  # sole
    # cloak hem flicker between legs + fold notches on hem edges
    _H(a, ly0, 7, 8, PAL['deep'])
    _P(a, ly0, 4, PAL['deep_hi']); _P(a, ly0, 11, PAL['deep_hi'])

# ── SIDE (left-facing; mirrored for right) ─────────────────────────────
def head_side(a):
    _H(a, 1, 5, 10, PAL['hood']); _H(a, 2, 4, 11, PAL['hood'])
    _H(a, 3, 3, 12, PAL['hood_hi']); _H(a, 4, 3, 12, PAL['hood'])
    _P(a, 2, 8, PAL['hood_hi'])
    _H(a, 5, 4, 11, PAL['hood_sh'])
    _P(a, 4, 3, PAL['skin'])                  # brow point
    _H(a, 5, 3, 5, PAL['skin'])               # upper wedge (short)
    _H(a, 6, 3, 6, PAL['skin'])
    _H(a, 7, 4, 6, PAL['skin'])
    _P(a, 6, 4, PAL['outline'])
    _P(a, 7, 5, PAL['skin_sh'])
    _H(a, 8, 5, 6, PAL['skin_sh'])
    _P(a, 8, 4, PAL['hood']); _P(a, 8, 3, PAL['hood_sh'])
    _P(a, 7, 7, PAL['hood_sh']); _P(a, 8, 7, PAL['hood_sh'])
    _P(a, 8, 9, PAL['hood']); _P(a, 8, 10, PAL['hood']); _P(a, 8, 11, PAL['hood_edge'])
    _P(a, 7, 10, PAL['hood']); _P(a, 6, 10, PAL['hood'])
    _P(a, 7, 11, PAL['hood'])
    # neck shadow merge
    _P(a, 9, 4, PAL['hair']); _P(a, 9, 11, PAL['hair'])



def torso_side(a):
    _H(a, 9, 4, 11, PAL['deep'])
    _H(a, 10, 3, 12, PAL['deep'])
    _P(a, 10, 4, PAL['deep_hi'])                        # chest edge glint
    _H(a, 11, 4, 11, PAL['deep'])
    _P(a, 11, 3, PAL['hair'])
    _H(a, 12, 4, 11, PAL['deep'])
    _P(a, 12, 4, PAL['blue_hi'])                        # pendant hangs toward viewer-left
    _H(a, 13, 4, 11, PAL['deep'])
    _H(a, 14, 4, 10, PAL['blue'])                       # side sash
    _H(a, 15, 4, 11, PAL['deep'])
    _H(a, 16, 4, 11, PAL['deep'])
    _H(a, 17, 4, 11, PAL['charcoal'])
    # scabbard along the back hip (side): visible diagonal wedge
    _P(a, 13, 12, PAL['wood']); _P(a, 14, 12, PAL['wood'])
    _P(a, 14, 11, PAL['wood'])
    _P(a, 15, 3, PAL['hair'])

def legs_side(a, stride=0, bob=0):
    ly0 = 18 - bob
    _H(a, ly0, 3, 11, PAL['deep'])                      # cloak hem
    _P(a, ly0, 3, PAL['deep_hi']); _P(a, ly0, 11, PAL['deep_hi'])
    if stride == 0:
        _H(a, ly0+1, 4, 6, PAL['charcoal_l']); _H(a, ly0+1, 8, 10, PAL['charcoal_d'])
        _H(a, ly0+2, 4, 6, PAL['charcoal']); _H(a, ly0+2, 8, 10, PAL['charcoal_d'])
        _H(a, ly0+3, 3, 6, PAL['wood']);     _H(a, ly0+3, 8, 10, PAL['charcoal_d'])
        _H(a, ly0+4, 3, 6, PAL['outline']); _P(a, ly0+4, 9, PAL['outline'])
    elif stride > 0:
        _H(a, ly0+1, 3, 6, PAL['charcoal_l']); _H(a, ly0+1, 9, 11, PAL['charcoal_d'])
        _H(a, ly0+2, 1, 5, PAL['charcoal']); _H(a, ly0+2, 10, 12, PAL['charcoal_d'])
        _H(a, ly0+3, 1, 4, PAL['wood']);     _H(a, ly0+3, 11, 13, PAL['charcoal_d'])
        _H(a, ly0+4, 1, 4, PAL['outline']); _P(a, ly0+4, 12, PAL['outline'])
    else:
        _H(a, ly0+1, 8, 11, PAL['charcoal_l']); _H(a, ly0+1, 2, 5, PAL['charcoal_d'])
        _H(a, ly0+2, 9, 12, PAL['charcoal']); _H(a, ly0+2, 1, 4, PAL['charcoal_d'])
        _H(a, ly0+3, 10, 13, PAL['wood']);    _H(a, ly0+3, 1, 3, PAL['charcoal_d'])
        _H(a, ly0+4, 10, 13, PAL['outline']); _P(a, ly0+4, 2, PAL['outline'])

# ── BACK ───────────────────────────────────────────────────────────────
def head_back(a):
    _H(a, 1, 5, 10, PAL['hood']); _H(a, 2, 4, 11, PAL['hood'])
    _H(a, 3, 3, 12, PAL['hood_hi']); _H(a, 4, 3, 12, PAL['hood'])
    _P(a, 2, 6, PAL['hood_hi']); _P(a, 2, 9, PAL['hood_hi'])
    _H(a, 5, 3, 12, PAL['hood']); _H(a, 6, 3, 12, PAL['hood'])
    _P(a, 5, 4, PAL['hood_sh']); _P(a, 6, 4, PAL['hood_sh'])
    _H(a, 7, 4, 11, PAL['hood']); _H(a, 8, 4, 11, PAL['hood'])
    _P(a, 7, 4, PAL['hair']); _P(a, 7, 11, PAL['hair'])



def torso_back(a):
    rows = [
        (9, 4, 11, 'deep'), (10, 3, 12, 'hair_hi'), (11, 3, 12, 'deep'),
        (12, 3, 12, 'hair_hi'), (13, 3, 12, 'deep'), (14, 3, 12, 'deep'),
        (15, 3, 12, 'deep'), (16, 4, 11, 'deep'), (17, 4, 11, 'charcoal'),
    ]
    for y, x0, x1, c in rows:
        _H(a, y, x0, x1, PAL[c])
    _P(a, 10, 7, PAL['blue']); _P(a, 10, 8, PAL['blue'])
    _P(a, 12, 3, PAL['deep_hi']); _P(a, 12, 12, PAL['deep_hi'])  # cape edges
    # scabbard hilt over right shoulder from the back
    _P(a, 9, 10, PAL['wood']); _P(a, 10, 11, PAL['wood']); _P(a, 9, 11, PAL['steel'])

def frame_front(pose, s=1):
    a = np.zeros((FH, FW, 4), np.uint8)
    head_front(a); torso_front(a)
    if pose == 'stand': legs_front(a)
    elif pose == 'stepL': legs_front(a, s, 0, 1)
    else: legs_front(a, 0, -s, 1)
    add_outline(a)
    return a

def frame_side(pose, mirror=False):
    a = np.zeros((FH, FW, 4), np.uint8)
    head_side(a); torso_side(a)
    if pose == 'stand': legs_side(a)
    elif pose == 'stepL': legs_side(a, 1)
    else: legs_side(a, -1)
    add_outline(a)
    if mirror: a = np.ascontiguousarray(a[:, ::-1, :])
    return a

def frame_back(pose, s=1):
    a = np.zeros((FH, FW, 4), np.uint8)
    head_back(a); torso_back(a)
    if pose == 'stand': legs_front(a)
    elif pose == 'stepL': legs_front(a, s, 0, 1)
    else: legs_front(a, 0, -s, 1)
    for y in range(0, 12):
        for x in range(FW):
            if a[y, x, 3] > 0 and (x < 3 or x > 12):
                a[y, x, :3] = PAL['hair']
    add_outline(a)
    return a

def make_sheet():
    sheet = np.zeros((FH * 4, FW * 3, 4), np.uint8)
    rows = [
        (frame_front('stand'), frame_front('stepL'), frame_front('stepR')),
        (frame_side('stand'), frame_side('stepL'), frame_side('stepR')),
        (frame_side('stand', True), frame_side('stepL', True), frame_side('stepR', True)),
        (frame_back('stand'), frame_back('stepL'), frame_back('stepR')),
    ]
    for r, frames in enumerate(rows):
        for c, fr in enumerate(frames):
            sheet[r*FH:(r+1)*FH, c*FW:(c+1)*FW] = fr
    return sheet

def assemble():
    sheet = make_sheet()
    Image.fromarray(sheet).save(os.path.join(OUT, 'soren_field_sheet.png'))
    Image.fromarray(sheet).resize((FW*3*6, FH*4*6), Image.NEAREST).save(os.path.join(SPIKE, 'preview_field_v6.png'))
    print('walk sheet v6: detailed hooded-identity, 12 frames')

if __name__ == '__main__':
    assemble()