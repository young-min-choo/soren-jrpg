#!/usr/bin/env python3
"""Check a field-sprite raw: is it a usable FULL-BODY stance?

Rules (ART-BIBLE §2 field sprites):
- alpha must cover 8-95% of frame (a full body fills its raw frame after
  chroma-key; >95% = unkeyed background, tiny = head-only bust fragment)
- content aspect must be taller than wide (humanoid standing)
- ≥3 distinct palette bands present (skin/hair/clothes = color-blocking)

Usage: python3 check_field_raw.py <path> (exit 0 = usable)
"""
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_battle_sprites import chroma_key

def main(path):
    img = Image.open(path).convert('RGBA')
    keyed = np.array(chroma_key(img))
    alpha = keyed[:, :, 3] > 0
    fill = alpha.mean()
    ys, xs = np.where(alpha)
    if not len(ys):
        print(f"FAIL {path}: empty after chroma-key"); return 1
    h, w = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
    vis = keyed[alpha][:, :3]
    uniq = {tuple(v) for v in vis}
    reasons = []
    if fill > 0.95: reasons.append(f"background not keyed (fill {fill:.0%})")
    if fill < 0.08: reasons.append(f"content too small (fill {fill:.0%}) — bust fragment?")
    if w >= h: reasons.append(f"not humanoid-standing ({w}x{h}, must be taller than wide)")
    if len(uniq) < 6: reasons.append(f"too few colors ({len(uniq)}) — flat fragment")
    if reasons:
        print(f"FAIL {path}: " + "; ".join(reasons)); return 1
    print(f"OK {path}: fill {fill:.0%}, body {w}x{h}, {len(uniq)} colors")
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))