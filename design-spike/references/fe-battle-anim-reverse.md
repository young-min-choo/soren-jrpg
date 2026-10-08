# GBA Fire Emblem Battle Animation — Reverse-Engineering Deep Dive

*Research date: 2026-10-09. Sources: fe-battle-animations.neocities.org (vilkalizer's
tutorial), feuniverse.us sprite/format threads, tutorial.feuniverse.us GBA gfx docs,
fireemblemgba.com production guides, FE4 battle-sprite data table docs.*

## 1. The format (what the ROM actually stores)

A GBA FE battle "animation" is NOT one looping sheet — it is a **frame bundle +
script**:

- **Frames:** series of PNGs, each **248×160** (8px column on the right reserved,
  not displayed). Each frame is a full battle-scene composition of the character.
- **Script:** plain text, per-frame display commands `N p- frame.png` (N = frames
  at 60fps, typically 2–7 for motion, 10–30 for holds) + `C##` engine commands
  (hit timing, SFX, screen shake, spell call, HP-bar sync).
- **12 modes** per animation: 1 melee, 3 melee-crit, 5 ranged, 6 ranged-crit,
  7/8 dodge, 9/10/11 standing, 12 miss. Script selects the mode by weapon +
  situation.
- **16-color palette** TOTAL per animation, shared by every frame. Outline color
  is always **#282828** (never pure black). Palettes are swappable per character
  (recolor = same sprite, new palette — cavaliers/lords).
- **Split-sprite trick (FE4 documented; GBA equivalent = main/secondary):**
  character body vs weapon-trail/shadow stored as separate images composited
  by the engine; magic effects are called by `C05` as SEPARATE spell animations.
- **Piercing frames:** a double-wide image; left part draws OVER the enemy,
  right part UNDER them → weapon appears to skewer the target (cut x ≈ 92px).
- **Positioning:** attacker stands ≈x150, feet ≈y102; target ≈60px to the
  front; game handles ranged scroll/shake automatically.
- Idle = 1 standing frame (some units have 1–2 loop), map-idle bob is the MAP
  sprite's separate 1-2-3-2-1 3-pose cycle (16×16/16×32/32×32, 16-color faction
  palettes: Player/Enemy/NPC/Gray).

## 2. The numbers that define the LOOK

- Character height: **women 32px, men 34px** in battle frames (range 30–38).
  NOT chibi — roughly 3.5–4 heads tall, small but adult proportions.
