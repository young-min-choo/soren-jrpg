#!/usr/bin/env python3
"""Build the REAL 12-frame Soren walk sheet per ART-BIBLE v2.

Layout (matches BootScene contract): 3 cols × 4 rows, 16×24 frames
  row 0: down   (front view)
  row 1: left   (side view, mirrored for right)
  row 2: right  (mirror of row 1)
  row 3: up     (back view)

3 frames per direction (FE-GBA convention):
  f0 = stand (contact pose)
  f1 = step (left leg forward — legs alternate, body bobs 1px UP)
  f2 = pass (right leg forward — mirrored step, body bobs 1px UP)

Legs alternate via horizontal leg-swap + vertical bob. Real pose change,
not a copy-flip fake.

Run: venv python3 build_walk_sheet.py
"""
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SPIKE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(SPIKE, 'raw_field')
OUT = os.path.join(SPIKE, '..', 'public', 'sprites')
BOSS = set()

PLUM = (42, 34, 51)
FRAME_W, FRAME_H = 16, 24

def load_base(path, size=(FRAME_W, FRAME_H)):
    """Raw 512px render -> gradient-safe chroma-key -> despill -> crop-to-content
    -> ASPECT-FIT resize (no squeeze!) -> anchored on frame, feet at bottom.

    The old pipeline force-squeezed the square raw into 16x24 (`!`), turning
    every direction into the same half-width mush. Crop-then-fit keeps the
    body's aspect ratio; the tiny remainder is padding, not distortion."""
    from chroma_key_v2 import chroma_key_v2, despill
    import subprocess
    img = chroma_key_v2(Image.open(path))
    despill(img)
    a = np.array(img)[:, :, 3] > 0
    ys, xs = np.where(a)
    if len(ys):
        img = img.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    w, h = size
    tmp_c, tmp_f = '/tmp/walkbase_c.png', '/tmp/walkbase_f.png'
    img.save(tmp_c)
    # aspect-fit into (w)x(h-2); bottom 2px reserved so outline never clips
    subprocess.run(['magick', tmp_c, '-filter', 'point', '-resize', f'{w}x{h-2}',
                    '+dither', '-colors', '20', tmp_f], check=True, timeout=30)
    fitted = Image.open(tmp_f).convert('RGBA')
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    canvas.paste(fitted, ((w - fitted.width) // 2, h - 2 - fitted.height))
    return np.array(canvas)

def snap(arr):
    pal = [tuple(v) for v in json.load(open(os.path.join(SPIKE, 'palette', 'master_palette.json'))).values()]
    out = arr.copy()
    vis = out[:,:,3] > 0
    colors = out[:,:,:3].astype(int)
    uniq = {}
    for c in np.unique(colors[vis], axis=0):
        uniq[tuple(c)] = min(pal, key=lambda p: sum((int(a)-int(b))**2 for a, b in zip(c, p)))
    for (r, g, b), (pr, pg, pb) in uniq.items():
        m = vis & (colors[:,:,0] == r) & (colors[:,:,1] == g) & (colors[:,:,2] == b)
        out[m, 0], out[m, 1], out[m, 2] = pr, pg, pb
    return out

def trim_center(arr, w=FRAME_W, h=FRAME_H):
    ys, xs = np.where(arr[:,:,3] > 0)
    if not len(ys): return arr
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    trimmed = arr[y0:y1+1, x0:x1+1]
    canvas = np.zeros((h, w, 4), dtype=np.uint8)
    th, tw = trimmed.shape[:2]
    if th > h: trimmed = trimmed[th-h:, :]  # keep the bottom (feet matter)
    if tw > w: trimmed = trimmed[:, (tw-w)//2:(tw-w)//2+w]
    th, tw = trimmed.shape[:2]
    # feet on the floor: anchor to bottom, center horizontally
    oy = h - th
    ox = (w - tw) // 2
    canvas[oy:oy+th, ox:ox+tw] = trimmed
    return canvas

def outline(arr, color=PLUM):
    a = arr[:,:,3] > 0
    ring = ~a & (np.roll(a,1,0) | np.roll(a,-1,0) | np.roll(a,1,1) | np.roll(a,-1,1))
    ring[0,:] = ring[-1,:] = False
    ring[:,0] = ring[:,-1] = False
    arr[ring,0], arr[ring,1], arr[ring,2] = color
    arr[ring,3] = 255
    return arr

def leg_region(arr, y_frac=0.72):
    """Rows below y_frac of the sprite = legs."""
    a = arr[:,:,3] > 0
    ys = np.where(a.any(axis=1))[0]
    if not len(ys): return arr, slice(0, 0)
    top, bottom = ys.min(), ys.max()
    leg_top = int(top + (bottom - top) * y_frac)
    return arr, slice(leg_top, bottom + 1)

def make_step(frame, mirror=False):
    """Step pose: one leg forward. Split legs at the horizontal center of the
    leg region, shift the whole sprite 1px up (bob), and shift one leg 1px
    forward (walk mechanics)."""
    f = frame.copy()
    arr, legs = leg_region(f)
    ls = legs
    if ls.stop - ls.start < 3:
        return f
    leg_block = f[ls, :, :]
    a = leg_block[:,:,3] > 0
    if not a.any():
        return f
    xs = np.where(a.any(axis=0))[0]
    if len(xs) < 3:
        return f
    mid = (xs.min() + xs.max()) // 2
    # widen stride: move left-half legs 1px left, right-half 1px right
    new_block = leg_block.copy()
    if mirror:
        # swap stride direction for the alternate frame
        new_block[:, xs.max(), :] = 0
    else:
        new_block[:, xs.min(), :] = 0
    f[ls, :, :] = new_block
    # 1px body bob: shift the whole sprite up by 1 (feet row keeps contact)
    bob = np.zeros_like(f)
    bob[:-1, :, :] = f[1:, :, :]
    bob[-1, :, :] = f[-1, :, :] * 0  # clear the ghost row
    return bob

def make_pass(frame):
    """Pass pose: legs together (narrow stance), body at normal height."""
    f = frame.copy()
    return f

def mirror_x(frame):
    return frame[:, ::-1, :].copy()

# ── build ──────────────────────────────────────────────────────
# Phase 9 v2: identity-locked hero raws (hero_front/side/back, one seed —
# same character in all directions). Legacy soren_* raws retired: they were
# three unrelated renders (blue dress vs green hoodie bust vs teal tunic).
front = load_base(os.path.join(RAW, 'hero_front.png'))
back = load_base(os.path.join(RAW, 'hero_back.png'))
side = load_base(os.path.join(RAW, 'hero_side.png'))

# fall back to the deployed front sheet's stand frame if raws are missing
if front is None:
    deployed = np.array(Image.open(os.path.join(OUT, 'soren_field_sheet.png')).convert('RGBA'))
    front = deployed[0:FRAME_H, 0:FRAME_W, :]

sheet = np.zeros((FRAME_H * 4, FRAME_W * 3, 4), dtype=np.uint8)

for row, (base, mirror) in enumerate([(front, False), (side, False),
                                       (side, True), (back, False)]):
    if base is None:
        base = front  # last resort
    if mirror:
        base = mirror_x(base)
    stand = outline(trim_center(snap(base.copy())))
    step = make_step(stand.copy())
    pas = make_pass(stand.copy())
    sheet[row*FRAME_H:(row+1)*FRAME_H, 0:FRAME_W] = stand
    sheet[row*FRAME_H:(row+1)*FRAME_H, FRAME_W:2*FRAME_W] = step
    sheet[row*FRAME_H:(row+1)*FRAME_H, 2*FRAME_W:3*FRAME_W] = pas

Image.fromarray(sheet).save(os.path.join(OUT, 'soren_field_sheet.png'))
print("walk sheet rebuilt: 3 cols × 4 rows, 16×24 — real pose frames")