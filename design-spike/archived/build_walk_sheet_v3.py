#!/usr/bin/env python3
"""Build the 12-frame hero walk sheet — DETERMINISTIC hand-pixel pipeline v2.

AI-raw downscale is retired (painterly 512px → 16×24 = mud). We DRAW the hero
in code using the AI identity palette (teal tunic, brown hair/belt/boots, skin,
slate trousers, plum outline), matching the AI battle sprite's colors.

Per ART-BIBLE v2:
- 16×24 frames, 3 cols × 4 rows (down / left / right / up)
- real pose change: stand / step-L / step-R (leg stride + 1px body bob)
- rows 1-2 share one side drawing (mirrored); row 3 = back view (no face)
- continuous plum outline; no orphan pixels; feet on frame bottom

Usage: python3 build_walk_sheet_v3.py
"""
import numpy as np
from PIL import Image
import os

SPIKE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SPIKE, '..', 'public', 'sprites')

FW, FH = 16, 24

# Palette identity (master_palette.json keys where applicable)
PAL = {
    'plum':    (40, 32, 48),      # outline
    'hair':    (96, 60, 36),      # brown_sh
    'hair_hi': (152, 104, 56),    # brown_mid
    'skin':    (248, 224, 192),   # skin_hi
    'skin_sh': (232, 184, 144),   # skin_mid
    'tunic':   (72, 120, 184),    # teal-blue tunic (matches AI battle sprite)
    'tunic_d': (40, 64, 128),     # tunic shadow
    'belt':    (96, 60, 36),      # brown leather
    'trous':   (72, 72, 88),      # dark slate trousers
    'boot':    (96, 60, 36),      # brown boots
}

Y_FACE0, Y_NECK = 8, 12           # face band rows (front view)
Y_TORSO0, Y_BELT = 13, 18         # torso rows
Y_LEG0 = 19                        # legs 19..21, boots 22..23
LEG_L, LEG_R = (4, 6), (9, 11)     # leg column spans (inclusive); 2px gap at x7-8


def _H(a, y, x0, x1, c):
    """Horizontal run painter, inclusive, clipped to frame."""
    if y < 0 or y >= FH: return
    x0, x1 = max(0, x0), min(FW - 1, x1)
    a[y, x0:x1 + 1, 0] = c[0]
    a[y, x0:x1 + 1, 1] = c[1]
    a[y, x0:x1 + 1, 2] = c[2]
    a[y, x0:x1 + 1, 3] = 255


def _P(a, y, x, c):
    if 0 <= y < FH and 0 <= x < FW:
        a[y, x, 0], a[y, x, 1], a[y, x, 2], a[y, x, 3] = c[0], c[1], c[2], 255


def add_outline(a):
    """Any visible pixel 4-adjacent to empty becomes plum."""
    alpha = a[:, :, 3] > 0
    ring = alpha & (np.roll(~alpha, 1, 0) | np.roll(~alpha, -1, 0) |
                    np.roll(~alpha, 1, 1) | np.roll(~alpha, -1, 1))
    a[ring, 0] = PAL['plum'][0]
    a[ring, 1] = PAL['plum'][1]
    a[ring, 2] = PAL['plum'][2]
    a[ring, 3] = 255


def paint_head_front(a):
    """Head rows 1-12 CONNECTED to torso row 13. 9px-wide head, 2px neck."""
    _H(a, 2, 6, 9, PAL['hair'])       # hair top edge (outline pass adds rim later)
    _H(a, 3, 5, 10, PAL['hair'])
    _H(a, 4, 4, 11, PAL['hair'])
    _H(a, 5, 4, 11, PAL['hair'])
    _H(a, 6, 4, 11, PAL['hair_hi'])   # bangs
    _H(a, 7, 4, 11, PAL['hair'])
    _H(a, 8, 5, 10, PAL['skin'])      # face (wide enough for 2 eyes)
    _H(a, 9, 5, 10, PAL['skin'])
    _P(a, 9, 6, PAL['plum']); _P(a, 9, 9, PAL['plum'])   # eyes at x edges
    _H(a, 10, 5, 10, PAL['skin_sh'])
    _H(a, 11, 6, 9, PAL['skin_sh'])   # jaw/chin
    _H(a, 12, 6, 9, PAL['hair'])      # hair sides frame the chin (GBA look)
    _P(a, 12, 6, PAL['hair']); _P(a, 12, 9, PAL['hair'])
    _H(a, 12, 7, 8, PAL['skin'])      # chin front
    _H(a, 13, 7, 8, PAL['skin_sh'])   # neck → touches torso at row 13


def paint_head_side(a):
    """Profile head rows 2-12, nose toward LOW x (pre-mirror faces left)."""
    _H(a, 2, 6, 9, PAL['hair'])
    _H(a, 3, 5, 10, PAL['hair'])
    _H(a, 4, 5, 10, PAL['hair'])
    _H(a, 5, 5, 10, PAL['hair'])
    _H(a, 6, 5, 10, PAL['hair_hi'])
    _H(a, 7, 6, 10, PAL['hair_hi'])
    _H(a, 8, 5, 9, PAL['skin'])
    _P(a, 9, 4, PAL['skin'])          # nose bump
    _H(a, 9, 5, 9, PAL['skin'])
    _H(a, 10, 5, 9, PAL['skin_sh'])
    _H(a, 11, 5, 9, PAL['skin_sh'])   # jaw
    _H(a, 12, 6, 9, PAL['hair'])      # hair frames jaw back side
    _H(a, 12, 6, 7, PAL['skin'])
    _H(a, 13, 7, 8, PAL['skin_sh'])   # neck → torso


