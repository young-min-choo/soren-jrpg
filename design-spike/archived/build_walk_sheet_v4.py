#!/usr/bin/env python3
"""Build the 12-frame hero walk sheet — DETERMINISTIC hand-pixel pipeline v4.

v4 = chibi-GBA restyle to match the battle-sprite look (user: "field sprite
looks god awful vs battle sprites — unify"). Head ~45% of height (GBA chibi),
2-tone shading, simple 1px dark eyes, no white bands; back view fully hair.
Same sheet contract as v3: 48x96 px, 3 cols (stand/stepL/stepR) x 4 rows
(down/left/right/up), 16x24 frames — game code unchanged.
"""
import numpy as np
from PIL import Image
import os

SPIKE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SPIKE, '..', 'public', 'sprites')

FW, FH = 16, 24
PAL = {
    'plum':    (40, 32, 48),
    'hair':    (96, 60, 36),
    'hair_hi': (152, 104, 56),
    'skin':    (248, 224, 192),
    'skin_sh': (232, 184, 144),
    'tunic':   (72, 120, 184),
    'tunic_d': (40, 64, 128),
    'tunic_hi':(96, 148, 208),
    'belt':    (96, 60, 36),
    'belt_hi': (128, 84, 44),
    'trous':   (72, 72, 88),
    'trous_d': (52, 52, 64),
    'boot':    (96, 60, 36),
}

def _H(a, y, x0, x1, c):
    if y < 0 or y >= FH: return
    x0, x1 = max(0, x0), min(FW - 1, x1)
    a[y, x0:x1+1, 0] = c[0]; a[y, x0:x1+1, 1] = c[1]
    a[y, x0:x1+1, 2] = c[2]; a[y, x0:x1+1, 3] = 255

def _P(a, y, x, c):
    if 0 <= y < FH and 0 <= x < FW:
        a[y, x, 0], a[y, x, 1], a[y, x, 2], a[y, x, 3] = c[0], c[1], c[2], 255

def add_outline(a):
    alpha = a[:, :, 3] > 0
    ring = alpha & (np.roll(~alpha, 1, 0) | np.roll(~alpha, -1, 0) |
                    np.roll(~alpha, 1, 1) | np.roll(~alpha, -1, 1))
    a[ring, 0] = PAL['plum'][0]; a[ring, 1] = PAL['plum'][1]
    a[ring, 2] = PAL['plum'][2]; a[ring, 3] = 255

def head_front(a):
    _H(a, 1, 5, 10, PAL['hair']); _H(a, 2, 4, 11, PAL['hair'])
    _H(a, 3, 3, 12, PAL['hair']); _H(a, 4, 3, 12, PAL['hair_hi'])
    _H(a, 5, 3, 12, PAL['hair']); _H(a, 6, 3, 12, PAL['hair'])
    _H(a, 7, 4, 11, PAL['skin'])
    _P(a, 8, 4, PAL['hair']); _P(a, 8, 11, PAL['hair'])
    _H(a, 8, 5, 10, PAL['skin'])
    _P(a, 9, 6, PAL['plum']); _P(a, 9, 9, PAL['plum'])
    _H(a, 10, 4, 11, PAL['skin'])

def head_side(a):
    _H(a, 1, 6, 10, PAL['hair']); _H(a, 2, 5, 11, PAL['hair'])
    _H(a, 3, 4, 11, PAL['hair']); _H(a, 4, 4, 11, PAL['hair_hi'])
    _H(a, 5, 4, 11, PAL['hair']); _H(a, 6, 5, 11, PAL['hair'])
    _P(a, 7, 3, PAL['skin'])
    _H(a, 7, 4, 10, PAL['skin'])
    _P(a, 9, 5, PAL['plum'])
    _H(a, 8, 4, 10, PAL['skin']); _H(a, 9, 5, 10, PAL['skin'])
    _H(a, 10, 5, 10, PAL['skin_sh'])

def torso_front(a):
    _H(a, 11, 5, 10, PAL['tunic'])     # collar row directly under face
    _H(a, 12, 4, 11, PAL['tunic'])
    _H(a, 13, 3, 12, PAL['tunic'])
    _H(a, 14, 3, 12, PAL['tunic_hi'])
    _H(a, 15, 3, 12, PAL['tunic'])
    _H(a, 16, 4, 11, PAL['tunic_d'])
    _H(a, 17, 4, 11, PAL['belt']); _P(a, 17, 8, PAL['belt_hi'])
    _P(a, 12, 3, PAL['tunic']); _P(a, 13, 2, PAL['tunic'])
    _P(a, 14, 2, PAL['skin_sh'])
    _P(a, 12, 12, PAL['tunic']); _P(a, 13, 13, PAL['tunic'])
    _P(a, 14, 13, PAL['skin_sh'])

