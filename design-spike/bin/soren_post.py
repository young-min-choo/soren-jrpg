#!/usr/bin/env python3
"""Soren pilot post-chain: raw 512² LoRA sheet → 48×96 soren-compliant walk-sheet.

Steps (proven chain from design-spike + BENCH-RESULTS post-chain ideas):
  1. grid-snap: fold the 512² continuous sheet onto a 128-cell lattice (4× target
     downscale), absorbing AA pixels into their dominant cell.
  2. palette quantize: map every opaque cell-color to the Soren master palette
     (38 colors) with straight RGB distance (gates use the same metric).
  3. k-centroid downscale 4× (512→128): per-cell mean color, NOT nearest — keeps
     thin dark details that nearest-neighbor drops (svntax LoRA's own spec).
  4. slice 16×16 cells → take the 4×3 walk grid (rows down/left/right/up) and
     composite into the 48×96 (16×24 frames) row order soren expects.
  5. alpha cleanup: near-flat background -> transparent, light rim -> removed.
Outputs: <outdir>/sheet_48x96.png + grid_128.png + metrics.json.

CLI (productized 2026-10-07):
  python3 soren_post.py --raw RAW_512.png --outdir OUT_DIR
Defaults reproduce the pilot paths when flags are omitted.
"""
import os, json, sys
import numpy as np
from PIL import Image

_PILOT = "/mnt/ssd/ai-models/output/soren_pilot_2026-10-07"
_args = sys.argv[1:] if len(sys.argv) > 1 else []
def _arg(flag, default):
    return _args[_args.index(flag) + 1] if flag in _args else default

RAW = _arg("--raw", os.path.join(_PILOT, "raw_lora_sheet_512.png"))
_OUTDIR = _arg("--outdir", _PILOT)
PAL = "/home/min/dev/soren-jrpg/design-spike/palette/master_palette.json"
SHEET_OUT = os.path.join(_OUTDIR, "sheet_48x96.png")
GRID128_OUT = os.path.join(_OUTDIR, "grid_128.png")
METRICS = os.path.join(_OUTDIR, "metrics.json")

# ---- load ---------------------------------------------------------------
img = Image.open(RAW).convert("RGB")
assert img.size == (512, 512), img.size
a = np.asarray(img).astype(np.float64)

# ---- 1. grid-snap to 128 lattice ----------------------------------------
# The LoRA emits a 4x4 frame grid inside 512px => each frame 128px. Frame content
# itself is meant to resolve at 32px after 4x downscale, so fold to 128 first.
N = 128
cell = 512 / N  # 4px per cell
# weight by saturation * darkness so AA haze never wins a cell
mx = a.max(axis=2); mn = a.min(axis=2)
sat = (mx - mn) / (mx + 1e-9)
weight = 0.25 + 0.75 * sat  # 0.25..1.0

