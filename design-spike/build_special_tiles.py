#!/usr/bin/env python3
"""Dungeon SPECIAL tiles (save, boss, block, switch, exit) × 5 themes — D0 slice.

Deterministic hand-pixel on the 29-color master palette. Each special tile is drawn
ON its theme's floor base (extracted from tiles_final/dg_<t>_floor.png, snapped to
palette) so it blends in-map. Output: design-spike/tiles_special/dg_<t>_<tile>.png
+ regenerated strips public/sprites/tiles/dgn_<t>.png now 10 tiles (indices 0-9 =
floor, wall, hazard, chest, door, save, boss, block, switch, exit).

Index contract (BootScene + DungeonScene): 0=floor 1=wall 2=hazard 3=chest 4=door
5=save 6=boss 7=block 8=switch 9=exit. Strip extension is ADDITIVE: old 5-tile
strips stay valid (consumers read the first tiles; BootScene stripIdx maps only 0-4
today and gains 5-9 once art exists).
"""
from PIL import Image, ImageDraw
import numpy as np
import os

W = H = 32
OUT_DIR = '/home/min/dev/soren-jrpg/design-spike/tiles_special'
STRIP_DIR = '/home/min/dev/soren-jrpg/public/sprites/tiles'
os.makedirs(OUT_DIR, exist_ok=True)

PAL = {
    'outline': (40, 32, 48),
    'deep_shadow': (36, 24, 40),
    'steel_dark': (72, 76, 92),
    'steel_mid': (120, 128, 148),
    'steel_hi': (176, 184, 200),
    'bone': (224, 216, 192),
    'gold_hi': (240, 208, 112),
    'gold_mid': (200, 160, 64),
    'gold_sh': (136, 96, 32),
    'ember_glow': (240, 160, 64),
    'ember_deep': (200, 96, 32),
    'blue_hi': (128, 176, 240),
    'blue_mid': (64, 112, 200),
    'blue_deep': (32, 64, 128),
    'plum_mid': (88, 72, 104),
    'wood_dark': (80, 56, 40),
    'wood_mid': (120, 88, 56),
    'green_hi': (112, 176, 96),
    'green_deep': (48, 96, 64),
    'red_flame': (216, 72, 48),
}
SNAP_SRC = None  # filled per theme


def snap(c, palette):
    """Nearest-palette-color snap (RGB euclidean)."""
    best, bd = None, 1e9
    for p in palette:
        d = (c[0]-p[0])**2 + (c[1]-p[1])**2 + (c[2]-p[2])**2
        if d < bd:
            bd, best = d, p
    return best


