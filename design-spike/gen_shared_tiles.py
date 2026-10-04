#!/usr/bin/env python3
"""Shared dungeon tiles: save point, pushable block, floor switch."""
import subprocess, os, time, urllib.parse
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))
STYLE = "GBA era JRPG top down 32x32 tile, seamless tileable, limited color palette"

JOBS = [
    ("raw_dgn_tiles/dg_save",   "pixel art save point tile, glowing golden sparkle rune on stone floor"),
    ("raw_dgn_tiles/dg_block",  "pixel art pushable stone block on cracked dungeon floor, square boulder"),
    ("raw_dgn_tiles/dg_switch", "pixel art floor pressure switch plate tile, raised circular stone button"),
]

def valid(path):
    try:
        im = Image.open(path); im.verify()
        return Image.open(path).size[0] >= 200 and os.path.getsize(path) > 1000
    except Exception:
        return False

for path, prompt in JOBS:
    dst = path + '.png'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if valid(dst):
        print(f"{os.path.basename(path)}: cached"); continue
    ok = False
    for attempt in range(8):
        seed = 17000 + attempt * 11 + hash(path) % 200
        url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(f"{prompt}, {STYLE}") + f"?width=256&height=256&nologo=true&seed={seed}"
        try:
            subprocess.run(['curl', '-s', '--max-time', '160', '-o', dst, url], timeout=170)
        except subprocess.TimeoutExpired:
            pass
        if valid(dst):
            print(f"{os.path.basename(path)}: OK attempt {attempt+1}"); ok = True; break
        time.sleep(8 + attempt * 3)
    if not ok:
        print(f"{os.path.basename(path)}: FAILED")