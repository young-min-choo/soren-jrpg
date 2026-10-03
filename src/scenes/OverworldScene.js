import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { playIntro, playAldricJoin } from '../game/story.js';
import { OW_MARKERS, OW_DOCKS, OW_COLS, OW_ROWS } from '../game/WorldData.js';
import { rollEncounter } from '../game/EnemyData.js';

/**
 * OverworldScene — world map exploration (40×32, Phase 8).
 * Top-left 20×16 = original map (village, ruins, embers) kept identical.
 * New: Port Meridian + Tide Temple (east), Stonewatch + Hollow Deep (south),
 * Skyhold + Storm Spire (northeast peaks), Aurelia (north), Conduit Gate
 * (far east). Airship docks unlock fast travel after 'airship' flag.
 * Uses DOM overlays for text (crisp at any resolution).
 */

const TILE_SIZE = 32;

const T_GRASS_DARK = 0;
const T_GRASS_LIGHT = 1;
const T_FOREST = 2;
const T_MOUNTAIN = 3;
const T_WATER = 4;
const T_PATH = 5;
const T_BRIDGE = 6;
const T_DESERT = 7;
const T_SNOW = 8;
const T_SWAMP = 9;

export default class OverworldScene extends Phaser.Scene {
  constructor() {
    super('Overworld');
  }