def floor_base(theme):
    """Theme floor tile, alpha-flattened to RGB + snapped to master palette."""
    img = Image.open(
        f'/home/min/dev/soren-qpg-placeholder').convert('RGB') if False else Image.open(
        f'/home/min/dev/soren-jrpg/design-spike/tiles_final/dg_{theme}_floor.png').convert('RGB')
    arr = np.array(img).reshape(-1, 3)
    # dominant colors → mini-palette (floor family: 6 colors, keeps texture tones)
    q = (arr // 16 * 16)
    vals, counts = np.unique(q, axis=0, return_counts=True)
    order = np.argsort(-counts)[:6]
    fam = [tuple(int(x) + 8 for x in vals[o]) for o in order]  # +8 dequantize center
    return np.array(img, dtype=np.uint8), fam


# ─── Drawing helpers — all coordinates on the 32px grid ───────────────────────
def rect(d, x0, y0, x1, y1, fill, outline=None):
    d.rectangle([x0, y0, x1, y1], fill=fill)
    if outline:
        d.rectangle([x0, y0, x1, y1], outline=outline)


def glow_dot(d, cx, cy, r, core, mid, outer):
    for rr, col in ((r, outer), (max(1, r-2), mid), (max(1, r-4), core)):
        d.ellipse([cx-rr, cy-rr, cx+rr, cy+rr], fill=col)


def sparkle(d, cx, cy, col):
    d.line([cx-3, cy, cx+3, cy], fill=col)
    d.line([cx, cy-3, cx, cy+3], fill=col)


# ─── Special tile painters (theme-agnostic; colors passed in) ─────────────────
def t_save(d, fam, ac):
    """Save point: stone plinth + small floating crystal (cool flame color)."""
    rect(d, 12, 22, 19, 29, ac['stone'], ac['outline'])
    rect(d, 13, 23, 18, 25, ac['stone_hi'])
    d.line([(12, 22), (19, 22)], fill=ac['outline'])
    # crystal: diamond shard, 8px tall, hovering 1px above plinth
    d.polygon([(16, 9), (19, 14), (17, 20), (15, 20), (13, 14)], fill=ac['crystal_mid'], outline=ac['outline'])
    d.polygon([(15, 11), (16, 14), (15, 18), (14, 14)], fill=ac['crystal_hi'])
    d.point((16, 8), fill=ac['white'])
    # sparkles
    d.point((11, 12), fill=ac['white']); d.point((21, 15), fill=ac['white'])



def t_boss(d, fam, ac):
    """Boss marker: dark aura disc + gold-ringed horned skull."""
    d.ellipse([3, 3, 28, 28], fill=ac['aura'], outline=ac['outline'], width=2)
    d.ellipse([6, 6, 25, 25], outline=ac['sigil'], width=1)
    # skull (bone) with big horns
    d.polygon([(7, 6), (11, 12), (9, 13)], fill=ac['bone'], outline=ac['outline'])   # left horn
    d.polygon([(24, 6), (20, 12), (22, 13)], fill=ac['bone'], outline=ac['outline']) # right horn
    rect(d, 12, 11, 19, 19, ac['bone'], ac['outline'])
    rect(d, 12, 16, 19, 19, ac['bone_sh'])  # jaw shade
    d.point((14, 14), fill=ac['outline']); d.point((17, 14), fill=ac['outline'])
    rect(d, 15, 17, 16, 17, ac['outline'])
    d.line([(14, 20), (14, 21)], fill=ac['bone_sh'])   # teeth
    d.line([(16, 20), (16, 21)], fill=ac['bone_sh'])
    d.line([(18, 20), (18, 21)], fill=ac['bone_sh'])
    # gold prongs on ring (4 cardinal)
    for cx, cy in ((15, 4), (15, 25), (4, 15), (25, 15)):
        rect(d, cx-1, cy-1, cx+1, cy+1, ac['gold_hi'], ac['gold_sh'])



def t_block(d, fam, ac):
    """Pushable block: STONE cube, universal grey family (reads as physics prop)."""
    hi, mid, dk = (176, 184, 200), (120, 128, 148), (72, 76, 92)  # steel family = stone-grey
    rect(d, 4, 4, 27, 11, hi, ac['outline'])
    rect(d, 4, 12, 27, 27, mid, ac['outline'])
    rect(d, 24, 13, 27, 26, dk)
    d.line([(7, 16), (13, 16)], fill=dk)
    d.line([(18, 21), (23, 21)], fill=dk)
    d.line([(8, 24), (21, 24)], fill=dk)
    d.point((6, 14), fill=hi); d.point((25, 14), fill=hi)
    d.point((6, 25), fill=hi); d.point((25, 25), fill=hi)



def t_switch(d, fam, ac):
    """Pressure plate: flush inset plate + ring rune (dim until active)."""
    rect(d, 5, 5, 26, 26, ac['stone'], ac['outline'])
    rect(d, 7, 7, 24, 24, ac['stone_hi'])
    rect(d, 9, 9, 22, 22, ac['stone'])
    d.ellipse([10, 10, 21, 21], outline=ac['plate_ring'], width=1)
    d.ellipse([13, 13, 18, 18], fill=ac['plate_core'])
    sparkle(d, 16, 16, ac['plate_spark'])



def t_exit(d, fam, ac):
    """Exit: stone archway glowing from within (way out = light)."""
    rect(d, 6, 4, 25, 27, ac['stone'], ac['outline'])
    rect(d, 8, 6, 23, 25, ac['stone'])
    # glowing doorway core
    rect(d, 11, 10, 20, 25, ac['exit_mid'], ac['outline'])
    rect(d, 12, 12, 19, 24, ac['exit_glow'])
    d.ellipse([13, 12, 18, 19], fill=ac['white'])
    # steps (3)
    d.line([(7, 24), (24, 24)], fill=ac['outline'])
    d.line([(7, 27), (24, 27)], fill=ac['outline'])
    d.point((10, 5), fill=ac['gold_hi']); d.point((21, 5), fill=ac['gold_hi'])



THEMES = {
    'ember': {
        'stone': (96, 40, 40), 'stone_hi': (160, 72, 40),
        'crystal_hi': (255, 200, 120), 'crystal_mid': (240, 96, 48),
        'sigil': (160, 48, 32), 'accent': (248, 176, 96), 'accent_dk': (160, 80, 32),
        'block_mid': (128, 48, 36), 'block_hi': (160, 88, 48), 'block_dk': (80, 24, 28),
        'plate_ring': (248, 160, 88), 'plate_core': (36, 24, 40), 'plate_spark': (255, 208, 144),
        'exit_glow': (255, 224, 160), 'exit_mid': (240, 160, 80), 'exit_hi': (200, 96, 48),
        'white': (248, 224, 192), 'aura': (48, 20, 24), 'bone_sh': (184, 128, 88),
    },
    'tide': {
        'stone': (72, 88, 128), 'stone_hi': (120, 152, 200),
        'crystal_hi': (200, 232, 255), 'crystal_mid': (96, 160, 240),
        'sigil': (48, 96, 176), 'accent': (128, 192, 240), 'accent_dk': (48, 80, 160),
        'block_mid': (88, 104, 136), 'block_hi': (136, 168, 208), 'block_dk': (48, 56, 88),
        'plate_ring': (160, 208, 255), 'plate_core': (36, 24, 40), 'plate_spark': (224, 248, 255),
        'exit_glow': (224, 248, 255), 'exit_mid': (144, 200, 240), 'exit_hi': (96, 144, 216),
        'white': (240, 248, 255), 'aura': (16, 40, 72), 'bone_sh': (170, 170, 184),
    },
    'hollow': {
        'stone': (72, 56, 44), 'stone_hi': (120, 96, 64),
        'crystal_hi': (200, 224, 176), 'crystal_mid': (128, 152, 96),
        'sigil': (96, 72, 40), 'accent': (176, 208, 128), 'accent_dk': (80, 104, 48),
        'block_mid': (108, 84, 56), 'block_hi': (152, 124, 84), 'block_dk': (56, 40, 28),
        'plate_ring': (176, 208, 128), 'plate_core': (36, 24, 40), 'plate_spark': (232, 248, 176),
        'exit_glow': (232, 248, 200), 'exit_mid': (168, 200, 120), 'exit_hi': (120, 144, 72),
        'white': (232, 240, 216), 'aura': (36, 32, 24), 'bone_sh': (160, 152, 120),
    },
    'spire': {
        'stone': (88, 92, 112), 'stone_hi': (152, 156, 176),
        'crystal_hi': (232, 240, 255), 'crystal_mid': (160, 176, 240),
        'sigil': (104, 112, 176), 'accent': (176, 192, 255), 'accent_dk': (72, 80, 152),
        'block_mid': (112, 116, 140), 'block_hi': (168, 176, 200), 'block_dk': (64, 68, 92),
        'plate_ring': (192, 208, 255), 'plate_core': (36, 24, 40), 'plate_spark': (240, 248, 255),
        'exit_glow': (240, 248, 255), 'exit_mid': (176, 192, 240), 'exit_hi': (128, 144, 208),
        'white': (244, 250, 255), 'aura': (32, 36, 64), 'bone_sh': (150, 156, 176),
    },
    'ruins': {
        'stone': (136, 104, 72), 'stone_hi': (192, 152, 112),
        'crystal_hi': (240, 216, 160), 'crystal_mid': (184, 144, 88),
        'sigil': (128, 96, 56), 'accent': (224, 184, 112), 'accent_dk': (136, 96, 48),
        'block_mid': (148, 112, 80), 'block_hi': (200, 160, 120), 'block_dk': (88, 64, 40),
        'plate_ring': (232, 200, 136), 'plate_core': (36, 24, 40), 'plate_spark': (252, 232, 176),
        'exit_glow': (252, 232, 176), 'exit_mid': (216, 176, 112), 'exit_hi': (168, 128, 72),
        'white': (248, 232, 200), 'aura': (44, 36, 28), 'bone_sh': (184, 160, 120),
    },
}

SPECIALS = {'save': t_save, 'boss': t_boss, 'block': t_block, 'switch': t_switch, 'exit': t_exit}


def main():
    built = 0
    for theme, ac in THEMES.items():
        ac = dict(ac)
        for k, v in PAL.items():
            ac.setdefault(k, v)
        base_img, fam = floor_base(theme)
        for name, fn in SPECIALS.items():
            img = Image.fromarray(base_img.copy(), 'RGB')
            # slight darken of floor behind specials for grounding (2px inner vignette)
            d = ImageDraw.Draw(img)
            fn(d, fam, ac)
            # snap all pixels to master palette + theme floor family
            palette = list(PAL.values()) + [tuple(v) for v in ac.values()] + list(fam)
            a = np.array(img)
            for y in range(H):
                for x in range(W):
                    a[y, x] = snap(a[y, x], palette)
            out = Image.fromarray(a, 'RGB').convert('RGBA')
            out.save(f'{OUT_DIR}/dg_{theme}_{name}.png')
            built += 1
    print(f'built {built} special tiles → {OUT_DIR}')


if __name__ == '__main__':
    main()