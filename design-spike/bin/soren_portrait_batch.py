#!/usr/bin/env python3
"""Soren portrait batch — Phase C slice 1 (approved plan C, 2026-10-07).

AI-painted FE-GBA-style busts → 64×64 pixel-fold (snap + palette) → gates.
Style clause is LOCKED VERBATIM across all identities (elder_v2 spike proved
it; neve test showed drift when reworded). Per-identity prompt = identity clause
+ locked STYLE + fixed background clause. Seeds deterministic per name
(same scheme as soren_batch.seed_for, offset by +500_000 to never collide).

Usage:
  python3 soren_portrait_batch.py --all
  python3 soren_portrait_batch.py --name neve --seed 123456   # regen one
Output: design-spike/portrait_batch/<name>/raw_512.png (+ _fold64.png in post)
"""
import argparse
import json
import os
import shutil
import sys
import time
import urllib.request

REPO = "/home/min/dev/soren-jrpg"
OUT_ROOT = os.path.join(REPO, "design-spike", "portrait_batch")
H = "http://127.0.0.1:8188"

# ── LOCKED STYLE CLAUSE (do not reword — consistency spine) ─────────────
# Taken verbatim from the verified elder_v2 spike (painterly FE-GBA read,
# survived 64px fold). "japanese fire emblem gba style official art" is the
# style anchor; "painterly shading, strong rim light" the rendering anchor.
STYLE = ("japanese fire emblem gba style official art, painterly shading, "
         "strong rim light, dark plum background")
BG = "plain dark plum background, single figure, no text, no watermark"

# Identity clauses. NPCs match the walk-sheet identity language (NPC_IDENTS in
# soren_batch.py) and the deployed portrait story. Party matches battle-sprite
# identities (gen_battle_sprites.py): aria = black-haired monk rust-orange gi +
# white headband; kael = wiry thief brown hair + dark-green cloak; aldric =
# seasoned knight silver armor + dark purple cape; soren = navy cloak + blue
# sash + wooden scabbard (build_walk_sheet_v6 pixel map).
IDENTS = {
    # ── towns/npc roster (16) ──
    "elder":        "dramatic painted portrait bust of an elderly village elder, weathered angular face, stern noble expression, deep wrinkles, long silver-grey hair, full grey beard, brown hooded traveling cloak",
    "abbot":        "dramatic painted portrait bust of a bald abbot monk, grey beard, weathered calm face, deep wrinkles, fire-orange hooded robe",
    "warden":       "dramatic painted portrait bust of a mysterious warden, dark plum hood covering most of the face, shadowed eyes glinting beneath the hood, dark robe",
    "windreader":   "dramatic painted portrait bust of a windreader priest, short steel-grey hair, calm intense eyes, water-blue robe with white feather accent at the collar",
    "chronicler":   "dramatic painted portrait bust of a chronicler scribe, short steel-grey hair, round spectacles, sharp intelligent eyes, red robe",
    "high_scholar": "dramatic painted portrait bust of a high scholar, steel flat cap, grey beard, heavy-lidded discerning eyes, long steel-grey robe with gold trim",
    "harbormaster": "dramatic painted portrait bust of a weathered harbormaster, brown seaman cap, grey hair, full grey beard, squinting sea-worn eyes, water-blue jacket",
    "dockhand":     "dramatic painted portrait bust of a young dock worker, brown cap, short brown hair, honest open face, rope-scarred hands lowered from frame, water-blue sleeveless shirt",
    "neve":         "dramatic painted portrait bust of a fiery young woman, red hair in a high ponytail, bright red scarf around neck, defiant confident expression, large expressive eyes, red tunic",
    "quarry_chief": "dramatic painted portrait bust of a quarry chief, battered stone-grey helmet, grey dust in short beard, solid patient expression, stone-grey mining clothes",
    "shopkeeper":   "dramatic painted portrait bust of a friendly shopkeeper, short brown hair, round cheeks, warm ready smile, brown tunic with a gold apron",
    "innkeeper":    "dramatic painted portrait bust of a cheerful innkeeper, long golden-blonde hair, bright welcome, water-blue tunic with a blue apron",
    "job_master":   "dramatic painted portrait bust of a guild job master, short dark plum hair, scarred eyebrow, appraising expert gaze, leaf-green hooded robe pushed back at the shoulders",
    "townsfolk":    "dramatic painted portrait bust of an ordinary townsfolk, short brown hair, plain honest face, mild curiosity, stone-grey tunic",
    "villager":     "dramatic painted portrait bust of a simple villager, short brown hair, sun-tanned open face, shy smile, leaf-green tunic",
    "gareth":       "dramatic painted portrait bust of an older knight defeated by war, short red hair, full red beard streaked grey, bitter hardened eyes, old steel armor with a torn dark strap",
    # ── party (4) ──
    "soren":        "dramatic painted portrait bust of a young mage warrior hero, dark navy hood down showing dark tousled hair, blue pendant sash, determined quiet fire in the eyes, navy traveling cloak",
    "aria":         "dramatic painted portrait bust of a young monk woman, short black hair with white headband, serene focused eyes, rust-orange gi robe over the shoulders",
    "kael":         "dramatic painted portrait bust of a wiry young thief, scruffy brown hair, crooked cocky grin, quick darting eyes, dark green hooded cloak",
    "aldric":       "dramatic painted portrait bust of a seasoned knight, grey-streaked hair under a scarred brow, haunted disciplined gaze, worn silver armor, dark purple cape",
}


