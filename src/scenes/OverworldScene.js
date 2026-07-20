import Phaser from 'phaser';

/**
 * OverworldScene — world map exploration.
 * Phase 1: tilemap, player movement (4-dir + sprint), collision, town entrance.
 *
 * The overworld is a simple 20×16 tile map (640×512 at 32px tiles).
 * Camera follows player. A town entrance tile triggers transition to TownScene.
 *
 * Tile indices:
 *   0 = grass (dark), 1 = grass (light), 2 = forest, 3 = mountain (solid),
 *   4 = water (solid), 5 = path, 6 = bridge
 *
 * Collision: tiles 2 (forest), 3 (mountain), 4 (water) are solid.
 * Town entrance: a specific tile position triggers scene change.
 */

const TILE_SIZE = 32;
const MAP_COLS = 20;
const MAP_ROWS = 16;

// Tile indices
const T_GRASS_DARK = 0;
const T_GRASS_LIGHT = 1;
const T_FOREST = 2;
const T_MOUNTAIN = 3;
const T_WATER = 4;
const T_PATH = 5;
const T_BRIDGE = 6;

// Solid tiles (block movement)
const SOLID_TILES = [T_FOREST, T_MOUNTAIN, T_WATER];

// Town entrance position (tile coords)
const TOWN_ENTRANCE_X = 10;
const TOWN_ENTRANCE_Y = 8;

export default class OverworldScene extends Phaser.Scene {
  constructor() {
    super('Overworld');
  }

  create() {
    // Build the tilemap data array
    const mapData = this.generateMapData();

    // Create tilemap from generated data
    const map = this.make.tilemap({
      data: mapData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE
    });

    // Add tileset image (generated in BootScene)
    const tileset = map.addTilesetImage('overworld_tiles', 'overworld_tiles', TILE_SIZE, TILE_SIZE);

    // Create the ground layer
    const groundLayer = map.createLayer(0, tileset, 0, 0);

    // Set collision on solid tiles
    groundLayer.setCollisionByExclusion([T_GRASS_DARK, T_GRASS_LIGHT, T_PATH, T_BRIDGE]);

    // Create player at center-ish of map
    const playerStartX = TOWN_ENTRANCE_X * TILE_SIZE + TILE_SIZE / 2;
    const playerStartY = (TOWN_ENTRANCE_Y + 2) * TILE_SIZE + TILE_SIZE / 2;

    this.player = this.physics.add.sprite(playerStartX, playerStartY, 'player_field', 1);

    // Stop instantly when velocity is set to 0 (no sliding/deceleration)
    this.player.body.setDrag(0, 0);

    // Player walk animations
    this.createAnimations();

    // Play idle-down
    this.player.anims.play('walk-down', false);
    this.player.anims.pause();

    // Collision
    this.physics.add.collider(this.player, groundLayer);

    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);

    // Input — use raw DOM keyboard events instead of Phaser's keyboard plugin
    this.keyShift = this.input.keyboard.addKey('SHIFT');

    // Raw key state tracking
    this.keys = { up: false, down: false, left: false, right: false };
    this.confirmPressed = false;

