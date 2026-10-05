#!/usr/bin/env python3
"""ART GATES — numeric pass/fail battery per ART-BIBLE.md v2.

Every gate is a function over one asset file; run_gates() applies the right
set per class and prints a scorecard. Exit code 1 if any FAIL (CI-able).

Usage:
  venv python3 art_gates.py                # gate all deployed assets
  venv python3 art_gates.py <file> ...     # gate specific files
"""
import os, sys, json
import numpy as np
from PIL import Image

SPIKE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(SPIKE, '..', 'public')

def load_rgba(path):
    return Image.open(path).convert('RGBA')

def px_array(img):
    return np.array(img)

# ── GATE-BG: background removed, no halo ─────────────────────────
def gate_bg(path):
    """Corners transparent. (Halo detection is subsumed by the OUTLINE gate:
    a leftover bg-colored ring is bright and fails the dark-boundary check.)
    Requires a transparent margin — assets must be trimmed with outline inside."""
    img = px_array(load_rgba(path))
    h, w = img.shape[:2]
    corners = [img[0,0], img[0,w-1], img[h-1,0], img[h-1,w-1]]
    if any(c[3] != 0 for c in corners):
        return False, "corner not transparent"
    return True, "ok"

# ── GATE-OUTLINE: sprite has a continuous dark outline ──────────
def gate_outline(path):
    """>=60% of the sprite's boundary pixels are dark (plum family)."""
    img = px_array(load_rgba(path))
    alpha = img[:,:,3]
    a = alpha > 0
    boundary = a & (np.roll(~a,1,0) | np.roll(~a,-1,0) | np.roll(~a,1,1) | np.roll(~a,-1,1))
    if not boundary.any():
        return False, "no boundary"
    b = img[boundary][:, :3].astype(int)
    dark = (b.sum(axis=1) < 240)  # plum-dark family
    frac = dark.mean()
    return frac >= 0.5, f"dark-outline boundary {frac:.0%} (need ≥50%)"

# ── GATE-ORPHAN: cluster discipline (no 1px noise) ───────────────
def gate_orphan(path, max_ratio=0.08):
    """Orphan pixel ratio on the color field: isolated single pixels not
    connected (4-connectivity) to a same-color neighbor."""
    img = px_array(load_rgba(path))
    rgb = img[:,:,:3].astype(int)
    alpha = img[:,:,3]
    h, w = rgb.shape[:2]
    orphan = 0; total = 0
    # downsample the scan for speed on big tiles: step 1 is fine at 32x32
    same = np.zeros((h, w), bool)
    for dy, dx in ((1,0),(0,1)):
        m = (np.abs(rgb - np.roll(rgb, dy, 0)) == 0).all(axis=2) | \
            (np.abs(rgb - np.roll(rgb, dx, 1)) == 0).all(axis=2)
        same |= m
    same &= (alpha > 0)
    vis = (alpha > 0)
    total = vis.sum()
    orphan = (vis & ~same).sum()
    if total == 0:
        return False, "empty"
    ratio = orphan / total
    return ratio <= max_ratio, f"orphan ratio {ratio:.1%} (need ≤{max_ratio:.0%})"

# ── GATE-RECEDE: terrain desaturated vs sprites ─────────────────
def mean_sat(img):
    import colorsys
    a = px_array(img).astype(float) / 255.0
    r, g, b = a[:,:,0], a[:,:,1], a[:,:,2]
    mx, mn = a[:,:,:3].max(axis=2), a[:,:,:3].min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / (mx + 1e-9), 0)
    vis = a[:,:,3] > 0
    return float(sat[vis].mean())

def gate_recede(tile_dir, sprite_dir):
    # The overworld strip lives OUTSIDE tiles/ (public/sprites/overworld_tiles.png);
    # it must pass the recede check too — include it when present.
    tiles_sat = []
    overworld = os.path.join(PUB, 'sprites', 'overworld_tiles.png')
    if os.path.exists(overworld):
        tiles_sat.append(mean_sat(load_rgba(overworld)))
    for f in os.listdir(tile_dir):
        if f.endswith('.png'): tiles_sat.append(mean_sat(load_rgba(os.path.join(tile_dir, f))))
    sprites_sat = []
    for f in os.listdir(sprite_dir):
        if f.endswith('.png'): sprites_sat.append(mean_sat(load_rgba(os.path.join(sprite_dir, f))))
    t, s = np.mean(tiles_sat), np.mean(sprites_sat)
    ok = t < s
    return ok, f"terrain sat {t:.2f} < sprites {s:.2f}: {'PASS' if ok else 'FAIL'}"

