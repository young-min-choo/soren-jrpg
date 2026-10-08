#!/usr/bin/env python3
"""14-frame CAST sequence via identity i2i (Eirika's real monkcast frames).

Cast arc (from the real 31-frame monk anim, sampled to 14):
  raise (staff/arms up) → charged push-out w/ wind → RELEASE swirl (spell
  leaves) → cape settle → recovery.
For any caster; the game's castGesture maps: charge → release (spell FX +
damage) → recover. Sheet: cells 95x72 (matches atk19 geometry).

Timing (verbatim from the 31-frame anim at 60fps; sampled 2:1):
  charge: 12 ticks, charge-loop: 10, release: 6, swirl: 6, settle 8, recover 8
"""
import json, os, sys, time, urllib.request, shutil

H = "http://127.0.0.1:8188"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_BASE = os.path.join(HERE, "..", "fe_frames_v2")
INP = "/mnt/ssd/ai-models/comfyui/input"

IDENT = {
    "soren": ("a young swordsman hero in a dark plum hooded cloak, deep purple hood "
              "with a small pale face peeking out, charcoal tunic, bright blue sash, brown boots"),
    "aria":  ("a young monk woman with short black hair and a white headband, wearing "
              "a rust-orange monk gi with a white sash"),
    "kael":  ("a wiry young thief man with tousled dark-copper hair, wearing a dark "
              "teal vest over a cream shirt"),
}
# 14 sampled cast frames from the real monk anim
CAST_REF = [0, 3, 6, 8, 10, 12, 14, 17, 19, 21, 24, 26, 28, 30]
POSE_NOTES = [
    "standing ready, arms relaxed",
    "arms starting to rise, gathering focus",
    "arms raised halfway, head bowed slightly",
    "arms fully raised, arcane orb forming between hands",
    "charged hold: orb blazing, robes and hair pushed by wind",
    "charged hold, head thrown back, wind intensifying",
    "shoving arms forward: the spell RELEASES, orb streaking to the target",
    "release follow-through: arms fully extended, cape whipped forward",
    "swirl: cape wraps around as the magic dissipates",
    "cape settling back down",
    "lowering arms, breathing out",
    "arms half-lowered, stance relaxing",
    "nearly recovered",
    "back to calm ready stance",
]

def post_json(path, payload, timeout=300):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

def gen_frame(char, n, seed):
    ref = f"cast_ref_{n:02d}.png"
    POS = (f"pixel art of a single small sprite: {IDENT[char]}. {POSE_NOTES[n]}. "
           "GBA fire emblem battle sprite. THE SPRITE IS TINY: about 36 pixels tall on "
           "a large empty canvas, centered, realistic proportions, dark #282828 single "
           "pixel outline, limited 16 color palette, solid green background, side view "
           "facing right")
    NEG = ("blurry, lowres, 3d render, realistic, photo, watermark, text, grid, sheet, "
           "multiple figures, big head, deformed, chibi, close-up, large sprite")
    graph = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux-2-klein-base-4b-fp8.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "flux2", "device": "default"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": POS, "clip": ["2", 0]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["2", 0]}},
        "5": {"class_type": "LoadImage", "inputs": {"image": ref}},
        "6": {"class_type": "ImageScale", "inputs": {"image": ["5", 0], "width": 512, "height": 512,
                                                      "upscale_method": "nearest-exact", "crop": "disabled"}},
        "7": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
        "8": {"class_type": "VAEEncode", "inputs": {"pixels": ["6", 0], "vae": ["7", 0]}},
        "9": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["3", 0], "negative": ["4", 0],
              "latent_image": ["8", 0], "seed": seed, "steps": 20, "cfg": 3.5,
              "sampler_name": "euler", "scheduler": "simple", "denoise": 0.55}},
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["7", 0]}},
        "11": {"class_type": "SaveImage", "inputs": {"images": ["10", 0],
               "filename_prefix": f"{char}_cast_{n:02d}"}},
    }
    pid = post_json("/prompt", {"prompt": graph, "client_id": f"{char}_cast{n}"})["prompt_id"]
    t0 = time.time()
    while time.time() - t0 < 260:
        time.sleep(3)
        hist = json.load(urllib.request.urlopen(f"{H}/history/{pid}", timeout=30))
        if pid in hist and hist[pid]["status"].get("completed"):
            for nid, no in hist[pid]["outputs"].items():
                for im in no.get("images", []):
                    src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im["filename"]
                    if os.path.exists(src):
                        dst = os.path.join(OUT_BASE, char, f"cast_{n:02d}.png")
                        shutil.copyfile(src, dst)
                        return dst
            raise RuntimeError("no image")
    raise TimeoutError(f"{char} cast_{n:02d}")

def main():
    chars = sys.argv[1:] or ["aria"]
    for char in chars:
        for n in range(14):
            dst = os.path.join(OUT_BASE, char, f"cast_{n:02d}.png")
            if os.path.exists(dst):
                print(f"✓ {char} cast_{n:02d} cached", flush=True)
                continue
            gen_frame(char, n, 7000 + n)
            print(f"✓ {char} cast_{n:02d}", flush=True)

if __name__ == "__main__":
    main()