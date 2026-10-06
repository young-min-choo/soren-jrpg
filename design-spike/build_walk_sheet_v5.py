#!/usr/bin/env python3
"""Build the v5 hero walk sheet — DETERMINISTIC, matches the BATTLE identity.

v4 was rejected by the user (3 times): "nothing like the battle characters."
Forensic comparison showed v4 = blue-tunic kid (tunic dominates, flat cap),
battle Soren = dark-hooded swordsman (plum/charcoal dominates, browns+blue
accents, pale face wedge). v5 inverts the palette dominance to READ as the
battle art when scaled 3x:

  identity anchors (from soren_battle pixel map):
    - hood/hair mass in brown_mid/brown_sh covering head top+sides
    - pale skin wedge (skin_hi) as the ONLY bright face area
    - charcoal/plum body (near-shade of outline) dominating the torso
    - water_sh blue accents (pendant, sash) — the battle sprite's eye-catchers
    - grey-steel accents (belt buckle, scabbard)
  Same 48x96 sheet contract: 3 cols x 4 rows, 16x24 frames.
"""
import numpy as np
from PIL import Image
import os

SPIKE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SPIKE, '..', 'public', 'sprites')

FW, FH = 16, 24
# Master palette values (same as battle roster)
PAL = {
    'outline':  (40, 32, 48),    # plum outline
    'deep':     (36, 24, 40),    # deep shadow — the battle sprite's "black cloth"
    'hair':     (96, 60, 36),    # brown_sh — hood/hair
    'hair_hi':  (152, 104, 56),  # brown_mid — hood highlight
    'skin':     (248, 224, 192), # skin_hi
    'skin_sh':  (232, 184, 144), # skin_mid
    'charcoal': (72, 72, 88),    # stone_sh — trousers/cloth
    'charcoal_d':(52, 52, 64),
    'blue':     (40, 64, 128),   # water_sh — pendant/sash accents
    'blue_hi':  (72, 120, 184),  # water_mid
    'steel':    (160, 168, 192), # steel_mid — buckle
    'steel_sh': (96, 100, 128),
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

# ── FRONT (down-facing) ────────────────────────────────────────────────
# Head rows 1-8: hood mass with pale face wedge in the center-bottom
def head_front(a):
    _H(a, 1, 5, 10, PAL['hair'])      # hood dome
    _H(a, 2, 4, 11, PAL['hair'])
    _H(a, 3, 3, 12, PAL['hair'])
    _H(a, 4, 3, 12, PAL['hair_hi'])   # hood rim highlight
    _H(a, 5, 3, 12, PAL['hair'])
    # face wedge rows 5-8 (narrow, low in the head — hoods hang over brows)
    _H(a, 5, 5, 10, PAL['skin'])      # brow shadow row = skin under hood rim
    _H(a, 6, 4, 11, PAL['skin'])
    _H(a, 7, 4, 11, PAL['skin'])
    _P(a, 6, 6, PAL['outline']); _P(a, 6, 9, PAL['outline'])   # dark eyes
    _H(a, 8, 5, 10, PAL['skin_sh'])   # jaw shade
    # hood side walls frame the face
    _P(a, 6, 3, PAL['hair']); _P(a, 7, 3, PAL['hair'])
    _P(a, 6, 12, PAL['hair']); _P(a, 7, 12, PAL['hair'])
    _P(a, 8, 3, PAL['hair']); _P(a, 8, 12, PAL['hair'])

# Torso rows 9-17: charcoal cloth dominates, blue pendant + sash accents
def torso_front(a):
    _H(a, 9, 4, 11, PAL['deep'])       # collar / cloak line
    _H(a, 10, 3, 12, PAL['deep'])
    _H(a, 11, 3, 12, PAL['deep'])
    _P(a, 10, 7, PAL['blue']); _P(a, 10, 8, PAL['blue'])   # pendant
    _P(a, 11, 7, PAL['blue_hi'])       # pendant glint
    _H(a, 12, 3, 12, PAL['deep'])
    _P(a, 11, 3, PAL['hair']); _P(a, 12, 2, PAL['hair'])   # shoulder hair spill
    _P(a, 12, 13, PAL['hair'])
    _H(a, 13, 3, 12, PAL['deep'])
    _H(a, 14, 3, 12, PAL['deep'])      # sash row
    _H(a, 14, 5, 10, PAL['blue'])      # blue sash band
    _H(a, 15, 3, 12, PAL['deep'])
    _H(a, 16, 4, 11, PAL['deep'])
    _H(a, 17, 4, 11, PAL['charcoal'])  # belt row (lighter = separation)
    _P(a, 16, 2, PAL['deep']); _P(a, 17, 2, PAL['hair'])   # hands/strap hints
    _P(a, 16, 13, PAL['deep']); _P(a, 17, 13, PAL['hair'])
    _P(a, 15, 8, PAL['steel'])         # belt buckle

# Legs rows 18-23: charcoal trousers, brown boots
def legs_front(a, ldx=0, rdx=0, bob=0):
    ly0 = 18 - bob
    for (x0, x1), dx in (((4, 6), ldx), ((9, 11), rdx)):
        _H(a, ly0, x0+dx, x1+dx, PAL['charcoal'])
        _H(a, ly0+1, x0+dx, x1+dx, PAL['charcoal'])
        _H(a, ly0+2, x0+dx, x1+dx, PAL['hair'])          # boots (brown)
        _H(a, ly0+3, x0+dx, x1+dx, PAL['outline'])
    # cloak hem flicker between legs
    _H(a, ly0, 7, 8, PAL['deep'])

# ── SIDE (left-facing; mirrored for right) ─────────────────────────────
def head_side(a):
    _H(a, 1, 5, 10, PAL['hair']); _H(a, 2, 4, 11, PAL['hair'])
    _H(a, 3, 3, 12, PAL['hair']); _H(a, 4, 3, 12, PAL['hair_hi'])
    _H(a, 5, 4, 11, PAL['hair'])
    # profile face wedge on the LEFT edge (facing left)
    _P(a, 4, 3, PAL['skin'])
    _H(a, 5, 3, 9, PAL['skin'])
    _H(a, 6, 3, 9, PAL['skin'])
    _H(a, 7, 4, 10, PAL['skin'])
    _P(a, 6, 4, PAL['outline'])        # single eye
    _H(a, 8, 4, 10, PAL['skin_sh'])
    _P(a, 8, 3, PAL['hair']); _P(a, 7, 3, PAL['hair'])
    _P(a, 8, 11, PAL['hair']); _P(a, 6, 11, PAL['hair'])
    _P(a, 7, 11, PAL['hair'])

def torso_side(a):
    _H(a, 9, 4, 11, PAL['deep'])
    _H(a, 10, 3, 12, PAL['deep'])
    _H(a, 11, 4, 11, PAL['deep'])
    _P(a, 11, 3, PAL['hair'])
    _H(a, 12, 4, 11, PAL['deep'])
    _H(a, 13, 4, 11, PAL['deep'])
    _H(a, 14, 4, 10, PAL['blue'])      # sash visible from side
    _H(a, 15, 4, 11, PAL['deep'])
    _H(a, 16, 4, 11, PAL['deep'])
    _H(a, 17, 4, 11, PAL['charcoal'])
    _P(a, 15, 3, PAL['hair'])

def legs_side(a, stride=0, bob=0):
    ly0 = 18 - bob
    _H(a, ly0, 5, 10, PAL['deep'])     # cloak hem
    if stride == 0:
        _H(a, ly0+1, 5, 9, PAL['charcoal'])
        _H(a, ly0+2, 5, 9, PAL['charcoal'])
        _H(a, ly0+3, 5, 9, PAL['hair'])
        _H(a, ly0+4, 5, 9, PAL['outline'])
    elif stride > 0:
        _H(a, ly0+1, 3, 9, PAL['charcoal'])
        _H(a, ly0+2, 2, 8, PAL['charcoal'])
        _H(a, ly0+3, 2, 7, PAL['hair'])
        _H(a, ly0+4, 2, 8, PAL['outline'])
    else:
        _H(a, ly0+1, 5, 11, PAL['charcoal'])
        _H(a, ly0+2, 6, 12, PAL['charcoal'])
        _H(a, ly0+3, 7, 12, PAL['hair'])
        _H(a, ly0+4, 7, 13, PAL['outline'])

# ── BACK (up-facing): hood covers everything — the battle sprite's back read ──
def head_back(a):
    _H(a, 1, 5, 10, PAL['hair']); _H(a, 2, 4, 11, PAL['hair'])
    _H(a, 3, 3, 12, PAL['hair']); _H(a, 4, 3, 12, PAL['hair_hi'])
    _H(a, 5, 3, 12, PAL['hair']); _H(a, 6, 3, 12, PAL['hair'])
    _H(a, 7, 4, 11, PAL['hair'])
    _H(a, 8, 4, 11, PAL['hair'])

def torso_back(a):
    rows = [
        (9, 4, 11, 'deep'), (10, 3, 12, 'hair_hi'), (11, 3, 12, 'deep'),
        (12, 3, 12, 'hair_hi'), (13, 3, 12, 'deep'), (14, 3, 12, 'deep'),
        (15, 3, 12, 'deep'), (16, 4, 11, 'deep'), (17, 4, 11, 'charcoal'),
    ]
    for y, x0, x1, c in rows:
        _H(a, y, x0, x1, PAL[c])
    _P(a, 10, 7, PAL['blue']); _P(a, 10, 8, PAL['blue'])   # sash knot visible from back

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
    if pose == 'stand': legs_front(a)     # back legs = same silhouette
    elif pose == 'stepL': legs_front(a, s, 0, 1)
    else: legs_front(a, 0, -s, 1)
    # all head rows hair (back of hood); keep legs as-is
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
    # big preview for review
    Image.fromarray(sheet).resize((FW*3*6, FH*4*6), Image.NEAREST).save(os.path.join(SPIKE, 'preview_field_v5.png'))
    print('walk sheet v5: hooded-identity, 12 frames')

if __name__ == '__main__':
    assemble()