  create(data) {
    this.domElements = [];

    // Cutscene lock: runCutscene sets this while playing. Field scenes bail
    // out of update() when set — movement, encounters, interactions all stop.
    this.cutsceneLock = false;

    const mapData = this.generateMapData();
    const map = this.make.tilemap({ data: mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('overworld_tiles', 'overworld_tiles', TILE_SIZE, TILE_SIZE);
    const groundLayer = map.createLayer(0, tileset, 0, 0);
    groundLayer.setCollisionByExclusion([T_GRASS_DARK, T_GRASS_LIGHT, T_PATH, T_BRIDGE, T_DESERT, T_SNOW, T_SWAMP]);

    // Restore saved position if present (save/load contract)
    const gs = GameState.get();
    const hasSavedPos = data && data.resumePos;
    const playerStartX = hasSavedPos ? gs.x : 10 * TILE_SIZE + TILE_SIZE / 2;
    const playerStartY = hasSavedPos ? gs.y : 10 * TILE_SIZE + TILE_SIZE / 2;
    this.player = this.physics.add.sprite(playerStartX, playerStartY, 'player_field', 1);
    this.player.body.setDrag(0, 0);

    this.createAnimations();
    this.player.anims.play('walk-down', false);
    this.player.anims.pause();

    this.physics.add.collider(this.player, groundLayer);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, OW_COLS * TILE_SIZE, OW_ROWS * TILE_SIZE);

    // Input — raw DOM keyboard events
    this.keyShift = this.input.keyboard.addKey('SHIFT');
    this.keys = { up: false, down: false, left: false, right: false };
    this.confirmPressed = false;

    this.handleKeyDown = (e) => {
      // Paused scenes (Menu/Battle/GameOver on top) must not react to input
      if (!this.scene.isActive()) return;
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
    this.statusDiv.textContent = '▼ markers: Yellow = Town · Red/orange = Dungeon · Press Z at a marker';
    container.appendChild(this.statusDiv);
    this.domElements.push(this.statusDiv);

    // Entrance markers (▼) — one per marker config, gated ones hidden until flag
    this.markerDivs = [];
    OW_MARKERS.forEach((m, i) => {
      const div = document.createElement('div');
      div.style.cssText = `
        position: absolute;
        color: ${m.color}; font-size: 18px;
        font-family: "Courier New", monospace;
        transform: translate(-50%, -50%);
        pointer-events: none; z-index: 10;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      `;
      div.textContent = '▼';
      const visible = !m.gate || GameState.hasFlag(m.gate);
      div.style.display = visible ? '' : 'none';
      container.appendChild(div);
      this.domElements.push(div);
      this.markerDivs.push({ div, cfg: m });
    });

    // Airship dock markers (visible only with 'airship' flag)
    this.dockDivs = [];
    if (GameState.hasFlag('airship')) {
      OW_DOCKS.forEach((d, i) => {
        const div = document.createElement('div');
        div.style.cssText = `
          position: absolute;
          color: #66ddff; font-size: 16px;
          font-family: "Courier New", monospace;
          transform: translate(-50%, -50%);
          pointer-events: none; z-dock: 10;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        `;
        div.textContent = '⚓';
        container.appendChild(div);
        this.domElements.push(div);
        this.dockDivs.push({ div, pos: d });
      });
    }

    this.facing = 'down';
    this.transitioning = false;

    // --- Random encounter system — region-based ---
    this.encounterThreshold = 6 + Math.floor(Math.random() * 4);

    // --- Story triggers ---
    // Intro cutscene (first entry of a new game only)
    if (!GameState.hasFlag('introDone')) {
      playIntro(this);
    }
    // Aldric joins after the Fire Relic, on the next overworld entry (once)
    else if (GameState.hasFlag('relicFire') && !GameState.hasFlag('aldricJoined')) {
      playAldricJoin(this);
    }
    // After betrayal, on overworld entry: Aria/Kael resolve to follow
    else if (GameState.hasFlag('betrayed') && !GameState.hasFlag('gateOpenedNoted')) {
      GameState.setFlag('gateOpenedNoted');
      // No cutscene needed — status line points at the Conduit Gate marker
      this.statusDiv.textContent = 'The Conduit Gate is open — follow the purple ▼ far east';
    }
  }

  update(time, delta) {
    if (this.transitioning || this.cutsceneLock) return;

    const cam = this.cameras.main;
    const canvas = document.querySelector('canvas');
    const canvasRect = canvas.getBoundingClientRect();
    const sx = canvasRect.width / cam.worldView.width;
    const sy = canvasRect.height / cam.worldView.height;

    // Update marker positions to follow camera
    this.markerDivs.forEach(({ div, cfg }) => {
      const visible = !cfg.gate || GameState.hasFlag(cfg.gate);
      if (div.style.display === 'none' && visible) div.style.display = '';
      if (div.style.display !== 'none') {
        const wx = cfg.x * TILE_SIZE + TILE_SIZE / 2;
        const wy = cfg.y * TILE_SIZE + TILE_SIZE / 2;
        div.style.left = ((wx - cam.scrollX) * sx) + 'px';
        div.style.top = ((wy - cam.scrollY) * sy) + 'px';
      }
    });
    this.dockDivs.forEach(({ div, pos }) => {
      const wx = pos.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = pos.y * TILE_SIZE + TILE_SIZE / 2;
      div.style.left = ((wx - cam.scrollX) * sx) + 'px';
      div.style.top = ((wy - cam.scrollY) * sy) + 'px';
    });

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

    const playerTileX = Math.floor(this.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / TILE_SIZE);

    // ── Marker interactions (Z at a marker) ──
    let nearMarker = null;
    for (const { div, cfg } of this.markerDivs) {
      if (Math.abs(playerTileX - cfg.x) <= 1 && Math.abs(playerTileY - cfg.y) <= 1) {
        nearMarker = cfg;
        break;
      }
    }

    // ── Airship dock travel (Z at a dock) ──
    let nearDock = null;
    for (const { pos } of this.dockDivs) {
      if (Math.abs(playerTileX - pos.x) <= 1 && Math.abs(playerTileY - pos.y) <= 1) {
        nearDock = pos;
        break;
      }
    }

    if (this.confirmPressed) {
      this.confirmPressed = false;

      if (nearDock && !nearMarker) {
        this.openAirshipMenu(nearDock);
        return;
      }

      if (nearMarker) {
        if (nearMarker.gate && !GameState.hasFlag(nearMarker.gate)) {
          const prev = this.statusDiv.textContent;
          this.statusDiv.textContent = 'The way is sealed. (An omen has not yet come to pass)';
          setTimeout(() => { if (this.statusDiv) this.statusDiv.textContent = prev; }, 3000);
          return;
        }
        this.enterMarker(nearMarker);
        return;
      }
    }

    // --- Random encounters — region-based area tables ---
    if (moving && !nearMarker && !nearDock) {
      const distMoved = Phaser.Math.Distance.Between(this.player.x, this.player.y, this._lastPlayerX || this.player.x, this._lastPlayerY || this.player.y);
      this.encounterDistance = (this.encounterDistance || 0) + distMoved;
      this._lastPlayerX = this.player.x;
      this._lastPlayerY = this.player.y;
      const thresholdPx = this.encounterThreshold * TILE_SIZE;
      if (this.encounterDistance >= thresholdPx) {
        this.encounterDistance = 0;
        this.encounterThreshold = 6 + Math.floor(Math.random() * 4);
        this.startBattle(this._regionKey(playerTileX, playerTileY));
      }
    }
  }

  /** Encounter region by position — drives which enemy table is used. */
  _regionKey(x, y) {
    // Original grassland (top-left quadrant around village)
    if (x < 20 && y < 16) return 'overworld';
    // Northeast peaks (Skyhold/Spire approach)
    if (y < 10 && x >= 24) return 'endgame';
    // East coast (Port Meridian / Tide Temple)
    if (x >= 24 && y >= 10 && y < 20) return 'coast';
    // South (Stonewatch / Hollow Deep)
    if (y >= 16 && x < 20) return 'coast';
    // Far east / capital region
    if (x >= 20 && y >= 16) return 'endgame';
    return 'overworld';
  }

  enterMarker(cfg) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(cfg.sceneKey);
    });
  }

  openAirshipMenu(dock) {
    // Fast-travel menu: pick any unlocked dock
    if (this.transitioning) return;
    const container = document.getElementById('game-container');
    this.airshipDiv = document.createElement('div');
    this.airshipDiv.style.cssText = `
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: 400px;
      background: rgba(20, 20, 50, 0.95); border: 2px solid rgba(255,255,255,0.3);
      padding: 16px; box-sizing: border-box;
      font-family: "Courier New", monospace; color: #ffffff;
      z-index: 50; pointer-events: none;
      border-radius: 4px;
    `;
    const names = ['Village', 'Port Meridian', 'Stonewatch', 'Skyhold', 'Aurelia'];
    this._airshipOptions = OW_DOCKS.map((d, i) => ({ ...d, name: names[i] }));
    this._airshipIndex = 0;
    container.appendChild(this.airshipDiv);
    this._renderAirshipMenu();

    this._airshipKeyHandler = (e) => {
      const opts = this._airshipOptions;
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
        case 'ArrowLeft': case 'a': case 'A':
          this._airshipIndex = (this._airshipIndex - 1 + opts.length) % opts.length;
          this._renderAirshipMenu(); e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S':
        case 'ArrowRight': case 'd': case 'D':
          this._airshipIndex = (this._airshipIndex + 1) % opts.length;
          this._renderAirshipMenu(); e.preventDefault(); break;
        case 'z': case 'Z': case 'Enter': {
          const dest = opts[this._airshipIndex];
          this._closeAirshipMenu();
          this._flyTo(dest);
          e.preventDefault(); break;
        }
        case 'x': case 'X': case 'Escape':
          this._closeAirshipMenu();
          e.preventDefault(); break;
      }
    };
    window.addEventListener('keydown', this._airshipKeyHandler);
  }

  _renderAirshipMenu() {
    if (!this.airshipDiv) return;
    let html = '<div style="font-size:14px;color:#66ddff;margin-bottom:8px">The Zephyr — Where to?</div>';
    this._airshipOptions.forEach((opt, i) => {
      const sel = i === this._airshipIndex;
      const prefix = sel ? '▶' : ' ';
      const color = sel ? '#ffff00' : '#ccc';
      html += `<div style="color:${color};font-size:13px;margin:4px 0"><span style="display:inline-block;width:18px">${prefix}</span>${opt.name}</div>`;
    });
    html += '<div style="font-size:11px;color:#888;margin-top:8px">Z: Fly · X: Stay</div>';
    this.airshipDiv.innerHTML = html;
  }

  _closeAirshipMenu() {
    if (this.airshipDiv) { this.airshipDiv.remove(); this.airshipDiv = null; }
    if (this._airshipKeyHandler) {
      window.removeEventListener('keydown', this._airshipKeyHandler);
      this._airshipKeyHandler = null;
    }
  }

  _flyTo(dest) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.statusDiv.textContent = `The Zephyr carries you to ${dest.name}...`;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // Teleport player to the destination dock
      this.player.body.reset(dest.x * TILE_SIZE + TILE_SIZE / 2, (dest.y + 1) * TILE_SIZE + TILE_SIZE / 2);
      this.player.x = dest.x * TILE_SIZE + TILE_SIZE / 2;
      this.player.y = (dest.y + 1) * TILE_SIZE + TILE_SIZE / 2;
      this._lastPlayerX = this.player.x;
      this._lastPlayerY = this.player.y;
      this.transitioning = false;
      this.cameras.main.fadeIn(400, 0, 0, 0);
      setTimeout(() => {
        if (this.statusDiv) this.statusDiv.textContent = '▼ markers: Yellow = Town · Red/orange = Dungeon · Press Z at a marker';
      }, 2500);
    });
  }

  openMenu() {
    if (this.transitioning) return;
    this.player.setVelocity(0, 0);
    this.scene.launch('Menu', { parentScene: 'Overworld' });
    this.scene.pause();
  }

  startBattle(areaKey) {
    if (this.transitioning) return;
    this.transitioning = true;
    // Stop player movement immediately
    this.player.setVelocity(0, 0);
    // Hide overworld DOM elements immediately (before fade, so they don't float during transition)
    this.domElements.forEach(el => el.style.display = 'none');

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.launch('Battle', {
        returnScene: 'Overworld',
        enemies: rollEncounter(areaKey || 'overworld'),
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
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
    }
  }

  cleanupDom() {
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
    if (this._airshipKeyHandler) {
      window.removeEventListener('keydown', this._airshipKeyHandler);
      this._airshipKeyHandler = null;
    }
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
    for (let y = 0; y < OW_ROWS; y++) {
      const row = [];
      for (let x = 0; x < OW_COLS; x++) {
        let tile = (x + y) % 2 === 0 ? T_GRASS_DARK : T_GRASS_LIGHT;
        // Border
        if (x === 0 || x === OW_COLS - 1 || y === 0 || y === OW_ROWS - 1) tile = T_FOREST;
        // ── Original 20×16 quadrant (kept exact) ──
        if (x >= 14 && x <= 18 && y >= 1 && y <= 4) tile = T_WATER;
        if (x >= 15 && x <= 17 && y >= 3 && y <= 5) tile = T_PATH;
        if (x >= 1 && x <= 4 && y >= 1 && y <= 3) tile = T_MOUNTAIN;
        if (x === 3 && y === 2) tile = T_PATH;                    // embers entrance
        if (x >= 2 && x <= 3 && y >= 4 && y <= 6) tile = T_PATH; // embers path
        if (x >= 2 && x <= 9 && y === 7) tile = T_PATH;          // east path
        if (x === 1 && x <= 4 && y >= 11 && y <= 14) tile = T_MOUNTAIN;
        if (x === 10 && y >= 8 && y <= 10) tile = T_PATH;        // town path
        // ── New regions ──
        // East coast (Port Meridian at 27,10; Tide Temple 33,15)
        if (x >= 24 && x <= 38 && y >= 9 && y <= 13) tile = T_GRASS_LIGHT;
        if (x >= 28 && x <= 38 && y >= 14 && y <= 17) tile = T_WATER;   // sea
        if (x === 27 && y >= 10 && y <= 12) tile = T_PATH;             // port path
        if (x >= 27 && x <= 33 && y === 12) tile = T_PATH;              // path to tide
        if (x >= 33 && x <= 35 && y >= 13 && y <= 15) tile = T_PATH;    // tide approach
        // South (Stonewatch 10,19; Hollow Deep 5,25)
        if (x >= 2 && x <= 18 && y >= 17 && y <= 29) tile = T_DESERT;
        if (x === 10 && y >= 16 && y <= 19) tile = T_PATH;              // down to stonewatch
        if (x >= 5 && x <= 10 && y === 21) tile = T_PATH;
        if (x === 5 && y >= 21 && y <= 25) tile = T_PATH;               // to hollow
        if (x >= 1 && x <= 4 && y >= 22 && y <= 28) tile = T_SWAMP;      // swamp
        // Northeast peaks (Skyhold 29,7; Spire 34,2; Aurelia 22,3)
        if (x >= 21 && x <= 39 && y >= 1 && y <= 8) tile = T_MOUNTAIN;
        if (x === 22 && y >= 3 && y <= 8) tile = T_PATH;                // aurelia path
        if (x >= 22 && x <= 29 && y === 7) tile = T_PATH;                // to skyhold
        if (x >= 29 && x <= 34 && y >= 2 && y <= 7) tile = T_PATH;      // spire approach
        if (x >= 25 && x <= 33 && y >= 1 && y <= 3) tile = T_SNOW;       // snow caps
        // Far east (Conduit Gate 37,22)
        if (x >= 19 && x <= 39 && y >= 18 && y <= 31) tile = T_DESERT;
        if (x >= 30 && x <= 39 && y >= 19 && y <= 26) tile = T_SWAMP;    // god-wound wastes
        if (x >= 19 && x <= 37 && y === 22) tile = T_PATH;               // conduit road
        row.push(tile);
      }
      map.push(row);
    }
    // Clear walls under markers themselves
    OW_MARKERS.forEach(m => {
      const t = map[m.y] && map[m.y][m.x];
      if (t === T_MOUNTAIN || t === T_FOREST || t === T_WATER) map[m.y][m.x] = T_PATH;
    });
    return map;
  }
}