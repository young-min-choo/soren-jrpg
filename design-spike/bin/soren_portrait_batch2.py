#!/usr/bin/env python3
"""Soren portrait batch v2 — keyword hygiene + auto-screen + seed retry.

Learnings from the v1 raw grid (2026-10-07, 20 raws):
- GOOD (4): elder, aldric, abbot, soren — painterly FE read, plum bg.
- DRIFT (14): young faces slide to flat cel anime unless given facial-drama
  vocab; saturated color adjectives ("fiery red") cause monochrome collapse;
  caps/hats sometimes hijack identity.
- BROKEN (2): innkeeper, warden — flat-color fields.
Fix strategy per identity: material color nouns (auburn/scarf, not fiery red),
explicit framing ("head and shoulders fill the frame"), plum bg anchored as
"dark plum backdrop behind the figure", cool-neutral skin for warm-graded
identities, keep the locked style clause verbatim.

Screen (programmatic, no vision):
  - std(rgb) >= 20                (rejects flat fields)
  - non-bg fraction >= 12%        (rejects empty/figureless)
  - corner bg is plum/dark        (rejects blue/white backdrop drift)
  - warm face pixels >= 300 OR bright-centroid fallback for hooded figures
Retry up to 3 deterministic seeds; first passing seed wins.

Usage: python3 soren_portrait_batch2.py --all [--name k] [--force] [--max-retry 3]
"""
import argparse
import json
import os
import shutil
import sys
import time
import urllib.request

import numpy as np
from PIL import Image

REPO = "/home/min/dev/soren-jrpg"
OUT_ROOT = os.path.join(REPO, "design-spike", "portrait_batch")
OUTROOT2 = os.path.join(REPO, "design-spike", "portrait_batch_v2")
H = "http://127.0.0.1:8188"

STYLE = ("japanese fire emblem gba style official art, painterly shading with "
         "visible brush texture, dramatic chiaroscuro light, dark plum backdrop "
         "behind the figure")
BG = "head and shoulders fill the frame, plain dark plum backdrop, no text, no watermark"

# v2 identity clauses (hygiene applied). Facial-drama vocab tuned per age so
# young faces keep painterly drama (the elder template's operative ingredient).
IDENTS = {
    "elder":        "dramatic painted portrait of an elderly village elder, weathered angular face, stern noble expression, deep wrinkles, long silver-grey hair, full grey beard, brown hooded traveling cloak",
    "abbot":        "dramatic painted portrait of a bald abbot monk, grey beard, weathered calm face, deep wrinkles, kind heavy brow, fire-orange hooded robe",
    "warden":       "dramatic painted portrait of a mysterious hooded warden, dark plum hood shadowing the whole face except a pale determined chin, faint cold moonlit rim light tracing the hood edge, dark robe",
    "windreader":   "dramatic painted portrait of a windreader priest, short steel-grey hair, calm piercing storm-grey eyes, weathered lean face, water-blue robe with a white feather clasped at the collar",
    "chronicler":   "dramatic painted portrait of a chronicler scribe, short steel hair, round spectacles catching the light, sharp intelligent eyes, weathered lean face, deep red scholar robe",
    "high_scholar": "dramatic painted portrait of a high scholar, steel flat cap, grey beard, heavy-lidded discerning gaze, weathered angular face, long slate-grey robe with gold trim",
    "harbormaster": "dramatic painted portrait of a weathered harbormaster, brown seaman cap, steel-grey hair, full grey beard, salt-squint eyes, weathered tan face, dark teal seaman jacket",
    "dockhand":     "dramatic painted portrait of a young dock worker, worn brown cap, short brown hair, honest weathered face, sun-tanned skin, rope-scarred hands, slate-blue sleeveless shirt",
    "neve":         "dramatic painted portrait of a defiant young woman, auburn hair in a high ponytail, one crimson scarf at the neck, determined expression, large expressive grey eyes, cool fair skin, cream tunic",
    "quarry_chief": "dramatic painted portrait of a quarry chief, battered grey stone helmet pushed back, dust-grey stubble, patient stony expression, deep crow's feet, grey mining leathers",
    "shopkeeper":   "dramatic painted portrait of a friendly shopkeeper, short brown hair, round weathered cheeks, warm ready smile lit by soft hearth light, brown tunic with a brass-buckled apron",
    "innkeeper":    "dramatic painted portrait of a warm innkeeper, long honey-blonde hair, bright welcome in soft hearth light, cool shadows, gentle weathered face, slate-blue dress with a linen apron",
    "job_master":   "dramatic painted portrait of a guild job master, dark plum hair, old scar through one eyebrow, appraising expert gaze, weathered sharp face, leaf-green robe pushed off one shoulder",
    "townsfolk":    "dramatic painted portrait of an ordinary townsfolk, short brown hair, plain weathered honest face, mild curious gaze, warm skin in neutral light, stone-grey tunic",
    "villager":     "dramatic painted portrait of a simple villager, short brown hair, sun-tanned open face, shy smile, cool neutral daylight, moss-green tunic",
    "gareth":       "dramatic painted portrait of an older knight defeated by war, short copper-red hair, full red beard streaked grey, bitter hardened eyes, weathered angular face, old steel armor with a torn dark strap",
    "soren":        "dramatic painted portrait of a young mage warrior, dark tousled hair escaping a navy hood, steady quiet fire in large grey eyes, cool fair skin, navy traveling cloak with a blue pendant",
    "aria":         "dramatic painted portrait of a young monk woman, short black hair with a white headband, serene intense eyes, cool fair skin, rust-orange gi robe over one shoulder",
    "kael":         "dramatic painted portrait of a wiry young thief, scruffy brown hair, crooked cocky grin, quick darting hazel eyes, weathered tan skin, dark green hooded cloak",
    "aldric":       "dramatic painted portrait of a seasoned knight, grey-streaked hair under a scarred brow, haunted disciplined gaze, weathered angular face, worn silver plate armor, dark purple cape",
}


