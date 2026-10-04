/**
 * ConduitScenes — the two finale areas (Phase 8 endgame).
 *
 * ConduitGate (Overworld-adjacent field scene):
 *   - A short path to the Gate. Walking to the end triggers:
 *     Gareth cutscene → Gareth boss fight → betrayal cutscene → Aldric p1 fight
 *   - After betrayal: the Gate interior opens (Conduit scene).
 *
 * Conduit (interior):
 *   - Final arena. Stepping to the center triggers the finale cutscene,
 *     then the two-phase Aldric battle (p1 → p2 handled in BattleScene),
 *     then the ending + credits. Sets gameComplete.
 *
 * Both are simple field scenes — no encounters, no menu-triggered puzzles.
 * Timing via setTimeout (launched-battle safety), raw DOM input, DOM overlays.
 */
import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { playGarethScene, playBetrayalScene, playFinaleScene, playEndingScene } from '../game/story.js';

const TILE_SIZE = 32;

export class ConduitGateScene extends Phaser.Scene {
  constructor() {
    super('ConduitGate');
  }

  create() {
    this.domElements = [];
    this.transitioning = false;
    this.cutsceneLock = false;

    // Simple 12×10 corridor map
    const cols = 12, rows = 10;
    this.mapData = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        row.push(x === 0 || x === cols - 1 || y === 0 || y === rows - 1 ? 1 : 0);
      }
      this.mapData.push(row);
    }

    const map = this.make.tilemap({ data: this.mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('town_tiles', 'town_tiles', TILE_SIZE, TILE_SIZE);
    const ground = map.createLayer(0, tileset, 0, 0);
    ground.setCollision([1]);

    this.player = this.physics.add.sprite(6 * TILE_SIZE + 16, 8 * TILE_SIZE + 16, 'player_field', 1);
    this.player.body.setDrag(0, 0);
    this.player.body.setSize(20, 20);
    this.createAnimations();
    this.player.anims.play('walk-down', false);
    this.player.anims.pause();
    this.physics.add.collider(this.player, ground);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, cols * TILE_SIZE, rows * TILE_SIZE);
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#0a0510');

    // Exit tile (back to overworld) at entrance
    // Trigger tile at the top end
    this.triggerFired = GameState.hasFlag('betrayed'); // already done = just a corridor now

    // Input
    this.keys = { up: false, down: false, left: false, right: false };
    this.keyShift = this.input.keyboard.addKey('SHIFT');
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
    this.statusDiv.textContent = GameState.hasFlag('betrayed')
      ? 'The Conduit Gate — The wound in the sky waits at the end of the road'
      : 'The road to the Conduit Gate — Something waits at the end';
    document.getElementById('game-container').appendChild(this.statusDiv);
    this.domElements.push(this.statusDiv);

    // Gareth sprite mid-map (before betrayal only)
    if (!GameState.hasFlag('garethMet')) {
      this.garethSprite = this.add.rectangle(6 * TILE_SIZE + 16, 4 * TILE_SIZE + 16, 30, 30, 0x8b0000);
      this.garethSprite.setStrokeStyle(2, 0xff4444);
    }

    this.facing = 'down';
    this.menuScene = 'Overworld'; // exit target
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
      if (this.player.anims.currentAnim?.key !== animKey) this.player.anims.play(animKey, true);
    } else {
      this.player.anims.pause();
      const frameMap = { down: 1, left: 4, right: 7, up: 10 };
      this.player.setFrame(frameMap[this.facing] ?? 1);
    }

    const tileY = Math.floor(this.player.y / TILE_SIZE);
    const tileX = Math.floor(this.player.x / TILE_SIZE);

    // Exit at the bottom (back to overworld)
    if (tileY >= 8 && this.confirmPressed) {
      this.confirmPressed = false;
      this.exitToOverworld();
      return;
    }
    this.confirmPressed = false;

    // Story triggers — fire once
    if (!this.triggerFired && tileY <= 5) {
      this.triggerFired = true;
      this._runGarethSequence();
    }
  }

  async _runGarethSequence() {
    // Cutscene locks movement; when it resolves, launch the Gareth fight.
    await playGarethScene(this);
    this.player.setVelocity(0, 0);
    this.transitioning = true;
    this.domElements.forEach(el => el.style.display = 'none');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    await new Promise(res => this.cameras.main.once('camerafadeoutcomplete', res));
    this.scene.launch('Battle', { returnScene: 'ConduitGate', enemies: ['boss_disgraced'], isBoss: true });
    this.scene.pause();
    if (!this._bossResumeRegistered) {
      this._bossResumeRegistered = true;
      // Stage tracker: garethDone → betrayalDone → p1Done. Without this the
      // second resume would replay the betrayal cutscene in a loop.
      this._garethStage = 'garethFought';
      this.events.on('resume', async (sys, data) => {
        if (data && data.battleResult !== 'win') {
          // fled/lost — don't advance the stage
          this.transitioning = false;
          this.domElements.forEach(el => el.style.display = '');
          this.cameras.main.fadeIn(300, 0, 0, 0);
          return;
        }
        if (this._garethStage === 'garethFought') {
          this._garethStage = 'betrayalPlaying';
          if (this.garethSprite) this.garethSprite.setVisible(false);
          // Gareth defeated → betrayal cutscene. Aldric does NOT fight here —
          // he tears the Gate open and steps through. Follow him in.
          await playBetrayalScene(this);
          this.player.setVelocity(0, 0);
          this.transitioning = true;
          this.domElements.forEach(el => el.style.display = 'none');
          this.cameras.main.fadeOut(300, 0, 0, 0);
          await new Promise(res => this.cameras.main.once('camerafadeoutcomplete', res));
          this._garethStage = 'done';
          // The Conduit proper — the finale vs Aldric plays inside.
          this.scene.start('Conduit');
          return;
        }
        this.transitioning = false;
        this.domElements.forEach(el => el.style.display = '');
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
    }
  }

  // Aldric p1 victory resumes here (second resume handler branch)
  // — we use the same 'resume' event with a counter
  exitToOverworld() {
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
    this.scene.launch('Menu', { parentScene: 'ConduitGate' });
    this.scene.pause();
  }

  cleanupDom() {
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
  }

  createAnimations() {
    if (!this.anims.exists('walk-down')) {
      this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('player_field', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-left', frames: this.anims.generateFrameNumbers('player_field', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player_field', { start: 6, end: 8 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('player_field', { start: 9, end: 11 }), frameRate: 8, repeat: -1 });
    }
  }

  shutdown() { this.cleanupDom(); }
}

export class ConduitScene extends Phaser.Scene {
  constructor() {
    super('Conduit');
  }

  create() {
    this.domElements = [];
    this.transitioning = false;
    this.cutsceneLock = false;

    // 10×10 arena
    const cols = 10, rows = 10;
    this.mapData = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        row.push(x === 0 || x === cols - 1 || y === 0 || y === rows - 1 ? 1 : 0);
      }
      this.mapData.push(row);
    }

    const map = this.make.tilemap({ data: this.mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('town_tiles', 'town_tiles', TILE_SIZE, TILE_SIZE);
    const ground = map.createLayer(0, tileset, 0, 0);
    ground.setCollision([1]);

    this.player = this.physics.add.sprite(5 * TILE_SIZE + 16, 8 * TILE_SIZE + 16, 'player_field', 1);
    this.player.body.setDrag(0, 0);
    this.player.body.setSize(20, 20);
    this.createAnimations();
    this.player.anims.play('walk-down', false);
    this.player.anims.pause();
    this.physics.add.collider(this.player, ground);

    // Aldric sprite at the center basin
    this.aldricSprite = this.add.rectangle(5 * TILE_SIZE + 16, 3 * TILE_SIZE + 16, 32, 32, 0x331133);
    this.aldricSprite.setStrokeStyle(2, 0x8833aa);

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, cols * TILE_SIZE, rows * TILE_SIZE);
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.cameras.main.setBackgroundColor('#050510');

    // If the finale was already finished, this is a quiet arena
    this.finaleDone = GameState.hasFlag('gameComplete');

    // Input
    this.keys = { up: false, down: false, left: false, right: false };
    this.keyShift = this.input.keyboard.addKey('SHIFT');
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
    document.getElementById('game-container').appendChild(this.statusDiv);
    this.domElements.push(this.statusDiv);
    this.statusDiv.textContent = GameState.hasFlag('gameComplete')
      ? 'The Conduit — The basin is quiet now. The relics sleep.'
      : 'The Conduit — The sky is an eye. Aldric waits at the basin.';

    this.facing = 'down';
  }

  _setStatus(text) {
    if (this.statusDiv) this.statusDiv.textContent = text;
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
      if (this.player.anims.currentAnim?.key !== animKey) this.player.anims.play(animKey, true);
    } else {
      this.player.anims.pause();
      const frameMap = { down: 1, left: 4, right: 7, up: 10 };
      this.player.setFrame(frameMap[this.facing] ?? 1);
    }

    const tileX = Math.floor(this.player.x / TILE_SIZE);
    const tileY = Math.floor(this.player.y / TILE_SIZE);
    this.confirmPressed = false;

    // Approach the basin → finale cutscene → Aldric (both phases) → ending
    if (!this.finaleDone && tileY <= 5) {
      this.finaleDone = true;
      this._runFinaleSequence();
    }
  }

  async _runFinaleSequence() {
    await playFinaleScene(this);
    this.player.setVelocity(0, 0);
    this.transitioning = true;
    this.domElements.forEach(el => el.style.display = 'none');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    await new Promise(res => this.cameras.main.once('camerafadeoutcomplete', res));
    this.scene.launch('Battle', { returnScene: 'Conduit', enemies: ['boss_aldric_p1'], isBoss: true });
    this.scene.pause();
    if (!this._finaleResumeRegistered) {
      this._finaleResumeRegistered = true;
      this.events.on('resume', async (sys, data) => {
        this.transitioning = false;
        this.domElements.forEach(el => el.style.display = '');
        // BattleScene morphs p1 → p2 internally; a 'win' here means both phases fell
        if (data && data.battleResult === 'win') {
          if (this.aldricSprite) this.aldricSprite.setVisible(false);
          await playEndingScene(this);
          this._setStatus('The Conduit — The basin is quiet. The relics sleep. — THE END —');
        }
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
    }
  }

  openMenu() {
    if (this.transitioning) return;
    this.player.setVelocity(0, 0);
    this.scene.launch('Menu', { parentScene: 'Conduit' });
    this.scene.pause();
  }

  cleanupDom() {
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
  }

  createAnimations() {
    if (!this.anims.exists('walk-down')) {
      this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('player_field', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-left', frames: this.anims.generateFrameNumbers('player_field', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player_field', { start: 6, end: 8 }), frameRate: 8, repeat: -1 });
      this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('player_field', { start: 9, end: 11 }), frameRate: 8, repeat: -1 });
    }
  }

  shutdown() { this.cleanupDom(); }
}