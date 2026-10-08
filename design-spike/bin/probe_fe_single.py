#!/usr/bin/env python3
"""Probe: can flux2-klein (NO pixel_4walk LoRA) make ONE FE-style action frame?
Single-image test — FE proportions + palette + outline, single pose, no grid."""
import json, os, time, urllib.request, shutil, sys

H = "http://127.0.0.1:8188"
IDENT = ("a young swordsman hero in a dark plum hooded cloak, deep purple hood "
         "over his head with a small pale face peeking out, charcoal tunic, "
         "bright blue sash, steel sword drawn held in his right hand")
STYLE = ("single pixel art sprite, GBA Fire Emblem battle frame, character 32 pixels tall "
         "realistic adult proportions, three-quarter side view facing right, mid sword-swing "
         "with bright motion smear arc, near-black #282828 single pixel outline, "
         "limited 16 color palette, solid midtone background")

def post(path, payload, timeout=240):
    req = urllib.request.Request(H + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))

graph = {
    "1": {"class_type": "UNETLoader",
          "inputs": {"unet_name": "flux-2-klein-base-4b-fp8.safetensors", "weight_dtype": "default"}},
    "2": {"class_type": "CLIPLoader",
          "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "flux2", "device": "default"}},
    "3": {"class_type": "CLIPTextEncode",
          "inputs": {"text": f"{IDENT}. {STYLE}", "clip": ["2", 0]}},
    "4": {"class_type": "EmptySD3LatentImage",
          "inputs": {"width": 512, "height": 512, "batch_size": 1}},
    "5": {"class_type": "KSampler",
          "inputs": {"model": ["1", 0], "positive": ["3", 0], "negative": ["3", 0],
                     "latent_image": ["4", 0], "seed": 4242, "steps": 20, "cfg": 3.5,
                     "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
    "6": {"class_type": "VAELoader", "inputs": {"vae_name": "flux2-vae.safetensors"}},
    "7": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["6", 0]}},
    "8": {"class_type": "SaveImage",
          "inputs": {"images": ["7", 0], "filename_prefix": "fe_probe_single"}},
}
out = post("/prompt", {"prompt": graph, "client_id": "fe_probe"})
pid = out["prompt_id"]
t0 = time.time()
while True:
    time.sleep(2)
    hist = json.load(urllib.request.urlopen(f"{H}/history/{pid}", timeout=30))
    if pid in hist and hist[pid]["status"].get("completed"):
        for nid, no in hist[pid]["outputs"].items():
            for im in no.get("images", []):
                src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im["filename"]
                if os.path.exists(src):
                    shutil.copyfile(src, "/tmp/fe_probe_single.png")
                    print("saved /tmp/fe_probe_single.png", f"{time.time()-t0:.0f}s")
                    sys.exit(0)
        break
print("timeout")