import Phaser from 'phaser';

/**
 * TownScene — town interior.
 * Phase 1: tilemap, player movement, exit back to overworld.
 *
 * The town is a simple 16×12 tile map (512×384 at 32px tiles).
 * Contains a few buildings (solid wall tiles), paths, and an exit.
 *
 * Tile indices:
 *   0 = stone floor, 1 = stone wall (solid), 2 = path,
 *   3 = building wall (solid), 4 = building roof (solid), 5 = wood floor
 *
 * Exit: bottom-center tile triggers return to Overworld.
 */

const TILE_SIZE = 32;
const MAP_COLS = 16;
const MAP_ROWS = 12;

// Tile indices
const T_FLOOR = 0;
const T_WALL = 1;
const T_PATH = 2;
const T_BUILDING_WALL = 3;
const T_BUILDING_ROOF = 4;
const T_WOOD = 5;

// Solid tiles
const SOLID_TILES = [T_WALL, T_BUILDING_WALL, T_BUILDING_ROOF];

// Exit position (bottom-center)
const EXIT_X = 8;
const EXIT_Y = 11;

export default class TownScene extends Phaser.Scene {
  constructor() {
    super('Town');
  }

  create() {
    // Build the town map data
    const mapData = this.generateMapData();

    // Create tilemap
    const map = this.make.tilemap({
      data: mapData,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE
    });

    const tileset = map.addTilesetImage('town_tiles', 'town_tiles', TILE_SIZE, TILE_SIZE);
    const groundLayer = map.createLayer(0, tileset, 0, 0);

    // Set collision on solid tiles
    groundLayer.setCollision([T_WALL, T_BUILDING_WALL, T_BUILDING_ROOF]);

    // Player starts at the exit position (entering from below)
    const playerStartX = EXIT_X * TILE_SIZE + TILE_SIZE / 2;
    const playerStartY = (EXIT_Y - 1) * TILE_SIZE + TILE_SIZE / 2;

    this.player = this.physics.add.sprite(playerStartX, playerStartY, 'player_field', 1);

    // Stop instantly when velocity is set to 0 (no sliding/deceleration)
    this.player.body.setDrag(0, 0);

    // Animations (same as overworld)
    this.createAnimations();
    this.player.anims.play('walk-down', false);
    this.player.anims.pause();

    // Collision
    this.physics.add.collider(this.player, groundLayer);

    // --- NPC (townsperson) ---
    // Place an NPC near the center of town
    this.npcs = [];

    // NPC 1: Townsperson near the central path
    const npc1X = 6 * TILE_SIZE + TILE_SIZE / 2;
    const npc1Y = 5 * TILE_SIZE + TILE_SIZE / 2;
    const npc1 = this.physics.add.staticSprite(npc1X, npc1Y, 'player_field', 1);
    npc1.setData('dialogue', {
      speaker: 'Townsfolk',
      portrait: null,
      pages: [
        'Welcome to our town, traveler.',
        'You seek the ancient relics? Dangerous business, that.',
        'But I can see it in your eyes... you won\'t be dissuaded.',
        'Be careful out there. The world is not as kind as this town.'
      ]
    });
    npc1.setData('name', 'Townsfolk');
    this.npcs.push(npc1);

    // NPC 2: Village elder near the right building
    const npc2X = 11 * TILE_SIZE + TILE_SIZE / 2;
    const npc2Y = 5 * TILE_SIZE + TILE_SIZE / 2;
    const npc2 = this.physics.add.staticSprite(npc2X, npc2Y, 'player_field', 1);
    npc2.setTint(0x888888); // slightly different color to distinguish
    npc2.setData('dialogue', {
      speaker: 'Elder',
      portrait: null,
      pages: [
        'The prophecy speaks of one who will gather the ancient relics.',
        'I had hoped it was just a story told to children.',
        '...But here you stand before me.',
        'Will you take on this burden?'
      ],
      choices: [
        { text: 'I will.', value: 'accept' },
        { text: 'I\'m not sure yet...', value: 'hesitant' }
      ]
    });
    npc2.setData('name', 'Elder');
    this.npcs.push(npc2);

    // Prevent walking through NPCs
    this.npcs.forEach(npc => {
      this.physics.add.collider(this.player, npc);
    });

    this.nearbyNpc = null;
    this.interactPrompt = null;

    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);

