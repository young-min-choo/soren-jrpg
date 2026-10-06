/**
 * RelicDungeonScene — parametric relic dungeon (Phase 8).
 * One class, config-driven, covers Tide Temple / Hollow Deep / Storm Spire.
 *
 * Config contract (see src/game/WorldData.js + story.js):
 *   key        — area key for encounter table (EnemyData.AREAS)
 *   bossType   — enemy key of the boss
 *   relicFlag  — story flag set by the relic cutscene
 *   relicScene — (scene, cutsceneRunner) => playRelicXScene(scene)
 *   puzzle     — 'plates' (walk-over switches) | 'blocks' (push-blocks)
 *   plateCount — for 'plates'
 *   bg         — camera background color
 *   accent     — switch/save accent color for toasts
 *
 * Same patterns as EmbersScene: launched-scene-safe timing (setTimeout),
 * raw DOM input, DOM overlays, RESUME payload on arg 2.
 */
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { rollEncounter } from '../game/EnemyData.js';

const TILE_SIZE = 32;
const MAP_COLS = 20;
const MAP_ROWS = 15;

const T_FLOOR = 0;
const T_WALL = 1;
const T_HAZARD = 2;   // water/lava/chasm — collidable flavor
const T_DOOR = 4;
const T_SAVE = 5;
const T_BOSS = 6;
const T_BLOCK = 7;
const T_SWITCH = 8;
const T_EXIT = 9;

