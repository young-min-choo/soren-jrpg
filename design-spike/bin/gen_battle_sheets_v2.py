#!/usr/bin/env python3
"""Battle sheets v2 — FIELD-CONSISTENT identities.

Choo's art call (playtest round 3): KEEP the battle-sprite design style
(animated chibi action sheets, 16x24 grid frames) but make the BATTLE
identity match the FIELD identity — the NPC-pipeline look Soren's field
sheet already has. FE model: one character identity, two renderings
(field = 48x96 walk sheet, battle = same identity, bigger + weapons).

Change vs v1: identity prompts are taken VERBATIM from the field/NPC
identity list (soren_batch.py NPC_IDENTS entries + story canon), with a
short battle clause appended (weapon drawn / fists ready). No more
hand-invented battle descriptions.

Output: design-spike/battle_sheets_v2/<name>/raw_512.png + sheet_48x96.png
Deploy target after verification: public/sprites/battle/sheets/<key>.png
"""
import json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_PREFIX = "soren_battle_action_v2"
OUT = os.path.join(HERE, "..", "battle_sheets_v2")

ROW_CONTRACT = (
    "The spritesheet is a 4 by 4 grid of four rows of frames - "
    "first row is 3 walking frames facing down and 1 frame both arms raised, "
    "second row is 3 walking frames facing left and 1 frame jumping left, "
    "third row is 3 walking frames facing right and 1 frame jumping right, "
    "fourth row is 3 walking frames back view facing up and 1 frame lying on floor."
)
STYLE = "A pixel art spritesheet of"

# Field-identity prompts VERBATIM (same words as their field/portrait canon),
# plus a battle-only clause. Soren = NPC_IDENTS['soren_hero'] exactly.
FIELD_IDENTITIES = {
    "soren_battle": (
        "a young swordsman hero in a dark plum hooded cloak, deep purple hood "
        "over his head with a small pale face peeking out from inside the hood, "
        "charcoal tunic under the cloak, bright blue sash across his chest, "
        "steel sword scabbard on his hip, brown boots",
        "steel sword DRAWN in his right hand"  # battle clause replaces scabbard-only
    ),
    "aria_battle": (
        "a young monk woman with short black hair and a white headband, "
        "wearing a rust-orange monk gi with a white sash",
        "bare fists raised in a fighting stance"
    ),
    "kael_battle": (
        "a wiry young thief man with tousled dark-copper hair, "
        "wearing a dark teal vest over a cream shirt",
        "a short dagger held ready in his right hand"
    ),
}

H = "http://127.0.0.1:8188"

def post(path, payload, timeout=180):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

def seed_for(name, salt):
    base = sum(ord(c) * (i + 1) for i, c in enumerate(name))
    return (42 + base + salt * 13) % 10_000_000

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
    os.makedirs(OUT, exist_ok=True)
    out = post("/prompt", {"prompt": graph})
    pid = out["prompt_id"]
    for _ in range(150):
        time.sleep(2)
        try:
            hist = post(f"/history/{pid}", {}, timeout=15)
        except Exception:
            continue
        if hist.get(pid):
            imgs = [o for o in hist[pid]["outputs"].values() if "images" in o]
            if imgs:
                finfo = imgs[0]["images"][0]
                src = os.path.join(HERE, "..", "output", finfo["subfolder"], finfo["filename"])
                dst = os.path.join(OUT, name)
                os.makedirs(dst, exist_ok=True)
                raw_path = os.path.join(dst, "raw_512.png")
                os.replace(src, raw_path)
                return raw_path, time.time() - t0
    raise RuntimeError(f"{name}: generation timed out")

def main():
    which = sys.argv[1:] or list(FIELD_IDENTITIES)
    for i, name in enumerate(which):
        ident, clause = FIELD_IDENTITIES[name]
        prompt = f"{ident}, {clause}"
        seed = seed_for(name, i)
        print(f"→ {name} seed={seed} ({len(prompt)}ch)", flush=True)
        raw, dt = gen_one(name, prompt, seed)
        print(f"   raw {raw} ({dt:.0f}s)", flush=True)

if __name__ == "__main__":
    main()