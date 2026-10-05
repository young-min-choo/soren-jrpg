#!/usr/bin/env python3
"""Generate the hero's field-sprite raws: one canonical identity, 3 directions.

IDENTITY-LOCKED on the SAME seed + same outfit prompt block — one render per
direction, so all directions are the same person in the same outfit:
  HERO = "young swordsman hero, short spiky brown hair, teal tunic with
          brown leather belt and dark trousers, brown boots"
Direction raws must pass judge_field_raw.py (full body, 1 figure, facing).

Output: raw_field/hero_front.png, hero_side.png, hero_back.png
Run: python3 gen_field_identities.py
"""
import subprocess, os, time, urllib.parse, json

os.chdir(os.path.dirname(os.path.abspath(__file__)))

HERO = ("young swordsman hero with short spiky brown hair, teal blue tunic "
        "with brown leather belt, dark trousers, brown boots")
# ONE seed for all three directions = one consistent identity (same face build,
# same outfit colors). Pollinations is deterministic for (prompt, seed).
HERO_SEED = 4242

STYLE = ("fire emblem GBA character sprite, full body standing, chunky pixel art, "
         "plain solid magenta background, centered, single character")

JOBS = [
    ("raw_field/hero_front", HERO + ", facing the camera, arms at sides", HERO_SEED),
    ("raw_field/hero_side",  HERO + ", strict side profile view facing left, arms at sides", HERO_SEED),
    ("raw_field/hero_back",  HERO + ", seen from directly behind, NO face visible, back of head and shoulders, arms at sides", HERO_SEED),
]


from PIL import Image


def valid_png(path, min_size=200):
    try:
        im = Image.open(path); im.verify()
        return Image.open(path).size[0] >= min_size and os.path.getsize(path) > 1000
    except Exception:
        return False


def generate(dst, prompt, base_seed, attempts=8):
    for attempt in range(attempts):
        seed = base_seed + attempt * 101  # attempt 0 = canonical seed
        url = ("https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt)
               + f"?width=512&height=512&nologo=true&seed={seed}")
        try:
            subprocess.run(['curl', '-s', '--max-time', '160', '-o', dst, url], timeout=170)
        except subprocess.TimeoutExpired:
            pass
        if valid_png(dst):
            print(f"{dst}: OK attempt {attempt+1} (seed {seed})")
            return True
        time.sleep(6 + attempt * 3)
    print(f"{dst}: FAILED after {attempts} attempts")
    return False


if __name__ == '__main__':
    ok = True
    for path, prompt, seed in JOBS:
        if valid_png(path + '.png'):
            print(f"{path}: cached")
            continue
        ok = generate(path + '.png', prompt, seed) and ok
    exit(0 if ok else 1)