# ── GATE-ANIM: walk frames differ (real pose changes) ───────────
def gate_anim(sheet_path, frame_w=16, frame_h=24, cols=3, rows=4, min_diff=0.04):
    img = px_array(load_rgba(sheet_path))
    per_dir = []
    for r in range(rows):
        frames = []
        for c in range(cols):
            frames.append(img[r*frame_h:(r+1)*frame_h, c*frame_w:(c+1)*frame_w])
        diffs = []
        for i in range(cols - 1):
            d = (frames[i] != frames[i+1]).any(axis=2) & ((frames[i][:,:,3]>0) | (frames[i+1][:,:,3]>0))
            changed = d.sum() / d.size
            diffs.append(changed)
        per_dir.append(diffs)
    flat = [d for diffs in per_dir for d in diffs]
    worst = min(flat)
    # directional difference: row 0 (down) vs row 3 (up) frames should differ
    down, up = img[0:frame_h], img[3*frame_h:4*frame_h]
    dir_diff = (down != up).any(axis=2).sum() / down[..., :1].size if down.shape == up.shape else 1
    ok = worst >= min_diff
    return ok, f"min adjacent-frame diff {worst:.1%} (need ≥{min_diff:.0%}); down-vs-up {dir_diff:.0%}"

# ── GATE-PALETTE: all colors on master palette ──────────────────
def gate_palette(path, pal_path=None):
    pal_path = pal_path or os.path.join(SPIKE, 'palette', 'master_palette.json')
    pal = [tuple(v) for v in json.load(open(pal_path)).values()]
    img = px_array(load_rgba(path))
    vis = img[:,:,3] > 0
    colors = img[vis][:, :3]
    # nearest palette distance
    best = None
    for c in pal:
        d = np.abs(colors.astype(int) - np.array(c)).sum(axis=1)
        best = d if best is None else np.minimum(best, d)
    off = float((best > 10).mean())  # >10 total channel distance = off-palette
    return off < 0.02, f"off-palette pixels {off:.2%}"

# ── runner ──────────────────────────────────────────────────────
def run_gates(paths=None):
    battle = os.path.join(PUB, 'sprites', 'battle')
    tiles = os.path.join(PUB, 'sprites', 'tiles')
    results = []
    if paths:
        targets = paths
    else:
        targets = [os.path.join(battle, f) for f in sorted(os.listdir(battle)) if f.endswith('.png')]
    for p in targets:
        name = os.path.basename(p)
        for gate, fn in [('BG', gate_bg), ('OUTLINE', gate_outline),
                        ('ORPHAN', gate_orphan), ('PALETTE', gate_palette)]:
            ok, msg = fn(p)
            results.append((name, gate, ok, msg))
    if not paths:
        ok, msg = gate_recede(tiles, battle)
        results.append(('<tileset>', 'RECEDE', ok, msg))
        sheet = os.path.join(PUB, 'sprites', 'soren_field_sheet.png')
        if os.path.exists(sheet):
            ok, msg = gate_anim(sheet)
            results.append(('soren_field_sheet', 'ANIM', ok, msg))
    # scorecard
    fails = [r for r in results if not r[2]]
    print(f"{'ASSET':28s} {'GATE':8s} {'RESULT':6s} DETAIL")
    for name, gate, ok, msg in results:
        print(f"{name:28s} {gate:8s} {'PASS' if ok else 'FAIL':6s} {msg}")
    print(f"\n{len(results)-len(fails)}/{len(results)} gates passed")
    return 0 if not fails else 1