cols = np.arange(512)
cellx = (cols // cell).astype(int)  # 0..127 per column
# accumulate per-cell weighted mean via np.add.at on flattened indices
flat_idx = cellx[None, :] + N * cellx[:, None]
acc = np.zeros((N * N, 4))  # r,g,b,w
np.add.at(acc, (flat_idx.ravel(), 0), a[:, :, 0].ravel() * weight.ravel())
np.add.at(acc, (flat_idx.ravel(), 1), a[:, :, 1].ravel() * weight.ravel())
np.add.at(acc, (flat_idx.ravel(), 2), a[:, :, 2].ravel() * weight.ravel())
np.add.at(acc, (flat_idx.ravel(), 3), weight.ravel())
snapped = acc[:, :3] / np.maximum(acc[:, 3:4], 1e-9)
snapped = snapped.reshape(N, N, 3).round().astype(np.uint8)

# ---- background detection on the snapped grid ---------------------------
# corners = background; flood from the border on color similarity
bg = np.zeros((N, N), bool)
for x0, y0 in [(0, 0), (N-1, 0), (0, N-1), (N-1, N-1)]:
    seed = snapped[y0, x0].astype(int)
    d = np.abs(snapped.astype(int) - seed).sum(axis=2)
    bg |= d < 40
# also near-white paper background
bg |= (snapped > 235).all(axis=2)

# ---- 2. palette quantize (master palette, same metric as gate_palette) ---
pal = [tuple(v) for v in json.load(open(PAL)).values()]
pal_arr = np.array(pal, int)  # (P,3)
flat = snapped.reshape(-1, 3).astype(int)
d = np.abs(flat[:, None, :] - pal_arr[None, :, :]).sum(axis=2)  # (256,P)
best = d.argmin(axis=1)
quant = pal_arr[best].reshape(N, N, 3).astype(np.uint8)

# ---- 3-4. slice: each 128px frame IS 16px at final scale (128 = 8px/frame? no)
# LoRA sheet is 4x4 frames of 128px; soren frame = 16x24 aspect. A 128px frame
# maps to 16x24 by a 2-stage: downscale each 128px frame to 16x24 directly is
# anisotropic; soren walk frames are 16 wide x 24 tall — the LoRA draws full-body
# characters roughly square. Proven soren approach (build_walk_sheet_v6): pad the
# square sprite into a 16x24 canvas with feet at the bottom row.
frames_sq = []
for r in range(4):
    for c in range(3):
        y0, x0 = r * 32, c * 32  # 128/4=32; frames occupy a 32-cell sub-block?
        pass
# NOTE: 128 cells total N=128 => each 512-frame = 128 cells. Frame grid = 4x4 frames
# of 32 cells each. Recompute: frame_size_in_cells = N // 4 = 32
FC = N // 4
alpha = (~bg).astype(np.uint8) * 255
sheet_cells = np.dstack([quant, alpha])

def frame_to_16x24(fr_img):
    """32x32 cell block -> 16x24 RGBA, feet on bottom row, centered, tight crop."""
    fr = Image.fromarray(fr_img, "RGBA")
    arr = np.array(fr)
    ys, xs = np.where(arr[:, :, 3] > 0)
    if len(ys) == 0:
        return Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    crop = fr.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    # aspect-fit into 14x22 content box (1px margin), nearest-neighbor
    w, h = crop.size
    scale = min(14 / w, 22 / h)
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    crop = crop.resize((nw, nh), Image.NEAREST)
    out = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    ox, oy = (16 - nw) // 2, 24 - nh  # anchored bottom-center (grounded)
    out.paste(crop, (ox, oy))
    return out

sheet = Image.new("RGBA", (48, 96), (0, 0, 0, 0))
for row in range(4):
    for col in range(3):
        blk = sheet_cells[row * FC:(row + 1) * FC, col * FC:(col + 1) * FC]
        fr = frame_to_16x24(blk)
        sheet.paste(fr, (col * 16, row * 24))
sheet.save(SHEET_OUT)
print("sheet:", SHEET_OUT, sheet.size)

# ---- 5. metrics -----------------------------------------------------------
arr = np.array(sheet)
vis = arr[arr[:, :, 3] > 0]
colors = {tuple(c[:3]) for c in vis}
ys = np.where((arr[:, :, 3] > 0).any(axis=1))[0]
grid_ok = sheet.size == (48, 96)
# frame-level check: every frame non-empty, feet grounded
frames_ok, grounded = 0, 0
for row in range(4):
    for col in range(3):
        f = arr[row * 24:(row + 1) * 24, col * 16:(col + 1) * 16]
        fa = f[:, :, 3] > 0
        if fa.sum() > 20:
            frames_ok += 1
            if fa[23].any():
                grounded += 1
# adjacent-frame diff (anim gate): min across each row
diffs = []
for row in range(4):
    for c in range(2):
        f1 = arr[row*24:(row+1)*24, c*16:(c+1)*16]
        f2 = arr[row*24:(row+1)*24, (c+1)*16:(c+2)*16]
        d = (f1 != f2).any(axis=2).sum() / f1[:, :, :1].size
        diffs.append(round(float(d), 3))
# unique colors per frame (16x24 => target 6-14 like hand art)
ucf = []
for row in range(4):
    for col in range(3):
        f = arr[row*24:(row+1)*24, col*16:(col+1)*16]
        v = f[f[:, :, 3] > 0][:, :3]
        ucf.append(len({tuple(x) for x in v}))

Image.fromarray(snapped).save(GRID128_OUT)
m = {
    "raw": RAW, "sheet": SHEET_OUT,
    "sheet_size": sheet.size, "grid_48x96": grid_ok,
    "frames_nonempty": f"{frames_ok}/12", "grounded": f"{grounded}/12",
    "unique_colors_total": len(colors), "uniq_per_frame": ucf,
    "adjacent_frame_diff": diffs, "min_diff": min(diffs),
}
json.dump(m, open(METRICS, "w"), indent=1)
print(json.dumps(m, indent=1))