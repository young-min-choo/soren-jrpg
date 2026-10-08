#!/usr/bin/env python3
"""FE-style battle frames via img2img — BATCH (proof-of-pipeline).

Reference frames: real GBA FE rips (REFERENCE ONLY, never shipped). Each pose
type gets its own reference + denoise. Output → design-spike/fe_frames_v2/.
"""
import json, os, sys, time, urllib.request, shutil

H = "http://127.0.0.1:8188"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fe_frames_v2")
INP = "/mnt/ssd/ai-models/comfyui/input"

IDENT = {
    "soren": ("a young swordsman hero in a dark plum hooded cloak, deep purple hood "
              "with a small pale face peeking out, charcoal tunic, bright blue sash, "
              "steel sword drawn, brown boots"),
    "aria":  ("a young monk woman with short black hair and a white headband, "
              "wearing a rust-orange monk gi with a white sash, bare fists"),
    "kael":  ("a wiry young thief man with tousled dark-copper hair, wearing a dark "
              "teal vest over a cream shirt, short dagger drawn"),
}
NEG = ("blurry, lowres, 3d render, realistic, photo, watermark, text, grid, sheet, "
       "multiple figures, big head, deformed, chibi, close-up, large sprite")

# pose → (reference file, denoise). Reference copies must exist in INP.
POSES = {
    "stand":       ("fe_ref_eirika.png",      0.55),
    "windup":      ("fe_ref_windup.png",      0.55),
    "dash":        ("fe_ref_dash.png",        0.55),
    "swing":       ("fe_ref_contact.png",     0.55),
    "follow":      ("fe_ref_follow.png",      0.55),
    "return":      ("fe_ref_return.png",      0.50),
    "cast":        ("fe_ref_eirika.png",      0.58),   # placeholder ref until cast ref exists
}

# Frame layout per pose passed on CLI; prompt varies per pose type
POSE_PROMPT = {
    "stand":  ("calm ready stance, sword held low at his side",),
    "windup": ("coiled wind-up: body twisted back, blade drawn behind him, weight on back foot, glare fixed forward",),
    "dash":   ("full sprint dash forward, blade leading, cape whipping behind, extreme forward lean",),
    "swing":  ("the swing lands: blade sweeping in a level arc, intense motion smear on the blade tip, cape blown wide",),
    "follow": ("follow-through: body rotated past the swing, blade carried across, cape settling",),
    "return": ("relaxed return to stance, blade lowering to his side",),
    "cast":   ("spellcast: both arms raised mid-charge, arcane glow between hands, face lit from below",),
}
POSE_COOL = {
    "stand":  "",
    "windup": "tense, dramatic",
    "dash":   "intense, high speed, extreme motion",
    "swing":  "intense battle stance, dramatic cape and hood blown back by motion, sharp fierce glare, battle-worn",
    "follow": "intense, dynamic",
    "return": "",
    "cast":   "intense, dramatic wind, glowing",
}

def post_json(path, payload, timeout=300):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

def gen(char, pose, ref, dn, seed):
    cool = POSE_COOL.get(pose, "")
    body = POSE_PROMPT.get(pose, [pose])
    POS = (f"pixel art of a single small sprite: {IDENT[char]}. {body[0]}. {cool}. "
           "GBA fire emblem battle sprite. THE SPRITE IS TINY: about 36 pixels tall on "
           "a large empty canvas, centered, realistic proportions, dark #282828 single "
           "pixel outline, limited 16 color palette, solid green background, side view "
           "facing right")
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
              "sampler_name": "euler", "scheduler": "simple", "denoise": dn}},
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["7", 0]}},
        "11": {"class_type": "SaveImage", "inputs": {"images": ["10", 0],
               "filename_prefix": f"fe_{char}_{pose}"}},
    }
    pid = post_json("/prompt", {"prompt": graph, "client_id": f"fe_{char}_{pose}"})["prompt_id"]
    t0 = time.time()
    while time.time() - t0 < 260:
        time.sleep(3)
        hist = json.load(urllib.request.urlopen(f"{H}/history/{pid}", timeout=30))
        if pid in hist and hist[pid]["status"].get("completed"):
            for nid, no in hist[pid]["outputs"].items():
                for im in no.get("images", []):
                    src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im["filename"]
                    if os.path.exists(src):
                        d = os.path.join(OUT, char)
                        os.makedirs(d, exist_ok=True)
                        dst = os.path.join(d, f"{pose}.png")
                        shutil.copyfile(src, dst)
                        return dst
            raise RuntimeError("no image")
    raise TimeoutError(f"{char}/{pose}")

def main():
    chars = sys.argv[1:] or ["soren"]
    for char in chars:
        for pose, (ref, dn) in POSES.items():
            seed = abs(hash(f"{char}{pose}")) % 100000
            try:
                dst = gen(char, pose, ref, dn, seed)
                print(f"✓ {char}/{pose} → {dst}", flush=True)
            except Exception as e:
                print(f"✗ {char}/{pose}: {e}", flush=True)

if __name__ == "__main__":
    main()