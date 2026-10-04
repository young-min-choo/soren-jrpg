#!/usr/bin/env python3
"""Ruins set + shared chest tile — completes dungeon tile coverage."""
import subprocess, os, time, urllib.parse
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))
STYLE = "GBA era JRPG top down 32x32 tile, seamless tileable, limited color palette"

JOBS = [
    ("raw_dgn_tiles/dg_ruins_floor", "pixel art ancient ruins floor, cracked sandstone slabs with rubble"),
    ("raw_dgn_tiles/dg_ruins_wall",  "pixel art ancient ruins wall, weathered sandstone blocks with vines"),
    ("raw_dgn_tiles/dg_ruins_pit",   "pixel art dark open pit tile, black hole with crumbled stone edges"),
    ("raw_dgn_tiles/dg_chest",       "pixel art closed wooden treasure chest on stone floor, golden trim"),
    ("raw_dgn_tiles/dg_ruins_door",  "pixel art ancient stone doorway with carved runes, dark opening"),
]

def valid(path):
    try:
        im = Image.open(path); im.verify()
        return Image.open(path).size[0] >= 200
    except Exception:
        return False

with open('gen_tiles_progress.log', 'a') as log:
    done = 0
    for path, prompt in JOBS:
        dst = path + '.png'
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if valid(dst):
            log.write(f"{os.path.basename(path)}: cached\n"); done += 1; continue
        ok = False
        for attempt in range(8):
            seed = 11000 + attempt*3 + hash(path) % 300
            url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(f"{prompt}, {STYLE}") + f"?width=256&height=256&nologo=true&seed={seed}"
            try:
                subprocess.run(['curl', '-s', '--max-time', '160', '-o', dst, url], timeout=170)
            except subprocess.TimeoutExpired:
                pass
            if valid(dst):
                log.write(f"{os.path.basename(path)}: OK attempt {attempt+1}\n"); ok = True; done += 1; break
            time.sleep(5 + attempt*2)
        if not ok:
            log.write(f"{os.path.basename(path)}: FAILED\n")
        time.sleep(2)
    log.write(f"=== ruins batch done: {done}/{len(JOBS)} ===\n")
print("ruins gen queued")