def seed_for(name, attempt):
    base = sum((i + 1) * ord(c) for i, c in enumerate(name))
    return (base * 31 + attempt * 7 + 11) % 90_000 + 600_000


def post(path, payload, timeout=120):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def gen(prompt, seed, steps=8, cfg=1.0):
    graph = {
        "1": {"class_type": "UNETLoader",
              "inputs": {"unet_name": "z_image_turbo_int8_convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader",
              "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}},
        "4": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["1", 0], "shift": 3.0}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": f"{prompt}, {STYLE}. {BG}", "clip": ["2", 0]}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["4", 0], "positive": ["5", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": steps, "cfg": cfg,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["8", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "soren_port_v2"}},
    }
    q = post("/prompt", {"prompt": graph, "client_id": "soren_port2"})["prompt_id"]
    t0 = time.time()
    while True:
        time.sleep(1.5)
        hist = json.load(urllib.request.urlopen(H + f"/history/{q}", timeout=30))
        if q in hist:
            st = hist[q]["status"]
            if st.get("completed"):
                for nid, no in hist[q]["outputs"].items():
                    for im in no.get("images", []):
                        src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im.get("filename", "")
                        if os.path.exists(src):
                            return src, time.time() - t0
                raise RuntimeError("completed, no image")
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st)[:1200])
        if time.time() - t0 > 600:
            raise TimeoutError("10min")


def screen(path):
    """Return (ok, reason, metrics). plum bg = hue family 9 (or dark neutral).
    non-bg is computed against corner seeds ONLY for BRIGHT corners; dark-bg
    portraits (hooded figures on plum) fall through to the face/warm check —
    a lit face inside a dark frame is fine art, not a flat field."""
    import colorsys
    img = Image.open(path).convert("RGB")
    a = np.asarray(img).astype(int)
    flat = a.reshape(-1, 3)
    std = flat.std(axis=0)
    m = dict(std=float(std.mean()))
    if m["std"] < 20:
        return False, "flat", m
    corners = np.array([a[8, 8], a[8, -8], a[-8, 8], a[-8, -8]])
    corner_v = [(c / 255).max() for c in corners]
    dark_bg = sum(1 for v in corner_v if v < 0.55)
    # corner bg check: dark or plum-ish (not bright blue / not white)
    corner_ok = 0
    for cy, cx in [(8, 8), (8, -8), (-8, 8), (-8, -8)]:
        r, g, b = a[cy, cx] / 255
        v = max(r, g, b)
        s = (max(r, g, b) - min(r, g, b)) / (max(r, g, b) + 1e-9)
        h6 = colorsys.rgb_to_hsv(r, g, b)[0] * 12
        if v < 0.55 or (0.30 < h6 < 0.85 and s > 0.15):  # dark or purple-family
            corner_ok += 1
    m["corners_ok"] = corner_ok
    if corner_ok < 3:
        return False, "bg-drift", m
    if dark_bg < 3:
        # bright bg: require real figure separation from it
        d = np.abs(flat[:, None, :] - corners[None, :, :]).sum(axis=2).min(axis=1)
        nonbg = (d > 90).mean()
        m["nonbg"] = float(nonbg)
        if nonbg < 0.12:
            return False, "no-figure", m
    # face pixels: warm band (lit skin); hooded dark portraits may fail this
    # — accept if a bright cluster (face/rim light) exists at all
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    warm = ((r > 150) & (r - b > 45) & (g > 90) & (g < r)).sum()
    bright = ((r > 190) & (g > 150) & (b > 110)).sum()
    m["warm"] = int(warm)
    m["bright"] = int(bright)
    if warm < 300 and bright < 3000:
        return False, "no-face", m
    return True, "ok", m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--max-retry", type=int, default=3)
    args = ap.parse_args()
    targets = sorted(IDENTS) if args.all else [args.name]
    if not targets or targets == [None]:
        sys.exit("pass --name <key> or --all")
    for name in targets:
        outdir = os.path.join(OUTROOT2, name)
        os.makedirs(outdir, exist_ok=True)
        done = os.path.join(outdir, "raw_512.png")
        if os.path.exists(done) and not args.force:
            print(f"[skip] {name}")
            continue
        won = False
        for attempt in range(args.max_retry):
            seed = seed_for(name, attempt)
            try:
                src, t = gen(IDENTS[name] + ", " + STYLE + ". " + BG, seed)
            except Exception as e:
                print(f"[FAIL] {name} a{attempt}: {e}")
                continue
            raw_dst = os.path.join(outdir, f"raw_a{attempt}.png")
            shutil.copy(src, raw_dst)
            ok, reason, m = screen(raw_dst)
            stamp = f"std={m['std']:.0f} nonbg={m.get('nonbg', float('nan')):.0%} corners={m.get('corners_ok','-')} warm={m.get('warm','-')}"
            if ok:
                shutil.copy(raw_dst, done)
                json.dump({"seed": seed, "attempt": attempt, **m},
                          open(os.path.join(outdir, "gen_info.json"), "w"))
                print(f"[gen ] {name}: {t:.0f}s a{attempt} seed={seed} {stamp} OK")
                won = True
                break
            print(f"[retry] {name} a{attempt} seed={seed}: {reason} ({stamp})")
        if not won:
            print(f"[GIVE-UP] {name}: no seed passed in {args.max_retry}")
    return 0


if __name__ == "__main__":
    sys.exit(main())