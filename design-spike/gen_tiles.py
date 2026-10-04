#!/usr/bin/env python3
"""Town + dungeon tile generator — free tier. Background-safe: resume support.
Tiles are 256px raw -> quantized 32x32 at processing time."""
import subprocess, os, time, urllib.parse
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))

STYLE = "GBA era JRPG top down 32x32 tile, seamless tileable, limited color palette"

JOBS = [
    # Town (finish the 3 that didn't land)
    ("raw_town_tiles/tn_door",       "pixel art heavy wooden dungeon door in stone frame, closed"),
    ("raw_town_tiles/tn_boss",       "pixel art ominous dark red stone floor with glowing cracks"),
    ("raw_town_tiles/tn_dungeonexit", "pixel art stone stairway entrance going down, gray steps"),
    ("raw_town_tiles/tn_exitmark",   "pixel art glowing blue floor marker rune tile"),
    # Dungeon themes — floors/walls/hazards per relic dungeon
    ("raw_dgn_tiles/dg_ember_floor",  "pixel art volcanic cave floor, dark basalt with ember specks"),
    ("raw_dgn_tiles/dg_ember_wall",   "pixel art volcanic cave wall, dark rock with glowing lava veins"),
    ("raw_dgn_tiles/dg_ember_hazard", "pixel art lava pool tile, molten orange with dark crust edge"),
    ("raw_dgn_tiles/dg_tide_floor",   "pixel art flooded temple floor, pale blue tile with water sheen"),
    ("raw_dgn_tiles/dg_tide_wall",    "pixel art submerged temple wall, coral encrusted stone blocks"),
    ("raw_dgn_tiles/dg_tide_hazard",  "pixel art deep water pool tile, dark blue with bubbles"),
    ("raw_dgn_tiles/dg_hollow_floor", "pixel art earthen cavern floor, dark soil with root strands"),
    ("raw_dgn_tiles/dg_hollow_wall",  "pixel art earthen cavern wall, packed clay with bone fragments"),
    ("raw_dgn_tiles/dg_hollow_hazard","pixel art thorn bramble patch tile, dark twisted vines"),
    ("raw_dgn_tiles/dg_spire_floor",  "pixel art storm spire floor, pale stone with carved wind symbols"),
    ("raw_dgn_tiles/dg_spire_wall",   "pixel art storm spire wall, gray slate blocks with lightning veins"),
    ("raw_dgn_tiles/dg_spire_hazard", "pixel art crackling lightning hazard tile, white arcs on dark stone"),
]

def valid(path):
    try:
        im = Image.open(path); im.verify()
        return Image.open(path).size[0] >= 200
    except Exception:
        return False

with open('gen_tiles_progress.log', 'a') as log:
    log.write("=== tiles batch start ===\n")
    done = 0
    for path, prompt in JOBS:
        dst = path + '.png'
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if valid(dst):
            log.write(f"{os.path.basename(path)}: cached\n"); done += 1; continue
        ok = False
        for attempt in range(6):
            seed = 8000 + attempt*7 + hash(path) % 400
            url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(f"{prompt}, {STYLE}") + f"?width=256&height=256&nologo=true&seed={seed}"
            try:
                subprocess.run(['curl', '-s', '--max-time', '160', '-o', dst, url], timeout=170)
            except subprocess.TimeoutExpired:
                pass
            if valid(dst):
                log.write(f"{os.path.basename(path)}: OK attempt {attempt+1}\n"); ok = True; done += 1; break
            time.sleep(6 + attempt*2)
        if not ok:
            log.write(f"{os.path.basename(path)}: FAILED\n")
        time.sleep(3)
    log.write(f"=== tiles batch done: {done}/{len(JOBS)} ===\n")