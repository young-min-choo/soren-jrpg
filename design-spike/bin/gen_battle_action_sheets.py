#!/usr/bin/env python3
"""Battle ACTION sheets — extends the proven soren_batch pipeline.

The pixel_4walk LoRA produces a 4x4 grid (12 walk frames + 4 special poses:
arms-raised / jump-left / jump-right / lying-down per the row contract).
The special poses ARE action poses — row-0 col-3 ('both arms raised') is
exactly a spellcast raise, and the jump frames read as physical strikes.

This generator makes CHARACTER battle sheets reusing that geometry:
  rows 0-3 = same walk contract (12 walk + 4 special)
  → battle consumes: row0 col3 (arms raised) = CAST, row1 col3 (jump) = SLASH,
    plus the 3 walk frames of the facing row for idle/lunge motion.

Output: design-spike/battle_sheets/<name>/sheet_48x96.png (same as NPC)
        + BattleScene consumes via a battle-sheet manifest.
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_PREFIX = "soren_battle_action"

ROW_CONTRACT = (
    "The spritesheet is a 4 by 4 grid of four rows of frames - "
    "first row is 3 walking frames facing down and 1 frame both arms raised, "
    "second row is 3 walking frames facing left and 1 frame jumping left, "
    "third row is 3 walking frames facing right and 1 frame jumping right, "
    "fourth row is 3 walking frames back view facing up and 1 frame lying on floor."
)
STYLE = "A pixel art spritesheet of"

BATTLE_IDENTS = {
    # battle-view identities: weapon DRAWN and used in poses
    "soren_battle_sheet": "a young swordsman hero in a dark plum hooded cloak, deep purple hood over his head with a small pale face peeking out from inside the hood, charcoal tunic under the cloak, bright blue sash across his chest, DRAWN STEEL SWORD held in his right hand, brown boots",
    "aria_battle_sheet":  "a young monk woman with short black hair, wearing a rust-orange monk gi with a white sash, bare hands held open, calm stance",
    "kael_battle_sheet":  "a nimble young thief man with tousled dark-copper hair, wearing a dark teal vest over a cream shirt, a short dagger held in his right hand",
}

H = "http://127.0.0.1:8188"

def post(path, payload, timeout=120):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

def seed_for(name, i=0):
    base = sum((i + 1) * ord(c) for c in name)
    return (42 + base + i * 7) % 10_000_000

def gen_one(name, prompt, seed):
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
    q = post("/prompt", {"prompt": graph, "client_id": f"battle_{name}"})["prompt_id"]
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
                raise RuntimeError(f"{name}: {json.dumps(st)[:1500]}")
        if time.time() - t0 > 900:
            raise TimeoutError(f"{name}: timeout")

def main():
    outroot = os.path.join(HERE, "..", "battle_sheets")
    os.makedirs(outroot, exist_ok=True)
    only = sys.argv[1:] or sorted(BATTLE_IDENTS)
    for name in only:
        prompt = BATTLE_IDENTS.get(name)
        if not prompt:
            print(f"skip {name} (not in BATTLE_IDENTS)"); continue
        outdir = os.path.join(outroot, name)
        os.makedirs(outdir, exist_ok=True)
        raw_dst = os.path.join(outdir, "raw_512.png")
        if os.path.exists(raw_dst):
            print(f"{name}: raw exists, skip"); continue
        seed = seed_for(name)
        try:
            src, took = gen_one(name, prompt, seed)
            import shutil
            shutil.copy(src, raw_dst)
            print(f"{name}: OK seed {seed} {took:.0f}s")
        except Exception as e:
            print(f"{name}: FAIL {e}")
        time.sleep(2)

if __name__ == "__main__":
    main()