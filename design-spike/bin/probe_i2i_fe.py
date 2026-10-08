#!/usr/bin/env python3
"""FE-style via img2img on REAL GBA FE frames — flux2-klein img2img.

Reference: Eirika standing frame (game rip, REFERENCE ONLY — never shipped).
Approach: resize ref to 512 → klein img2img (denoise tuned) with Soren identity
prompt → the STRUCTURE (proportions, pose, outline discipline) comes from the
reference; the identity (palette/character) from the prompt.
Probe first at denoise 0.55 / 0.7 to find the identity-transfer sweet spot.
"""
import json, os, sys, time, urllib.request, shutil, base64

H = "http://127.0.0.1:8188"
REF = "/tmp/fe_ref_eirika.png"
OUTDIR = "/tmp/fe_i2i"

def post_json(path, payload, timeout=300):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def run(graph, outname):
    pid = post_json("/prompt", {"prompt": graph, "client_id": "fe_i2i"})["prompt_id"]
    t0 = time.time()
    while True:
        time.sleep(3)
        hist = json.load(urllib.request.urlopen(f"{H}/history/{pid}", timeout=30))
        if pid in hist and hist[pid]["status"].get("completed"):
            for nid, no in hist[pid]["outputs"].items():
                for im in no.get("images", []):
                    src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im["filename"]
                    if os.path.exists(src):
                        dst = os.path.join(OUTDIR, outname)
                        os.makedirs(OUTDIR, exist_ok=True)
                        shutil.copyfile(src, dst)
                        return dst, time.time() - t0
            raise RuntimeError("no image")
        if time.time() - t0 > 420:
            raise TimeoutError(outname)

def main():
    # Preload ref image into ComfyUI input dir (LoadImage reads from there)
    inp = "/mnt/ssd/ai-models/comfyui/input"
    os.makedirs(inp, exist_ok=True)
    shutil.copyfile(REF, os.path.join(inp, "fe_ref_eirika.png"))

    POS = ("a pixel art sprite of a young swordsman hero in a dark plum hooded cloak, "
           "deep purple hood with a small pale face peeking out, charcoal tunic, "
           "bright blue sash, steel sword drawn, brown boots, GBA fire emblem battle "
           "sprite, 32 pixels tall realistic proportions, dark #282828 single outline, "
           "limited 16 color palette, solid green background, side view facing right")
    NEG = ("blurry, lowres, jpeg artifacts, 3d render, realistic, photo, watermark, "
           "text, multiple views, grid, big head, deformed, extra limbs, chibi")

    for dn in [0.5, 0.65, 0.8]:
        graph = {
            "1": {"class_type": "UNETLoader",
                  "inputs": {"unet_name": "flux-2-klein-base-4b-fp8.safetensors", "weight_dtype": "default"}},
            "2": {"class_type": "CLIPLoader",
                  "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "flux2", "device": "default"}},
            "3": {"class_type": "CLIPTextEncode", "inputs": {"text": POS, "clip": ["2", 0]}},
            "4": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["2", 0]}},
            "5": {"class_type": "LoadImage", "inputs": {"image": "fe_ref_eirika.png"}},
            "6": {"class_type": "ImageScale", "inputs": {"image": ["5", 0], "width": 512, "height": 512,
                                                          "upscale_method": "nearest-exact", "crop": "disabled"}},
            "7": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
            "8": {"class_type": "VAEEncode", "inputs": {"pixels": ["6", 0], "vae": ["7", 0]}},
            "9": {"class_type": "KSampler",
                  "inputs": {"model": ["1", 0], "positive": ["3", 0], "negative": ["4", 0],
                             "latent_image": ["8", 0], "seed": 9000 + int(dn * 100), "steps": 20, "cfg": 3.5,
                             "sampler_name": "euler", "scheduler": "simple", "denoise": dn}},
            "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["7", 0]}},
            "11": {"class_type": "SaveImage",
                   "inputs": {"images": ["10", 0], "filename_prefix": f"fe_i2i_d{int(dn*100)}"}},
        }
        dst, dt = run(graph, f"i2i_d{int(dn*100)}.png")
        print(f"denoise {dn}: {dst} ({dt:.0f}s)")

if __name__ == "__main__":
    main()