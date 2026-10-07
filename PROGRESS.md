# Build Progress Log

This file tracks what has been implemented, tested, and what's next.
Read this before starting new work.

> **2026-10-05:** This log had gone stale at "Phase 1" since July while 107 more
> commits landed. Rebuilt below from the full commit history. Keep it current.

---

## Status: Phase 10 (NPC walk sheets) slice A complete. Next: manual playtest.

| Phase | Status | Deliverable |
|---|---|---|
| 1. Engine Skeleton | ✅ 2026-07-20 | Walk overworld, enter town, walk around |
| 2. Dialogue System | ✅ 2026-07-20→21 | Talk to NPCs, portraits, choices |
| 3. Combat Prototype | ✅ 2026-07-21 | Battle, win/lose, Game Over |
| 4. Party & Jobs | ✅ 2026-07-21 | Party of 4, items, status effects, magic, JP, FF3-style job change |
| 5. First Dungeon | ✅ 2026-07-21 | Push-block puzzle, save point, boss (goblin) |
| 6. Save System | ✅ 2026-07-22 | 3 slots + X-menu (Status/Items/Jobs/Save/Load) |
| 7. Story & Events | ✅ 2026-09-08 | New game flow, cutscenes, story flags, NPC dialogue reacts to flags |
| 8. Content Expansion | ✅ 2026-10-03 | Full world: towns, dungeons, finale, equipment, economy, Game Over |
| 9. Polish (art/audio) | ✅ 2026-10-04 | Slices 1-9 below |
| 10. AI art batch (Phase A) | ✅ 2026-10-07 | NPC walk sheets ×16 + talk-facing; slices below |

### Phase 10 slices
1. **Slice A (2026-10-07): NPC walk sheets ×16** — klein-base-4B + pixel_4walk LoRA
   batch (pipeline: `design-spike/bin/soren_batch.py` → `soren_post.py` →
   `soren_batch_verify.py` → `soren_wire_export.py`). All 16 identities:
   12/12 frames grounded, ANIM ≥12%, 0% off-palette, HUE ≤5 (auto rare-family
   merge). Game-facing: `public/sprites/npc_sheets/` + `npc-sheet-manifest.json`
   (manifest-driven load — no 404s possible), sheet-backed static NPCs,
   per-key walk anims, talk-facing pose on dialogue. E2E 37/37.
2. **Slice C (2026-10-07): FE-style painted portraits ×20** — Z-Image Turbo
   (clean 8-step) painterly busts with a LOCKED style clause → face-anchored
   crop → 2×2 pixel fold → master palette → bg-flatten → corner key
   (`soren_portrait_batch2.py` + `soren_portrait_fold.py`). Programmatic
   screen (std/nonbg/plum-corners/face) + deterministic seed retries; visual
   regen loop killed style drift (warden×2, windreader, innkeeper, neve).
   In-place overwrite of `public/sprites/portraits/*.png` (old set in git for
   rollback). E2E 37/37; in-game dialogue render verified.

### Phase 9 slices (all committed 2026-10-04)
1. AI art pipeline: master palette, overworld tiles, player sprite
2. Battle sprites: chroma-key pipeline, manifest loader, in-game swap
3. Pixel fonts (VT323 + Press Start 2P), 121 size bumps, title/dialogue verified
4. MusicManager + procedural chiptune soundtrack
5. Themed dungeon tilesets — 6 strips, per-scene themes, fallback chain
6. Complete battle roster + all tile strips, zero fallbacks
7. ART BIBLE v2 + gate battery + visual standards overhaul
8. ART BIBLE v2 standards sweep — sprites, terrain, walk anims
9. MP2K-style orchestral soundtrack v2.2 — all music gates pass

## Verification

- **E2E suite: 32/32 passing** (2026-10-05, headless run on omarchy desktop).
  Covers: movement/encounters, fight+win+rewards, items, Game Over path,
  job change, push-block puzzle, boss fight, save→reload→load, new-game flow,
  intro cutscene, flag-driven NPC dialogue, relic cutscene once-only,
  flag persistence through save/reload, cutscene input lockout.
- **Manual playtest: NOT started.** `PLAYTEST-QUESTS.md` (Phases 7-8, ~30-40 min,
  7 zones) exists and every quest is unchecked. The E2E suite proves the code
  works; this quest log proves the GAME works. Do it before new features.

## How to run

```bash
npm ci                # first time only
npm run dev           # http://localhost:5173
npx playwright test   # 32 specs, self-playing, ~3 min
npm run build && npm run preview   # production build (dist/ is gitignored)
```

Desktop (omarchy) keeps a dev server running for tailnet play:
**http://omarchy:5173** (or http://100.106.214.96:5173 from any tailnet device).