def torso_side(a):
    _H(a, 11, 5, 10, PAL['tunic'])
    _H(a, 12, 4, 11, PAL['tunic'])
    _H(a, 13, 4, 11, PAL['tunic'])
    _H(a, 14, 4, 10, PAL['tunic_hi'])
    _H(a, 15, 4, 10, PAL['tunic'])
    _H(a, 16, 5, 10, PAL['tunic_d'])
    _H(a, 17, 4, 11, PAL['belt'])
    _P(a, 12, 3, PAL['tunic']); _P(a, 13, 3, PAL['tunic'])
    _P(a, 14, 3, PAL['skin_sh'])

def legs_front(a, ldx=0, rdx=0, bob=0):
    ly0 = 18 - bob
    for (x0, x1), dx in (((4, 6), ldx), ((9, 11), rdx)):
        _H(a, ly0, x0+dx, x1+dx, PAL['trous'])
        _H(a, ly0+1, x0+dx, x1+dx, PAL['trous'])
        _H(a, ly0+2, x0+dx, x1+dx, PAL['trous_d'])
        _H(a, ly0+3, x0+dx, x1+dx, PAL['boot'])
        _H(a, ly0+4, x0+dx, x1+dx, PAL['plum'])

def legs_side(a, stride=0, bob=0):
    ly0 = 18 - bob
    _H(a, ly0, 5, 10, PAL['trous'])
    if stride == 0:
        _H(a, ly0+1, 5, 9, PAL['trous'])
        _H(a, ly0+2, 5, 9, PAL['trous_d'])
        _H(a, ly0+3, 5, 9, PAL['boot'])
        _H(a, ly0+4, 5, 9, PAL['plum'])
    elif stride > 0:
        _H(a, ly0+1, 3, 9, PAL['trous'])
        _H(a, ly0+2, 2, 8, PAL['trous_d'])
        _H(a, ly0+3, 2, 7, PAL['boot'])
        _H(a, ly0+4, 2, 8, PAL['plum'])
    else:
        _H(a, ly0+1, 5, 11, PAL['trous'])
        _H(a, ly0+2, 6, 12, PAL['trous_d'])
        _H(a, ly0+3, 7, 12, PAL['boot'])
        _H(a, ly0+4, 7, 13, PAL['plum'])

def frame_front(pose, s=1):
    a = np.zeros((FH, FW, 4), np.uint8)
    head_front(a); torso_front(a)
    if pose == 'stand': legs_front(a)
    elif pose == 'stepL': legs_front(a, ldx=s, bob=1)
    else: legs_front(a, rdx=-s, bob=1)
    add_outline(a)
    return a

def frame_side(pose, mirror=False):
    a = np.zeros((FH, FW, 4), np.uint8)
    head_side(a); torso_side(a)
    if pose == 'stand': legs_side(a)
    elif pose == 'stepL': legs_side(a, 1, 1)
    else: legs_side(a, -1, 1)
    add_outline(a)
    if mirror: a = np.ascontiguousarray(a[:, ::-1, :])
    return a

def frame_back(pose, s=1):
    a = frame_front(pose, s)
    # back view: EVERYTHING in the head band becomes hair (ring exception removed —
    # that's what left skin/white remnants at the collar in v8/v9)
    for y in range(0, 12):
        for x in range(FW):
            if a[y, x, 3] > 0:
                a[y, x, :3] = PAL['hair']
    add_outline(a)
    return a

def make_sheet():
    sheet = np.zeros((FH * 4, FW * 3, 4), np.uint8)
    rows = [
        (frame_front('stand'), frame_front('stepL', 1), frame_front('stepR', 1)),
        (frame_side('stand'), frame_side('stepL'), frame_side('stepR')),
        (frame_side('stand', True), frame_side('stepL', True), frame_side('stepR', True)),
        (frame_back('stand'), frame_back('stepL', 1), frame_back('stepR', 1)),
    ]
    for r, frames in enumerate(rows):
        for c, fr in enumerate(frames):
            sheet[r*FH:(r+1)*FH, c*FW:(c+1)*FW] = fr
    return sheet

def assemble():
    sheet = make_sheet()
    Image.fromarray(sheet).save(os.path.join(OUT, 'soren_field_sheet.png'))
    Image.fromarray(sheet).resize((FW*3*8, FH*4*8), Image.NEAREST).save('/tmp/field_v10.png')
    print("walk sheet v4: chibi-GBA 12 frames")

if __name__ == '__main__':
    assemble()