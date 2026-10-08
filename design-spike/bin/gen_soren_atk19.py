#!/usr/bin/env python3
"""19-frame Soren ATTACK — 1:1 from Eirika's real attack sequence (fe refs).

Choo round-5: 2-6 frames reads as before/after; FE has ~19 frames per attack.
This maps EVERY Eirika attack frame through the identity-transfer i2i chain and
packs a 19-cell strip + the REAL script timing (from the actual game script
fe-battle-animations.neocities.org/eirika.html, mode 1).

Timing table (60fps ticks → ms), verbatim FE pacing:
  script = [[frameIdx, ticks], ...]
  [0,1],[1,4],[2,2],[3,2],[4,10],[5,4],[6,4],[7,5]  → hit frame (idx 8) fired
  [[8,2],[9,3],[10,3],[11,3],[12,2],[13,2],[14,2],[15,2],[16,2],[17,2],[18,2],[0,1]]
Total ≈ 0.72s in + 0.6s return-to-stand ≈ FE attack length.

Ref frames: /tmp/fe_atk_00..18.png (extracted from eirikattack.gif, game rip —
REFERENCE ONLY). Output: fe_frames_v2/soren/atk_XX.png raws → 19-cell strip.
"""
import json, os, sys, time, urllib.request, shutil

H = "http://127.0.0.1:8188"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fe_frames_v2", "soren")
INP = "/mnt/ssd/ai-models/comfyui/input"

IDENT = ("a young swordsman hero in a dark plum hooded cloak, deep purple hood "
         "with a small pale face peeking out, charcoal tunic, bright blue sash, "
         "steel sword drawn, brown boots")

# per-frame pose note (matches what each Eirika frame shows)
POSE_NOTES = {
    0:  "calm ready stance, sword held low",
    1:  "settling further into stance, shoulders square, glare forward",
    2:  "coiling back: weight shifts to back foot, blade angling up behind",
    3:  "deep wind-up: body twisted sideways, blade fully drawn back",
    4:  "held wind-up (the dramatic pause before the strike)",
    5:  "uncoiling: hips rotating forward, blade starting to rise over",
    6:  "blade sweeping overhead toward the target, cape lifting",
    7:  "full extension beginning: arms driving the blade forward and down",
    8:  "CONTACT: blade cleaving down through the target, extreme motion, smear on the blade tip, cape blown wide",
    9:  "blade carried through and down, passing the hit point",
    10: "follow-through: body rotated past the swing, blade low across",
    11: "recovering: drawing the blade back up from the follow-through",
    12: "recovery stance, blade returning to guard",
    13: "stepping back toward home, guard regaining",
    14: "walking back, blade lowered but ready",
    15: "walking back, relaxed",
    16: "returning: soft stance",
    17: "settling into the ready stance",
    18: "almost at rest, one last settle",
}

def post_json(path, payload, timeout=300):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

def gen_frame(idx, seed):
    ref = f"fe_ref_atk_{idx:02d}.png"
    POS = (f"pixel art of a single small sprite: {IDENT}. {POSE_NOTES[idx]}. "
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
               "filename_prefix": f"soren_atk_{idx:02d}"}},
    }
    pid = post_json("/prompt", {"prompt": graph, "client_id": f"soren_atk{idx}"})["prompt_id"]
    t0 = time.time()
    while time.time() - t0 < 260:
        time.sleep(3)
        hist = json.load(urllib.request.urlopen(f"{H}/history/{pid}", timeout=30))
        if pid in hist and hist[pid]["status"].get("completed"):
            for nid, no in hist[pid]["outputs"].items():
                for im in no.get("images", []):
                    src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im["filename"]
                    if os.path.exists(src):
                        dst = os.path.join(OUT, f"atk_{idx:02d}.png")
                        shutil.copyfile(src, dst)
                        return dst
            raise RuntimeError("no image")
    raise TimeoutError(f"atk_{idx:02d}")

def main():
    os.makedirs(OUT, exist_ok=True)
    # copy refs into comfy input
    for i in range(19):
        shutil.copyfile(f"/tmp/fe_atk_{i:02d}.png", os.path.join(INP, f"fe_ref_atk_{i:02d}.png"))
    todo = [int(x) for x in sys.argv[1:]] or list(range(19))
    for i in todo:
        if os.path.exists(os.path.join(OUT, f"atk_{i:02d}.png")):
            print(f"✓ atk_{i:02d} cached", flush=True)
            continue
        dst = gen_frame(i, 9000 + i)
        print(f"✓ {dst} ({i})", flush=True)

if __name__ == "__main__":
    main()