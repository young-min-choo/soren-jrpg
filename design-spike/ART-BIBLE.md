# SOREN — ART BIBLE v2 (Phase 9 standards revision)

Grounded in: cluster theory (Saint11/Pixelation), GBA-era readability rules,
studio art-bible practice (visual pillars, do/don'ts, one review owner,
milestone-tied gates). This document is OPERATIONAL: every rule has a
numeric gate the CI battery enforces. An asset that fails a gate does not
ship.

## 1. Visual pillars

- **P1 — Readability over detail.** At 16×24 field / 32×32 battle, show a few
  things clearly. Small sprites need recognizable silhouettes + 2-3 main
  colors, NOT crammed detail.
- **P2 — Clusters, not noise.** Pixel art is made of connected same-color
  clusters. Orphan 1px pixels read as noise/mud at game scale. AI output is
  post-processed to enforce cluster discipline.
- **P3 — Sprites pop, terrain recedes.** Characters/enemies are the visual
  priority: saturated, outlined, high internal contrast. Terrain is
  supporting: desaturated, low-contrast, minimal single-pixel texture. If a
  tile draws more attention than the player, it fails.
- **P4 — One game, one palette.** All assets remap onto the 29-color master
  palette (`design-spike/palette/master_palette.json`). Shared ambient shadow
  plum (`#2a2233`-family) outlines; hue-shifted ramps; no pure black.
- **P5 — Motion is pose, not decoration.** Walk cycles are real 3-frame pose
  changes (leg alternation + 1px body bob) per direction, FE-GBA style.
  Static-looking movement = broken.

## 2. Per-asset-class specs

### Field sprites (16×24, 12-frame sheet: 4 dirs × 3 frames)
- Distinct silhouette per character (hair/outfit color blocking)
- Plum outline, continuous (no gaps >1px)
- 3 frames per direction: stand / step-L / step-R (legs alternate, body bobs 1px)
- Side frames mirror for the opposite direction; up-facing uses a back-view
  base (hair/cape block, no face)
- GATE-ANIM: frame 1 vs frame 2 differ by ≥4% pixels; frame 2 vs frame 3 ≥4%;
  each direction column differs from other directions (not the same art)

### Battle sprites (32×32 regular, 48×48 boss)
- Chroma-keyed background — GATE-BG: all 4 corner pixels alpha=0; no halo
  ring: no pixel adjacent to transparent may match the removed bg color
  (despill pass)
- Clean single outline, silhouette readable at 50% zoom
- Bosses fill ≥80% of canvas; enemies ≥60%

### Terrain tiles (32×32, seamless)
- GATE-ORPHAN: orphan-pixel ratio (1px clusters) < 8% after cleanup
- GATE-SEAM: edge_diff < 40 (both axes) — existing test
- GATE-RECEDE: mean saturation of tile set < mean saturation of sprite set
- Detail budget: texture via 2-4px clusters (grass tufts, brick seams), NOT
  1px speckle. Dithering banned on tiles < 32px content.
- Transition logic: tiles must read as a continuous field (no visible grid
  boxes) — verified by in-game screenshot review

### Music (sequenced sample synthesis, GBA-MP2K-style)
- Instrument PALETTE: strings ensemble, brass, flute, ocarina, harp,
  choir, timpani, percussion (sample-based, NOT raw square waves)
- Form: 16-bar loops minimum (A 8 + B 8) — no 4-bar ostinato loops
- Dynamics: RMS varies ≥25% between sections (crescendo/drop)
- Voices: melody + counter-melody (thirds/sixths) + bass + pad = ≥4 voices
- Space: Schroeder reverb wet ~0.25; stereo width
- GATE-MUSIC: loop seam ≤0.02 join_diff; section-RMS variance ≥0.25;
  ≥4 concurrent voices detected in mid-loop window

### UI / fonts
- VT323 body, Press Start 2P display (shipped — keep)

## 3. Process (studio-style review cadence)

1. Asset generated → auto-processed (chroma-key, quantize, palette snap,
   cluster cleanup, despill)
2. **Gate battery** (design-spike/art_gates.py) — numeric pass/fail
3. In-game screenshot + vision-judge review (cohesion sheet)
4. Human review at milestone: only the owner (Choo) signs off visually
5. E2E suite must stay 32/32 — assets may never regress behavior

## 4. Do / Don't (quick reference)

DO: big clusters, hue-shifted ramps, plum outlines, desaturated terrain,
3-frame pose cycles, sampled instruments, A/B song forms.
DON'T: 1px speckle texture, pure black outlines, saturated busy floors,
copy-flip "animation", raw square-wave leads, 4-bar loops.