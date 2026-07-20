# Prerequisites — Environment Setup

## Required Software

| Tool | Version | Purpose |
|---|---|---|
| Node.js | LTS (v20+) | JavaScript runtime, package manager |
| npm | bundled with Node | Dependency management |
| Vite | latest (via npm) | Dev server + build tool |
| Phaser 3 | 3.80+ | Game engine |
| Tiled | 1.10+ | Tilemap editor (for towns/dungeons/overworld) |
| Modern browser | Chrome/Firefox | Testing |

## Project Setup

```bash
# From project root
npm init -y
npm install phaser
npm install -D vite

# Start dev server
npx vite

# Build for production
npx vite build
```

## Project Structure

```
game-project/
├── DESIGN-DOCUMENT.md          # Canonical spec
├── PROGRESS.md                 # Build log
├── .agent/                     # Agent skills (this directory)
├── package.json
├── vite.config.js
├── index.html                  # Vite entry point
├── src/
│   ├── main.js                 # Phaser game config + instance
│   ├── scenes/
│   │   ├── BootScene.js        # Asset loading, init
│   │   ├── TitleScene.js       # Title screen, new/load game
│   │   ├── NameEntryScene.js   # Player name input
│   │   ├── JobChoiceScene.js   # Starting job selection
│   │   ├── OverworldScene.js   # World map exploration
│   │   ├── TownScene.js        # Town interiors
│   │   ├── DungeonScene.js     # Dungeon interiors + puzzles
│   │   ├── BattleScene.js      # Turn-based combat
│   │   ├── MenuScene.js        # Party/inventory/equipment/save
│   │   ├── DialogueScene.js    # Dialogue overlay (portrait + text)
│   │   ├── CutsceneScene.js    # Scripted story sequences
│   │   ├── ShopScene.js        # Buy/sell
│   │   └── InnScene.js         # Rest + restore
│   ├── systems/
│   │   ├── combat.js           # Combat engine (turn order, damage, actions)
│   │   ├── jobs.js             # Job data, abilities, growth curves
│   │   ├── save.js             # Save/load (localStorage)
│   │   ├── events.js           # Event triggers, story flags, cutscenes
│   │   └── puzzles.js          # Field puzzle logic (push blocks, switches)
│   ├── data/
│   │   ├── characters.json     # Party member definitions
│   │   ├── enemies.json        # Enemy stats + abilities
│   │   ├── items.json          # Items (potions, key items, etc.)
│   │   ├── spells.json         # Magic spells
│   │   ├── jobs.json           # Job classes, stats, abilities
│   │   └── encounters.json     # Fixed encounter formations per area
│   └── assets/
│       ├── sprites/            # Character + enemy spritesheets
│       ├── tilesets/           # Tiled tilesets + exported JSON maps
│       ├── audio/              # Music + SFX
│       └── ui/                 # UI elements, portraits, icons
```

## Key Technical Constraints
- **Resolution:** 256×224 internal, scaled up with integer scaling
- **Rendering:** `image-rendering: pixelated`, no anti-aliasing
- **Platform:** Web browser, desktop-first
- **Save:** localStorage (key-value), 3 slots + autosave
- **No external API calls** — fully client-side, no backend