export function makeRelicDungeon(config) {
  return class extends Phaser.Scene {
    constructor() {
      super(config.sceneKey);
      this.cfg = config;
    }

    create() {
      this.domElements = [];
      this.transitioning = false;
      this.cutsceneLock = false;
      this.encounterThreshold = 6 + Math.floor(Math.random() * 4);

      this.mapData = this.generateMap();
      this.puzzleSolved = false;
      this.switchStates = new Array(this.cfg.plateCount || 2).fill(false);
      this.blockSprites = [];

      const container = document.getElementById('game-container');

      const map = this.make.tilemap({ data: this.mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
      // Phase 9: per-dungeon themed tileset when BootScene built it
      const themeKey = this.cfg.theme || null;
      const useKey = (themeKey && this.textures.exists(themeKey)) ? themeKey : 'town_tiles';
      const tileset = map.addTilesetImage(useKey, useKey, TILE_SIZE, TILE_SIZE);
      this.groundLayer = map.createLayer(0, tileset, 0, 0);
      this.groundLayer.setCollision([T_WALL, T_HAZARD, T_DOOR]);

      // Boss sprite — D0 sigil art when theme strip has it, fallback rectangles
      const bossTileX = 10, bossTileY = 2;
      const bossTex = this.cfg.theme && this.textures.exists(this.cfg.theme) ? this.textures.get(this.cfg.theme) : null;
      if (bossTex && bossTex.has(6)) {
        this.bossSprite = this.add.image(
          bossTileX * TILE_SIZE + 16, bossTileY * TILE_SIZE + 16, this.cfg.theme, 6
        ).setDisplaySize(32, 32);
      } else {
        this.bossSprite = this.add.rectangle(
          bossTileX * TILE_SIZE + 16, bossTileY * TILE_SIZE + 16, 30, 30, this.cfg.bossColor
        );
        this.bossSprite.setStrokeStyle(2, 0xffffff & 0xffffff);
      }
      this.bossDefeated = GameState.hasFlag(this.cfg.relicFlag);

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

      if (this.cfg.puzzle === 'blocks') this.createBlocks();

      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);
      this.cameras.main.fadeIn(400, 0, 0, 0);
      this.cameras.main.setBackgroundColor(this.cfg.bg);

      // If boss already defeated (revisit), open the exit immediately
      if (this.bossDefeated) {
        for (let y = 0; y < MAP_ROWS; y++) {
          for (let x = 0; x < MAP_COLS; x++) {
            if (this.mapData[y][x] === T_BOSS) {
              this.mapData[y][x] = T_EXIT;
              this.groundLayer.putTileAt(T_EXIT, x, y);
            }
          }
        }
        if (this.bossSprite) this.bossSprite.setVisible(false);
      }

      // Input — raw DOM pattern
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
      this.statusDiv.textContent = this.cfg.hint;
      container.appendChild(this.statusDiv);
      this.domElements.push(this.statusDiv);

      this.interactDiv = null;
      this.facing = 'down';
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
        const distMoved = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          this._lastPlayerX || this.player.x, this._lastPlayerY || this.player.y
        );
        this.encounterDistance = (this.encounterDistance || 0) + distMoved;
        this._lastPlayerX = this.player.x;
        this._lastPlayerY = this.player.y;
        if (this.encounterDistance >= this.encounterThreshold * TILE_SIZE) {
          this.encounterDistance = 0;
          this.encounterThreshold = 6 + Math.floor(Math.random() * 4);
          this.startBattle();
          return;
        }
        if (this.cfg.puzzle === 'blocks') this.tryPushBlock();
      } else {
        this.player.anims.pause();
        const frameMap = { down: 1, left: 4, right: 7, up: 10 };
        this.player.setFrame(frameMap[this.facing] ?? 1);
      }

      const tileX = Math.floor(this.player.x / TILE_SIZE);
      const tileY = Math.floor(this.player.y / TILE_SIZE);
      const tile = this.mapData[tileY] && this.mapData[tileY][tileX];

      if (tile === T_SWITCH && this.cfg.puzzle === 'plates') {
        this.stepOnPlate(tileX, tileY);
      }

      if (tile === T_SAVE && this.confirmPressed) {
        this.confirmPressed = false;
        GameState.get().scene = this.cfg.sceneKey;
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

    // ── Plates puzzle (Embers-style walk-over) ──
    stepOnPlate(x, y) {
      this.switchPositions.forEach((sw, i) => {
        if (sw.x === x && sw.y === y && !this.switchStates[i]) {
          this.switchStates[i] = true;
          const n = this.switchStates.filter(Boolean).length;
          const total = this.switchStates.length;
          this._toast(`Plate ${n}/${total} activated!`);
          if (this.switchStates.every(Boolean) && !this.puzzleSolved) {
            this.openBossDoor();
          }
        }
      });
    }

    openBossDoor() {
      this.puzzleSolved = true;
      for (let yy = 0; yy < MAP_ROWS; yy++) {
        for (let xx = 0; xx < MAP_COLS; xx++) {
          if (this.mapData[yy][xx] === T_DOOR) {
            this.mapData[yy][xx] = T_FLOOR;
            this.groundLayer.putTileAt(T_FLOOR, xx, yy);
          }
        }
      }
      this.groundLayer.setCollision(
        this.cfg.puzzle === 'blocks' ? [T_WALL, T_HAZARD] : [T_WALL, T_HAZARD]
      );
      this._toast(this.cfg.solvedMsg);
    }

    // ── Blocks puzzle (Dungeon-style push) ──
    setBlockActive(block, on) {
      // Image sprites (D0 tile art) tint; rectangles keep fillStyle
      if (block.fillStyle === undefined) {
        if (on) block.setTint(0x66ff88); else block.clearTint();
      } else {
        block.setFillStyle(on ? 0x44aa44 : 0x886644);
      }
    }

    createBlocks() {
      for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < MAP_COLS; x++) {
          if (this.mapData[y][x] === T_BLOCK) {
            let block;
            const tilesetTex = this.textures.get(this.cfg.theme);
            if (tilesetTex && tilesetTex.has(7)) {
              block = this.add.image(x * TILE_SIZE + 16, y * TILE_SIZE + 16, this.cfg.theme, 7).setDisplaySize(32, 32);
            } else {
              block = this.add.rectangle(x * TILE_SIZE + 16, y * TILE_SIZE + 16, 24, 24, 0x886644);
              block.setStrokeStyle(2, 0x443322);
            }
            block.setData('gridX', x);
            block.setData('gridY', y);
            this.blockSprites.push(block);
            this.mapData[y][x] = T_FLOOR;
            this.groundLayer.putTileAt(T_FLOOR, x, y);
          }
        }
      }
      this.blockSprites.forEach(b =>
        this.checkBlockOnSwitch(b, b.getData('gridX'), b.getData('gridY')));
    }

    tryPushBlock() {
      const playerTileX = Math.floor(this.player.x / TILE_SIZE);
      const playerTileY = Math.floor(this.player.y / TILE_SIZE);
      const dx = { right: 1, left: -1, up: 0, down: 0 }[this.facing] || 0;
      const dy = { up: -1, down: 1, left: 0, right: 0 }[this.facing] || 0;
      const targetX = playerTileX + dx;
      const targetY = playerTileY + dy;

      const playerCenterX = playerTileX * TILE_SIZE + TILE_SIZE / 2;
      const playerCenterY = playerTileY * TILE_SIZE + TILE_SIZE / 2;
      const distToCenter = Phaser.Math.Distance.Between(this.player.x, this.player.y, playerCenterX, playerCenterY);
      if (distToCenter > TILE_SIZE * 0.4) return;

      for (const block of this.blockSprites) {
        const bx = block.getData('gridX');
        const by = block.getData('gridY');
        if (bx === targetX && by === targetY) {
          const newX = bx + dx;
          const newY = by + dy;
          const stopHere = () => {
            this.player.x = playerCenterX;
            this.player.y = playerCenterY;
            this.player.setVelocity(0, 0);
          };
          if (newX < 1 || newX >= MAP_COLS - 1 || newY < 1 || newY >= MAP_ROWS - 1) { stopHere(); return; }
          const targetTile = this.mapData[newY][newX];
          if (targetTile !== T_FLOOR && targetTile !== T_SWITCH) { stopHere(); return; }
          if (this.blockSprites.some(b => b.getData('gridX') === newX && b.getData('gridY') === newY)) { stopHere(); return; }

          // rAF slide
          const fromX = block.x, toX = newX * TILE_SIZE + 16;
          const fromY = block.y, toY = newY * TILE_SIZE + 16;
          const slideStart = performance.now();
          const SLIDE_MS = 200;
          const animateSlide = () => {
            const elapsed = performance.now() - slideStart;
            if (elapsed < SLIDE_MS) {
              const t = elapsed / SLIDE_MS;
              block.x = fromX + (toX - fromX) * t;
              block.y = fromY + (toY - fromY) * t;
              requestAnimationFrame(animateSlide);
            } else {
              block.setPosition(toX, toY);
            }
          };
          requestAnimationFrame(animateSlide);
          block.setData('gridX', newX);
          block.setData('gridY', newY);
          stopHere();
          this.checkBlockOnSwitch(block, newX, newY);
          return;
        }
      }
    }

    checkBlockOnSwitch(block, x, y) {
      let onAny = false;
      this.switchPositions.forEach((sw, i) => {
        if (sw.x === x && sw.y === y) {
          this.switchStates[i] = true;
          this.setBlockActive(block, true);
          onAny = true;
        }
      });
      if (!onAny) this.setBlockActive(block, false);
      // Re-check every switch: a switch stays on only while a block covers it
      this.switchPositions.forEach((sw, i) => {
        const hasBlock = this.blockSprites.some(
          b => b.getData('gridX') === sw.x && b.getData('gridY') === sw.y
        );
        if (!hasBlock) this.switchStates[i] = false;
      });
      if (this.switchStates.every(Boolean) && !this.puzzleSolved) {
        this.openBossDoor();
      }
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
          : tile === T_BOSS ? 'Press Z to fight ' + this.cfg.bossName
          : 'Press Z to Exit';
        this.interactDiv.style.display = 'block';
      } else if (this.interactDiv) {
        this.interactDiv.style.display = 'none';
      }
    }

    _toast(msg) {
      this.statusDiv.textContent = msg;
      setTimeout(() => {
        if (this.statusDiv && !this.cutsceneLock) {
          this.statusDiv.textContent = this.cfg.hint;
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
        this.scene.launch('Battle', {
          returnScene: this.cfg.sceneKey,
          enemies: rollEncounter(this.cfg.area),
        });
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
        this.scene.launch('Battle', {
          returnScene: this.cfg.sceneKey,
          enemies: [this.cfg.bossType],
          isBoss: true,
        });
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
            if (!GameState.hasFlag(this.cfg.relicFlag)) {
              this.cfg.playRelicScene(this);
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
      this.scene.launch('Menu', { parentScene: this.cfg.sceneKey });
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

      // Three chambers
      this.addWallRect(map, 2, 10, 16, 1);
      map[10][10] = T_FLOOR;
      this.addWallRect(map, 2, 5, 16, 1);
      map[5][10] = T_DOOR;

      // Hazard pools (flavor: water / roots / chasms)
      const hz = this.cfg.puzzle === 'blocks' ? [[3, 11], [16, 11], [3, 6], [16, 6]] : [[2, 11], [17, 11], [2, 6], [17, 6]];
      hz.forEach(([x, y]) => {
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            if (map[y + dy] && map[y + dy][x + dx] !== undefined) map[y + dy][x + dx] = T_HAZARD;
          }
        }
      });

      // Save point
      map[MAP_ROWS - 3][10] = T_SAVE;

      // Puzzle setup
      const count = this.cfg.plateCount || 2;
      this.switchPositions = [];
      const plateSpots = count === 3
        ? [[4, 7], [10, 7], [15, 7]]
        : [[4, 7], [15, 7]];
      plateSpots.forEach(([x, y], i) => {
        this.switchPositions.push({ x, y });
        map[y][x] = T_SWITCH;
      });

      if (this.cfg.puzzle === 'blocks') {
        // Blocks start off the plates (player must push them on)
        const blockSpots = count === 3
          ? [[6, 7], [10, 8], [13, 7]]
          : [[6, 7], [13, 7]];
        blockSpots.forEach(([x, y]) => { map[y][x] = T_BLOCK; });
      }

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

    cleanupDom() {
      this.domElements.forEach(el => el.remove());
      this.domElements = [];
      this.interactDiv = null;
    }

    shutdown() { this.cleanupDom(); }
  };
}