    this.handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': this.keys.up = true; e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S': this.keys.down = true; e.preventDefault(); break;
        case 'ArrowLeft': case 'a': case 'A': this.keys.left = true; e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D': this.keys.right = true; e.preventDefault(); break;
        case 'z': case 'Z': case 'Enter': this.confirmPressed = true; e.preventDefault(); break;
      }
    };

    this.handleKeyUp = (e) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': this.keys.up = false; break;
        case 'ArrowDown': case 's': case 'S': this.keys.down = false; break;
        case 'ArrowLeft': case 'a': case 'A': this.keys.left = false; break;
        case 'ArrowRight': case 'd': case 'D': this.keys.right = false; break;
      }
    };

    this.handleBlur = () => {
      this.keys.up = false;
      this.keys.down = false;
      this.keys.left = false;
      this.keys.right = false;
    };

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('blur', this.handleBlur);
    });

    // Gamepad
    this.gamepad = null;
    this.input.gamepad.once('connected', (pad) => {
      this.gamepad = pad;
    });
    if (this.input.gamepad && this.input.gamepad.total > 0) {
      this.gamepad = this.input.gamepad.getPad(0);
    }

    // Town entrance indicator (a small visual marker)
    const entranceX = TOWN_ENTRANCE_X * TILE_SIZE + TILE_SIZE / 2;
    const entranceY = TOWN_ENTRANCE_Y * TILE_SIZE + TILE_SIZE / 2;
    const entranceMarker = this.add.text(entranceX, entranceY, '▼', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffff00',
      align: 'center'
    });
    entranceMarker.setOrigin(0.5);

    // Blink the entrance marker
    this.tweens.add({
      targets: entranceMarker,
      alpha: 0,
      duration: 400,
      yoyo: true,
      repeat: -1
    });

    // Status text (top-left, stays on screen)
    this.statusText = this.add.text(8, 8, 'Overworld — Phase 1 Demo', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#000000'
    });
    this.statusText.setScrollFactor(0);

    this.statusText.setText('Overworld — Walk to the ▼ marker and press Z to enter town');

    // Track facing direction for interaction
    this.facing = 'down';

    // Flag to prevent rapid scene transitions
    this.transitioning = false;
  }

  update(time, delta) {
    if (this.transitioning) return;

    const speed = this.keyShift.isDown ? 180 : 100;

    let vx = 0;
    let vy = 0;
    let moving = false;

    // Horizontal — last pressed wins via tracking order
    if (this.keys.right) {
      vx = speed;
      this.facing = 'right';
      moving = true;
    } else if (this.keys.left) {
      vx = -speed;
      this.facing = 'left';
      moving = true;
    }

    // Vertical (overrides horizontal facing if pressed)
    if (this.keys.down) {
      vy = speed;
      this.facing = 'down';
      moving = true;
    } else if (this.keys.up) {
      vy = -speed;
      this.facing = 'up';
      moving = true;
    }

    this.player.setVelocity(vx, vy);

    // Animation
    if (moving) {
      const animKey = `walk-${this.facing}`;
      if (this.player.anims.currentAnim?.key !== animKey) {
        this.player.anims.play(animKey, true);
      }
    } else {
      this.player.anims.pause();
      // Reset to standing frame (middle frame = 1)
      const frameMap = { down: 1, left: 4, right: 7, up: 10 };
      this.player.setFrame(frameMap[this.facing] ?? 1);
    }

    // Check town entrance (Z or Enter near entrance tile)
    const playerTileX = Math.floor(this.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / TILE_SIZE);

    const nearEntrance =
      Math.abs(playerTileX - TOWN_ENTRANCE_X) <= 1 &&
      Math.abs(playerTileY - TOWN_ENTRANCE_Y) <= 1;

    if (nearEntrance && this.confirmPressed) {
      this.confirmPressed = false;
      this.enterTown();
    }

    // Gamepad A button
    if (nearEntrance && this.gamepad && this.gamepad.A) {
      this.enterTown();
    }

    // Reset one-shot flag at end of frame
    this.confirmPressed = false;
  }

  enterTown() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Town');
    });
  }

  createAnimations() {
    // Walk down: frames 0-2
    this.anims.create({
      key: 'walk-down',
      frames: this.anims.generateFrameNumbers('player_field', { start: 0, end: 2 }),
      frameRate: 8,
      repeat: -1
    });

    // Walk left: frames 3-5
    this.anims.create({
      key: 'walk-left',
      frames: this.anims.generateFrameNumbers('player_field', { start: 3, end: 5 }),
      frameRate: 8,
      repeat: -1
    });

    // Walk right: frames 6-8
    this.anims.create({
      key: 'walk-right',
      frames: this.anims.generateFrameNumbers('player_field', { start: 6, end: 8 }),
      frameRate: 8,
      repeat: -1
    });

    // Walk up: frames 9-11
    this.anims.create({
      key: 'walk-up',
      frames: this.anims.generateFrameNumbers('player_field', { start: 9, end: 11 }),
      frameRate: 8,
      repeat: -1
    });
  }

  /**
   * Generate a simple overworld map.
   * 20×16 tiles with grass, forest borders, a path, water, and a town entrance.
   */
  generateMapData() {
    const map = [];
    for (let y = 0; y < MAP_ROWS; y++) {
      const row = [];
      for (let x = 0; x < MAP_COLS; x++) {
        // Default: grass
        let tile = (x + y) % 2 === 0 ? T_GRASS_DARK : T_GRASS_LIGHT;

        // Forest border (edges)
        if (x === 0 || x === MAP_COLS - 1 || y === 0 || y === MAP_ROWS - 1) {
          tile = T_FOREST;
        }

        // Water lake (top-right area)
        if (x >= 14 && x <= 18 && y >= 1 && y <= 4) {
          tile = T_WATER;
        }

        // Mountains (bottom-left area)
        if (x >= 1 && x <= 4 && y >= 11 && y <= 14) {
          tile = T_MOUNTAIN;
        }

        // Path from south to town entrance
        if (x === TOWN_ENTRANCE_X && y > TOWN_ENTRANCE_Y && y < MAP_ROWS - 1) {
          tile = T_PATH;
        }

        // Path leading to town entrance from south
        if (x === TOWN_ENTRANCE_X && y >= TOWN_ENTRANCE_Y && y <= TOWN_ENTRANCE_Y) {
          tile = T_PATH;
        }

        row.push(tile);
      }
      map.push(row);
    }

    return map;
  }
}