## What's next

1. **Manual playtest** — work through `PLAYTEST-QUESTS.md`, report bugs in the
   one-line format it specifies (zone + quest + what-happened).
2. **Fix whatever the playtest surfaces**, then balance tuning (Lv curve,
   encounter rate feel, economy: Potion 50G / inn 30G vs. earn rate).
3. **Then** remaining Phase 10 scope: Phase B (enemy variants), Phase C (prop
   decals, one theme first), NPC *movement* (config-gated wandering) — sheets
   and anims are already in place for it. Decide deployment (tailscale serve
   `dist/`, or GitHub Pages once playtested).

### Phase 10 vibe/consistency final (2026-10-07, 45e85b6)
- Choo set the bar: vibe ≥9/10 AND consistency ≥9/10. Iteration 3 fixed the
  three weak cells: aria (crop bug — refold of original raw), quarry_chief
  (grey-haired bearded boss replacing the white-helm softboy), shopkeeper
  (painterly regen replacing flat-cel). Final self-grade: vibe 9/10,
  consistency 9/10. Gates 420/420, E2E 37/37.

### Phase 10 consistency pass (2026-10-07, feb5168)
- Style-audit of the 20 portraits: roster had split into 3 sub-families.
  Regen'd soren (profile ghost → frontal bust), innkeeper (washed → crisp);
  warden lifted version kept. All bg-normalized to the plum family.
  Gates 420/420, E2E 37/37.
- Closed two art-placement gaps: gareth was a red placeholder rectangle on
  the Conduit road (now his walk-sheet stand pose); Job Master menu now
  shows his portrait (top-right, re-attached after innerHTML renders).

### Phase 10 polish (2026-10-07, d5a7130)
- Portrait review pass → 9/10 verdict: lighting-coherence fixes (soren/warden
  shadow-rolloff lift; job_master trial reverted — lift destroyed identity),
  `gate_face` lit-face branch (moonlit pale-cool skin), `gate_bg` opaque
  plum-backdrop branch. Gates 420/420 again; E2E 37/37.

---

## Change Log

### 2026-10-05 — Audit day (this file)
- GitHub brought current: desktop repo was 10 commits ahead; pushed to origin
  (62d5808 → 41e1184, Phase 8 full content + all Phase 9 slices).
- All clones (laptop, omarchy desktop) synced to 41e1184.
- E2E 32/32 green. PROGRESS.md rewritten from commit history.
- Dev server restarted on omarchy for tailnet play.
- Setup: deploy keypair for omarchy created (needs registration; gh token on
  desktop is dead — re-auth `gh auth login` there or register the deploy key).

### 2026-10-04 — Phase 9 complete (slices 1-9)
AI art pipeline + master palette; chroma-key battle sprites; VT323/Press Start 2P
pixel fonts; MusicManager + procedural chiptune; six themed dungeon tilesets;
complete battle roster with zero fallbacks; ART BIBLE v2 gate battery; v2
standards sweep (sprites/terrain/walk anims); MP2K-style orchestral soundtrack
v2.2 passing all music gates.

### 2026-10-03 — Phase 8 complete
Full world content: all towns, dungeons, finale, equipment system, Game Over.

### 2026-09-08 — Phase 7 complete
Story & event scripting: new game flow (name entry, job choice), intro/relic
cutscenes, story flags, flag-aware NPC dialogue. Self-playing E2E suite added;
fixed dropped Z-presses and boss-exit resume. Phase 8 slice 1: economy + Cave
of Embers. Manual playtest quest log for Phases 7-8.

### 2026-07-22 / 23 — Phases 5-6 fixes
Save system + X-menu. Dungeon: Zelda-style walk-into push blocks, smooth rAF
slide, separate puzzle/boss doors, boss_goblin + visible boss sprite. Encounter
rate retuned toward FF1-3 feel (6-10 tiles maps, counts tiles not frames). Menu
resume crash fix, party portraits on menu/save screen.

### 2026-07-21 — Phases 3-5 complete
Battle systems: party turn order, enemy AI targeting fix, action menu, items,
status effects (poison/sleep/blind/defend), magic with MP + targeting, FFT-style
JP + ability shop, FF3-style job change via Job Master NPC, DOM battle log
anchoring + marker cleanup. First dungeon with push-block puzzle, save point,
boss.

### 2026-07-20 — Phase 1-2 complete
Created design document and agent skills harness (7 files in .agent/).
Initialized Phaser project (vite, index.html, main.js). BootScene programmatic
asset generation, TitleScene, OverworldScene (4-dir movement, sprint,
collision), TownScene, scene transitions with fade. Dialogue system.
Note: canvas textures need explicit `texture.add()` calls for frame
registration. Dev server at http://localhost:5173.