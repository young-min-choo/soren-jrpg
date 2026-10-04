#!/usr/bin/env python3
"""Retry sweep: regenerate any missing/invalid raws (battle + tiles).
Runs until everything exists or attempts exhausted."""
import subprocess, os, time, urllib.parse
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))

def valid(path):
    try:
        im = Image.open(path); im.verify()
        return Image.open(path).size[0] >= 200 and os.path.getsize(path) > 1000
    except Exception:
        return False

STYLE_SPR = "fire emblem GBA style, limited palette, clean single pixel outline, plain solid magenta background, full body, centered"
STYLE_TILE = "GBA era JRPG top down 32x32 tile, seamless tileable, limited color palette"

# key -> (out_path, size, prompt)
JOBS = {
    # battle sprites still missing
    "sirenfang": ("raw_battle/sirenfang.png", 512, "pixel art enemy sprite, vivid bright teal fish monster with pale belly, long white fangs, coral colored fin crest, high contrast, " + STYLE_SPR),
    "root_horror": ("raw_battle/root_horror.png", 512, "pixel art enemy sprite, twisted tree root monster with gnarled wooden limbs, " + STYLE_SPR),
    "cave_spider": ("raw_battle/cave_spider.png", 512, "pixel art enemy sprite, dark purple cave spider with many eyes, " + STYLE_SPR),
    "tomb_warden": ("raw_battle/tomb_warden.png", 512, "pixel art enemy sprite, skeletal tomb warden in rusted armor with round shield, " + STYLE_SPR),
    "crypt_priest": ("raw_battle/crypt_priest.png", 512, "pixel art enemy sprite, hooded dark priest with skull staff, purple robes, " + STYLE_SPR),
    "storm_hawk": ("raw_battle/storm_hawk.png", 512, "pixel art enemy sprite, blue white hawk with lightning crackling on wings, " + STYLE_SPR),
    "bandit": ("raw_battle/bandit.png", 512, "pixel art enemy sprite, scruffy bandit with red bandana and knife, " + STYLE_SPR),
    "dire_wolf": ("raw_battle/dire_wolf.png", 512, "pixel art enemy sprite, gray dire wolf snarling with raised hackles, " + STYLE_SPR),
    "boss_goblin": ("raw_battle/boss_goblin.png", 512, "pixel art boss sprite, goblin warlord king with iron crown and massive axe, imposing stance, " + STYLE_SPR),
    "boss_tide": ("raw_battle/boss_tide.png", 512, "pixel art boss sprite, leviathan sea priest in flowing blue robes holding trident, coral mantle, imposing, " + STYLE_SPR),
    "boss_hollow": ("raw_battle/boss_hollow.png", 512, "pixel art boss sprite, hollow king skeleton with earthen crown and stone armor, glowing green eyes, imposing, " + STYLE_SPR),
    "boss_storm": ("raw_battle/boss_storm.png", 512, "pixel art boss sprite, storm sovereign queen with lightning wings and silver armor, crackling energy, imposing, " + STYLE_SPR),
    "boss_disgraced": ("raw_battle/boss_disgraced.png", 512, "pixel art boss sprite, disgraced knight in rusted crimson armor, broken sword, hunched menacing stance, imposing, " + STYLE_SPR),
    "boss_aldric_p1": ("raw_battle/boss_aldric_p1.png", 512, "pixel art boss sprite, noble knight in silver armor with dark purple cape, greatsword raised, five glowing crystals orbiting him, imposing, " + STYLE_SPR),
    # tiles missing
    "tn_door": ("raw_town_tiles/tn_door.png", 256, "pixel art heavy wooden dungeon door in stone frame, closed, " + STYLE_TILE),
    "tn_boss": ("raw_town_tiles/tn_boss.png", 256, "pixel art ominous dark red stone floor with glowing cracks, " + STYLE_TILE),
    "tn_dungeonexit": ("raw_town_tiles/tn_dungeonexit.png", 256, "pixel art stone stairway entrance going down, gray steps, " + STYLE_TILE),
    "dg_ruins_floor": ("raw_dgn_tiles/dg_ruins_floor.png", 256, "pixel art ancient ruins floor, cracked sandstone slabs with rubble, " + STYLE_TILE),
    "dg_ruins_pit": ("raw_dgn_tiles/dg_ruins_pit.png", 256, "pixel art dark open pit tile, black hole with crumbled stone edges, " + STYLE_TILE),
    "dg_ruins_door": ("raw_dgn_tiles/dg_ruins_door.png", 256, "pixel art ancient stone doorway with carved runes, dark opening, " + STYLE_TILE),
    "dg_ember_wall": ("raw_dgn_tiles/dg_ember_wall.png", 256, "pixel art volcanic cave wall, dark rock with glowing lava veins, " + STYLE_TILE),
    "dg_tide_floor": ("raw_dgn_tiles/dg_tide_floor.png", 256, "pixel art flooded temple floor, pale blue tile with water sheen, " + STYLE_TILE),
    "dg_hollow_wall": ("raw_dgn_tiles/dg_hollow_wall.png", 256, "pixel art earthen cavern wall, packed clay with bone fragments, " + STYLE_TILE),
    "dg_spire_wall": ("raw_dgn_tiles/dg_spire_wall.png", 256, "pixel art storm spire wall, gray slate blocks with lightning veins, " + STYLE_TILE),
}

with open('gen_retry_progress.log', 'a') as log:
    log.write("=== retry sweep start ===\n")
    done = 0
    todo = [(k, v) for k, v in JOBS.items() if not valid(v[0])]
    log.write(f"todo: {len(todo)}/{len(JOBS)}\n")
    for key, (path, size, prompt) in todo:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        ok = False
        for attempt in range(8):
            seed = 15000 + attempt * 29 + hash(key) % 700
            url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt) + f"?width={size}&height={size}&nologo=true&seed={seed}"
            try:
                subprocess.run(['curl', '-s', '--max-time', '160', '-o', path, url], timeout=170)
            except subprocess.TimeoutExpired:
                pass
            if valid(path):
                log.write(f"{key}: OK attempt {attempt+1}\n"); ok = True; done += 1; break
            time.sleep(8 + attempt * 4)
        if not ok:
            log.write(f"{key}: FAILED all attempts\n")
        time.sleep(4)
    log.write(f"=== retry sweep done: {done}/{len(todo)} ===\n")