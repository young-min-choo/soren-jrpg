#!/usr/bin/env python3
"""Generate Soren back-view field sprite (for the up-facing walk row)."""
import subprocess, os, time, urllib.parse
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def valid(path):
    try:
        im = Image.open(path); im.verify()
        return Image.open(path).size[0] >= 200 and os.path.getsize(path) > 1000
    except Exception:
        return False

JOBS = [
    ("raw_field/soren_back", 512,
     "pixel art single character sprite seen from behind (back view), 24 year old hero swordsman, "
     "short brown hair, blue tunic with leather belt, NO face visible, back of head and shoulders, "
     "fire emblem GBA style, limited palette, clean single dark outline, plain solid magenta background, "
     "full body, centered, 16x24 pixel grid style"),
]
for path, size, prompt in JOBS:
    dst = path + '.png'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if valid(dst):
        print(f"{os.path.basename(path)}: cached"); continue
    for attempt in range(10):
        seed = 31000 + attempt * 7
        url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt) + f"?width={size}&height={size}&nologo=true&seed={seed}"
        try:
            subprocess.run(['curl', '-s', '--max-time', '160', '-o', dst, url], timeout=170)
        except subprocess.TimeoutExpired:
            pass
        if valid(dst):
            print(f"{os.path.basename(path)}: OK attempt {attempt+1}"); break
        time.sleep(9 + attempt * 3)
    else:
        print(f"{os.path.basename(path)}: FAILED")