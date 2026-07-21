import Phaser from 'phaser';

/**
 * TownScene — town interior.
 * Uses DOM overlays for all text (crisp at any resolution).
 */

const TILE_SIZE = 32;
const MAP_COLS = 16;
const MAP_ROWS = 12;

const T_FLOOR = 0;
const T_WALL = 1;
const T_PATH = 2;
const T_BUILDING_WALL = 3;
const T_BUILDING_ROOF = 4;
const T_WOOD = 5;

const EXIT_X = 8;
const EXIT_Y = 11;

export default class TownScene extends Phaser.Scene {
  constructor() {
    super('Town');
  }

  create() {
    this.domElements = [];
    const container = document.getElementById('game-container');

    const mapData = this.generateMapData();
    const map = this.make.tilemap({ data: mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage('town_tiles', 'town_tiles', TILE_SIZE, TILE_SIZE);
    const groundLayer = map.createLayer(0, tileset, 0, 0);
    groundLayer.setCollision([T_WALL, T_BUILDING_WALL, T_BUILDING_ROOF]);

    const playerStartX = EXIT_X * TILE_SIZE + TILE_SIZE / 2;
    const playerStartY = (EXIT_Y - 1) * TILE_SIZE + TILE_SIZE / 2;
    this.player = this.physics.add.sprite(playerStartX, playerStartY, 'player_field', 1);
    this.player.body.setDrag(0, 0);

    this.createAnimations();
    this.player.anims.play('walk-down', false);
    this.player.anims.pause();

    this.physics.add.collider(this.player, groundLayer);

    // --- NPCs ---
    this.npcs = [];

    const npc1X = 6 * TILE_SIZE + TILE_SIZE / 2;
    const npc1Y = 5 * TILE_SIZE + TILE_SIZE / 2;
    const npc1 = this.physics.add.staticSprite(npc1X, npc1Y, 'player_field', 1);
    npc1.setData('dialogue', {
      speaker: 'Townsfolk', portrait: null,
      pages: [
        'Welcome to our town, traveler.',
        'You seek the ancient relics? Dangerous business, that.',
        'But I can see it in your eyes... you won\'t be dissuaded.',
        'Be careful out there. The world is not as kind as this town.'
      ]
    });
    npc1.setData('name', 'Townsfolk');
    this.npcs.push(npc1);

    const npc2X = 11 * TILE_SIZE + TILE_SIZE / 2;
    const npc2Y = 5 * TILE_SIZE + TILE_SIZE / 2;
    const npc2 = this.physics.add.staticSprite(npc2X, npc2Y, 'player_field', 1);
    npc2.setTint(0x888888);
    npc2.setData('dialogue', {
      speaker: 'Elder', portrait: null,
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

    this.npcs.forEach(npc => { this.physics.add.collider(this.player, npc); });

    this.nearbyNpc = null;

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Input — raw DOM keyboard events
    this.keyShift = this.input.keyboard.addKey('SHIFT');
    this.keys = { up: false, down: false, left: false, right: false };
    this.confirmPressed = false;

    this.handleKeyDown = (e) => {
      if (this.dialogueActive) return;
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
        case 'z': case 'Z': case 'Enter': this.confirmPressed = false; break;
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

    // Exit marker (▲)
    this.exitDiv = document.createElement('div');
    this.exitDiv.style.cssText = `
      position: absolute;
      color: #ffff00; font-size: 18px;
      font-family: "Courier New", monospace;
      transform: translate(-50%, -50%);
      pointer-events: none; z-index: 10;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    this.exitDiv.textContent = '▲';
    container.appendChild(this.exitDiv);
    this.domElements.push(this.exitDiv);

    this.exitBlink = setInterval(() => {
      this.exitDiv.style.opacity = this.exitDiv.style.opacity === '0' ? '1' : '0';
    }, 400);

    // Position exit marker
    const exitWorldX = EXIT_X * TILE_SIZE + TILE_SIZE / 2;
    const exitWorldY = EXIT_Y * TILE_SIZE + TILE_SIZE / 2;
    const canvas = document.querySelector('canvas');
    const updateMarkerPos = () => {
      const cr = canvas.getBoundingClientRect();
      const cam = this.cameras.main;
      const sx = cr.width / cam.worldView.width;
      const sy = cr.height / cam.worldView.height;
      this.exitDiv.style.left = ((exitWorldX - cam.scrollX) * sx) + 'px';
      this.exitDiv.style.top = ((exitWorldY - cam.scrollY) * sy) + 'px';
    };
    updateMarkerPos();
    this.updateMarkerPos = updateMarkerPos;

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
    this.statusDiv.textContent = 'Town — Walk to the ▲ marker and press Z to exit';
    container.appendChild(this.statusDiv);
    this.domElements.push(this.statusDiv);

    // NPC interact prompt (created on demand)
    this.interactDiv = null;

    this.facing = 'down';
    this.transitioning = false;
    this.dialogueActive = false;
  }

  update(time, delta) {
    if (this.transitioning) return;
    if (this.dialogueActive) return;

    // Update exit marker position (in case canvas was resized)
    if (this.updateMarkerPos) this.updateMarkerPos();

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
    if (nearExit && this.gamepad && this.gamepad.A) {
      this.exitTown();
    }

    // --- NPC interaction ---
    this.nearbyNpc = null;
    let minDist = TILE_SIZE * 1.5;
    for (const npc of this.npcs) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (dist < minDist) { minDist = dist; this.nearbyNpc = npc; }
    }

    // Show/hide interact prompt using DOM
    const container = document.getElementById('game-container');
    if (this.nearbyNpc && !this.dialogueActive) {
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
        this.interactDiv.textContent = 'Press Z';
        container.appendChild(this.interactDiv);
        this.domElements.push(this.interactDiv);
      }
      // Position above NPC — account for camera scroll and canvas scaling
      const canvas = document.querySelector('canvas');
      const cr = canvas.getBoundingClientRect();
      const cam = this.cameras.main;
      const sx = cr.width / (cam.worldView.width);
      const sy = cr.height / (cam.worldView.height);
      const screenX = (this.nearbyNpc.x - cam.scrollX) * sx;
      const screenY = (this.nearbyNpc.y - 24 - cam.scrollY) * sy;
      this.interactDiv.style.left = screenX + 'px';
      this.interactDiv.style.top = screenY + 'px';
      this.interactDiv.style.display = 'block';
    } else if (this.interactDiv) {
      this.interactDiv.style.display = 'none';
    }

    if (this.nearbyNpc && this.confirmPressed && !this.dialogueActive) {
      this.confirmPressed = false;
      this.talkToNpc(this.nearbyNpc);
    }

    this.confirmPressed = false;
  }

  talkToNpc(npc) {
    if (this.dialogueActive) return;
    this.dialogueActive = true;
    if (this.interactDiv) this.interactDiv.style.display = 'none';

    this.player.setVelocity(0, 0);
    this.player.anims.pause();
    const frameMap = { down: 1, left: 4, right: 7, up: 10 };
    this.player.setFrame(frameMap[this.facing] ?? 1);

    const dialogueData = npc.getData('dialogue');
    this.scene.launch('Dialogue', {
      ...dialogueData,
      onComplete: (choiceValue) => {
        this.dialogueActive = false;
        if (choiceValue) console.log(`Player chose: ${choiceValue}`);
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

  cleanupDom() {
    if (this.exitBlink) clearInterval(this.exitBlink);
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

  generateMapData() {
    const map = [];
    for (let y = 0; y < MAP_ROWS; y++) {
      const row = [];
      for (let x = 0; x < MAP_COLS; x++) {
        let tile = T_FLOOR;
        if (x === 0 || x === MAP_COLS - 1 || y === 0) tile = T_WALL;
        if (y === MAP_ROWS - 1) { tile = x === EXIT_X ? T_PATH : T_WALL; }
        if (x >= 2 && x <= 4 && y >= 2 && y <= 3) tile = y === 2 ? T_BUILDING_ROOF : T_BUILDING_WALL;
        if (x >= 10 && x <= 13 && y >= 2 && y <= 3) tile = y === 2 ? T_BUILDING_ROOF : T_BUILDING_WALL;
        if (x >= 2 && x <= 4 && y >= 6 && y <= 8) tile = y === 6 ? T_BUILDING_ROOF : T_BUILDING_WALL;
        if (x >= 10 && x <= 13 && y >= 6 && y <= 8) tile = y === 6 ? T_BUILDING_ROOF : T_BUILDING_WALL;
        if (x === EXIT_X && y >= 3 && y <= MAP_ROWS - 1) tile = T_PATH;
        if (y === 5 && x >= 2 && x <= MAP_COLS - 3) tile = T_PATH;
        if ((x === 5 && y >= 2 && y <= 3) || (x === 9 && y >= 2 && y <= 3)) tile = T_WOOD;
        row.push(tile);
      }
      map.push(row);
    }
    return map;
  }
}