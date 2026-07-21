import Phaser from 'phaser';
import GameState from '../game/GameState.js';

/**
 * DungeonScene — first dungeon: Ancient Ruins.
 * Features: tilemap, random encounters, push-block puzzle, save point, boss fight.
 */

const TILE_SIZE = 32;
const MAP_COLS = 20;
const MAP_ROWS = 15;

// Tile types
const T_FLOOR = 0;
const T_WALL = 1;
const T_PIT = 2;
const T_CHEST = 3;
const T_DOOR = 4;
const T_SAVE = 5;
const T_BOSS = 6;
const T_BLOCK = 7;    // pushable block
const T_SWITCH = 8;   // pressure plate
const T_EXIT = 9;

export default class DungeonScene extends Phaser.Scene {
  constructor() {
    super('Dungeon');
  }

  create(data) {
    this.domElements = [];
    this.transitioning = false;
    this.dialogueActive = false;
    this.encounterSteps = 0;
    this.encounterThreshold = 15 + Math.floor(Math.random() * 10);

    // Generate dungeon layout
    this.mapData = this.generateDungeon();
    this.puzzleSolved = false;
    this.blockSprites = [];
    this.switchStates = [false, false];

    const container = document.getElementById('game-container');

    // Create tilemap from generated data
    const map = this.make.tilemap({ data: this.mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('town_tiles', 'town_tiles', TILE_SIZE, TILE_SIZE);
    this.groundLayer = map.createLayer(0, tileset, 0, 0);
    this.groundLayer.setCollision([T_WALL, T_PIT, T_CHEST, T_DOOR, T_BOSS]);

    // Player start — entrance at bottom center
    const startX = Math.floor(MAP_COLS / 2) * TILE_SIZE + TILE_SIZE / 2;
    const startY = (MAP_ROWS - 2) * TILE_SIZE + TILE_SIZE / 2;
    this.player = this.physics.add.sprite(startX, startY, 'player_field', 1);
    this.player.body.setDrag(0, 0);
    this.player.body.setSize(20, 20);

    this.createAnimations();
    this.player.anims.play('walk-down', false);
    this.player.anims.pause();

    this.physics.add.collider(this.player, this.groundLayer);

    // Create pushable blocks
    this.createBlocks();

    // Camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0a1a');

    // Input
    this.keyShift = this.input.keyboard.addKey('SHIFT');
    this.keys = { up: false, down: false, left: false, right: false };
    this.confirmPressed = false;
    this.interactPressed = false;

    this.handleKeyDown = (e) => {
      if (this.dialogueActive || this.transitioning) return;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': this.keys.up = true; e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S': this.keys.down = true; e.preventDefault(); break;
        case 'ArrowLeft': case 'a': case 'A': this.keys.left = true; e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D': this.keys.right = true; e.preventDefault(); break;
        case 'z': case 'Z': case 'Enter': this.confirmPressed = true; e.preventDefault(); break;
        case 'x': case 'X': case 'Escape': this.interactPressed = true; e.preventDefault(); break;
      }
    };

    this.handleKeyUp = (e) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': this.keys.up = false; break;
        case 'ArrowDown': case 's': case 'S': this.keys.down = false; break;
        case 'ArrowLeft': case 'a': case 'A': this.keys.left = false; break;
        case 'ArrowRight': case 'd': case 'D': this.keys.right = false; break;
        case 'z': case 'Z': case 'Enter': this.confirmPressed = false; break;
        case 'x': case 'X': case 'Escape': this.interactPressed = false; break;
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

    // --- DOM overlays ---
    // Status text (top-left)
    this.statusDiv = document.createElement('div');
    this.statusDiv.style.cssText = `
      position: absolute; left: 4px; top: 4px;
      color: #ffffff; background: rgba(0,0,0,0.7);
      font-family: "Courier New", monospace; font-size: 11px;
      padding: 2px 4px; border-radius: 2px;
      pointer-events: none; z-index: 10;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    this.statusDiv.textContent = 'Ancient Ruins — Find the exit';
    container.appendChild(this.statusDiv);
    this.domElements.push(this.statusDiv);

    // Interaction prompt
    this.interactDiv = null;
    this.facing = 'down';

    // Save point state
    this.savedHere = false;
  }

  update(time, delta) {
    if (this.transitioning || this.dialogueActive) return;

    const speed = this.keyShift.isDown ? 160 : 90;
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
      // Count steps for random encounters
      this.encounterSteps++;
      if (this.encounterSteps >= this.encounterThreshold) {
        this.encounterSteps = 0;
        this.encounterThreshold = 15 + Math.floor(Math.random() * 10);
        this.startBattle();
      }
    } else {
      this.player.anims.pause();
      const frameMap = { down: 1, left: 4, right: 7, up: 10 };
      this.player.setFrame(frameMap[this.facing] ?? 1);
    }

    // Check special tiles
    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    const tile = this.mapData[tileY] && this.mapData[tileY][tileX];

    // Save point
    if (tile === T_SAVE && this.confirmPressed) {
      this.confirmPressed = false;
      this.saveGame();
    }

    // Boss tile
    if (tile === T_BOSS && this.confirmPressed) {
      this.confirmPressed = false;
      this.startBossFight();
    }

    // Exit tile
    if (tile === T_EXIT && this.confirmPressed) {
      this.confirmPressed = false;
      this.exitDungeon();
    }

    // Push block interaction (X key)
    if (this.interactPressed) {
      this.interactPressed = false;
      this.tryPushBlock();
    }

    // Update interaction prompt
    this.updateInteractPrompt(tile);

    // Check puzzle completion
    this.checkPuzzle();

    this.confirmPressed = false;
    this.interactPressed = false;
  }

  startBattle() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setVelocity(0, 0);

    // Pick random enemies for dungeon
    const enemyPool = ['slime', 'bat', 'goblin'];
    const numEnemies = 1 + Math.floor(Math.random() * 2);
    const enemies = [];
    for (let i = 0; i < numEnemies; i++) {
      enemies.push(enemyPool[Math.floor(Math.random() * enemyPool.length)]);
    }

    // Hide DOM elements
    this.domElements.forEach(el => el.style.display = 'none');

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.launch('Battle', { returnScene: 'Dungeon', enemies });
      this.scene.pause();
    });

    if (!this._resumeHandlerRegistered) {
      this._resumeHandlerRegistered = true;
      this.events.on('resume', () => {
        this.transitioning = false;
        this.domElements.forEach(el => el.style.display = '');
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
    }
  }

  startBossFight() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.domElements.forEach(el => el.style.display = 'none');

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.launch('Battle', { returnScene: 'Dungeon', enemies: ['boss_goblin'], isBoss: true });
      this.scene.pause();
    });

    if (!this._bossResumeRegistered) {
      this._bossResumeRegistered = true;
      this.events.on('resume', (data) => {
        this.transitioning = false;
        this.domElements.forEach(el => el.style.display = '');
        if (data && data.battleResult === 'win') {
          // Boss defeated — open the exit
          this.openExit();
        }
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
    }
  }

  openExit() {
    // Replace boss tile with floor and open a passage
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        if (this.mapData[y][x] === T_BOSS) {
          this.mapData[y][x] = T_EXIT;
          this.groundLayer.putTileAt(T_EXIT, x, y);
          this.groundLayer.setCollision([T_WALL, T_PIT, T_CHEST, T_DOOR, T_BOSS]);
          // Remove collision from exit tile
        }
      }
    }
    this.statusDiv.textContent = 'Ancient Ruins — Victory! Walk to the ▲ to exit.';
  }

  saveGame() {
    GameState.get().scene = 'Dungeon';
    GameState.get().x = this.player.x;
    GameState.get().y = this.player.y;
    GameState.fullHeal();
    this.savedHere = true;
    this.statusDiv.textContent = 'Ancient Ruins — Saved! HP/MP restored.';
    setTimeout(() => {
      if (!this.transitioning && !this.dialogueActive) {
        this.statusDiv.textContent = 'Ancient Ruins — Find the exit';
      }
    }, 3000);
  }

  exitDungeon() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Overworld');
    });
  }

  // --- Push block puzzle ---
  createBlocks() {
    // Find block tiles and create sprites
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        if (this.mapData[y][x] === T_BLOCK) {
          const bx = x * TILE_SIZE + TILE_SIZE / 2;
          const by = y * TILE_SIZE + TILE_SIZE / 2;
          const block = this.add.rectangle(bx, by, 24, 24, 0x886644);
          block.setStrokeStyle(2, 0x443322);
          block.setData('tileX', x);
          block.setData('tileY', y);
          block.setData('gridX', x);
          block.setData('gridY', y);
          this.blockSprites.push(block);
          // Make block collidable with player
          this.physics.add.existing(block, true);
          this.physics.add.collider(this.player, block);
          // Remove from tilemap (it's a sprite now)
          this.mapData[y][x] = T_FLOOR;
          this.groundLayer.putTileAt(T_FLOOR, x, y);
        }
      }
    }
  }

  tryPushBlock() {
    // Find block adjacent to player in facing direction
    const playerTileX = Math.floor(this.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / TILE_SIZE);
    const dx = { right: 1, left: -1, up: 0, down: 0 }[this.facing] || 0;
    const dy = { up: -1, down: 1, left: 0, right: 0 }[this.facing] || 0;
    const targetX = playerTileX + dx;
    const targetY = playerTileY + dy;

    for (const block of this.blockSprites) {
      const bx = block.getData('gridX');
      const by = block.getData('gridY');
      if (bx === targetX && by === targetY) {
        // Try to push block in facing direction
        const newX = bx + dx;
        const newY = by + dy;
        // Check if target tile is free (floor or switch)
        if (newX < 0 || newX >= MAP_COLS || newY < 0 || newY >= MAP_ROWS) return;
        const targetTile = this.mapData[newY][newX];
        if (targetTile !== T_FLOOR && targetTile !== T_SWITCH) return;
        // Check no other block at target
        const blocked = this.blockSprites.some(b => b.getData('gridX') === newX && b.getData('gridY') === newY);
        if (blocked) return;

        // Move block
        block.setData('gridX', newX);
        block.setData('gridY', newY);
        this.tweens.add({
          targets: block,
          x: newX * TILE_SIZE + TILE_SIZE / 2,
          y: newY * TILE_SIZE + TILE_SIZE / 2,
          duration: 200,
          ease: 'Quad.easeOut',
        });
        // Check if block is on a switch
        this.checkBlockOnSwitch(block, newX, newY);
      }
    }
  }

  checkBlockOnSwitch(block, x, y) {
    for (let i = 0; i < this.switchPositions.length; i++) {
      const sw = this.switchPositions[i];
      if (sw.x === x && sw.y === y) {
        this.switchStates[i] = true;
        block.setFillStyle(0x44aa44);
        return;
      }
    }
    // Block moved off a switch
    block.setFillStyle(0x886644);
    for (let i = 0; i < this.switchPositions.length; i++) {
      const sw = this.switchPositions[i];
      if (sw.x === x && sw.y === y) continue;
      const hasBlock = this.blockSprites.some(b => b.getData('gridX') === sw.x && b.getData('gridY') === sw.y);
      if (!hasBlock) this.switchStates[i] = false;
    }
  }

  checkPuzzle() {
    if (this.puzzleSolved) return;
    if (this.switchStates.every(s => s)) {
      this.puzzleSolved = true;
      this.statusDiv.textContent = 'Ancient Ruins — Puzzle solved! The door opens.';
      // Open the door (replace door tiles with floor)
      for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < MAP_COLS; x++) {
          if (this.mapData[y][x] === T_DOOR) {
            this.mapData[y][x] = T_FLOOR;
            this.groundLayer.putTileAt(T_FLOOR, x, y);
          }
        }
      }
      this.groundLayer.setCollision([T_WALL, T_PIT, T_CHEST, T_BOSS]);
    }
  }

  updateInteractPrompt(tile) {
    const container = document.getElementById('game-container');
    const showPrompt = tile === T_SAVE || tile === T_BOSS || tile === T_EXIT;

    if (showPrompt && !this.dialogueActive) {
      if (!this.interactDiv) {
        this.interactDiv = document.createElement('div');
        this.interactDiv.style.cssText = `
          position: absolute;
          color: #ffff00; background: rgba(0,0,0,0.7);
          font-family: "Courier New", monospace; font-size: 11px;
          padding: 2px 4px; border-radius: 2px;
          transform: translate(-50%, -100%);
          pointer-events: none; z-index: 15;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        `;
        container.appendChild(this.interactDiv);
        this.domElements.push(this.interactDiv);
      }
      const canvas = document.querySelector('canvas');
      const cr = canvas.getBoundingClientRect();
      const cam = this.cameras.main;
      const sx = cr.width / cam.worldView.width;
      const sy = cr.height / cam.worldView.height;
      const screenX = (this.player.x - cam.scrollX) * sx;
      const screenY = (this.player.y - 24 - cam.scrollY) * sy;
      this.interactDiv.style.left = screenX + 'px';
      this.interactDiv.style.top = screenY + 'px';

      let promptText = 'Press Z';
      if (tile === T_SAVE) promptText = 'Press Z to Save';
      if (tile === T_BOSS) promptText = 'Press Z to fight Boss';
      if (tile === T_EXIT) promptText = 'Press Z to Exit';
      this.interactDiv.textContent = promptText;
      this.interactDiv.style.display = 'block';
    } else if (this.interactDiv) {
      this.interactDiv.style.display = 'none';
    }
  }

  cleanupDom() {
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
    this.interactDiv = null;
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

  generateDungeon() {
    // Procedurally generate a dungeon layout
    const map = [];
    for (let y = 0; y < MAP_ROWS; y++) {
      const row = [];
      for (let x = 0; x < MAP_COLS; x++) {
        // Border walls
        if (x === 0 || x === MAP_COLS - 1 || y === 0 || y === MAP_ROWS - 1) {
          row.push(T_WALL);
        } else {
          row.push(T_FLOOR);
        }
      }
      map.push(row);
    }

    // Add interior walls to create rooms and corridors
    // Room 1: entrance area (bottom)
    this.addWallRect(map, 4, 10, 5, 1); // horizontal wall with gap
    map[10][6] = T_FLOOR; // gap (door)

    // Room 2: puzzle room (middle)
    // Door (closed until puzzle solved)
    map[10][6] = T_DOOR;

    // Room 3: boss room (top)
    this.addWallRect(map, 4, 5, 5, 1);
    map[5][6] = T_DOOR; // door to boss room

    // Add some pillars/obstacles in the main area
    for (let y = 11; y < MAP_ROWS - 1; y++) {
      for (let x = 2; x < MAP_COLS - 2; x++) {
        if ((x + y) % 5 === 0 && x !== 6) {
          map[y][x] = T_WALL; // decorative pillars
        }
      }
    }

    // Save point in the entrance area
    map[MAP_ROWS - 3][Math.floor(MAP_COLS / 2)] = T_SAVE;

    // Puzzle: 2 switches + 2 pushable blocks in the middle room
    this.switchPositions = [
      { x: 4, y: 8 },
      { x: 9, y: 8 },
    ];
    map[8][4] = T_SWITCH;
    map[8][9] = T_SWITCH;
    map[7][5] = T_BLOCK; // pushable block 1
    map[7][8] = T_BLOCK; // pushable block 2

    // Boss in the top room
    map[2][Math.floor(MAP_COLS / 2)] = T_BOSS;

    // Exit (appears after boss defeated, starts as wall)
    // The boss tile becomes exit after victory

    // Clear path around save point and entrance
    map[MAP_ROWS - 2][Math.floor(MAP_COLS / 2)] = T_FLOOR;
    map[MAP_ROWS - 3][Math.floor(MAP_COLS / 2)] = T_SAVE;

    return map;
  }

  addWallRect(map, x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (map[y + dy] && map[y + dy][x + dx] !== undefined) {
          map[y + dy][x + dx] = T_WALL;
        }
      }
    }
  }
}