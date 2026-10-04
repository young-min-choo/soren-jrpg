#!/usr/bin/env python3
"""Battle sprite batch generator — free tier (Pollinations FLUX).

Generates all remaining battle sprites with retries + resume support.
Progress logged to gen_progress.log. Each sprite: 512px raw -> validated.
Magenta background for chroma-key transparency removal later.

Run: nohup python3 gen_battle_sprites.py &
Poll: tail gen_progress.log; ls raw_battle/
"""
import subprocess, os, time, urllib.parse, json
from PIL import Image

os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('raw_battle', exist_ok=True)

STYLE = "fire emblem GBA style, limited palette, clean single pixel outline, plain solid magenta background, full body, centered"

# (key, size_px_for_url, prompt)
JOBS = [
    # ── Party battle sprites (32×32 native, side-view facing right) ──
    ("aria_battle", 512, "pixel art battle sprite, young monk woman with short black hair and white headband, rust orange gi robes, fists raised in fighting stance, side view facing right, " + STYLE),
    ("kael_battle", 512, "pixel art battle sprite, wiry young thief man with scruffy brown hair, dark green hooded cloak, holding a dagger low, crouching stance, side view facing right, " + STYLE),
    ("aldric_battle", 512, "pixel art battle sprite, seasoned knight in worn silver armor with dark purple cape, greatsword held ready, gray-streaked hair, side view facing right, " + STYLE),
    # ── Regular enemies (32×32 native) ──
    ("bat", 512, "pixel art enemy sprite, purple cave bat with wings spread, fangs visible, " + STYLE),
    ("goblin", 512, "pixel art enemy sprite, small green goblin holding a wooden club, yellow eyes, " + STYLE),
    ("goblin_shaman", 512, "pixel art enemy sprite, green goblin shaman with bone necklace and wooden staff, " + STYLE),
    ("zombie", 512, "pixel art enemy sprite, ruins zombie in tattered clothes, green rotting skin, arms outstretched, " + STYLE),
    ("wisp", 512, "pixel art enemy sprite, pale blue glowing spirit wisp with a faint face, floating flame shape, " + STYLE),
    ("magma_slime", 512, "pixel art enemy sprite, orange molten slime with glowing lava cracks, dripping, " + STYLE),
    ("fire_imp", 512, "pixel art enemy sprite, small red imp devil with flame hair and mischievous grin, " + STYLE),
    ("ember_bat", 512, "pixel art enemy sprite, red black bat with ember glowing wings, " + STYLE),
    ("golem", 512, "pixel art enemy sprite, gray stone golem with mossy patches, massive fists, " + STYLE),
    ("tide_crab", 512, "pixel art enemy sprite, orange tide crab with oversized claws, " + STYLE),
    ("jellyfish", 512, "pixel art enemy sprite, translucent blue jellyfish with trailing tentacles, " + STYLE),
    ("coral_wraith", 512, "pixel art enemy sprite, teal ghostly wraith wearing a coral crown, flowing robes, " + STYLE),
    ("sirenfang", 512, "pixel art enemy sprite, blue fish monster with long fangs and fin crest, " + STYLE),
    ("root_horror", 512, "pixel art enemy sprite, twisted tree root monster with gnarled wooden limbs, " + STYLE),
    ("cave_spider", 512, "pixel art enemy sprite, dark purple cave spider with many eyes, " + STYLE),
    ("tomb_warden", 512, "pixel art enemy sprite, skeletal tomb warden in rusted armor with round shield, " + STYLE),
    ("crypt_priest", 512, "pixel art enemy sprite, hooded dark priest with skull staff, purple robes, " + STYLE),
    ("storm_hawk", 512, "pixel art enemy sprite, blue white hawk with lightning crackling on wings, " + STYLE),
    ("volt_sprite", 512, "pixel art enemy sprite, yellow white electric spark elemental, crackling energy, " + STYLE),
    ("thunder_ogre", 512, "pixel art enemy sprite, blue gray ogre with massive war hammer, tusks, " + STYLE),
    ("mist_lurker", 512, "pixel art enemy sprite, gray mist ghost with hollow eyes, semi transparent shroud, " + STYLE),
    ("dire_wolf", 512, "pixel art enemy sprite, gray dire wolf snarling with raised hackles, " + STYLE),
    ("bandit", 512, "pixel art enemy sprite, scruffy bandit with red bandana and knife, " + STYLE),
    ("armored_knight", 512, "pixel art enemy sprite, heavy plate armored knight with lance, plume helmet, " + STYLE),
    # ── Bosses (48×48 native — bigger, imposing) ──
    ("boss_goblin", 512, "pixel art boss sprite, goblin warlord king with iron crown and massive axe, imposing stance, " + STYLE),
    ("boss_tide", 512, "pixel art boss sprite, leviathan sea priest in flowing blue robes holding trident, coral mantle, imposing, " + STYLE),
    ("boss_hollow", 512, "pixel art boss sprite, hollow king skeleton with earthen crown and stone armor, glowing green eyes, imposing, " + STYLE),
    ("boss_storm", 512, "pixel art boss sprite, storm sovereign queen with lightning wings and silver armor, crackling energy, imposing, " + STYLE),
    ("boss_disgraced", 512, "pixel art boss sprite, disgraced knight in rusted crimson armor, broken sword, hunched menacing stance, imposing, " + STYLE),
    ("boss_aldric_p1", 512, "pixel art boss sprite, noble knight in silver armor with dark purple cape, greatsword raised, five glowing crystals orbiting him, imposing, " + STYLE),
    ("boss_aldric_p2", 512, "pixel art boss sprite, corrupted knight with cracked armor, glowing white eyes, dark aura tendrils, desperate rage pose, imposing, " + STYLE),
]

def valid_png(path, min_size=1000):
    try:
        im = Image.open(path)
        im.verify()
        im2 = Image.open(path)
        return im2.size[0] >= 200 and os.path.getsize(path) > min_size
    except Exception:
        return False

def log(msg):
    with open('gen_progress.log', 'a') as f:
        f.write(msg + '\n')
        f.flush()

log(f"=== batch start: {len(JOBS)} sprites ===")
done = 0
for key, size, prompt in JOBS:
    dst = f'raw_battle/{key}.png'
    if valid_png(dst):
        log(f"{key}: cached OK")
        done += 1
        continue
    ok = False
    for attempt in range(6):
        seed = 7000 + hash(key) % 500 + attempt * 23
        url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt) + f"?width={size}&height={size}&nologo=true&seed={seed}"
        try:
            subprocess.run(['curl', '-s', '--max-time', '160', '-o', dst, url], timeout=170)
        except subprocess.TimeoutExpired:
            pass
        if valid_png(dst):
            log(f"{key}: OK attempt {attempt+1} ({os.path.getsize(dst)}B)")
            ok = True
            done += 1
            break
        time.sleep(7 + attempt * 3)
    if not ok:
        log(f"{key}: FAILED after 6 attempts")
    time.sleep(4)

log(f"=== batch complete: {done}/{len(JOBS)} ===")