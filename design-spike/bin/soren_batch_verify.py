#!/usr/bin/env python3
"""Soren NPC batch verify: gates + hue-fix pass over design-spike/npc_sheets/*.

1. Per sheet: GATE-ANIM (adjacent-frame diff ≥4%, per art_gates.gate_anim),
   GATE-GROUND (feet touch bottom row), GATE-PALETTE (0% off-palette at the
   >10-distance metric), GATE-HUE ≤5 hue families (with one automatic hue-merge
   retry: merges the two rarest families into their nearest neighbors, then
   re-quantizes — fixes the pilot's 43/48 HUE miss mechanically).
2. Gate failures listed with which identity + which gate.
3. Prints a wiring manifest: {name: status}.

Usage: python3 soren_batch_verify.py [--fix-hue] [--all | name ...]
"""
import colorsys
import json
import os
import sys

import numpy as np
from PIL import Image

REPO = "/home/min/dev/soren-jrpg"
SHEETS = os.path.join(REPO, "design-spike", "npc_sheets")
PAL = os.path.join(REPO, "design-spike", "palette", "master_palette.json")
PUB_NPC = os.path.join(REPO, "public", "sprites", "npc")
sys.path.insert(0, os.path.join(REPO, "design-spike"))
from art_gates import gate_anim, gate_ground, gate_palette, gate_hue  # noqa: E402


def _fam_hue(rgb):
    """Hue-family bucket (0-11) matching art_gates._hue_families' classifier."""
    import colorsys as _cs
    r, g, b = (c / 255 for c in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    s = (mx - mn) / (mx + 1e-9) if mx > 0 else 0
    v = mx
    if s <= 0.12 or v <= 0.35:
        return -1  # dark/neutral: never a family
    return round(_cs.rgb_to_hsv(r, g, b)[0] * 12) % 12


def hue_fams(arr_rgb):
    hues = []
    for r, g, b in arr_rgb:
        r, g, b = r / 255, g / 255, b / 255
        mx, mn = max(r, g, b), min(r, g, b)
        s = (mx - mn) / (mx + 1e-9) if mx > 0 else 0
        v = mx
        if s > 0.12 and v > 0.35:
            hues.append(round(colorsys.rgb_to_hsv(r, g, b)[0] * 12))
    return sorted(set(hues))


def fix_hue(sheet_path):
    """Merge the two rarest hue families into nearest neighbors, re-quantize."""
    img = Image.open(sheet_path).convert("RGBA")
    a = np.array(img)
    vis = a[:, :, 3] > 0
    rgb = a[vis][:, :3]
    fams = hue_fams(rgb)
    if len(fams) <= 5:
        return None  # already passing
    # count pixels per family
    counts = []
    for fam in fams:
        n = 0
        for r, g, b in rgb:
            r_, g_, b_ = r / 255, g / 255, b / 255
            mx, mn = max(r_, g_, b_), min(r_, g_, b_)
            s = (mx - mn) / (mx + 1e-9)
            v = mx
            if s > 0.12 and v > 0.35 and round(colorsys.rgb_to_hsv(r_, g_, b_)[0] * 12) == fam:
                n += 1
        counts.append((n, fam))
    counts.sort()
    rare = [counts[0][1], counts[1][1]]
    survivors = [f for f in fams if f not in rare]
    # remap rare-family pixels to the nearest palette color WHOSE HUE FAMILY
    # survives (nearest-overall could land back in a rare family and no-op)
    pal = [tuple(v) for v in json.load(open(PAL)).values()]
    pal_arr = np.array(pal, int)
    pal_hues = np.array([_fam_hue(tuple(p)) for p in pal])
    keep = np.isin(pal_hues, survivors)
    surv_pal = pal_arr[keep]
    if not len(surv_pal):
        return None
    arr = a.astype(int)
    mask = np.zeros(arr.shape[:2], bool)
    h, w = arr.shape[:2]
    for y in range(h):
        for x in range(w):
            r, g, b, al = arr[y, x]
            if al == 0:
                continue
            r_, g_, b_ = r / 255, g / 255, b / 255
            mx, mn = max(r_, g_, b_), min(r_, g_, b_)
            s = (mx - mn) / (mx + 1e-9)
            v = mx
            if s > 0.12 and v > 0.35 and round(colorsys.rgb_to_hsv(r_, g_, b_)[0] * 12) in rare:
                mask[y, x] = True
    if not mask.sum():
        return None
    px = arr[mask][:, :3]
    d = np.abs(px[:, None, :] - surv_pal[None, :, :]).sum(axis=2)
    repl = surv_pal[d.argmin(axis=1)]
    arr[mask, :3] = repl
    Image.fromarray(arr.astype(np.uint8)).save(sheet_path)
    return list(rare)


def verify(name, do_fix):
    outdir = os.path.join(SHEETS, name)
    sheet = os.path.join(outdir, "sheet_48x96.png")
    if not os.path.exists(sheet):
        return (name, "MISSING", {})
    hue_merged = None
    if do_fix:
        n_fams_before = len(hue_fams(np.array(Image.open(sheet).convert("RGBA"))[np.array(Image.open(sheet).convert("RGBA"))[:, :, 3] > 0][:, :3]))
        if n_fams_before > 5:
            rare = fix_hue(sheet)
            if rare:
                hue_merged = rare
    checks = {}
    ok, msg = gate_anim(sheet)
    checks["ANIM"] = (ok, msg)
    ok, msg = gate_ground(sheet)
    checks["GROUND"] = (ok, msg)
    ok, msg = gate_palette(sheet)
    checks["PALETTE"] = (ok, msg)
    ok, msg = gate_hue(sheet)
    checks["HUE"] = (ok, msg)
    all_ok = all(v[0] for v in checks.values())
    return (name, "PASS" if all_ok else "FAIL", checks, hue_merged)


def main():
    args = sys.argv[1:]
    do_fix = "--fix-hue" in args
    names = [a for a in args if not a.startswith("--")]
    if "--all" in args or not names:
        names = sorted(d for d in os.listdir(SHEETS) if os.path.isdir(os.path.join(SHEETS, d))) if os.path.isdir(SHEETS) else []
    results = [verify(n, do_fix) for n in names]
    print(f"{'IDENTITY':16s} {'VERDICT':8s} DETAIL")
    for r in results:
        name, verdict, checks = r[0], r[1], r[2]
        fixed = f" (hue-merged {r[3]})" if len(r) > 3 and r[3] else ""
        print(f"{name:16s} {verdict:8s}{fixed}")
        for g, (ok, msg) in checks.items():
            print(f"  {g:8s} {'PASS' if ok else 'FAIL'} {msg}")
    print()
    print("wiring manifest:", json.dumps({r[0]: r[1] for r in results}))
    fails = [r[0] for r in results if r[1] not in ("PASS",)]
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())