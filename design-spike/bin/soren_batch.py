#!/usr/bin/env python3
"""Soren NPC walk-sheet batch generator (Phase A, 2026-10-07).

Productized from the pilot (plans/2026-10-07_soren-pixel-art-pipeline):
klein-base-4B fp8 + svntax pixel_4walk LoRA -> 512x512 4x4 sheet -> post-chain
(soren_post.py) -> 48x96 palette-locked walk sheet + metrics.json.

Usage:
  python3 soren_batch.py --name innkeeper --prompt "..." [--seed N]           # one
  python3 soren_batch.py --all                                               # whole NPC_IDENTS queue
  python3 soren_batch.py --name innkeeper --force                            # regen even if exists

Results land in design-spike/npc_sheets/<name>/ (raw_512.png, sheet_48x96.png,
metrics.json). Gates run at the END over everything (art_gates.run_gates_v3-style
checks via soren_batch_verify.py); review x8 renders before wiring into the game.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request

REPO = "/home/min/dev/soren-jrpg"
OUT_ROOT = os.path.join(REPO, "design-spike", "npc_sheets")
H = "http://127.0.0.1:8188"
RAW_PREFIX = "soren_npc_raw"

# Shared prompt scaffold: the LoRA's row contract is FIXED (pilot-verified).
# Only the character clause varies per identity.
ROW_CONTRACT = (
    "The spritesheet is a 4 by 4 grid of four rows of frames - "
    "first row is 3 walking frames facing down and 1 frame both arms raised, "
    "second row is 3 walking frames facing left and 1 frame jumping left, "
    "third row is 3 walking frames facing right and 1 frame jumping right, "
    "fourth row is 3 walking frames back view facing up and 1 frame lying on floor."
)
STYLE = "A pixel art spritesheet of"

# One entry per NPC manifest key. Descriptions come from
# design-spike/build_npc_sprites_v2.py SPECS (the v2 hero-language identities:
# hair shape/color, outfit color, robe/hood/helmet, accent) so the generated
# sheets stay consistent with the shipped static sprites and portraits.
NPC_IDENTS = {
    "elder":        "an elderly village elder with long steel-grey hair and a full grey beard, wearing a long brown hooded robe",
    "job_master":   "a job master guild officer with short dark plum hair, wearing a long leaf-green hooded robe",
    "shopkeeper":   "a friendly shopkeeper with short brown hair, wearing a brown tunic with a gold apron",
    "innkeeper":    "a cheerful innkeeper with long golden-blonde hair, wearing a water-blue tunic with a blue apron",
    "townsfolk":    "an ordinary townsfolk with short brown hair wearing a plain stone-grey tunic",
    "dockhand":     "a dock worker wearing a brown cap, short brown hair, wearing a water-blue sleeveless shirt",
    "harbormaster": "a weathered harbormaster wearing a brown cap, grey steel hair, full beard, wearing a water-blue jacket",
    "neve":         "a young woman with red hair in a high ponytail, wearing a red tunic with a bright red scarf",
    "quarry_chief": "a quarry chief wearing an old stone-grey helmet and grey stone-grey mining clothes",
    "warden":       "a mysterious warden with a dark plum hood covering most of the face, wearing a long dark plum robe",
    "windreader":   "a windreader priest with short steel-grey hair, wearing a long water-blue robe with a white feather accent",
    "chronicler":   "a chronicler scribe with short steel-grey hair and round glasses, wearing a long red robe",
    "abbot":        "a bald abbot monk with a grey beard, wearing a long fire-orange hooded robe",
    "high_scholar": "a high scholar wearing a steel flat cap, grey beard, long steel robe with gold trim",
    "villager":     "a simple villager with short brown hair wearing a leaf-green tunic",
    "gareth":       "an older knight named Gareth with short red hair, full red beard, wearing steel armour",
    "soren_hero":   "a young swordsman hero in a dark plum hooded cloak, deep purple hood over his head with a small pale face peeking out from inside the hood, charcoal tunic under the cloak, bright blue sash across his chest, steel sword scabbard on his hip, brown boots",
}

# Seed stickied from the pilot (seed 42 proved grid geometry). Batch spread:
# deterministic per-name so regens are reproducible; keep base in range 1000..
def seed_for(name, i=0):
    base = sum((i + 1) * ord(c) for c in name)  # deterministic per identity
    return (42 + base + i * 7) % 10_000_000


def post(path, payload, timeout=120):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def gen_one(name, prompt, seed):
    """POST the Bench A graph for one identity, return raw 512 sheet path."""
    # Exact pilot graph: klein fp8 + qwen CLIP (flux2) + pixel_4walk LoRA @1.0,
    # ModelSamplingFlux 1.15/0.5, 20 steps cfg 3.5 euler/simple.
    graph = {
        "1": {"class_type": "UNETLoader",
              "inputs": {"unet_name": "flux-2-klein-base-4b-fp8.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader",
              "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "flux2", "device": "default"}},
        "3": {"class_type": "LoraLoaderModelOnly",
              "inputs": {"model": ["1", 0],
                         "lora_name": "pixel_4walk_small_flux2_klein_base_4b_v1.safetensors",
                         "strength_model": 1.0}},
        "4": {"class_type": "ModelSamplingFlux",
              "inputs": {"model": ["3", 0], "max_shift": 1.15, "base_shift": 0.5,
                         "width": 512, "height": 512}},
        "5": {"class_type": "CLIPTextEncode",
              "inputs": {"text": f"{STYLE} {prompt}. {ROW_CONTRACT}", "clip": ["2", 0]}},
        "6": {"class_type": "EmptySD3LatentImage",
              "inputs": {"width": 512, "height": 512, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["4", 0], "positive": ["5", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": 20, "cfg": 3.5,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["8", 0]}},
        "10": {"class_type": "SaveImage",
               "inputs": {"images": ["9", 0], "filename_prefix": RAW_PREFIX}},
    }
    t0 = time.time()
    q = post("/prompt", {"prompt": graph, "client_id": f"soren_batch_{name}"})["prompt_id"]
    while True:
        time.sleep(2)
        hist = json.load(urllib.request.urlopen(H + f"/history/{q}", timeout=30))
        if q in hist:
            st = hist[q]["status"]
            if st.get("completed"):
                for nid, no in hist[q]["outputs"].items():
                    for im in no.get("images", []):
                        src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im.get("filename", "")
                        if os.path.exists(src):
                            return src, time.time() - t0
                raise RuntimeError(f"{name}: completed but no image path")
            if st.get("status_str") == "error":
                raise RuntimeError(f"{name}: {json.dumps(st)[:2000]}")
        if time.time() - t0 > 900:
            raise TimeoutError(f"{name}: 15min timeout")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name")
    ap.add_argument("--prompt")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    targets = []
    if args.all:
        targets = sorted(NPC_IDENTS)
    elif args.name:
        targets = [args.name]
        if args.name not in NPC_IDENTS:
            sys.exit(f"unknown identity '{args.name}'. known: {', '.join(sorted(NPC_IDENTS))}")
    else:
        sys.exit("pass --name <key> or --all")

    # Queue idempotency: skip already-POSTed identities so a re-run doesn't
    # double-generate (ComfyUI is also busy-serial, so this protects reruns).
    queue = []
    for name in targets:
        prompt = args.prompt or NPC_IDENTS[name]
        outdir = os.path.join(OUT_ROOT, name)
        sheet = os.path.join(outdir, "sheet_48x96.png")
        if os.path.exists(sheet) and not args.force:
            print(f"[skip] {name}: sheet exists (use --force to regen)")
            continue
        if not args.prompt and name not in NPC_IDENTS:
            sys.exit(f"{name}: no built-in prompt and --prompt not given")
        queue.append((name, prompt))

    if not queue:
        print("nothing to do")
        return 0

    for name, prompt in queue:
        outdir = os.path.join(OUT_ROOT, name)
        os.makedirs(outdir, exist_ok=True)
        seed = args.seed if args.seed is not None else seed_for(name)
        try:
            raw, t = gen_one(name, prompt, seed)
        except Exception as e:
            print(f"[FAIL] {name}: {e}")
            continue
        raw_dst = os.path.join(outdir, "raw_512.png")
        shutil.copy(raw, raw_dst)
        print(f"[gen ] {name}: {t:.0f}s seed={seed}")
        # Post-chain per identity (0.4s, proven recipe from pilot).
        # The 3.14 toolchain python lacks numpy — use the venv python that runs
        # the design-spike tooling (verified: numpy+PIL present).
        post_py = "/home/min/.hermes/installs/2f3145438c638618/environments/be64c352882443c18a79fe68c2476c4e/venv/bin/python"
        post_script = os.path.join(os.path.dirname(__file__), "soren_post.py")
        r = subprocess.run([post_py, post_script, "--raw", raw_dst, "--outdir", outdir],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print(f"[post-FAIL] {name}: {r.stdout[-600:]} {r.stderr[-600:]}")
            continue
        try:
            m = json.load(open(os.path.join(outdir, "metrics.json")))
            print(f"[post] {name}: frames {m['frames_nonempty']} grounded {m['grounded']} "
                  f"min_diff {m['min_diff']:.1%} colors {m['unique_colors_total']}")
        except Exception as e:
            print(f"[warn] {name}: metrics unreadable {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())