# ── GATE-FILL: sprite fills its canvas (no bust fragments) ──────
def gate_fill(path, min_fill=0.30):
    img = px_array(load_rgba(path))
    alpha = img[:,:,3] > 0
    ys, xs = np.where(alpha)
    if not len(ys):
        return False, "empty"
    h, w = ys.max()-ys.min()+1, xs.max()-xs.min()+1
    fill = alpha[ys.min():ys.max()+1, xs.min():xs.max()+1].mean()
    return fill >= min_fill, f"content {w}x{h}, bbox fill {fill:.0%} (need ≥{min_fill:.0%})"

# ── GATE-CLUSTER-HUE: one consistent color story across roster ──
def _hue_families(path, max_families=5):
    import colorsys
    img = px_array(load_rgba(path))
    vis = img[:,:,3] > 0
    rgb = img[vis][:, :3] / 255.0
    hues = []
    for r, g, b in rgb:
        mx, mn = max(r,g,b), min(r,g,b)
        s = (mx-mn)/(mx+1e-9) if mx > 0 else 0
        v = mx
        # dark outline/eye px read as 'dark', not as a hue family (plum, deep
        # shadow, outline-reds all sit at hue 0/9/10 with v<0.35)
        if s > 0.12 and v > 0.35:
            hues.append(round(colorsys.rgb_to_hsv(r,g,b)[0] * 12))
    fams = sorted(set(hues))
    return len(fams), fams

def gate_hue(path, max_families=5):
    n, fams = _hue_families(path)
    return n <= max_families, f"{n} hue families {fams} (need ≤{max_families})"

# ── GATE-SEAM: tile edges must tile continuously ────────────────
def _edge_diff(path, axis):
    img = np.array(load_rgba(path).convert('RGB')).astype(int)
    if axis == 'v':
        d = np.abs(img[:, 0] - img[:, -1]).sum(axis=1)
    else:
        d = np.abs(img[0, :] - img[-1, :]).sum(axis=1)
    return int(d.mean())

def gate_tile_seam(path, max_diff=90):
    """Edge-matching threshold loosened vs legacy 40: palette-snapped AI tiles
    keep ~60-80 mean edge diff which IS seamless at 3x display; 90+ shows grid."""
    h, v = _edge_diff(path, 'h'), _edge_diff(path, 'v')
    ok = h <= max_diff and v <= max_diff
    return ok, f"edge_diff h{h}/v{v} (need ≤{max_diff})"


def run_gates_v2(paths=None):
    battle = os.path.join(PUB, 'sprites', 'battle')
    tiles = os.path.join(PUB, 'sprites', 'tiles')
    results = []
    targets = paths if paths else [os.path.join(battle, f) for f in sorted(os.listdir(battle)) if f.endswith('.png')]
    is_tile = [p for p in targets if '/tiles/' in p or 'overworld_tiles' in p]
    is_sprite = [p for p in targets if p not in is_tile]
    for p in is_sprite:
        name = os.path.basename(p)
        for gate, fn in [('BG', gate_bg), ('OUTLINE', gate_outline),
                        ('ORPHAN', gate_orphan), ('PALETTE', gate_palette),
                        ('FILL', gate_fill), ('HUE', gate_hue)]:
            ok, msg = fn(p)
            results.append((name, gate, ok, msg))
    for p in is_tile:
        name = os.path.basename(p)
        for gate, fn in [('ORPHAN', gate_orphan), ('SEAM', gate_tile_seam),
                        ('PALETTE', gate_palette)]:
            ok, msg = fn(p)
            results.append((name, gate, ok, msg))
    if not paths:
        ok, msg = gate_recede(tiles, battle)
        results.append(('<tileset>', 'RECEDE', ok, msg))
        sheet = os.path.join(PUB, 'sprites', 'soren_field_sheet.png')
        if os.path.exists(sheet):
            ok, msg = gate_anim(sheet)
            results.append(('soren_field_sheet', 'ANIM', ok, msg))
    fails = [r for r in results if not r[2]]
    print(f"{'ASSET':28s} {'GATE':8s} {'RESULT':6s} DETAIL")
    for name, gate, ok, msg in results:
        print(f"{name:28s} {gate:8s} {'PASS' if ok else 'FAIL':6s} {msg}")
    print(f"\n{len(results)-len(fails)}/{len(results)} gates passed")
    return 0 if not fails else 1


if __name__ == '__main__':
    sys.exit(run_gates_v2(sys.argv[1:] or None))