#!/usr/bin/env python3
"""v8 hero walk sheet — Soren built through the NPC v2 template (hole-free).

Playtest 2026-10-09: "Soren's hair is STILL see-through". Root cause found in
the alpha channel: the v6/v7 SIDE-head silhouette (the hero's own hand-rolled
draw code) contains literal TRANSPARENT PIXELS inside the hood (x7-9, y6-8 in
the left/right frames — never filled: v6's face-draw writes skin rows 6-8 at
x3-6 only, leaving the "face far side" as holes; outline pass doesn't fill
interior). Front frames had 2-hole nits, sides 4 real interior holes. That's
the see-through — not tones, not masonry.

Fix: stop hand-maintaining the hero. Draw him with the PROVEN NPC painter
(build_npc_sprites_v2.py's npc_head + npc_body, hole-free by construction,
same grammar Choo singled out as "better than mine"): Soren = plum hooded
wanderer with the battle identity carried via hairshape='hood', plum outfit
ramp, blue sash accent, steel scabbard hint, and the template's 2px eyes +
skin face. The NPC hood shape encloses the face — no alpha holes possible.

Walk anims: the 16 AI NPC sheets carry 12-frame walk cycles; the hero needs
his own. The template's static (16x24) frames get a walk cycle by
parameterizing the LEGS layer only (same legs_front/legs_side/legs_back
geometry as before) while the head/torso come from the template painter.
Output: 48x96, 3x4 (down/left/right/up), contract-compatible.

Palette: master palette ONLY (plum family = battle Soren's mass, correct).
"""
import numpy as np
from PIL import Image
import os, json, sys

SPIKE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SPIKE)
PUB = os.path.join(SPIKE, '..', 'public', 'sprites')

FW, FH = 16, 24
MP = {k: tuple(v) for k, v in json.load(open(os.path.join(SPIKE, 'palette', 'master_palette.json'))).items()}

# import the PROVEN NPC painter (npc_head/npc_body) + its helpers
import importlib.util
spec = importlib.util.spec_from_file_location('npcv2', os.path.join(SPIKE, 'build_npc_sprites_v2.py'))
npcv2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(npcv2)

_H, _P, add_outline = npcv2._H, npcv2._P, npcv2.add_outline

# Soren body overrides drawn in the same grammar (post-npc_body pass):
# blue sash + steel scabbard + charcoal trouser/boots instead of template legs.
BLUE = MP.get('water_hi', (72, 120, 184))
BLUE_D = MP.get('water_mid', (56, 90, 150))
STEEL = MP.get('steel_hi', (208, 216, 232))
STEEL_D = MP.get('steel_mid', (160, 168, 192))
WOOD = MP.get('wood', (104, 68, 40))


def hero_body(a, spec):
    """npc_body with Soren identity: plum robe→tunic, blue sash, scabbard."""
    # collar+torso via the template's non-robe branch, plum ramp
    o_hi, o_md, o_sh = MP.get('plum_hi', (96, 76, 104)), MP.get('plum_mid', (64, 52, 72)), MP.get('plum_sh', (44, 36, 52))
    _H(a, 10, 5, 10, o_md)
    _H(a, 11, 4, 11, o_md)
    _H(a, 12, 3, 12, o_md); _P(a, 12, 3, o_hi); _P(a, 12, 12, o_sh)
    _H(a, 13, 3, 12, o_hi)
    _H(a, 14, 3, 12, o_md)
    _H(a, 15, 3, 12, o_sh)
    _H(a, 16, 4, 11, o_sh)
    _H(a, 17, 4, 11, o_sh)
    _P(a, 17, 7, MP['gold_mid' if 'gold_mid' in MP else 'steel_hi'])     # buckle
    # blue sash band (battle-Soren accent) row 13
    _H(a, 13, 3, 12, BLUE)
    _P(a, 13, 4, MP.get('water_hi', BLUE) if 'water_hi' in MP else (96, 140, 208))
    # legs: charcoal + dark boots
    _H(a, 18, 4, 6, MP['charcoal_l']); _H(a, 18, 9, 11, MP['charcoal_d'])
    _H(a, 19, 4, 6, MP['charcoal']); _H(a, 19, 9, 11, MP['charcoal_d'])
    _H(a, 20, 4, 6, WOOD); _H(a, 20, 9, 11, WOOD)
    _H(a, 21, 4, 6, MP['outline']); _H(a, 21, 9, 11, MP['outline'])
    # scabbard on left hip
    _P(a, 15, 10, WOOD); _P(a, 16, 10, WOOD); _P(a, 17, 10, STEEL_D)
    _P(a, 16, 11, WOOD)
    # the hero carries the hooded look: force hairshape='hood' spec through
    npcv2.npc_head(a, dict(hair='plum', hairshape='hood', beard=False,
                           outfit='plum', robe=False, _key='soren'))


