# Game Engine — Phaser 3 Patterns & Conventions

## Phaser Config

```javascript
const config = {
  type: Phaser.AUTO,
  width: 256,
  height: 224,
  pixelArt: true,           // disables anti-aliasing
  zoom: 3,                  // integer scaling (256×224 → 768×672)
  scene: [BootScene, TitleScene, OverworldScene, ...],
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 } }  // no gravity — top-down JRPG
  },
  input: {
    gamepad: true            // basic gamepad support
  }
};
```

## Scene Management

### Scene Structure
Each scene is a class extending `Phaser.Scene`:

```javascript
export default class OverworldScene extends Phaser.Scene {
  constructor() {
    super('Overworld');
  }

  preload() {
    // Load tilemaps, sprites, audio
  }

  create() {
    // Build the scene: tilemap, player sprite, NPCs, input
  }

  update(time, delta) {
    // Per-frame logic: movement, collision, encounters
  }
}
```

### Scene Transitions
```javascript
// Start a new scene, stop current
this.scene.start('Town', { townId: 'village1' });

// Launch overlay scene (runs on top, e.g., dialogue, menu)
this.scene.launch('Dialogue', { text: '...', portrait: '...' });
this.scene.pause('Overworld');  // pause underneath

// Resume when overlay closes
this.scene.resume('Overworld');
this.scene.stop('Dialogue');
```

### Key Scenes & Their Responsibilities

| Scene | Key | Role |
|---|---|---|
| BootScene | `Boot` | Load global assets, then → Title |
| TitleScene | `Title` | New Game / Load Game |
| OverworldScene | `Overworld` | World map, random encounters, enter areas |
| TownScene | `Town` | Town interior, NPCs, shops, inn, save |
| DungeonScene | `Dungeon` | Dungeon interior, puzzles, save points, boss |
| BattleScene | `Battle` | Turn-based combat |
| MenuScene | `Menu` | Party/inventory/equipment/jobs/save (overlay) |
| DialogueScene | `Dialogue` | Portrait + text box (overlay) |
| CutsceneScene | `Cutscene` | Scripted sequences |

## Tilemap Loading (Tiled → Phaser)

```javascript
preload() {
  this.load.tilemapTiledJSON('map', 'assets/tilesets/town1.json');
  this.load.image('tiles', 'assets/tilesets/town_tiles.png');
}

create() {
  const map = this.make.tilemap({ key: 'map' });
  const tileset = map.addTilesetImage('town_tiles', 'tiles');

  // Layers (order matters — background first)
  const groundLayer = map.createLayer('Ground', tileset);
  const decorLayer = map.createLayer('Decoration', tileset);
  const collisionLayer = map.createLayer('Collision', tileset);

  // Set collision on collision layer tiles
  collisionLayer.setCollisionByProperty({ collides: true });

  // Player + collision
  this.physics.add.collider(this.player, collisionLayer);
}
```

## Sprite Rendering

### Field Sprites (16×24)
```javascript
preload() {
  this.load.spritesheet('player', 'assets/sprites/player.png', {
    frameWidth: 16,
    frameHeight: 24
  });
}

create() {
  this.player = this.physics.add.sprite(x, y, 'player');

  // Walk animations (4 directions × 3 frames each)
  this.anims.create({
    key: 'walk-down',
    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 2 }),
    frameRate: 8,
    repeat: -1
  });
  // ... walk-up, walk-left, walk-right
}
```

### Battle Sprites (32×32)
Same pattern, larger frames. Idle, attack, hit, cast animations.

## Input Handling

```javascript
// Keyboard
const cursors = this.input.keyboard.createCursorKeys();
const keyZ = this.input.keyboard.addKey('Z');
const keyX = this.input.keyboard.addKey('X');
const keyShift = this.input.keyboard.addKey('SHIFT');

// Gamepad
this.input.gamepad.once('connected', (pad) => {
  this.gamepad = pad;
});

// In update():
if (cursors.left.isDown || (this.gamepad && this.gamepad.left)) {
  // move left
}
```

## Audio

```javascript
preload() {
  this.load.audio('town-theme', 'assets/audio/town1.mp3');
  this.load.audio('menu-select', 'assets/audio/sfx/select.wav');
}

create() {
  // Music (loop)
  this.music = this.sound.add('town-theme', { loop: true, volume: 0.5 });
  this.music.play();

  // SFX (one-shot)
  this.sound.play('menu-select');
}
```

## Pixel-Perfect Rendering
- `pixelArt: true` in config handles most of it
- Sprites must be designed at native resolution (16×24, 32×32)
- Never scale sprites with smoothing — use integer multiples
- Camera zoom uses integer values