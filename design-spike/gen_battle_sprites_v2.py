#!/usr/bin/env python3
"""Battle sprite regeneration v2 — anatomy-correct prompts, shared identity.

Retired prompts produced: "small green goblin" → chibi green-haired boy;
"zombie" → generic; humanoid prompts fought the creature intent.

Fix: every monster prompt uses CREATURE anatomy language (hunched bestial,
fangs, claws, non-human silhouette) and every sprite shares ONE style block
locked to the deployed roster's style. Regen list = verified failures:

  goblin, goblin_shaman, bandit, tomb_warden, crypt_priest, dire_wolf,
  mist_lurker, armored_knight, boss_hollow, jellyfish, cave_spider,
  storm_hawk, boss_aldric_p1 (face mush), boss_disgraced

Keep as-is (verified good): slime, bat, zombie, wisp, magma_slime, fire_imp,
ember_bat, golem, tide_crab, coral_wraith, sirenfang, root_horror,
volt_sprite, thunder_ogre, boss_goblin, boss_tide, boss_storm, boss_magma,
boss_aldric_p2, soren/aria/kael/aldric_battle.

Usage: python3 gen_battle_sprites_v2.py  (resume-safe; valid_png skips done)
"""
import subprocess, os, time, urllib.parse, json
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))
RAW = 'raw_battle'

STYLE = ("fire emblem GBA battle sprite, full body creature, chunky visible pixel art, "
         "thick clean dark outline, limited 8-color palette, plain solid magenta background, "
         "single figure, centered, no text")

# (key, is_boss, prompt) — creature-anatomy phrasing, explicit silhouettes
JOBS = [
    ("goblin", False,
     "pixel art goblin monster, hunched green-skinned misshapen imp creature with long pointed ears, "
     "wide flat nose, jagged yellow fangs, beady red eyes, skinny clawed arms, holding a knobby wooden club, "
     "menacing crouch, " + STYLE),
    ("goblin_shaman", False,
     "pixel art goblin shaman, green hunched imp elder with long pointed ears, bone necklace, skull-topped "
     "wooden staff raised, tattered dark robe, hunched, " + STYLE),
    ("bandit", False,
     "pixel art bandit human thief, tall scruffy man in dark hood and cloth cap, red bandana over lower face, "
     "crouched knife-forward combat stance, leather vest, " + STYLE),
    ("tomb_warden", False,
     "pixel art undead skeletal warrior, exposed bone ribcage and skull with glowing eye sockets, rusted "
     "battered plate armor pieces, round battered shield, curved rusted sword, " + STYLE),
    ("crypt_priest", False,
     "pixel art evil undead priest monster, gaunt corpse-faced human in tattered purple vestments with tall "
     "collar, holding ornate skull staff with glowing orb, " + STYLE),
    ("dire_wolf", False,
     "pixel art dire wolf monster beast, quadruped predator standing all fours, huge fanged jaw open, sharp "
     "ears back, bristling grey fur, long tail, claws, side profile, " + STYLE),
    ("mist_lurker", False,
     "pixel art ghost faceless apparition, hooded shroud shape with wispy torn robe bottom fading to wisps, "
     "two hollow dark eye sockets, semi transparent edges, " + STYLE),
    ("armored_knight", False,
     "pixel art heavy plate armored soldier, full plate harness with closed great helm and feather plume, "
     "long lance and tower shield, wide planted stance, " + STYLE),
    ("boss_hollow", True,
     "pixel art skeleton boss king, giant fleshless skull with cracked earthen crown, ribcage exposed, tattered "
     "royal cape, huge stone hammer, hulking, " + STYLE),
    ("jellyfish", False,
     "pixel art giant jellyfish monster, translucent dome bell with long trailing tentacles, glowing core, "
     "floating, simplified shapes, " + STYLE),
    ("cave_spider", False,
     "pixel art giant cave spider, arachnid with round bulbous abdomen, eight long jointed legs, multiple red "
     "eyes, fanged mandibles, dark purple chitin, " + STYLE),
    ("storm_hawk", False,
     "pixel art storm hawk bird of prey, raptor with spread wings, sharp hooked beak, talons bared, lightning "
     "arcs between wing tips, blue and white feathers, " + STYLE),
    ("boss_aldric_p1", True,
     "pixel art fallen knight boss, tall warrior in shining silver plate armor with dark purple cape, visored "
     "helm up showing stern face, enormous greatsword planted point-down, " + STYLE),
    ("boss_disgraced", True,
     "pixel art disgraced knight boss, broken warrior in dented rusted crimson armor, cracked visor, broken "
     "half-sword in clawed gauntlet, hunched menace, " + STYLE),
]

BOSS_KEYS = {'boss_goblin','boss_tide','boss_hollow','boss_storm','boss_disgraced',
             'boss_aldric_p1','boss_aldric_p2','boss_magma'}

def valid_png(path, min_size=1000):
    try:
        im = Image.open(path); im.verify()
        return Image.open(path).size[0] >= 200 and os.path.getsize(path) > min_size
    except Exception:
        return False

def log(msg):
    with open('gen_progress_v2.log', 'a') as f:
        f.write(msg + '\n'); f.flush()

if __name__ == '__main__':
    log(f"=== regen v2 batch start: {len(JOBS)} sprites ===")
    done = 0
    for key, is_boss, prompt in JOBS:
        dst = f'{RAW}/{key}.png'
        if valid_png(dst):
            log(f"{key}: cached"); done += 1; continue
        ok = False
        for attempt in range(6):
            seed = 9000 + (hash(key) % 400) + attempt * 31
            url = ("https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt)
                   + f"?width=512&height=512&nologo=true&seed={seed}")
            try:
                subprocess.run(['curl', '-s', '--max-time', '160', '-o', dst, url], timeout=170)
            except subprocess.TimeoutExpired:
                pass
            if valid_png(dst):
                log(f"{key}: OK attempt {attempt+1} (seed {seed}, {os.path.getsize(dst)}B)")
                ok = True; done += 1; break
            time.sleep(6 + attempt * 3)
        if not ok:
            log(f"{key}: FAILED after 6 attempts")
        time.sleep(3)
    log(f"=== regen v2 complete: {done}/{len(JOBS)} ===")
    print(f"done {done}/{len(JOBS)}")