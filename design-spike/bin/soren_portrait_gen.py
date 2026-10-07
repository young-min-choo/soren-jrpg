#!/usr/bin/env python3
"""Soren portrait spike — Z-Image Turbo int8, clean render (bench C graph).

Tests whether the 6s daily-driver path can produce GBA-Fire-Emblem-style
dialogue busts. Run WITHOUT a pixel LoRA first (bench B showed LoRA noise);
big canvas + flat background, then fold to 64x64 in post.

Usage:
  python3 soren_portrait_gen.py --name elder --prompt "..." [--seed N]
"""
import argparse
import json
import os
import shutil
import sys
import time
import urllib.request

H = "http://127.0.0.1:8188"
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_ROOT = os.path.join(ROOT, "..", "portrait_spike")


def gen(prompt, seed, outdir, steps=8, cfg=1.0):
    graph = {
        "1": {"class_type": "UNETLoader",
              "inputs": {"unet_name": "z_image_turbo_int8_convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader",
              "inputs": {"clip_name": "qwen_3_4b.safetensors", "type": "lumina2", "device": "default"}},
        "4": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["1", 0], "shift": 3.0}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["2", 0]}},
        "6": {"class_type": "EmptySD3LatentImage",
              "inputs": {"width": 512, "height": 512, "batch_size": 1}},
        "7": {"class_type": "KSampler",
              "inputs": {"model": ["4", 0], "positive": ["5", 0], "negative": ["5", 0],
                         "latent_image": ["6", 0], "seed": seed, "steps": steps, "cfg": cfg,
                         "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["8", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "soren_portrait"}},
    }
    req = urllib.request.Request(H + "/prompt", data=json.dumps(
        {"prompt": graph, "client_id": "soren_portrait"}).encode(),
        headers={"Content-Type": "application/json"})
    q = json.load(urllib.request.urlopen(req, timeout=60))["prompt_id"]
    t0 = time.time()
    while True:
        time.sleep(1.5)
        hist = json.load(urllib.request.urlopen(H + f"/history/{q}", timeout=30))
        if q in hist:
            st = hist[q]["status"]
            if st.get("completed"):
                for nid, no in hist[q]["outputs"].items():
                    for im in no.get("images", []):
                        src = im.get("fullpath") or "/mnt/ssd/ai-models/output/" + im.get("filename", "")
                        if os.path.exists(src):
                            dst = os.path.join(outdir, "raw_512.png")
                            os.makedirs(outdir, exist_ok=True)
                            shutil.copy(src, dst)
                            return dst, time.time() - t0
                raise RuntimeError("completed, no image")
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st)[:1500])
        if time.time() - t0 > 600:
            raise TimeoutError("10min")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--steps", type=int, default=8)
    ap.add_argument("--cfg", type=float, default=1.0)
    args = ap.parse_args()
    outdir = os.path.join(OUT_ROOT, args.name)
    raw, t = gen(args.prompt, args.seed, outdir, args.steps, args.cfg)
    print(f"[gen] {args.name}: {t:.0f}s -> {raw}")


if __name__ == "__main__":
    main()