def seed_for(name):
    base = sum((i + 1) * ord(c) for i, c in enumerate(name))
    return (42 + base) % 100_000 + 500_000


def post(path, payload, timeout=120):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def gen(name, prompt, seed, outdir, steps=8, cfg=1.0):
    graph = {
        "1": {"class_type": "UNETLoader",
              "inputs": {"unet_name": "z_image_turbo_int8_convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader",
              "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}},
        "4": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["1", 0], "shift": 3.0}},
        "5": {"class_type": "CLIPTextEncode",
              "inputs": {"text": f"{prompt}, {STYLE}. {BG}", "clip": ["2", 0]}},
        "6": {"class_type": "EmptySD3LatentImage",
              "inputs": {"width": 512, "height": 512, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["4", 0], "positive": ["5", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": steps, "cfg": cfg,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["8", 0]}},
        "10": {"class_type": "SaveImage",
               "inputs": {"images": ["9", 0], "filename_prefix": "soren_portrait"}},
    }
    t0 = time.time()
    q = post("/prompt", {"prompt": graph, "client_id": f"soren_port_{name}"})["prompt_id"]
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
                            os.makedirs(outdir, exist_ok=True)
                            shutil.copy(src, os.path.join(outdir, "raw_512.png"))
                            return time.time() - t0
                raise RuntimeError(f"{name}: completed but no image")
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st)[:1500])
        if time.time() - t0 > 600:
            raise TimeoutError(f"{name}: 10min")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    if args.all:
        targets = sorted(IDENTS)
    elif args.name:
        if args.name not in IDENTS:
            sys.exit(f"unknown identity '{args.name}'. known: {', '.join(sorted(IDENTS))}")
        targets = [args.name]
    else:
        sys.exit("pass --name <key> or --all")

    for name in targets:
        outdir = os.path.join(OUT_ROOT, name)
        if os.path.exists(os.path.join(outdir, "raw_512.png")) and not args.force:
            print(f"[skip] {name} (exists; --force to regen)")
            continue
        seed = args.seed if args.seed is not None else seed_for(name)
        try:
            t = gen(name, IDENTS[name], seed, outdir)
            print(f"[gen] {name}: {t:.0f}s seed={seed}")
        except Exception as e:
            print(f"[FAIL] {name}: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())