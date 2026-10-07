import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { playRelicScene, npcDialogue } from '../game/story.js';

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
// Pushable blocks get REAL physics bodies (playtest 2026-10-08, bug 5):
// the old sprite + walk-into tile dance had an off-by-half-tile bounce math
// that could snap the player a full tile into/onto things and could stand
// the player INSIDE the block's old tile — "walked behind a pillar and
// couldn't get out". Blocks are immovable bodies that block the player with
// physics, pushes are explicit and validated, no position-snapping at all.

export default class DungeonScene extends Phaser.Scene {
  constructor() {
    super('Dungeon');
  }

  create(data) {
    this.domElements = [];
    this.transitioning = false;
    this.dialogueActive = false;
    this.encounterSteps = 0;
    this.encounterThreshold = 6 + Math.floor(Math.random() * 4); // 6-10 tiles (dungeon — slightly more frequent)

    // Generate dungeon layout
    this.mapData = this.generateDungeon();
    this.puzzleSolved = false;
    this.blockSprites = [];
    this.switchStates = [false, false];
    this.pushCooldown = 0;
    this.puzzleTransition = false;

    const container = document.getElementById('game-container');

    // Create tilemap from generated data
    const map = this.make.tilemap({ data: this.mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    // Phase 9: themed ruins tileset when BootScene built it
      const useKey = this.textures.exists('dgn_ruins') ? 'dgn_ruins' : 'town_tiles';
      this._themeTexKey = useKey;
      const tileset = map.addTilesetImage(useKey, useKey, TILE_SIZE, TILE_SIZE);
    this.groundLayer = map.createLayer(0, tileset, 0, 0);
    this.groundLayer.setCollision([T_WALL, T_PIT, T_CHEST, T_DOOR]);
    // Note: T_BOSS is NOT in collision — player must step on it to trigger the fight

    // D: floor variants (frames 10=crack, 11=moss) de-uniform the wallpaper floor.
    // Deterministic hash pick — ~9% crack, ~6% moss, only on plain floor tiles.
    this.sprinkleFloorVariants(groundLayer => groundLayer);

    // --- Boss sprite (visible on the boss tile) ---
    const bossTileX = Math.floor(MAP_COLS / 2);
    const bossTileY = 2;
    // D0: boss sigil tile art (frame 6) with fallback to red marker
    if (this.textures.exists('dgn_ruins') && this.textures.get('dgn_ruins').has(6)) {
      this.bossSprite = this.add.image(
        bossTileX * TILE_SIZE + TILE_SIZE / 2,
        bossTileY * TILE_SIZE + TILE_SIZE / 2,
        'dgn_ruins', 6
      ).setDisplaySize(32, 32);
      this.bossSprite.isTileArt = true;
    } else {
      this.bossSprite = this.add.rectangle(
        bossTileX * TILE_SIZE + TILE_SIZE / 2,
        bossTileY * TILE_SIZE + TILE_SIZE / 2,
        28, 28, 0xdd2222
      );
      this.bossSprite.setStrokeStyle(2, 0xff4444);
    }
    this.bossDefeated = false;

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

    this.handleKeyDown = (e) => {
      // Paused scenes (Menu/Battle/GameOver on top) must not react to input
      if (!this.scene.isActive()) return;
      if (this.dialogueActive || this.transitioning) return;
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
        // NOTE: 'z' is intentionally NOT cleared here — see TownScene.
        // Clearing confirmPressed on keyup drops taps whose keydown+keyup
        // both land between two rendered frames.
      }
    };

    this.handleBlur = () => {
      this.keys.up = false; this.keys.down = false; this.keys.left = false; this.keys.right = false;
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

    // --- DOM overlays ---
    // Status text (top-left)
    this.statusDiv = document.createElement('div');
    this.statusDiv.style.cssText = `
      position: absolute; left: 4px; top: 4px;
      color: #ffffff; background: rgba(0,0,0,0.7);
      font-family: "VT323", monospace; font-size: 16px;
      padding: 2px 4px; border-radius: 2px;
      pointer-events: none; z-index: 10;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    this.statusDiv.textContent = 'Ancient Ruins — Push blocks onto switches to open the door';
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
      // Count tiles walked for random encounters
      const distMoved = Phaser.Math.Distance.Between(this.player.x, this.player.y, this._lastPlayerX || this.player.x, this._lastPlayerY || this.player.y);
      this.encounterDistance = (this.encounterDistance || 0) + distMoved;
      this._lastPlayerX = this.player.x;
      this._lastPlayerY = this.player.y;
      const thresholdPx = this.encounterThreshold * TILE_SIZE;
      if (this.encounterDistance >= thresholdPx) {
        this.encounterDistance = 0;
        this.encounterThreshold = 6 + Math.floor(Math.random() * 4);
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


    // Update interaction prompt
    this.updateInteractPrompt(tile);

    // Check puzzle completion
    this.checkPuzzle();

    this.confirmPressed = false;
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
      // Phaser emits RESUME as (systems, data) — the payload is the 2nd arg.
      // Reading only the 1st arg silently missed battleResult, so beating the
      // boss never opened the exit.
      this.events.on('resume', (sys, data) => {
        this.transitioning = false;
        this.domElements.forEach(el => el.style.display = '');
        if (data && data.battleResult === 'win') {
          // Boss defeated — open the exit
          this.openExit();
          // Relic story beat — only once (flag guards re-fights)
          if (!GameState.hasFlag('relicWind')) {
            playRelicScene(this);
          }
        }
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
    }
  }

  openExit() {
    // Boss defeated — hide boss sprite, replace boss tile with exit
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
        this.statusDiv.textContent = 'Ancient Ruins — Push blocks onto switches to open the door';
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

  openMenu() {
    if (this.transitioning) return;
    this.player.setVelocity(0, 0);
    this.scene.launch('Menu', { parentScene: 'Dungeon' });
    this.scene.pause();
  }

  // --- Push block puzzle ---
  /** D: overlay floor-variant textures (frames 10=crack, 11=moss) on plain floor tiles. */
  sprinkleFloorVariants() {
    const layer = this.groundLayer;
    if (!layer || !this._themeTexKey) return;
    const texObj = this.textures.get(this._themeTexKey);
    if (!texObj || !texObj.has(10)) return;
    const hash = (x, y, seed) => {
      let n = (x * 374761393 + y * 668265263 + seed * 2654435761) >>> 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
      return (n ^ (n >>> 16)) >>> 0;
    };
    for (let y = 0; y < layer.height; y++) {
      for (let x = 0; x < layer.width; x++) {
        const t = layer.getTileAt(x, y, true);
        if (!t || t.index === -1 || t.index !== T_FLOOR + 1) continue;
        const h = hash(x, y, 7) % 100;
        if (h < 9 || (h >= 15 && h < 21)) {
          const frame = h < 9 ? 10 : 11;
          const img = this.add.image(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            this._themeTexKey, frame
          );
          img.setDepth(0);
        }
      }
    }
  }



  setBlockActive(block, on) {
    // Image sprites (D0 tile art) tint; rectangles keep fillStyle
    if (block.fillStyle === undefined) {
      if (on) block.setTint(0x66ff88); else block.clearTint();
    } else {
      block.setFillStyle(on ? 0x44aa44 : 0x886644);
    }
  }

    createBlocks() {
    // Find block tiles and create sprites
    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        if (this.mapData[y][x] === T_BLOCK) {
          const bx = x * TILE_SIZE + TILE_SIZE / 2;
          const by = y * TILE_SIZE + TILE_SIZE / 2;
          // D0: real stone-cube art sprite (falls back to rectangle).
          // STATIC physics body: the player walks into it and stops with
          // real collision (no tile-bounce math), which is what killed the
          // "walked into/behind a block and got stuck" report.
          let block;
          if (this.textures.exists('dgn_ruins') && this.textures.get('dgn_ruins').has(7)) {
            block = this.physics.add.existing(this.add.image(bx, by, 'dgn_ruins', 7).setDisplaySize(32, 32), true);
          } else {
            block = this.physics.add.existing(this.add.rectangle(bx, by, 24, 24, 0x886644).setStrokeStyle(2, 0x443322), true);
          }
          block.setData('gridX', x);
          block.setData('gridY', y);
          this.blockSprites.push(block);
          if (this.physics.add && block.body) {
            this.physics.add.collider(this.player, block, () => this.tryPushNearestBlock());
          }
          // Remove from tilemap (it's a sprite now)
          this.mapData[y][x] = T_FLOOR;
          this.groundLayer.putTileAt(T_FLOOR, x, y);
        }
      }
    }
    // Check blocks against switches at start (in case they spawn on one)
    this.blockSprites.forEach(block => {
      this.checkBlockOnSwitch(block, block.getData('gridX'), block.getData('gridY'));
    });
  }

  // Push validator — every mutation path funnels through this so a push can
  // never strand the puzzle (block on a switch is always re-pushable off it:
  // its opposite side is the tile the pusher is standing on, i.e. always free).
  playerTile() {
    return { x: Math.floor(this.player.x / TILE_SIZE), y: Math.floor(this.player.y / TILE_SIZE) };
  }

  canPushFrom(px, py, dx, dy) {
    const bx = px + dx, by = py + dy;      // block tile (must hold a block)
    const tx = bx + dx, ty = by + dy;      // destination
    if (bx < 0 || by < 0 || bx >= MAP_COLS || by >= MAP_ROWS) return { ok: false };
    const block = this.blockSprites.find(b => b.getData('gridX') === bx && b.getData('gridY') === by);
    if (!block) return { ok: false };
    if (tx < 1 || ty < 1 || tx >= MAP_COLS - 1 || ty >= MAP_ROWS - 1) return { ok: false, block };
    const t = this.mapData[ty] && this.mapData[ty][tx];
    if (t !== T_FLOOR && t !== T_SWITCH) return { ok: false, block };
    if (this.blockSprites.some(b => b.getData('gridX') === tx && b.getData('gridY') === ty)) return { ok: false, block };
    return { ok: true, block, tx, ty };
  }

  // Called on player-block collider contact: push if grounded on a valid side.
  // Contact may register while the player's CENTER still belongs to the
  // neighboring tile (wall-ride), so we test TWO candidate origin tiles:
  // the player's tile-math tile AND the tile derived from sprite positions.
  // For (dx,dy) direction, a block at B is pushed when origin O = B-(dx,dy)
  // holds the player (origin must be walkable — it's where the pusher stands;
  // the block's previous tile is always walkable floor/switch after a push).
  tryPushNearestBlock() {
    if (this.puzzleTransition || this.pushCooldown > 0) return;
    const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];
    const fdx = { right: 1, left: -1, up: 0, down: 0 }[this.facing] || 0;
    const fdy = { up: -1, down: 1, left: 0, right: 0 }[this.facing] || 0;
    const dx = fdx, dy = fdy;
    if (!dx && !dy) return;

    const pt = this.playerTile();
    // candidate origins: player's math tile, and sprite-derived tile
    // (sprite pos may differ from math tile by contact overlap rounding)
    const origins = [
      pt,
      { x: Math.floor((this.player.x - dx * TILE_SIZE * 0.5) / TILE_SIZE), y: Math.floor((this.player.y - dy * TILE_SIZE * 0.5) / TILE_SIZE) },
    ];
    let push = null;
    for (const o of origins) {
      if (!o) continue;
      const c = this.canPushFrom(o.x, o.y, dx, dy);
      if (c.ok) { push = c; push.fromX_p = o.x; push.fromY_p = o.y; break; }
    }
    if (!push) return;
    const { block, tx, ty } = push;
    const fromX = block.x, fromY = block.y;
    const bx0 = block.getData('gridX');
    const toX = tx * TILE_SIZE + TILE_SIZE / 2;
    const toY = ty * TILE_SIZE + TILE_SIZE / 2;
    block.setData('gridX', tx);
    block.setData('gridY', ty);
    // Freeze body during slide so contact-trigger doesn't chain-fire
    if (block.body) { block.body.enable = false; }
    this.pushCooldown = 260;
    this.time.delayedCall(this.pushCooldown, () => { this.pushCooldown = 0; });
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
        // Re-enable the static body at the new tile
        if (block.body) { block.body.reset(toX, toY); block.body.enable = true; }
        // SOFTLOCK GUARD: a block may never rest on the door line — it would
        // block the only path to the boss room and become un-pushable back
        // (destination wall). Slide it back one tile (pusher is that way).
        if (this.mapData[ty][tx] === T_FLOOR && this.wouldTrapOnDoorLine(tx, ty)) {
          block.setData('gridX', bx0);
          block.setData('gridY', ty);
          if (block.body) block.body.enable = false;
          this.time.delayedCall(SLIDE_MS, () => {
            block.setPosition(fromX, fromY);
            if (block.body) { block.body.reset(fromX, fromY); block.body.enable = true; }
            this.statusDiv.textContent = "Can't push it there — it would plug the doorway.";
          });
          return;
        }
      }
    };
    requestAnimationFrame(animateSlide);
    // Check if block is on a switch
    this.checkBlockOnSwitch(block, tx, ty);
  }

  wouldTrapOnDoorLine(tx, ty) {
    // Door line at y=10: tiles (4..8,10); door tile itself is (6,10).
    // A block resting on x∈{4,5,7,8} y=10 leaves the door reachable only via
    // a push that requires standing INSIDE the door gap — impossible.
    return ty === 10 && tx >= 4 && tx <= 8 && tx !== 6;
  }

  checkBlockOnSwitch(block, x, y) {
    for (let i = 0; i < this.switchPositions.length; i++) {
      const sw = this.switchPositions[i];
      if (sw.x === x && sw.y === y) {
        this.switchStates[i] = true;
        this.setBlockActive(block, true);
        return;
      }
    }
    // Block moved off a switch
    this.setBlockActive(block, false);
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
      this.statusDiv.textContent = 'Ancient Ruins — Puzzle solved! Proceed to the boss room.';
      // Open the door (replace door tiles with floor)
      for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < MAP_COLS; x++) {
          if (this.mapData[y][x] === T_DOOR) {
            this.mapData[y][x] = T_FLOOR;
            this.groundLayer.putTileAt(T_FLOOR, x, y);
          }
        }
      }
      this.groundLayer.setCollision([T_WALL, T_PIT, T_CHEST]);
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

    // Room 2: puzzle room (middle)
    // Puzzle door (closed until puzzle solved) — at (6,10)
    map[10][6] = T_DOOR;

    // Room 3: boss room (top)
    this.addWallRect(map, 4, 5, 5, 1);
    // Boss room door — always open (boss is the gatekeeper)
    map[5][6] = T_FLOOR;

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