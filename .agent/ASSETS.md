# Assets — Sprites, Tilesets, Audio

## Asset Strategy
**Hybrid approach:** AI concept art for direction → curated free asset packs for final game.

### Sourcing Free Assets
1. **itch.io** — Search "GBA JRPG asset pack", "pixel art RPG sprites", "16x16 tileset"
2. **OpenGameArt.org** — Search "JRPG", "turn-based", "pixel art RPG"
3. **Kenney.nl** — Free game asset packs (CC0 license)

### Selection Criteria
- Must match GBA/SNES pixel art aesthetic (Fire Emblem GBA / FFTA style)
- Correct dimensions: 16×24 field sprites, 32×32 battle sprites, 32×32 tiles
- Includes animation frames (walk cycles, attack poses)
- Consistent art style across the pack
- License allows free use (CC0, CC-BY, or similar)

## Asset Organization

```
src/assets/
├── sprites/
│   ├── characters/        # Party member field + battle sprites
│   │   ├── soren_field.png
│   │   ├── soren_battle.png
│   │   ├── thief_field.png
│   │   └── ...
│   ├── enemies/           # Enemy battle sprites
│   │   ├── slime.png
│   │   ├── goblin.png
│   │   └── ...
│   └── portraits/         # FFTA-style dialogue portraits
│       ├── soren.png
│       ├── party_knight.png
│       └── ...
├── tilesets/
│   ├── overworld/         # Overworld map tiles
│   ├── towns/             # Town tilesets
│   ├── dungeons/          # Dungeon tilesets
│   └── maps/              # Exported Tiled JSON files
├── audio/
│   ├── music/             # BGM tracks (.mp3 or .ogg)
│   └── sfx/               # Sound effects (.wav or .ogg)
└── ui/
    ├── dialogue_box.png   # Text box background
    ├── menu_bg.png        # Menu background
    ├── cursor.png         # Menu cursor
    └── health_bar.png     # HP/MP bars
```

## Spritesheet Conventions

### Field Sprite Sheet (16×24 per frame)
```
Layout (typical):
Row 0: walk-down   (3 frames: left-foot, stand, right-foot)
Row 1: walk-left   (3 frames)
Row 2: walk-right  (3 frames)
Row 3: walk-up     (3 frames)
```
- 12 frames total per character
- Frame rate: 8 fps for walking
- Standing = middle frame of each row

### Battle Sprite Sheet (32×32 per frame)
```
Layout (typical):
Row 0: idle       (2-4 frames, subtle breathing)
Row 1: attack     (3-4 frames, swing + recover)
Row 2: hit/damage (1-2 frames, recoil)
Row 3: cast       (3-4 frames, spell animation)
Row 4: KO/down    (1 frame, fallen)
```

### Enemy Sprite Sheet (32×32 per frame)
```
Row 0: idle       (2-4 frames)
Row 1: attack     (3-4 frames)
Row 2: hit        (1-2 frames)
Row 3: death      (2-3 frames, fade or collapse)
```

## Tileset Conventions

### Tile Size: 32×32
- Tilesets are PNG grids of 32×32 tiles
- Import into Tiled map editor
- Export maps as JSON (Phaser loads these directly)

### Tile Properties (set in Tiled)
| Property | Value | Purpose |
|---|---|---|
| `collides` | true/false | Solid tiles block movement |
| `interactive` | true/false | Can be examined (signs, chests) |
| `savePoint` | true/false | Save point tile |
| `encounter` | true/false | Random encounter zone |
| `door` | target map | Warp to another map |
| `puzzle` | puzzle type | Push block, switch, etc. |

## Audio Conventions

### Music
- Format: .mp3 or .ogg (ogg preferred for smaller size)
- Loop seamlessly
- Volume normalized across tracks

### SFX
- Format: .wav or .ogg
- Short duration (< 1 second for most SFX)
- One sound per file

## Naming Conventions
- Lowercase, hyphenated: `walk-down`, `town-theme`, `menu-select`
- Character sprites: `{name}_{context}.png` (e.g., `soren_field.png`)
- Enemy sprites: `{enemy_name}.png` (e.g., `slime.png`)
- Maps: `{area_type}_{name}.json` (e.g., `town_village1.json`, `dungeon_relic1.json`)