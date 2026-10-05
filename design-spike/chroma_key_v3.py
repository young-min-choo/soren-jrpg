#!/usr/bin/env python3
"""Chroma-key v3 — region-growing with LOCAL background model + slab removal.

Kills the two failure modes of v1/v2 that baked grey into battle sprites:

MODE A (radial studio backdrop): pollinations ignores the magenta instruction
~90% of the time and renders a grey vignette (dark corners → light blob mid-
frame). Linear bg model (v2) can't follow a radial gradient; corner-vote (v1)
keeps the whole light center. Fix: region-grow from the frame edges, comparing
each candidate to the LOCAL frontier color (mean of recently-keyed ring) —
follows any smooth gradient, radial included.

MODE B (ground slab): many renders put the subject on a grey platform/shadow
slab that touches the frame bottom → 30px-wide uniform rows baked underfoot.
Fix: after keying, detect near-uniform grey full-width rows among the bottom
rows and cut them, then re-anchor feet.

Also: despill (ring desaturation) — retained from v2.
"""
import numpy as np
from PIL import Image
from collections import deque, Counter


def local_tol_key(img, tol_start=30, tol_max=58, ring_k=14):
    """Region-grow bg removal with local frontier color per step."""
    img = img.convert('RGBA')
    w, h = img.size
    arr = np.asarray(img).astype(int)
    visited = np.zeros((h, w), bool)
    bg = np.zeros((h, w), bool)
    frontier = deque()
    for x in range(w):
        frontier += [(x, 0), (x, h - 1)]
    for y in range(h):
        frontier += [(0, y), (w - 1, y)]
    # frontier color history (recent ring)
    recent = []
    def push_recent(c):
        recent.append(c)
        if len(recent) > ring_k:
            recent.pop(0)
    def near(c, ref, tol):
        return max(abs(c[0]-ref[0]), abs(c[1]-ref[1]), abs(c[2]-ref[2])) <= tol
    while frontier:
        x, y = frontier.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y, x]:
            continue
        visited[y, x] = True
        c = arr[y, x]
        if c[3] == 0:
            bg[y, x] = True
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                frontier.append((x+dx, y+dy))
            continue
        ref = np.mean(recent, axis=0) if recent else c[:3]
        # dynamic tolerance: loose for smooth gradient, capped
        tol = tol_start
        if recent:
            spread = np.max(np.abs(np.array(recent) - ref)) if len(recent) > 1 else 0
            tol = min(tol_max, tol_start + spread * 0.8)
        if near(c[:3], ref, tol):
            bg[y, x] = True
            push_recent(c[:3])
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                frontier.append((x+dx, y+dy))
    out = arr.copy()
    out[bg, :] = 0
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def remove_slab(img, max_rows=12):
    """Cut uniform grey full-width rows at the bottom (ground slab)."""
    a = np.asarray(img.convert('RGBA')).copy()
    h, w = a.shape[:2]
    cut = 0
    for y in range(h - 1, max(0, h - 1 - max_rows), -1):
        row = a[y]
        vis = row[row[:, 3] > 0]
        if len(vis) < w * 0.8:      # not near-full-width
            break
        rgb = vis[:, :3].astype(int)
        spread = rgb.max(axis=0) - rgb.min(axis=0)
        mx, mn = rgb.max(axis=1)/255, rgb.min(axis=1)/255
        sat = (mx - mn) / (mx + 1e-9)
        if spread.max() < 26 and sat.mean() < 0.18:   # uniform + greyish
            a[y, :, :] = 0
            cut += 1
        else:
            break
    if cut:
        # re-anchor: shift content down so feet touch the bottom again
        al = a[:, :, 3] > 0
        ys = np.where(al.any(axis=1))[0]
        if len(ys):
            y1 = ys.max()
            if y1 < h - 1:
                shift = (h - 1) - y1
                a = np.roll(a, shift, axis=0)
                a[:shift, :, :] = 0
    return Image.fromarray(a, 'RGBA')


def despill(img, strength=0.65):
    a = np.asarray(img.convert('RGBA')).astype(float).copy()
    alpha = a[:, :, 3] > 0
    ring = alpha & (np.roll(~alpha, 1, 0) | np.roll(~alpha, -1, 0) |
                    np.roll(~alpha, 1, 1) | np.roll(~alpha, -1, 1))
    ring2 = alpha & ~ring & (np.roll(ring, 1, 0) | np.roll(ring, -1, 0) |
                             np.roll(ring, 1, 1) | np.roll(ring, -1, 1))
    for mask, s in ((ring, strength), (ring2, strength * 0.5)):
        rgb = a[:, :, :3]
        gray = rgb.mean(axis=2, keepdims=True)
        a[:, :, :3] = np.where(mask[:, :, None], rgb * (1 - s) + gray * s, rgb)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def chroma_key_v3(img):
    """Full pipeline: local-tolerance region-grow + slab removal + despill."""
    img = local_tol_key(img)
    img = remove_slab(img)
    img = despill(img)
    return img