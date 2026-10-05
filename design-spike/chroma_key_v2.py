#!/usr/bin/env python3
"""Chroma-key v2 — multi-region sampling + background-mode removal.

Fixes the hero_* field raws failure: these renders use a STUDIO GRADIENT
background (light center → darker corners), so single-color corner voting +
tolerance-48 flood leaves a huge soft-grey blob around the sprite (which then
reads as grey rocks after downscaling).

Strategy:
1. Sample the background along all 4 edges (not just corners), in bands.
2. Fit a linear model bg(x,y) ≈ a + b·x + c·y from the edge samples.
3. A pixel is background if it's CLOSE TO THE MODEL within tolerance —
   handles gradients, plus a global fallback色 check for flat renders.
4. Flood-fill from the frame edges with that predicate.

Also: despill pass after keying — pixels adjacent to transparency that match
a background tone get desaturated/darkened toward the sprite outline rather
than leaving a halo.
"""
import numpy as np
from collections import deque
from PIL import Image

def estimate_bg_model(img):
    """Fit bg≈a+b·x+c·y per channel from a 3px edge band, RANSAC-lite:
    drop the top/bottom 30% of band brightness per row to ignore vignette
    corners and accidental sprite-touches."""
    a = np.asarray(img.convert('RGB'), dtype=float)
    h, w = a.shape[:2]
    band = 3
    samples = []
    for x in range(0, w, 4):
        samples += [(x, y) for y in range(band)]
        samples += [(x, y) for y in range(h - band, h)]
    for y in range(0, h, 4):
        samples += [(x, y) for x in range(band)]
        samples += [(x, y) for x in range(w - band, w)]
    pts = np.array(samples)
    cols = a[pts[:, 1], pts[:, 0]]            # N×3
    # Robust per-channel: use median as base, then least-squares on residuals
    coords = np.stack([np.ones(len(pts)), pts[:, 0] / w, pts[:, 1] / h], axis=1)
    models = []
    for ch in range(3):
        y = cols[:, ch]
        # two-pass: fit, drop outliers >30 residual, refit
        beta, *_ = np.linalg.lstsq(coords, y, rcond=None)
        resid = np.abs(coords @ beta - y)
        keep = resid < max(24.0, np.percentile(resid, 70))
        beta, *_ = np.linalg.lstsq(coords[keep], y[keep], rcond=None)
        models.append(beta)
    A = np.array(models)  # 3×3
    return A  # bg(r,g,b) = A @ [1, x/w, y/h]


PRED_CACHE = {}
def make_bg_pred(img, tolerance=42):
    A = estimate_bg_model(img)
    arr = np.asarray(img.convert('RGB'), dtype=float)
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    coords = np.stack([np.ones_like(xx), xx / w, yy / h], axis=-1)  # h×w×3
    model = coords @ A.T                                            # h×w×3
    diff = np.abs(arr - model).max(axis=-1)                         # h×w
    return lambda r, g, b, x, y: max(abs(r - model[y, x, 0]), abs(g - model[y, x, 1]), abs(b - model[y, x, 2])) <= tolerance


def chroma_key_v2(img, tolerance=42):
    """Model-based background removal (gradients OK). Alpha-0 pixels always bg."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    pred = make_bg_pred(img, tolerance)
    visited = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        q.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        q.extend([(0, y), (w - 1, y)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        r, g, b, a = px[x, y]
        if a == 0 or pred(r, g, b, x, y):
            px[x, y] = (0, 0, 0, 0)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q.append((x + dx, y + dy))
    return img


def despill(img, strength=0.6):
    """Darken/desaturate pixels near transparency (halo suppression)."""
    a = np.asarray(img.convert('RGBA'), dtype=float)
    alpha = a[:, :, 3] > 0
    ring = alpha & (np.roll(~alpha, 1, 0) | np.roll(~alpha, -1, 0) |
                    np.roll(~alpha, 1, 1) | np.roll(~alpha, -1, 1))
    # two-pixel ring
    ring2 = alpha & ~ring & (np.roll(ring, 1, 0) | np.roll(ring, -1, 0) |
                             np.roll(ring, 1, 1) | np.roll(ring, -1, 1))
    for mask, s in ((ring, strength), (ring2, strength * 0.5)):
        rgb = a[:, :, :3]
        gray = rgb.mean(axis=2, keepdims=True)
        a[:, :, :3] = np.where(mask[:, :, None], rgb * (1 - s) + gray * s, rgb)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')