def legs_swap(a, pose):
    """Re-draw rows 18-21 legs for a walk pose over the static base."""
    # wipe leg rows (keep outline re-added later at sheet assemble)
    for y in range(18, 22):
        a[y, :, :] = 0
    if pose == 'stand':
        _H(a, 18, 4, 6, MP['charcoal_l']); _H(a, 18, 9, 11, MP['charcoal_d'])
        _H(a, 19, 4, 6, MP['charcoal']); _H(a, 19, 9, 11, MP['charcoal_d'])
        _H(a, 20, 4, 6, WOOD); _H(a, 20, 9, 11, WOOD)
        _H(a, 21, 4, 6, MP['outline']); _H(a, 21, 9, 11, MP['outline'])
    elif pose == 'stepL':
        # near leg forward-left, far leg back-right (scissor)
        _H(a, 18, 3, 5, MP['charcoal_l']); _H(a, 18, 9, 12, MP['charcoal_d'])
        _H(a, 19, 2, 4, MP['charcoal']); _H(a, 19, 10, 12, MP['charcoal_d'])
        _H(a, 20, 2, 4, WOOD); _H(a, 20, 10, 12, WOOD)
        _H(a, 21, 2, 4, MP['outline']); _H(a, 21, 10, 12, MP['outline'])
    else:  # stepR: legs pass together (narrow stance, mid-swing)
        _H(a, 18, 5, 7, MP['charcoal_l']); _H(a, 18, 8, 10, MP['charcoal_d'])
        _H(a, 19, 5, 7, MP['charcoal']); _H(a, 19, 8, 10, MP['charcoal_d'])
        _H(a, 20, 5, 7, WOOD); _H(a, 20, 8, 10, WOOD)
        _H(a, 21, 5, 7, MP['outline']); _H(a, 21, 8, 10, MP['outline'])
    # cloak hem over legs top (rows 18 continuity with torso)
    _H(a, 18, 7, 8, MP['plum_sh'])


def frame(pose, facing, mirror=False):
    a = np.zeros((FH, FW, 4), np.uint8)
    hero_body(a, None)
    legs_swap(a, pose)
    add_outline(a)
    if facing == 'back':
        # back view: hood covers head fully (v6 back-head grammar over template rows)
        for y in range(0, 12):
            for x in range(FW):
                if a[y, x, 3] > 0 and a[y, x, :3].tolist() in [tuple(MP['skin_mid']), (248, 224, 192)]:
                    a[y, x, :3] = MP['plum_mid'][:3]
        _H(a, 6, 3, 12, MP['plum_mid'])
        _P(a, 5, 4, MP['plum_sh']); _P(a, 6, 4, MP['plum_sh'])
        _P(a, 7, 4, MP['wood' if 'wood' in MP else 'brown_mid']); _P(a, 7, 11, MP['wood' if 'wood' in MP else 'brown_mid'])
        add_outline(a)
    if mirror:
        a = np.ascontiguousarray(a[:, ::-1, :])
    return a


def make_sheet():
    sheet = np.zeros((FH * 4, FW * 3, 4), np.uint8)
    rows = [
        (frame('stand', 'front'), frame('stepL', 'front'), frame('stepR', 'front')),
        (frame('stand', 'side'), frame('stepL', 'side'), frame('stepR', 'side')),
        (frame('stand', 'side', True), frame('stepL', 'side', True), frame('stepR', 'side', True)),
        (frame('stand', 'back'), frame('stepL', 'back'), frame('stepR', 'back')),
    ]
    for r, frames in enumerate(rows):
        for c, fr in enumerate(frames):
            sheet[r*FH:(r+1)*FH, c*FW:(c+1)*FW] = fr
    return sheet


def assemble():
    sheet = make_sheet()
    Image.fromarray(sheet).save(os.path.join(PUB, 'soren_field_sheet.png'))
    Image.fromarray(sheet).resize((FW*3*6, FH*4*6), Image.NEAREST).save(
        os.path.join(SPIKE, 'preview_field_v8.png'))
    print('walk sheet v8: NPC-template hero (hole-free plum hood face), 12 frames')


if __name__ == '__main__':
    assemble()