- Palette: ≤16 colors, ONE shadow/outline (#282828), metal+skin share ramps
  sparingly. Eirika's sword/hair/skirt/cloak all share the blue ramp — deliberate
  color unification.
- Animation length: Eirika's full attack = **19 frames** for one swing.
- **Smears** are the signature: bright, outlineless, physically-impossible
  in-between shapes for 2–3 frames at slash contact — cheap, snappy, iconic.
- Crit animation = where the spin/jump flourish lives; ranged = lazy 2-frame
  toss; staff = raise + spell call + reverse.

## 3. What Sören already has vs the FE formula

| FE component | Sören current | Gap |
|---|---|---|
| Frame bundle | ✅ 12-frame 48×96 sheets (16×24 frames) | none |
| Script/commands | ✅ hard-coded gesture tweens in BattleScene (lunge → strike → settle) + castGesture + slashArc flash | timing constants differ from FE pacing |
| Hit sync (C1A at specific frame) | ✅ contact callback fires effects at gesture mid-point | ✅ |
| Smears | ❌ none | additive |
| 16-color discipline | ⚠️ 26 colors (Soren v2 sheet), gates allow ≤5 hue families | loose |
| Idle bob (map) vs battle idle | ⚠️ battle idle = squash breathing (not FE style — FE battle-idle is a held frame; the BOB belongs to map sprites) | could switch |
| Palette-swap variants | ❌ per-character sheets only | Phase B hook |
| Dodge/miss/crit modes | ❌ single attack anim | additive |
| Piercing frames | ❌ | optional — slashArc covers it |
| 248×160 full-scene frames | ❌ 16×24 units composited in-engine | fine — engine compositing is equivalent |

## 4. Options to get the FE look (recommendation first)

**A. FE-crafted frame sets via AI + human polish (RECOMMENDED)**
Generate per-character **melee attack + cast frame sequences** in true FE
proportions (32–34px tall, ≤16 colors, #282828 outline) — AI drafts the
keyframes (wind-up/contact/smear/follow-through/return, 6–10 frames), then a
pass enforces palette + outline rules. Wire as per-action frames consumed by a
script table (timing constants) mirroring FE modes (attack/crit/dodge/miss).
- Cost: 1 gen (~45s) × 3 party × 2 actions first (melee + cast), expand later.
- Result: genuinely FE-styled *and* animated — what Choo described.

**B. Keep current chibi sheets (v2) + FX layer**
Slash-arc sting + cast glow over the existing animated sheets. Cheapest, but
keeps the chibi proportion Choo doesn't want as the final look.

**C. Effect-layer on old 32×32 art**
Keeps the art Choo liked but no frame animation = still "moving pictures with
motion" — does not reach "actual movement."

**A is the one that satisfies "similar to GBA FE".** B/C are fallbacks.

## 5. Implementation sketch for A (Sören-specific)

1. `design-spike/bin/gen_battle_fe_frames.py` — per action, N-frame strip
   (keyframes with smears), prompt = field identity + FE style clauses
   ("32px tall, three-quarter view, #282828 single outline, 16 colors,
   smear frame at contact").
2. Post: same chroma/quantize chain + palette enforcement (extend
   seal_pinholes + a palette reducer to ≤16).
3. Frame layout: `battle_fe_frames/<char>/<action>/<n>.png`
4. Manifest + script: `battle_script = { attack: [[frame,duration],...] }`
   mirroring FE modes; BattleScene gestures play scripts instead of hardcoded
   frame indices (current castGesture/slashGesture become script runners).
5. FX unchanged (hit flash, magic circle) — FE also overlays separate FX.

## 6b. REPRODUCED EXPERIMENT (2026-10-09, options probed + committed 23179ea)

Option A's AI path FAILED with the current model stack:
1. `pixel_4walk` LoRA (the NPC-pipeline model) is **contract-locked** to its
   4x4 walk+specials grid — a completely rewritten action-row contract is
   IGNORED (same walk grid returned verbatim), and "32px realistic
   proportions" never takes through it.
2. Plain flux2-klein without the LoRA: identity + sword + smear read well in
   a SINGLE frame, but proportions are 3-head chunky + heavy cel shading —
   NOT GBA FE.
Probes: `design-spike/fe_frames/*/raw_512.png` (grid, ignored contract),
`design-spike/bin/probe_fe_single.py` + /tmp/fe_probe_single.png (no-LoRA).

REMAINING PATHS to real FE-style battle art (in order of cost):
- (i) ~~FE-style LoRA~~ DEAD END RECORDED: the CivitAI GBA Sprite Style LoRAs
  (949388 Illustrious / 726209 Pony) require CivitAI login (no account/key on
  this box); no HF mirrors. Downloaded Illustrious-XL-v0.1 base (6.6GB, correct
  file) — produces STRUCTURED NOISE on this Comfy install (3 probes, fresh
  restart; committed bin/probe_illustrious.py). Do not retry without a
  different checkpoint or host.
- (i-b) **img2img from REAL FE frames via flux2-klein — BREAKTHROUGH
  (066d922)**: Eirika standing frame (game rip, reference only) → 512 →
  klein img2img d0.55–0.62 with Soren identity prompt = crisp FE-proportioned
  hooded swordsman w/ sword (d55 ≈36px figure ready pose; d60 ≈52px swing).
  /tmp/fe_i2i/r55.png r60.png r62.png + bin/probe_i2i_fe.py.
  NEXT: pin denoise per pose type (stand 0.55, swing 0.60), lock scale via
  post-crop-to-36px, palette-lock pass, then batch poses.
- (ii) hand-sprite the 3 party sets (slow, exact) — still open as fallback.
- (iii) chibi v2 sheets + FX layer (live in game now, interim).

## 7. Original production notes from the source material (unchanged)

- "Start with the standing frame; all animations begin and end on it."
- Crit > attack effort (spin/twirl/jump); ranged cheap; staff trivial.
- One held frame > several nearly-identical (weight/readability).
- Every animation ends returning to standing = the "missing descent" class of
  bug (our castGesture bug was exactly a violation of this rule).
- Per-weapon animations for multi-weapon characters (equipment variants hook:
  same motion, weapon replaced = the FE hand-axe-from-sword workflow).
- Match vanilla pacing: FE attack ≈ 0.5–0.8s total; don't over-animate.