#!/usr/bin/env python3
"""FE-proportioned battle ACTION frames — option A (Choo's art call).

GBA FE reverse-engineering (references/fe-battle-anim-reverse.md):
battle units are 32-34px tall / ~4 heads (NOT chibi), ≤16 colors, single
#282828 outline, smear frames at contact. Sören's 512px gen canvas gives us
128px-per-frame cells ≈ 4x the FE size — post-chain downscales to the
FÉ-native 32px-tall figures inside 16x24?? NO — battle frames here use a
32x32 window with a 34px-tall max figure, kept at NATIVE 2x (64px content in
a 40x56 box) matching the deployed 2x battle sprite scale.

Simpler, proven path: generate with the same pixel_4walk LoRA but a NEW frame
contract optimized for ACTION keyframes instead of walk cycles:
  4x4 grid, per row:
   row0: stand + wind-up + contact(smear) + follow-through   (RIGHT-facing)
   row1: stand + cast-charge + cast-release + cast-recover   (RIGHT-facing)
   row2: hit-reaction (flinch) + dodge-lean + crit-jump + crit-land
   row3: spares / back view
Frames consumed by a script table (see battle_script in src/game/).

Prompt = VERBATIM field identity + battle clause (proven by v2 sheets) +
"GBA Fire Emblem battle sprite style, 32px tall proportions, near-black
#282828 single outline, limited 16 color palette, smear frame at strike".

Output: design-spike/fe_frames/<name>/raw_512.png + frames_20x28.png strip
(4 cols of 20x28 content cells in 32px grid padding = 80x112 strip).
"""
import json, os, sys, time, urllib.request, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_BASE = os.path.join(HERE, "..", "fe_frames")
RAW_PREFIX = "soren_fe_frames"
H = "http://127.0.0.1:8188"

FE_STYLE = (
    "GBA Fire Emblem battle sprite style, character about 32 pixels tall with "
    "realistic small pixel art proportions, thin near-black single pixel outline #282828, "
    "limited 16 color palette, dramatic pixel smear arc at the sword contact frame, "
    "side view facing right"
)

ROW_CONTRACT = (
    "The spritesheet is a 4 by 4 grid. "
    "First row: 1 standing idle pose, 1 sword wind-up pose crouched back, "
    "1 sword slash contact pose with a bright motion smear arc, 1 follow-through pose. "
    "Second row: 1 standing pose, 1 spellcasting charge pose with both arms raised and glowing orb, "
    "1 spell release pose arms thrust forward, 1 recovery pose arms lowered. "
    "Third row: 1 hit flinch pose leaning back, 1 dodge lean pose, 1 jumping critical attack pose, 1 landing pose. "
    "Fourth row: 1 standing pose, 1 victory pose sword raised, 1 crouched guard pose, 1 lying defeated on floor."
)

# Field identities VERBATIM + battle clause
IDENTITIES = {
    "soren": (
        "a young swordsman hero in a dark plum hooded cloak, deep purple hood "
        "over his head with a small pale face peeking out from inside the hood, "
        "charcoal tunic under the cloak, bright blue sash across his chest, "
        "brown boots",
        "steel sword DRAWN and held in his right hand"),
    "aria": (
        "a young monk woman with short black hair and a white headband, "
        "wearing a rust-orange monk gi with a white sash",
        "glowing pale-blue arcane orb between her hands when casting; bare fists otherwise"),
    "kael": (
        "a wiry young thief man with tousled dark-copper hair, "
        "wearing a dark teal vest over a cream shirt",
        "a short dagger held ready in his right hand"),
}

def post(path, payload, timeout=240):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

def seed_for(name, salt):
    base = sum(ord(c) * (i + 1) for i, c in enumerate(name))
    return (77 + base + salt * 29) % 10_000_000

def gen_grid(prompt, seed, outdir, name):
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
              "inputs": {"text": f"A pixel art spritesheet of {prompt}. {FE_STYLE}. {ROW_CONTRACT}",
                         "clip": ["2", 0]}},
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
    os.makedirs(outdir, exist_ok=True)
    out = post("/prompt", {"prompt": graph, "client_id": f"fe_frames_{name}"})
    pid = out["prompt_id"]
    t0 = time.time()
    while True:
        time.sleep(2)
        hist = json.load(urllib.request.urlopen(f"{H}/history/{pid}", timeout=30))
        if pid in hist:
            st = hist[pid]["status"]
            if st.get("completed"):
                for nid, no in hist[pid]["outputs"].items():
                    for im in no.get("images", []):
                        src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im["filename"]
                        if os.path.exists(src):
                            dst = os.path.join(outdir, "raw_512.png")
                            shutil.copyfile(src, dst)
                            os.remove(src)
                            return dst, time.time() - t0
                raise RuntimeError(f"{name}: completed but no image path")
            if st.get("status_str") == "error":
                raise RuntimeError(f"{name}: {json.dumps(st)[:1500]}")
        if time.time() - t0 > 420:
            raise TimeoutError(f"{name}: gen timeout")

def main():
    which = sys.argv[1:] or list(IDENTITIES)
    for i, name in enumerate(which):
        ident, clause = IDENTITIES[name]
        prompt = f"{ident}, {clause}"
        outdir = os.path.join(OUT_BASE, name)
        if os.path.exists(os.path.join(outdir, "raw_512.png")):
            print(f"✓ {name} already generated")
            continue
        seed = seed_for(name, i)
        print(f"→ {name} seed={seed}", flush=True)
        raw, dt = gen_grid(prompt, seed, outdir, name)
        print(f"   {raw} ({dt:.0f}s)", flush=True)

if __name__ == "__main__":
    main()