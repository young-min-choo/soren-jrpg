#!/usr/bin/env python3
"""Redraw the ruins dungeon WALL tile (frame 1) as unmistakably solid masonry.

Playtest 2026-10-08 bugs 4+5: the old wall art was a tan ARCH/MOUND with a
light hollow-looking center + moss corner tufts — players read it as a
walkable arch (or a grass patch) and "got stuck" on it / got confused about
pillars. A solo mound tile cannot communicate solidity.

New tile: flat staggered stone-block masonry in the same tan family.
- Full 32x32 solid, dark mortar courses (light on top-left, dark inside),
  staggered joints (no vertical seam through the whole tile), moss accents
  kept at the BOTTOM edge only, top-left highlight band.
- Reads solid in rows AND as a lone pillar (masonry plinth).
Backup written to tiles/dgn_ruins.png.bak-wall (first run only).
"""
from PIL import Image, ImageDraw
import os, random

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'sprites', 'tiles', 'dgn_ruins.png')
im = Image.open(P).convert('RGBA')

STONE   = (232, 184, 144, 255)   # = master skin_mid (existing ruins masonry tone)
STONE_L = (248, 224, 192, 255)   # = master skin_hi (lit face)
STONE_D = (200, 152, 96, 255)    # = master brown_hi (shaded face)
MORTAR  = (44, 36, 52, 255)      # = master plum_sh/outline family (theme)
DARK    = (40, 32, 48, 255)
MOSS    = (80, 136, 64, 255)     # = master leaf_mid
MOSS_D  = (80, 136, 64, 255)

tile = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
d = ImageDraw.Draw(tile)

# brick grid: 16x16 blocks, two courses, staggered so no full-height joint
# course rows at y=0..15, 16..31; joints at x=0 for both + x=16 offset by 8
COURSE_H = 16
BRICK_W = 16
d.rectangle([0, 0, 31, 31], fill=STONE)
# face shading: left 3px + top 2px light band per brick, bottom-right shade
for row in range(2):
    y0 = row * COURSE_H
    offset = 0 if row == 0 else BRICK_W // 2
    # horizontal mortar line at course bottom
    d.rectangle([0, y0 + COURSE_H - 2, 31, y0 + COURSE_H - 1], fill=MORTAR)
    xs = list(range(-offset, 33, BRICK_W))
    for i, x0 in enumerate(xs):
        # vertical joint 2px
        jx = x0 + BRICK_W
        if 0 < jx < 32:
            d.rectangle([max(0, jx - 1), y0, min(31, jx), y0 + COURSE_H - 3], fill=MORTAR)
        bx0, bx1 = max(0, x0), min(31, x0 + BRICK_W - 2)
        if bx1 <= bx0:
            continue
        # per-brick face: lit top-left, shaded bottom-right
        d.rectangle([bx0, y0, bx1, y0 + COURSE_H - 3], fill=STONE)
        d.rectangle([bx0, y0, bx1, y0 + 1], fill=STONE_L)            # top lit
        d.rectangle([bx0, y0, min(31, bx0 + 1), y0 + COURSE_H - 3], fill=STONE_L)  # left lit
        d.rectangle([max(0, bx1 - 1), y0 + 2, bx1, y0 + COURSE_H - 3], fill=STONE_D)  # right shade
        d.rectangle([bx0, y0 + COURSE_H - 5, bx1, y0 + COURSE_H - 3], fill=STONE_D)   # bottom shade
        # speckle noise (deterministic)
        rnd = random.Random(row * 10 + i)
        for _ in range(5):
            px = rnd.randint(bx0, bx1)
            py = rnd.randint(y0, y0 + COURSE_H - 4)
            c = STONE_L if rnd.random() < 0.5 else STONE_D
            d.point((px, py), fill=c)
# outer border: dark top + darker bottom (grounding)
d.rectangle([0, 0, 31, 1], fill=STONE_L)      # top lit rim
d.rectangle([0, 30, 31, 31], fill=MORTAR)     # ground shadow
# moss accent only along the BOTTOM mortar line (grows from ground, not corners)
rnd = random.Random(7)
for x in range(0, 32):
    if rnd.random() < 0.30:
        y = 28 + rnd.randint(0, 2)
        d.point((x, y), fill=MOSS if rnd.random() < 0.6 else MOSS_D)

# splice into strip as frame 1
out = im.copy()
out.paste(tile, (32, 0))
Bak = P + '.bak-wall.png'
if not os.path.exists(Bak):
    im.save(Bak)
out.save(P)
print('ruins wall tile redrawn as staggered masonry (frame 1); backup at', Bak)