def paint_body_front(a):
    """Torso rows 13-18, neck (row13) merges into tunic (row14)."""
    _H(a, 13, 6, 9, PAL['tunic'])     # shoulders/collar under neck
    _H(a, 14, 4, 11, PAL['tunic'])
    _H(a, 15, 4, 11, PAL['tunic'])
    _H(a, 16, 4, 11, PAL['tunic'])
    _H(a, 17, 4, 11, PAL['tunic_d'])
    _H(a, 18, 4, 11, PAL['belt'])
    # arms: 1px columns just outside torso
    _P(a, 14, 3, PAL['tunic'])
    _P(a, 15, 3, PAL['tunic'])
    _P(a, 16, 3, PAL['tunic_d'])
    _P(a, 14, 12, PAL['tunic'])
    _P(a, 15, 12, PAL['tunic'])
    _P(a, 16, 12, PAL['tunic_d'])


def paint_body_side(a):
    _H(a, 13, 6, 9, PAL['tunic'])     # collar under neck
    _H(a, 14, 4, 10, PAL['tunic'])
    _H(a, 15, 4, 10, PAL['tunic'])
    _H(a, 16, 4, 10, PAL['tunic_d'])
    _H(a, 17, 4, 10, PAL['tunic_d'])
    _H(a, 18, 4, 10, PAL['belt'])
    _P(a, 15, 3, PAL['tunic'])        # near arm
    _P(a, 16, 3, PAL['tunic_d'])


def paint_legs_front(a, ldx=0, rdx=0, bob=0):
    """Legs rows 19-23: two 3px legs with a 1px gap, trousers+boots, feet on row 23."""
    ly0 = Y_LEG0 - bob
    for (x0, x1), dx in ((LEG_L, ldx), (LEG_R, rdx)):
        _H(a, ly0, x0 + dx, x1 + dx, PAL['trous'])       # hip/thigh (touches belt row)
        _H(a, ly0 + 1, x0 + dx, x1 + dx, PAL['trous'])
        _H(a, ly0 + 2, x0 + dx, x1 + dx, PAL['trous'])
        _H(a, ly0 + 3, x0 + dx, x1 + dx, PAL['boot'])
        _H(a, ly0 + 4, x0 + dx, x1 + dx, PAL['plum'])    # sole/ground line


def paint_legs_side(a, stride=0, bob=0):
    """Side legs rows 19-23: stride shifts BOTH feet but feet stay on ground row."""
    ly0 = Y_LEG0 - bob
    _H(a, ly0, 5, 10, PAL['trous'])   # hips touch belt
    if stride == 0:
        _H(a, ly0 + 1, 5, 9, PAL['trous'])
        _H(a, ly0 + 2, 5, 9, PAL['trous'])
        _H(a, ly0 + 3, 5, 9, PAL['boot'])
        _H(a, ly0 + 4, 5, 9, PAL['boot'])
    elif stride > 0:   # leading leg forward+nose, back leg angled back
        _H(a, ly0 + 1, 4, 9, PAL['trous'])
        _H(a, ly0 + 2, 3, 8, PAL['trous'])
        _H(a, ly0 + 3, 3, 7, PAL['boot'])
        _H(a, ly0 + 4, 3, 8, PAL['plum'])
    else:
        _H(a, ly0 + 1, 5, 10, PAL['trous'])
        _H(a, ly0 + 2, 6, 10, PAL['trous'])
        _H(a, ly0 + 3, 6, 10, PAL['boot'])
        _H(a, ly0 + 4, 6, 11, PAL['plum'])


def frame_front(pose, stride_sign=1):
    a = np.zeros((FH, FW, 4), dtype=np.uint8)
    paint_head_front(a)
    paint_body_front(a)
    if pose == 'stand':
        paint_legs_front(a)
    elif pose == 'stepL':
        paint_legs_front(a, ldx=stride_sign, bob=1)
    else:  # stepR
        paint_legs_front(a, rdx=-stride_sign, bob=1)
    add_outline(a)
    return a


def frame_side(pose, mirror=False):
    a = np.zeros((FH, FW, 4), dtype=np.uint8)
    paint_head_side(a)
    paint_body_side(a)
    if pose == 'stand':
        paint_legs_side(a)
    elif pose == 'stepL':
        paint_legs_side(a, stride=1, bob=1)
    else:
        paint_legs_side(a, stride=-1, bob=1)
    add_outline(a)
    if mirror:
        a = np.ascontiguousarray(a[:, ::-1, :])
    return a


def frame_back(pose, stride_sign=1):
    a = frame_front(pose, stride_sign)
    # no face on back view: hair fills the face band + neck
    for y in range(Y_FACE0, Y_NECK):
        for x in range(FW):
            if a[y, x, 3] > 0:
                a[y, x, :3] = PAL['hair']
    add_outline(a)
    return a


def make_frames():
    rows = [
        (frame_front('stand'), frame_front('stepL', 1), frame_front('stepR', 1)),
        (frame_side('stand'), frame_side('stepL'), frame_side('stepR')),          # faces LEFT
        (frame_side('stand', True), frame_side('stepL', True), frame_side('stepR', True)),  # faces RIGHT
        (frame_back('stand'), frame_back('stepL', 1), frame_back('stepR', 1)),
    ]
    return rows


def assemble():
    sheet = np.zeros((FH * 4, FW * 3, 4), dtype=np.uint8)
    for r, frames in enumerate(make_frames()):
        for c, fr in enumerate(frames):
            sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = fr
    Image.fromarray(sheet).save(os.path.join(OUT, 'soren_field_sheet.png'))
    print("walk sheet v3: hand-pixel identity-locked 12 frames")


if __name__ == '__main__':
    assemble()