    // Fade in
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Input — raw DOM keyboard events (same as OverworldScene)
    this.keyShift = this.input.keyboard.addKey('SHIFT');

    this.keys = { up: false, down: false, left: false, right: false };
    this.confirmPressed = false; // one-shot flag, reset each frame

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

    // Exit marker
    const exitX = EXIT_X * TILE_SIZE + TILE_SIZE / 2;
    const exitY = EXIT_Y * TILE_SIZE + TILE_SIZE / 2;
    const exitMarker = this.add.text(exitX, exitY, '▲', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffff00',
      align: 'center'
    });
    exitMarker.setOrigin(0.5);

    this.tweens.add({
      targets: exitMarker,
      alpha: 0,
      duration: 400,
      yoyo: true,
      repeat: -1
    });

    // Status text
    this.statusText = this.add.text(8, 8, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#000000'
    });
    this.statusText.setScrollFactor(0);
    this.statusText.setText('Town — Walk to the ▲ marker and press Z to exit');

    this.facing = 'down';
    this.transitioning = false;
    this.dialogueActive = false;
  }

  update(time, delta) {
    if (this.transitioning) return;
    if (this.dialogueActive) return; // pause movement during dialogue

    const speed = this.keyShift.isDown ? 180 : 100;

    let vx = 0;
    let vy = 0;
    let moving = false;

    // Horizontal
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

    if (moving) {
      const animKey = `walk-${this.facing}`;
      if (this.player.anims.currentAnim?.key !== animKey) {
        this.player.anims.play(animKey, true);
      }
    } else {
      this.player.anims.pause();
      const frameMap = { down: 1, left: 4, right: 7, up: 10 };
      this.player.setFrame(frameMap[this.facing] ?? 1);
    }

    // Check exit
    const playerTileX = Math.floor(this.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / TILE_SIZE);

    const nearExit =
      Math.abs(playerTileX - EXIT_X) <= 1 &&
      Math.abs(playerTileY - EXIT_Y) <= 1;

    if (nearExit && this.confirmPressed) {
      this.confirmPressed = false;
      this.exitTown();
    }

    // Gamepad A button
    if (nearExit && this.gamepad && this.gamepad.A) {
      this.exitTown();
    }

    // --- NPC interaction ---
    // Find the nearest NPC within 1.5 tiles
    this.nearbyNpc = null;
    let minDist = TILE_SIZE * 1.5;
    for (const npc of this.npcs) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (dist < minDist) {
        minDist = dist;
        this.nearbyNpc = npc;
      }
    }

    // Show/hide interaction prompt
    if (this.nearbyNpc && !this.dialogueActive) {
      if (!this.interactPrompt) {
        this.interactPrompt = this.add.text(this.nearbyNpc.x, this.nearbyNpc.y - 20, 'Press Z', {
          fontFamily: '"Courier New", monospace',
          fontSize: '10px',
          color: '#ffff00',
          backgroundColor: '#000000',
          padding: { x: 2, y: 1 }
        });
        this.interactPrompt.setOrigin(0.5);
        this.interactPrompt.setDepth(100);
      } else {
        this.interactPrompt.setPosition(this.nearbyNpc.x, this.nearbyNpc.y - 20);
        this.interactPrompt.setVisible(true);
      }
    } else if (this.interactPrompt) {
      this.interactPrompt.setVisible(false);
    }

    // Talk to NPC on Z/Enter press
    if (this.nearbyNpc && this.confirmPressed && !this.dialogueActive) {
      this.confirmPressed = false;
      this.talkToNpc(this.nearbyNpc);
    }

    // Reset one-shot flag at end of frame
    this.confirmPressed = false;
  }

  talkToNpc(npc) {
    if (this.dialogueActive) return;
    this.dialogueActive = true;
    if (this.interactPrompt) this.interactPrompt.setVisible(false);

    // Stop player movement
    this.player.setVelocity(0, 0);
    this.player.anims.pause();
    const frameMap = { down: 1, left: 4, right: 7, up: 10 };
    this.player.setFrame(frameMap[this.facing] ?? 1);

    // Launch dialogue scene as overlay
    const dialogueData = npc.getData('dialogue');
    this.scene.launch('Dialogue', {
      ...dialogueData,
      onComplete: (choiceValue) => {
        this.dialogueActive = false;
        if (choiceValue) {
          console.log(`Player chose: ${choiceValue}`);
        }
      }
    });
  }

  exitTown() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Overworld');
    });
  }

  createAnimations() {
    // Only create if they don't already exist (shared across scenes)
    if (!this.anims.exists('walk-down')) {
      this.anims.create({
        key: 'walk-down',
        frames: this.anims.generateFrameNumbers('player_field', { start: 0, end: 2 }),
        frameRate: 8,
        repeat: -1
      });
      this.anims.create({
        key: 'walk-left',
        frames: this.anims.generateFrameNumbers('player_field', { start: 3, end: 5 }),
        frameRate: 8,
        repeat: -1
      });
      this.anims.create({
        key: 'walk-right',
        frames: this.anims.generateFrameNumbers('player_field', { start: 6, end: 8 }),
        frameRate: 8,
        repeat: -1
      });
      this.anims.create({
        key: 'walk-up',
        frames: this.anims.generateFrameNumbers('player_field', { start: 9, end: 11 }),
        frameRate: 8,
        repeat: -1
      });
    }
  }

  /**
   * Generate a simple town map.
   * 16×12 tiles with buildings, paths, and an exit at the bottom.
   */
  generateMapData() {
    const map = [];
    for (let y = 0; y < MAP_ROWS; y++) {
      const row = [];
      for (let x = 0; x < MAP_COLS; x++) {
        let tile = T_FLOOR;

        // Border walls
        if (x === 0 || x === MAP_COLS - 1 || y === 0) {
          tile = T_WALL;
        }

        // Bottom border — except exit
        if (y === MAP_ROWS - 1) {
          if (x === EXIT_X) {
            tile = T_PATH; // exit gap
          } else {
            tile = T_WALL;
          }
        }

        // Building 1 (top-left)
        if (x >= 2 && x <= 4 && y >= 2 && y <= 3) {
          tile = y === 2 ? T_BUILDING_ROOF : T_BUILDING_WALL;
        }

        // Building 2 (top-right)
        if (x >= 10 && x <= 13 && y >= 2 && y <= 3) {
          tile = y === 2 ? T_BUILDING_ROOF : T_BUILDING_WALL;
        }

        // Building 3 (mid-left)
        if (x >= 2 && x <= 4 && y >= 6 && y <= 8) {
          tile = y === 6 ? T_BUILDING_ROOF : T_BUILDING_WALL;
        }

        // Building 4 (mid-right)
        if (x >= 10 && x <= 13 && y >= 6 && y <= 8) {
          tile = y === 6 ? T_BUILDING_ROOF : T_BUILDING_WALL;
        }

        // Central path
        if (x === EXIT_X && y >= 3 && y <= MAP_ROWS - 1) {
          tile = T_PATH;
        }

        // Horizontal path
        if (y === 5 && x >= 2 && x <= MAP_COLS - 3) {
          tile = T_PATH;
        }

        // Wood floor near buildings (porches)
        if ((x === 5 && y >= 2 && y <= 3) || (x === 9 && y >= 2 && y <= 3)) {
          tile = T_WOOD;
        }

        row.push(tile);
      }
      map.push(row);
    }

    return map;
  }
}