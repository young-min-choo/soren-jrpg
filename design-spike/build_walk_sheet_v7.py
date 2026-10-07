#!/usr/bin/env python3
"""v7 hero walk sheet — face visibility fix (playtest bug 2026-10-08, #2).

User report: "soren's head is see-through" — the hood's interior skin wedge
(skin_sh 232,184,144) sat nearly identical to the most common wall/brick tone
(216,192,152) with NO dark boundary rim. The head read as a hole in the wall
(the skin pixels rendered against masonry as if the wall showed through).

Fix (v6 face rows 6-8 replaced):
  1. Face wedge re-toned to the PALE battle-skin family (skin 248,224,192 —
     visibly lighter than any masonry tone; skin_sh demoted to chin hint only
     and re-tinted one ramp step lighter than the old value's role).
  2. A 1px DARK outline band under the hood brim ABOVE the face + on BOTH
     face side edges: an explicit boundary, so the pale wedge can never float
     on masonry as an open hole.
  3. Chin shadow row kept but bounded — deep tone under the wedge.
Identity preserved: hood mass/rim/under-shadow rows untouched, same 8-px
wedge width, same silhouette. Same contract: 48x96, 3x4 frames.
"""
from build_walk_sheet_v6 import (PAL, _H, _P, add_outline, torso_front,
    legs_front, head_side as _head_side, torso_side, legs_side,
    head_back, torso_back, frame_side, frame_back)
import numpy as np
from PIL import Image
import os

SPIKE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(SPIKE, '..', 'public', 'sprites')
FW, FH = 16, 24


def head_front(a):
    # hood dome/rim/undershadow — unchanged from v6 (identity rows)
    _H(a, 1, 5, 10, PAL['hood'])
    _H(a, 2, 4, 11, PAL['hood'])
    _H(a, 3, 3, 12, PAL['hood_hi'])
    _H(a, 4, 3, 12, PAL['hood'])
    _P(a, 2, 5, PAL['hood_hi']); _P(a, 2, 9, PAL['hood_hi'])
    _H(a, 5, 4, 11, PAL['hood_sh'])
    # ── v7 FIX: pale face + explicit dark boundary ─────────────────────
    # row 6: dark brim band ABOVE the face (separates hood shadow from skin)
    _H(a, 6, 5, 10, PAL['outline'])
    # rows 7-8: pale wedge (BATTLE skin tone — much lighter than masonry)
    _H(a, 7, 6, 9, PAL['skin'])
    _H(a, 8, 6, 9, PAL['skin'])
    # eyes (NPC-template grammar: 2px dark pair — the hero read as a blank
    # mask next to big-faced NPCs; eyes restore parity at field scale)
    _P(a, 7, 6, PAL['outline']); _P(a, 7, 9, PAL['outline'])
    # side boundary rims (dark) so the wedge is boxed
    _P(a, 8, 5, PAL['outline'])
    _P(a, 8, 10, PAL['outline'])
    # chin hint: bounded skin_sh line INSIDE the wedge with shade either side
    _H(a, 9, 7, 8, PAL['skin_sh'])             # actual shadow line (inset)
    _P(a, 9, 6, PAL['hood_sh']); _P(a, 9, 9, PAL['hood_sh'])
    # hood shoulders of the face (plum) — unchanged
    _P(a, 6, 4, PAL['hood_edge']); _P(a, 7, 4, PAL['hood'])
    _P(a, 6, 11, PAL['hood_edge']); _P(a, 7, 11, PAL['hood'])
    _P(a, 8, 4, PAL['hood']); _P(a, 8, 11, PAL['hood'])
    _P(a, 9, 4, PAL['hood_sh']); _P(a, 9, 11, PAL['hood_sh'])


def head_side_v7(a):
    # replicate v6 side head but with the same boundary treatment
    _H(a, 1, 5, 10, PAL['hood']); _H(a, 2, 4, 11, PAL['hood'])
    _H(a, 3, 3, 12, PAL['hood_hi']); _H(a, 4, 3, 12, PAL['hood'])
    _P(a, 2, 8, PAL['hood_hi'])
    _H(a, 5, 4, 11, PAL['hood_sh'])
    _P(a, 4, 3, PAL['skin'])                  # brow point
    _H(a, 5, 3, 5, PAL['outline'])            # brim band above pale wedge
    _H(a, 6, 3, 6, PAL['skin'])
    _H(a, 7, 4, 6, PAL['skin'])
    _P(a, 7, 5, PAL['outline'])               # eye (dark px on profile face)
    _H(a, 8, 5, 6, PAL['skin_sh'])
    _H(a, 9, 5, 6, PAL['outline'])            # dark jaw band BELOW wedge
    _P(a, 8, 4, PAL['hood']); _P(a, 8, 3, PAL['hood_sh'])
    _P(a, 7, 7, PAL['hood_sh']); _P(a, 8, 7, PAL['hood_sh'])
    _P(a, 8, 9, PAL['hood']); _P(a, 8, 10, PAL['hood']); _P(a, 8, 11, PAL['hood_edge'])
    _P(a, 7, 10, PAL['hood']); _P(a, 6, 10, PAL['hood'])
    _P(a, 7, 11, PAL['hood'])
    _P(a, 9, 4, PAL['hair']); _P(a, 9, 11, PAL['hair'])


def frame_front_v7(pose, s=1):
    a = np.zeros((FH, FW, 4), np.uint8)
    head_front(a); torso_front(a)
    if pose == 'stand': legs_front(a)
    elif pose == 'stepL': legs_front(a, s, 0, 1)
    else: legs_front(a, 0, -s, 1)
    add_outline(a)
    return a


def frame_side_v7(pose, mirror=False):
    a = np.zeros((FH, FW, 4), np.uint8)
    head_side_v7(a); torso_side(a)
    if pose == 'stand': legs_side(a)
    elif pose == 'stepL': legs_side(a, 1)
    else: legs_side(a, -1)
    add_outline(a)
    if mirror: a = np.ascontiguousarray(a[:, ::-1, :])
    return a


def frame_back_v7(pose, s=1):
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
        (frame_front_v7('stand'), frame_front_v7('stepL'), frame_front_v7('stepR')),
        (frame_side_v7('stand'), frame_side_v7('stepL'), frame_side_v7('stepR')),
        (frame_side_v7('stand', True), frame_side_v7('stepL', True), frame_side_v7('stepR', True)),
        (frame_back_v7('stand'), frame_back_v7('stepL'), frame_back_v7('stepR')),
    ]
    for r, frames in enumerate(rows):
        for c, fr in enumerate(frames):
            sheet[r*FH:(r+1)*FH, c*FW:(c+1)*FW] = fr
    return sheet


def assemble():
    sheet = make_sheet()
    Image.fromarray(sheet).save(os.path.join(OUT, 'soren_field_sheet.png'))
    Image.fromarray(sheet).resize((FW*3*6, FH*4*6), Image.NEAREST).save(
        os.path.join(SPIKE, 'preview_field_v7.png'))
    print('walk sheet v7: pale bounded face (hole-bug fix), 12 frames')


if __name__ == '__main__':
    assemble()