import Phaser from 'phaser';

/**
 * OverworldScene — world map exploration.
 * Uses DOM overlays for text (crisp at any resolution).
 */

const TILE_SIZE = 32;
const MAP_COLS = 20;
const MAP_ROWS = 16;

const T_GRASS_DARK = 0;
const T_GRASS_LIGHT = 1;
const T_FOREST = 2;
const T_MOUNTAIN = 3;
const T_WATER = 4;
const T_PATH = 5;
const T_BRIDGE = 6;

const TOWN_ENTRANCE_X = 10;
const TOWN_ENTRANCE_Y = 8;

export default class OverworldScene extends Phaser.Scene {
  constructor() {
    super('Overworld');
  }

  create() {
    this.domElements = [];

    const mapData = this.generateMapData();
    const map = this.make.tilemap({ data: mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('overworld_tiles', 'overworld_tiles', TILE_SIZE, TILE_SIZE);
    const groundLayer = map.createLayer(0, tileset, 0, 0);
    groundLayer.setCollisionByExclusion([T_GRASS_DARK, T_GRASS_LIGHT, T_PATH, T_BRIDGE]);

    const playerStartX = TOWN_ENTRANCE_X * TILE_SIZE + TILE_SIZE / 2;
    const playerStartY = (TOWN_ENTRANCE_Y + 2) * TILE_SIZE + TILE_SIZE / 2;
    this.player = this.physics.add.sprite(playerStartX, playerStartY, 'player_field', 1);
    this.player.body.setDrag(0, 0);

    this.createAnimations();
    this.player.anims.play('walk-down', false);
    this.player.anims.pause();

    this.physics.add.collider(this.player, groundLayer);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);

    // Input — raw DOM keyboard events
    this.keyShift = this.input.keyboard.addKey('SHIFT');
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
      this.keys.up = false; this.keys.down = false; this.keys.left = false; this.keys.right = false;
    };

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
      window.removeEventListener('blur', this.handleBlur);
      this.cleanupDom();
    });

    this.gamepad = null;
    this.input.gamepad.once('connected', (pad) => { this.gamepad = pad; });
    if (this.input.gamepad && this.input.gamepad.total > 0) {
      this.gamepad = this.input.gamepad.getPad(0);
    }

    // --- DOM text overlays ---
    const container = document.getElementById('game-container');

    // Status text (top-left, fixed)
    this.statusDiv = document.createElement('div');
    this.statusDiv.style.cssText = `
      position: absolute; left: 4px; top: 4px;
      color: #ffffff; background: rgba(0,0,0,0.7);
      font-family: "Courier New", monospace; font-size: 11px;
      padding: 2px 4px; border-radius: 2px;
      pointer-events: none; z-index: 10;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    this.statusDiv.textContent = 'Walk to the ▼ marker and press Z to enter town';
    container.appendChild(this.statusDiv);
    this.domElements.push(this.statusDiv);

    // Entrance marker (▼) — positioned over the entrance tile, blinks
    const entranceX = TOWN_ENTRANCE_X * TILE_SIZE + TILE_SIZE / 2;
    const entranceY = TOWN_ENTRANCE_Y * TILE_SIZE + TILE_SIZE / 2;
    this.entranceDiv = document.createElement('div');
    this.entranceDiv.style.cssText = `
      position: absolute;
      color: #ffff00; font-size: 18px;
      font-family: "Courier New", monospace;
      transform: translate(-50%, -50%);
      pointer-events: none; z-index: 10;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    this.entranceDiv.textContent = '▼';
    container.appendChild(this.entranceDiv);
    this.domElements.push(this.entranceDiv);

    // Blink entrance marker
    this.entranceBlink = setInterval(() => {
      this.entranceDiv.style.opacity = this.entranceDiv.style.opacity === '0' ? '1' : '0';
    }, 400);

    this.facing = 'down';
    this.transitioning = false;

    // --- Random encounter system ---
    this.encounterSteps = 0;
    this.encounterThreshold = 15 + Math.floor(Math.random() * 10); // 15-25 steps
  }

  update(time, delta) {
    if (this.transitioning) return;

    // Update entrance marker position to follow camera
    const cam = this.cameras.main;
    const entranceWorldX = TOWN_ENTRANCE_X * TILE_SIZE + TILE_SIZE / 2;
    const entranceWorldY = TOWN_ENTRANCE_Y * TILE_SIZE + TILE_SIZE / 2;
    const canvas = document.querySelector('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const sx = canvasRect.width / cam.worldView.width;
    const sy = canvasRect.height / cam.worldView.height;
    this.entranceDiv.style.left = ((entranceWorldX - cam.scrollX) * sx) + 'px';
    this.entranceDiv.style.top = ((entranceWorldY - cam.scrollY) * sy) + 'px';

    const speed = this.keyShift.isDown ? 180 : 100;
    let vx = 0, vy = 0, moving = false;

    if (this.keys.right) { vx = speed; this.facing = 'right'; moving = true; }
    else if (this.keys.left) { vx = -speed; this.facing = 'left'; moving = true; }

    if (this.keys.down) { vy = speed; this.facing = 'down'; moving = true; }
    else if (this.keys.up) { vy = -speed; this.facing = 'up'; moving = true; }

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
    if (nearEntrance && this.gamepad && this.gamepad.A) {
      this.enterTown();
    }

    // --- Random encounter check ---
    if (moving && !nearEntrance) {
      this.encounterSteps++;
      if (this.encounterSteps >= this.encounterThreshold) {
        this.encounterSteps = 0;
        this.encounterThreshold = 15 + Math.floor(Math.random() * 10);
        this.startBattle();
      }
    }
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

  startBattle() {
    if (this.transitioning) return;
    this.transitioning = true;
    // Stop player movement immediately
    this.player.setVelocity(0, 0);
    // Hide overworld DOM elements immediately (before fade, so they don't float during transition)
    this.domElements.forEach(el => el.style.display = 'none');
    if (this.entranceBlink) clearInterval(this.entranceBlink);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.launch('Battle', {
        returnScene: 'Overworld',
        enemies: ['slime', 'slime'],
      });
      this.scene.pause();
    });
    // Resume from battle when it ends — only register once
    if (!this._resumeHandlerRegistered) {
      this._resumeHandlerRegistered = true;
      this.events.on('resume', (data) => {
        this.transitioning = false;
        // Restore overworld DOM elements
        this.domElements.forEach(el => el.style.display = '');
        this.entranceBlink = setInterval(() => {
          this.entranceDiv.style.opacity = this.entranceDiv.style.opacity === '0' ? '1' : '0';
        }, 400);
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
    }
  }

  cleanupDom() {
    if (this.entranceBlink) clearInterval(this.entranceBlink);
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
  }

  shutdown() { this.cleanupDom(); }

  createAnimations() {
    if (!this.anims.exists('walk-down')) {
      this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('player_field', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-left', frames: this.anims.generateFrameNumbers('player_field', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player_field', { start: 6, end: 8 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('player_field', { start: 9, end: 11 }), frameRate: 8, repeat: -1 });
    }
  }

  generateMapData() {
    const map = [];
    for (let y = 0; y < MAP_ROWS; y++) {
      const row = [];
      for (let x = 0; x < MAP_COLS; x++) {
        let tile = (x + y) % 2 === 0 ? T_GRASS_DARK : T_GRASS_LIGHT;
        if (x === 0 || x === MAP_COLS - 1 || y === 0 || y === MAP_ROWS - 1) tile = T_FOREST;
        if (x >= 14 && x <= 18 && y >= 1 && y <= 4) tile = T_WATER;
        if (x >= 1 && x <= 4 && y >= 11 && y <= 14) tile = T_MOUNTAIN;
        if (x === TOWN_ENTRANCE_X && y > TOWN_ENTRANCE_Y && y < MAP_ROWS - 1) tile = T_PATH;
        if (x === TOWN_ENTRANCE_X && y >= TOWN_ENTRANCE_Y && y <= TOWN_ENTRANCE_Y) tile = T_PATH;
        row.push(tile);
      }
      map.push(row);
    }
    return map;
  }
}