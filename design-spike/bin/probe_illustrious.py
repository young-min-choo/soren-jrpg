#!/usr/bin/env python3
"""Illustrious + FE GBA LoRA (if available) → single probe OR batch sheets.
Usage: probe (one 512 test) | gen <name> <prompt-extra>"""
import json, os, sys, time, urllib.request, shutil

H = "http://127.0.0.1:8188"
OUT = "/tmp"

IDENT_SOREN = ("1boy, solo, a young swordsman hero in a dark plum hooded cloak, "
               "small pale face peeking from inside the hood, charcoal tunic, "
               "bright blue sash across chest, steel sword drawn in right hand, brown boots")
STYLE_TAGS = ("pixel art, full body, simple background, gameboy advance style sprite, "
              "fire emblem battle sprite, 32 pixels tall, side view facing right, "
              "limited palette, dark outline")
NEG = ("blurry, lowres, jpeg artifacts, 3d render, realistic, photo, watermark, text, "
       "signature, multiple views, sheet, grid, big head, deformed, extra limbs")

def run(graph, outname):
    req = urllib.request.Request(H + "/prompt",
        data=json.dumps({"prompt": graph, "client_id": "fe_lora"}).encode(),
        headers={"Content-Type": "application/json"})
    pid = json.load(urllib.request.urlopen(req, timeout=120))["prompt_id"]
    t0 = time.time()
    while True:
        time.sleep(3)
        hist = json.load(urllib.request.urlopen(f"{H}/history/{pid}", timeout=30))
        if pid in hist and hist[pid]["status"].get("completed"):
            for nid, no in hist[pid]["outputs"].items():
                for im in no.get("images", []):
                    src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im["filename"]
                    if os.path.exists(src):
                        dst = os.path.join(OUT, outname)
                        shutil.copyfile(src, dst)
                        return dst, time.time() - t0
            raise RuntimeError("no image out")
        if time.time() - t0 > 400:
            raise TimeoutError(outname)

def probe():
    lora = "/mnt/ssd/ai-models/comfyui/models/loras/FEGBA-Sprites-illus_Fp.safetensors"
    has_lora = os.path.exists(lora) and os.path.getsize(lora) > 10_000_000
    nodes = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "Illustrious-XL-v0.1.safetensors"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": f"{IDENT_SOREN}, {STYLE_TAGS}, mid sword-swing", "clip": ["8", 0]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["8", 0]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},
        "5": {"class_type": "KSampler",
              "inputs": {"model": ["9", 0], "positive": ["2", 0], "negative": ["3", 0],
                         "latent_image": ["4", 0], "seed": 555, "steps": 26, "cfg": 6.0,
                         "sampler_name": "euler", "scheduler": "karras", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "fe_lora_probe"}},
        # lora chain (skipped if absent)
        "8": {"class_type": "CLIPLoader", "inputs": {}},
        "9": {"class_type": "KSampler"},
    }
    # Build without lora for now (8/9 invalid) — direct chain:
    nodes = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "Illustrious-XL-v0.1.safetensors"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": f"{IDENT_SOREN}, {STYLE_TAGS}, mid sword-swing, standing", "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512, "batch_size": 1}},
        "5": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
                         "latent_image": ["4", 0], "seed": 555, "steps": 26, "cfg": 6.0,
                         "sampler_name": "euler", "scheduler": "karras", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "fe_lora_probe"}},
    }
    dst, dt = run(nodes, "illu_probe3.png")
    print("saved", dst, f"{dt:.0f}s")

if __name__ == "__main__":
    probe()