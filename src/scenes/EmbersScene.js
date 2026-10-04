import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { rollEncounter } from '../game/EnemyData.js';
import { playRelicEmberScene } from '../game/story.js';

/**
 * EmbersScene — second dungeon: Cave of Embers (Fire Relic).
 * Unlocked after the Wind Relic (Overworld gate). Same architectural
 * pattern as DungeonScene: procedural tilemap, random encounters from
 * the 'embers' area table, save point, boss, story cutscene on victory.
 *
 * Puzzle twist (light, design doc §7): lava vents block the path — step
 * on 2 pressure plates to vent them, then the boss door opens.
 */

const TILE_SIZE = 32;
const MAP_COLS = 20;
const MAP_ROWS = 15;

// Tile types (shared indexes with the extended town_tiles set)
const T_FLOOR = 0;
const T_WALL = 1;
const T_LAVA = 2;      // deadly-looking, collidable
const T_DOOR = 4;      // boss door, opens on puzzle
const T_SAVE = 5;
const T_BOSS = 6;
const T_SWITCH = 8;
const T_EXIT = 9;

export default class EmbersScene extends Phaser.Scene {
  constructor() {
    super('Embers');
  }

  create() {
    this.domElements = [];
    this.transitioning = false;
    this.cutsceneLock = false;
    this.encounterThreshold = 6 + Math.floor(Math.random() * 4);

    this.mapData = this.generateMap();
    this.puzzleSolved = false;
    this.switchStates = [false, false];

    const container = document.getElementById('game-container');

    const map = this.make.tilemap({ data: this.mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('town_tiles', 'town_tiles', TILE_SIZE, TILE_SIZE);
    this.groundLayer = map.createLayer(0, tileset, 0, 0);
    this.groundLayer.setCollision([T_WALL, T_LAVA, T_DOOR]);

    // Boss sprite
    const bossTileX = 10, bossTileY = 2;
    this.bossSprite = this.add.rectangle(bossTileX * TILE_SIZE + 16, bossTileY * TILE_SIZE + 16, 30, 30, 0xff5500);
    this.bossSprite.setStrokeStyle(2, 0xffaa00);
    this.bossDefeated = false;

    // Player entrance at bottom center
    const startX = 10 * TILE_SIZE + 16;
    const startY = (MAP_ROWS - 2) * TILE_SIZE + 16;
    this.player = this.physics.add.sprite(startX, startY, 'player_field', 1);
    this.player.body.setDrag(0, 0);
    this.player.body.setSize(20, 20);

    this.createAnimations();
    this.player.anims.play('walk-down', false);
    this.player.anims.pause();

    this.physics.add.collider(this.player, this.groundLayer);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#1a0a05');

    // Input — same raw DOM pattern; no Z-clear on keyup (input-loss bug)
    this.keyShift = this.input.keyboard.addKey('SHIFT');
    this.keys = { up: false, down: false, left: false, right: false };
    this.confirmPressed = false;

    this.handleKeyDown = (e) => {
      // Paused scenes (Menu/Battle/GameOver on top) must not react to input
      if (!this.scene.isActive()) return;
      if (this.cutsceneLock || this.transitioning) return;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': this.keys.up = true; e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S': this.keys.down = true; e.preventDefault(); break;
        case 'ArrowLeft': case 'a': case 'A': this.keys.left = true; e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D': this.keys.right = true; e.preventDefault(); break;
        case 'z': case 'Z': case 'Enter': this.confirmPressed = true; e.preventDefault(); break;
        case 'x': case 'X': case 'Escape': this.openMenu(); e.preventDefault(); break;
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
      this.keys.up = this.keys.down = this.keys.left = this.keys.right = false;
      this.confirmPressed = false;
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

    // Status HUD
    this.statusDiv = document.createElement('div');
    this.statusDiv.style.cssText = `
      position: absolute; left: 4px; top: 4px;
      color: #ffffff; background: rgba(0,0,0,0.7);
      font-family: "VT323", monospace; font-size: 16px;
      padding: 2px 4px; border-radius: 2px;
      pointer-events: none; z-index: 10;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    this.statusDiv.textContent = 'Cave of Embers — Step on both vents to reach the Emberlord';
    container.appendChild(this.statusDiv);
    this.domElements.push(this.statusDiv);

    this.interactDiv = null;
  }

  update() {
    if (this.transitioning || this.cutsceneLock) return;

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
      // Random encounters from the 'embers' area table
      const distMoved = Phaser.Math.Distance.Between(this.player.x, this.player.y, this._lastPlayerX || this.player.x, this._lastPlayerY || this.player.y);
      this.encounterDistance = (this.encounterDistance || 0) + distMoved;
      this._lastPlayerX = this.player.x;
      this._lastPlayerY = this.player.y;
      if (this.encounterDistance >= this.encounterThreshold * TILE_SIZE) {
        this.encounterDistance = 0;
        this.encounterThreshold = 6 + Math.floor(Math.random() * 4);
        this.startBattle();
        return;
      }
    } else {
      this.player.anims.pause();
      const frameMap = { down: 1, left: 4, right: 7, up: 10 };
      this.player.setFrame(frameMap[this.facing] ?? 1);
    }

    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    const tile = this.mapData[tileY] && this.mapData[tileY][tileX];

    // Switches: stepping on them vents the lava
    if (tile === T_SWITCH && !this.switchStates.includes(true) || (tile === T_SWITCH)) {
      this.stepOnSwitch(tileX, tileY);
    }

    if (tile === T_SAVE && this.confirmPressed) {
      this.confirmPressed = false;
      GameState.get().scene = 'Embers';
      GameState.get().x = this.player.x;
      GameState.get().y = this.player.y;
      GameState.fullHeal();
      this._toast('Saved! HP/MP restored.');
    }

    if (tile === T_BOSS && this.confirmPressed) {
      this.confirmPressed = false;
      this.startBossFight();
    }

    if (tile === T_EXIT && this.confirmPressed) {
      this.confirmPressed = false;
      this.exitDungeon();
    }

    this.updateInteractPrompt(tile);
    this.confirmPressed = false;
  }

  stepOnSwitch(x, y) {
    this.switchPositions.forEach((sw, i) => {
      if (sw.x === x && sw.y === y && !this.switchStates[i]) {
        this.switchStates[i] = true;
        this._toast(`Vent ${this.switchStates.filter(Boolean).length}/2 opened!`);
        if (this.switchStates.every(Boolean) && !this.puzzleSolved) {
          this.puzzleSolved = true;
          // Open boss door
          for (let yy = 0; yy < MAP_ROWS; yy++) {
            for (let xx = 0; xx < MAP_COLS; xx++) {
              if (this.mapData[yy][xx] === T_DOOR) {
                this.mapData[yy][xx] = T_FLOOR;
                this.groundLayer.putTileAt(T_FLOOR, xx, yy);
              }
            }
          }
          this.groundLayer.setCollision([T_WALL, T_LAVA]);
          this._toast('The vents roar — the path to the Emberlord opens!');
        }
      }
    });
  }

  updateInteractPrompt(tile) {
    const container = document.getElementById('game-container');
    const show = tile === T_SAVE || tile === T_BOSS || tile === T_EXIT;
    if (show && !this.cutsceneLock) {
      if (!this.interactDiv) {
        this.interactDiv = document.createElement('div');
        this.interactDiv.style.cssText = `
          position: absolute;
          color: #ffff00; background: rgba(0,0,0,0.7);
          font-family: "VT323", monospace; font-size: 16px;
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
      this.interactDiv.style.left = ((this.player.x - cam.scrollX) * sx) + 'px';
      this.interactDiv.style.top = ((this.player.y - 24 - cam.scrollY) * sy) + 'px';
      this.interactDiv.textContent = tile === T_SAVE ? 'Press Z to Save'
        : tile === T_BOSS ? 'Press Z to fight Emberlord'
        : 'Press Z to Exit';
      this.interactDiv.style.display = 'block';
    } else if (this.interactDiv) {
      this.interactDiv.style.display = 'none';
    }
  }

  _toast(msg) {
    const prev = this.statusDiv.textContent;
    this.statusDiv.textContent = msg;
    setTimeout(() => {
      if (this.statusDiv && !this.cutsceneLock) {
        this.statusDiv.textContent = 'Cave of Embers — Step on both vents to reach the Emberlord';
      }
    }, 2500);
  }

  startBattle() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.domElements.forEach(el => el.style.display = 'none');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.launch('Battle', { returnScene: 'Embers', enemies: rollEncounter('embers') });
      this.scene.pause();
    });
    if (!this._resumeHandlerRegistered) {
      this._resumeHandlerRegistered = true;
      this.events.on('resume', (sys, data) => {
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
      this.scene.launch('Battle', { returnScene: 'Embers', enemies: ['boss_magma'], isBoss: true });
      this.scene.pause();
    });
    if (!this._bossResumeRegistered) {
      this._bossResumeRegistered = true;
      // RESUME emits (systems, data) — payload is arg 2
      this.events.on('resume', (sys, data) => {
        this.transitioning = false;
        this.domElements.forEach(el => el.style.display = '');
        if (data && data.battleResult === 'win') {
          if (this.bossSprite) this.bossSprite.setVisible(false);
          this.bossDefeated = true;
          for (let y = 0; y < MAP_ROWS; y++) {
            for (let x = 0; x < MAP_COLS; x++) {
              if (this.mapData[y][x] === T_BOSS) {
                this.mapData[y][x] = T_EXIT;
                this.groundLayer.putTileAt(T_EXIT, x, y);
              }
            }
          }
          if (!GameState.hasFlag('relicFire')) {
            playRelicEmberScene(this);
          }
        }
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
    }
  }

  exitDungeon() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Overworld');
    });
  }

  openMenu() {
    if (this.transitioning) return;
    this.player.setVelocity(0, 0);
    this.scene.launch('Menu', { parentScene: 'Embers' });
    this.scene.pause();
  }

  createAnimations() {
    if (!this.anims.exists('walk-down')) {
      this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('player_field', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-left', frames: this.anims.generateFrameNumbers('player_field', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player_field', { start: 6, end: 8 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('player_field', { start: 9, end: 11 }), frameRate: 8, repeat: -1 });
    }
  }

  generateMap() {
    const map = [];
    for (let y = 0; y < MAP_ROWS; y++) {
      const row = [];
      for (let x = 0; x < MAP_COLS; x++) {
        row.push(x === 0 || x === MAP_COLS - 1 || y === 0 || y === MAP_ROWS - 1 ? T_WALL : T_FLOOR);
      }
      map.push(row);
    }

    // Horizontal walls dividing three chambers (like Dungeon 1)
    this.addWallRect(map, 3, 10, 14, 1);
    map[10][10] = T_FLOOR; // gap between entrance chamber and puzzle chamber
    this.addWallRect(map, 3, 5, 14, 1);
    map[5][10] = T_DOOR;   // boss door — opens when both vents are stepped on

    // Decorative lava pools in side areas (collidable)
    this.addLava(map, 2, 11, 2, 2);
    this.addLava(map, 16, 11, 2, 2);
    this.addLava(map, 2, 6, 2, 2);
    this.addLava(map, 16, 6, 2, 2);

    // Save point in the entrance chamber
    map[MAP_ROWS - 3][10] = T_SAVE;

    // Two vents (switches) in the puzzle chamber — far apart
    this.switchPositions = [
      { x: 4, y: 7 },
      { x: 15, y: 7 },
    ];
    map[7][4] = T_SWITCH;
    map[7][15] = T_SWITCH;

    // Boss in top chamber
    map[2][10] = T_BOSS;

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

  addLava(map, x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (map[y + dy] && map[y + dy][x + dx] !== undefined) {
          map[y + dy][x + dx] = T_LAVA;
        }
      }
    }
  }

  cleanupDom() {
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
    this.interactDiv = null;
  }

  shutdown() { this.cleanupDom(); }
}