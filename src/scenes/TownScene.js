import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { JOBS, STARTING_JOBS, UNLOCKABLE_JOBS, getStatsForLevel } from '../game/JobData.js';
import { npcDialogue } from '../game/story.js';
import { getShop, sellPrice, INN_COST } from '../game/ShopData.js';
import { getTown } from '../game/WorldData.js';
import { getEquip } from '../game/EquipmentData.js';

/**
 * TownScene — town interior (base for all 5 towns).
 * The default export is the Village of Verdan (original map — kept exact so
 * existing tests + saves stay valid). Other towns instantiate via
 * `makeTownScene(townKey)` (see townInstances.js) with layout from WorldData.
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
  constructor(sceneKey = 'Town', townKey = 'village') {
    super(sceneKey);
    this.townKey = townKey; // WorldData.TOWNS key
  }

  /** Town config (WorldData). */
  _town() {
    return getTown(this.townKey) || getTown('village');
  }

  create() {
    this.domElements = [];
    const container = document.getElementById('game-container');

    const town = this._town();
    // NPCs from config (5 standard roles per town)
    this.npcCfgs = town.npcs;

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

    this.npcCfgs.forEach(cfg => {
      // Phase 9: real NPC art keyed by stable art key (npcKey || role),
      // never display name. WorldData npcKeys are camelCase; art files are
      // snake_case — normalize exactly like BattleScene's enemy art lookup.
      const rawKey = cfg.npcKey || cfg.role;
      const artKey = rawKey.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      const texKey = `npc_${artKey}`;
      // Phase 10: prefer the 12-frame walk sheet when the identity has one;
      // same 16×24 frames, so position/depth/body are identical. Sprite stays
      // STATIC (config-gated) until movement is tuned; anims give the pose
      // language (talk-facing) and stand frames — see createNpcAnimations().
      const sheetKey = `npc_sheet_${artKey}`;
      const hasSheet = this.textures.exists(sheetKey);
      const spawnKey = hasSheet ? sheetKey : texKey;
      const npc = this.textures.exists(spawnKey)
        ? this.physics.add.staticSprite(
            cfg.x * TILE_SIZE + TILE_SIZE / 2,
            cfg.y * TILE_SIZE + TILE_SIZE / 2,
            spawnKey, 1)
        : this.physics.add.staticSprite(
            cfg.x * TILE_SIZE + TILE_SIZE / 2,
            cfg.y * TILE_SIZE + TILE_SIZE / 2,
            'player_field', 1);
      if (hasSheet) {
        this.createNpcAnimations(artKey);
        npc.setData('hasSheet', true);
        npc.setData('artKey', artKey);
        npc.anims.pause();
        npc.setFrame(1); // stand frame, facing down (sheet row contract)
      }
      if (!this.textures.exists(texKey) && cfg.tint) npc.setTint(cfg.tint);
      npc.setData('artKey', artKey);
      npc.setData('name', cfg.name);
      if (cfg.npcKey) npc.setData('npcKey', cfg.npcKey);
      if (cfg.role === 'jobMaster') npc.setData('isJobMaster', true);
      if (cfg.role === 'shopkeeper') npc.setData('isShopkeeper', true);
      if (cfg.role === 'innkeeper') npc.setData('isInnkeeper', true);
      this.npcs.push(npc);
    });

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
      // Paused scenes (Menu/Battle/GameOver on top) must not react to input
      if (!this.scene.isActive()) return;
      // Modal menus take priority in order
      if (this.shopDiv && this._handleShopKey(e)) return;
      if (this.innDiv && this._handleInnKey(e)) return;
      // Job menu takes priority
      if (this.jobMenuDiv && this._handleJobMenuKey(e)) return;
      if (this.dialogueActive) return;
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
        // NOTE: 'z' is intentionally NOT cleared here. update() consumes
        // confirmPressed each frame; clearing on keyup drops taps whose
        // keydown+keyup land between two rendered frames (input loss).
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
      color: #ffff00; font-size: 26px;
      font-family: "VT323", monospace;
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
      font-family: "VT323", monospace; font-size: 16px;
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
          font-family: "VT323", monospace; font-size: 16px;
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

    // Phase 10: NPC turns to face the player (sprite pose language). Row
    // contract down/left/right/up → frame 1/4/7/10 is each row's stand frame.
    if (npc.getData('hasSheet')) {
      const dx = this.player.x - npc.x;
      const dy = this.player.y - npc.y;
      const facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const npcFrameMap = { down: 1, left: 4, right: 7, up: 10 };
      npc.anims.pause();
      npc.setFrame(npcFrameMap[facing] ?? 1);
      npc.setData('talkFacing', facing);
    }

    // Job Master opens job change menu instead of dialogue
    if (npc.getData('isJobMaster')) {
      this.openJobMenu();
      return;
    }

    // Shopkeeper opens the buy menu
    if (npc.getData('isShopkeeper')) {
      this.openShop();
      return;
    }

    // Innkeeper offers rest
    if (npc.getData('isInnkeeper')) {
      this.openInn();
      return;
    }

    const dialogueData = npc.getData('npcKey')
      ? npcDialogue(npc.getData('npcKey'))
      : npc.getData('dialogue');
    if (!dialogueData) { this.dialogueActive = false; return; }
    this.scene.launch('Dialogue', {
      ...dialogueData,
      onComplete: (choiceValue) => {
        this.dialogueActive = false;
        if (choiceValue) console.log(`Player chose: ${choiceValue}`);
      }
    });
  }

  // ─── Shop (Phase 8) ─────────────────────────────────────────────────────

  openShop() {
    this.shop = getShop(this._town().shopKey);
    this.shopIndex = 0;
    this.shopMode = 'buy';
    this._shopFlashMsg = '';
    this._createShopDom();
  }

  _createShopDom() {
    const container = document.getElementById('game-container');
    this.shopDiv = document.createElement('div');
    this.shopDiv.style.cssText = `
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: 520px; max-height: 480px;
      background: rgba(20, 20, 50, 0.95); border: 2px solid rgba(255,255,255,0.3);
      padding: 16px; box-sizing: border-box;
      font-family: "VT323", monospace; color: #ffffff;
      z-index: 50; pointer-events: none;
      border-radius: 4px; overflow: hidden;
    `;
    container.appendChild(this.shopDiv);
    this._updateShop();
  }

  _updateShop() {
    if (!this.shopDiv) return;
    const gold = GameState.get().gold;
    let html = `<div style="font-size: 20px;color:#ffff00;margin-bottom:4px">${this.shop.name} — <span style="font-size: 14px">[Q] Buy/Sell · [X] Leave</span></div>`;
    html += `<div style="font-size: 17px;color:#44dd44;margin-bottom:10px">Your gold: ${gold}G${this.shopMode === 'sell' ? ' — SELLING' : ''}</div>`;
    if (this.shopMode === 'sell') {
      // Sell mode: inventory items + owned equipment at half price
      const sellables = [];
      GameState.getInventory().forEach(it => {
        if (it.qty > 0) sellables.push({ name: it.name, qty: it.qty, unit: sellPrice(it.name), kind: 'item' });
      });
      Object.entries(GameState.getOwnedEquipment()).forEach(([name, qty]) => {
        if (qty > 0) sellables.push({ name, qty, unit: sellPrice(name), kind: 'equip' });
      });
      this._sellables = sellables;
      if (sellables.length === 0) {
        html += `<div style="color:#888;font-size: 18px">Nothing to sell.</div>`;
      } else {
        sellables.forEach((entry, i) => {
          const sel = i === this.shopIndex;
          const prefix = sel ? '▶' : ' ';
          const color = sel ? '#ffff00' : '#ccc';
          html += `<div style="color:${color};font-size: 18px;margin:4px 0"><span style="display:inline-block;width:18px">${prefix}</span>${entry.name} x${entry.qty} — <span style="color:#44dd44">sell ${entry.unit}G</span></div>`;
        });
      }
    } else {
      this.shop.stock.forEach((entry, i) => {
        const sel = i === this.shopIndex;
        const prefix = sel ? '▶' : ' ';
        const color = sel ? '#ffff00' : (gold >= entry.price ? '#ccc' : '#777');
        const qty = entry.kind === 'equip' ? GameState.getEquipQty(entry.name) : GameState.getItemQty(entry.name);
        const tag = entry.kind === 'equip' ? ' <span style="font-size: 14px;color:#88f">(equip)</span>' : '';
        html += `<div style="color:${color};font-size: 18px;margin:4px 0"><span style="display:inline-block;width:18px">${prefix}</span>${entry.name}${tag} — <span style="color:#44dd44">${entry.price}G</span> <span style="font-size: 14px;color:#888">(have ${qty})</span></div>`;
      });
    }
    if (this._shopFlashMsg) {
      html += `<div class="flash-live" style="font-size: 16px;color:#ffff44;margin-top:4px;min-height:14px">${this._shopFlashMsg}</div>`;
    }
    this.shopDiv.innerHTML = html;
  }

  _handleShopKey(e) {
    if (!this.shopDiv) return false;
    const listLen = () => this.shopMode === 'buy'
      ? this.shop.stock.length
      : (this._sellables ? this._sellables.length : 0);
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        if (listLen() > 0) { this.shopIndex = (this.shopIndex - 1 + listLen()) % listLen(); this._updateShop(); }
        e.preventDefault(); return true;
      case 'ArrowDown': case 's': case 'S':
        if (listLen() > 0) { this.shopIndex = (this.shopIndex + 1) % listLen(); this._updateShop(); }
        e.preventDefault(); return true;
      case 'q': case 'Q':
        // Toggle buy/sell mode
        this.shopMode = this.shopMode === 'buy' ? 'sell' : 'buy';
        this.shopIndex = 0;
        this._updateShop();
        e.preventDefault(); return true;
      case 'z': case 'Z': case 'Enter': {
        if (this.shopMode === 'buy') {
          const entry = this.shop.stock[this.shopIndex];
          const gold = GameState.get().gold;
          if (!entry) return true;
          if (gold < entry.price) {
            this._shopFlash('Not enough gold!');
          } else {
            GameState.get().gold -= entry.price;
            if (entry.kind === 'equip') GameState.addEquipment(entry.name, 1);
            else GameState.addItem(entry.name, 1);
            this._shopFlash(`Bought ${entry.name}!`);
          }
        } else {
          const entry = this._sellables && this._sellables[this.shopIndex];
          if (entry) {
            if (entry.kind === 'equip') GameState.removeEquipment(entry.name, 1);
            else GameState.removeItem(entry.name, 1);
            GameState.get().gold += entry.unit;
            this._shopFlash(`Sold ${entry.name} for ${entry.unit}G!`);
          }
        }
        this._updateShop();
        e.preventDefault(); return true;
      }
      case 'x': case 'X': case 'Escape':
        this._closeShop();
        this.dialogueActive = false;
        e.preventDefault(); return true;
    }
    return false;
  }

  _shopFlash(msg) {
    this._shopFlashMsg = msg;
    this._updateShop();
    setTimeout(() => {
      this._shopFlashMsg = '';
      if (this.shopDiv) this._updateShop();
    }, 1500);
  }

  _closeShop() {
    if (this.shopDiv) {
      this.shopDiv.remove();
      this.shopDiv = null;
    }
  }

  // ─── Inn (Phase 8) ──────────────────────────────────────────────────────

  openInn() {
    this.innIndex = 0; // 0 = Rest, 1 = Leave
    this._createInnDom();
  }

  _createInnDom() {
    const container = document.getElementById('game-container');
    this.innDiv = document.createElement('div');
    this.innDiv.style.cssText = `
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: 420px;
      background: rgba(20, 20, 50, 0.95); border: 2px solid rgba(255,255,255,0.3);
      padding: 16px; box-sizing: border-box;
      font-family: "VT323", monospace; color: #ffffff;
      z-index: 50; pointer-events: none;
      border-radius: 4px;
    `;
    container.appendChild(this.innDiv);
    this._updateInn();
  }

  _updateInn() {
    if (!this.innDiv) return;
    const gold = GameState.get().gold;
    const cost = this._town().innCost;
    const options = ['Rest (' + cost + 'G)', 'Leave'];
    let html = `<div style="font-size: 20px;color:#66aaff;margin-bottom:8px">Inn — A warm bed and a hot meal</div>`;
    html += `<div style="font-size: 17px;color:#44dd44;margin-bottom:10px">Your gold: ${gold}G</div>`;
    options.forEach((opt, i) => {
      const sel = i === this.innIndex;
      const prefix = sel ? '▶' : ' ';
      const color = sel ? '#ffff00' : '#ccc';
      html += `<div style="color:${color};font-size: 18px;margin:4px 0"><span style="display:inline-block;width:18px">${prefix}</span>${opt}</div>`;
    });
    html += `<div style="font-size: 16px;color:#888;margin-top:10px">Z: Select · X: Leave</div>`;
    this.innDiv.innerHTML = html;
  }

  _handleInnKey(e) {
    if (!this.innDiv) return false;
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
      case 'ArrowDown': case 's': case 'S':
        this.innIndex = (this.innIndex + 1) % 2;
        this._updateInn();
        e.preventDefault(); return true;
      case 'z': case 'Z': case 'Enter':
        if (this.innIndex === 0) {
          const cost = this._town().innCost;
          if (GameState.get().gold < cost) {
            this._innFlash('Not enough gold!');
          } else {
            GameState.get().gold -= cost;
            GameState.fullHeal();
            this._closeInn();
            this.dialogueActive = false;
            // Toast via status bar
            const prev = this.statusDiv.textContent;
            this.statusDiv.textContent = 'You feel fully rested! (-' + cost + 'G)';
            setTimeout(() => { if (this.statusDiv) this.statusDiv.textContent = prev; }, 2500);
            return true;
          }
          this._updateInn();
        } else {
          this._closeInn();
          this.dialogueActive = false;
        }
        e.preventDefault(); return true;
      case 'x': case 'X': case 'Escape':
        this._closeInn();
        this.dialogueActive = false;
        e.preventDefault(); return true;
    }
    return false;
  }

  _innFlash(msg) {
    if (!this.innDiv) return;
    let flash = this.innDiv.querySelector('.inn-flash');
    if (!flash) {
      flash = document.createElement('div');
      flash.className = 'inn-flash';
      flash.style.cssText = 'font-size: 16px;color:#ff8888;margin-top:6px;min-height:14px';
      this.innDiv.appendChild(flash);
    }
    flash.textContent = msg;
    setTimeout(() => { if (flash) flash.textContent = ''; }, 1500);
  }

  _closeInn() {
    if (this.innDiv) {
      this.innDiv.remove();
      this.innDiv = null;
    }
  }

  openJobMenu() {
    // Job Master offers: Change Job or Learn Abilities
    this.jobMenuState = 'main_menu';
    this.jobSelectedMember = 0;
    this.jobSelectedJob = 0;
    this.jobSelectedAbility = 0;
    this._createJobMenuDom();
  }

  _createJobMenuDom() {
    const container = document.getElementById('game-container');
    this.jobMenuDiv = document.createElement('div');
    this.jobMenuDiv.style.cssText = `
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: 500px; max-height: 450px;
      background: rgba(20, 20, 50, 0.95); border: 2px solid rgba(255,255,255,0.3);
      padding: 16px; box-sizing: border-box;
      font-family: "VT323", monospace; color: #ffffff;
      z-index: 50; pointer-events: none;
      border-radius: 4px; overflow: hidden;
    `;
    // Job Master portrait: a DOM <img> in the menu's top-right (the DOM menu
    // spans nearly the whole 256px game width — no room beside it).
    if (this.textures.exists('portrait_job_master')) {
      const src = this.textures.get('portrait_job_master').source[0].image;
      this.jobMenuPortraitImg = document.createElement('img');
      this.jobMenuPortraitImg.src = `sprites/portraits/job_master.png?v=${Date.now()}`;
      this.jobMenuPortraitImg.style.cssText = `
        position: absolute; right: 12px; top: 12px;
        width: 64px; height: 64px; image-rendering: pixelated;
        border: 1px solid rgba(255,255,255,0.3); border-radius: 3px;`;
      this.jobMenuDiv.appendChild(this.jobMenuPortraitImg);
    }
    container.appendChild(this.jobMenuDiv);
    this._updateJobMenu();
  }

  _setJobMenuHtml(html) {
    this.jobMenuDiv.innerHTML = html;
    // innerHTML wipes children — re-attach the portrait img after each render
    if (this.jobMenuPortraitImg) this.jobMenuDiv.appendChild(this.jobMenuPortraitImg);
  }

  _updateJobMenu() {
    if (!this.jobMenuDiv) return;
    const party = GameState.getParty();

    if (this.jobMenuState === 'main_menu') {
      const options = ['Change Job', 'Learn Abilities'];
      let html = '<div style="font-size: 20px;color:#ffff00;margin-bottom:8px">Job Master</div>';
      html += '<div style="font-size: 17px;color:#aaa;margin-bottom:10px">What would you like to do?</div>';
      options.forEach((opt, i) => {
        const sel = i === this.jobSelectedJob;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        html += `<div style="color:${color};font-size: 18px;margin:6px 0"><span style="display:inline-block;width:16px">${prefix}</span>${opt}</div>`;
      });
      html += '<div style="color:#888;font-size: 16px;margin-top:8px">Z: Select | X: Leave</div>';
      this._setJobMenuHtml(html);
      return;
    }

    if (this.jobMenuState === 'member_select') {
      let html = '<div style="font-size: 20px;color:#ffff00;margin-bottom:8px">Choose a party member:</div>';
      party.forEach((char, i) => {
        const sel = i === this.jobSelectedMember;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        const jp = char.jp && char.jp[char.job] || 0;
        html += `<div style="color:${color};font-size: 18px;margin:4px 0"><span style="display:inline-block;width:16px">${prefix}</span>${char.name} — ${char.job} (Lv.${char.level}, ${jp}JP)</div>`;
      });
      html += '<div style="color:#888;font-size: 16px;margin-top:8px">Z: Select | X: Back</div>';
      this._setJobMenuHtml(html);
      return;
    }

    if (this.jobMenuState === 'job_select') {
      const char = party[this.jobSelectedMember];
      const unlockedJobs = GameState.get().unlockedJobs;
      let html = `<div style="font-size: 20px;color:#ffff00;margin-bottom:8px">${char.name} — Current: ${char.job}</div>`;
      html += '<div style="font-size: 17px;color:#aaa;margin-bottom:6px">Choose a new job:</div>';
      unlockedJobs.forEach((jobName, i) => {
        const sel = i === this.jobSelectedJob;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        const isCurrent = jobName === char.job;
        const currentTag = isCurrent ? ' <span style="color:#888">(current)</span>' : '';
        const job = JOBS[jobName];
        const desc = job ? job.description : '';
        html += `<div style="color:${color};font-size: 18px;margin:4px 0"><span style="display:inline-block;width:16px">${prefix}</span>${jobName}${currentTag} — <span style="font-size: 14px;color:#888">${desc}</span></div>`;
      });
      html += '<div style="color:#888;font-size: 16px;margin-top:8px">Z: Confirm | X: Back</div>';
      this._setJobMenuHtml(html);
      return;
    }

    if (this.jobMenuState === 'ability_select') {
      const char = party[this.jobSelectedMember];
      const jp = char.jp && char.jp[char.job] || 0;
      const purchasable = GameState.getPurchasableAbilities(this.jobSelectedMember);
      const learned = char.learnedAbilities[char.job] || [];
      let html = `<div style="font-size: 20px;color:#ffff00;margin-bottom:8px">${char.name} — ${char.job} (${jp} JP)</div>`;
      if (learned.length > 0) {
        html += '<div style="font-size: 16px;color:#44dd44;margin-bottom:6px">Learned: ' + learned.join(', ') + '</div>';
      }
      if (purchasable.length === 0) {
        html += '<div style="color:#888;font-size: 17px">All abilities for this job have been learned!</div>';
      } else {
        html += '<div style="font-size: 17px;color:#aaa;margin-bottom:6px">Available to learn:</div>';
        purchasable.forEach((ab, i) => {
          const sel = i === this.jobSelectedAbility;
          const prefix = sel ? '▶' : '　';
          const color = sel ? '#ffff00' : (ab.affordable ? '#ccc' : '#666');
          const costColor = ab.affordable ? '#44dd44' : '#ff4444';
          html += `<div style="color:${color};font-size: 18px;margin:4px 0"><span style="display:inline-block;width:16px">${prefix}</span>${ab.name} (<span style="color:${costColor}">${ab.jpCost}JP</span>) — <span style="font-size: 14px;color:#888">${ab.description}</span></div>`;
        });
      }
      html += '<div style="color:#888;font-size: 16px;margin-top:8px">Z: Learn | X: Back</div>';
      this._setJobMenuHtml(html);
      return;
    }

    if (this.jobMenuState === 'confirm') {
      const char = party[this.jobSelectedMember];
      const unlockedJobs = GameState.get().unlockedJobs;
      const newJob = unlockedJobs[this.jobSelectedJob];
      let html = `<div style="font-size: 20px;color:#ffff00;margin-bottom:8px">Confirm job change?</div>`;
      html += `<div style="font-size: 18px;margin:4px 0">${char.name}: ${char.job} → ${newJob}</div>`;
      html += '<div style="font-size: 16px;color:#aaa;margin-top:8px">HP/MP will be adjusted. Learned abilities are kept.</div>';
      html += '<div style="font-size: 17px;color:#888;margin-top:8px">Z: Confirm | X: Cancel</div>';
      this._setJobMenuHtml(html);
      return;
    }

    if (this.jobMenuState === 'confirm_ability') {
      const char = party[this.jobSelectedMember];
      const purchasable = GameState.getPurchasableAbilities(this.jobSelectedMember);
      const ab = purchasable[this.jobSelectedAbility];
      if (!ab) { this.jobMenuState = 'ability_select'; this._updateJobMenu(); return; }
      let html = `<div style="font-size: 20px;color:#ffff00;margin-bottom:8px">Learn ${ab.name}?</div>`;
      html += `<div style="font-size: 18px;margin:4px 0">Cost: ${ab.jpCost} JP (You have ${char.jp[char.job] || 0} JP)</div>`;
      html += `<div style="font-size: 16px;color:#aaa;margin-top:4px">${ab.description}</div>`;
      html += '<div style="font-size: 17px;color:#888;margin-top:8px">Z: Confirm | X: Cancel</div>';
      this._setJobMenuHtml(html);
      return;
    }
  }

  _handleJobMenuKey(e) {
    if (!this.jobMenuDiv) return false;
    const party = GameState.getParty();
    const unlockedJobs = GameState.get().unlockedJobs;

    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W':
        if (this.jobMenuState === 'main_menu') {
          this.jobSelectedJob = (this.jobSelectedJob - 1 + 2) % 2;
        } else if (this.jobMenuState === 'member_select') {
          this.jobSelectedMember = (this.jobSelectedMember - 1 + party.length) % party.length;
        } else if (this.jobMenuState === 'job_select') {
          this.jobSelectedJob = (this.jobSelectedJob - 1 + unlockedJobs.length) % unlockedJobs.length;
        } else if (this.jobMenuState === 'ability_select') {
          const purchasable = GameState.getPurchasableAbilities(this.jobSelectedMember);
          if (purchasable.length > 0) this.jobSelectedAbility = (this.jobSelectedAbility - 1 + purchasable.length) % purchasable.length;
        }
        this._updateJobMenu();
        e.preventDefault(); return true;
      case 'ArrowDown': case 's': case 'S':
        if (this.jobMenuState === 'main_menu') {
          this.jobSelectedJob = (this.jobSelectedJob + 1) % 2;
        } else if (this.jobMenuState === 'member_select') {
          this.jobSelectedMember = (this.jobSelectedMember + 1) % party.length;
        } else if (this.jobMenuState === 'job_select') {
          this.jobSelectedJob = (this.jobSelectedJob + 1) % unlockedJobs.length;
        } else if (this.jobMenuState === 'ability_select') {
          const purchasable = GameState.getPurchasableAbilities(this.jobSelectedMember);
          if (purchasable.length > 0) this.jobSelectedAbility = (this.jobSelectedAbility + 1) % purchasable.length;
        }
        this._updateJobMenu();
        e.preventDefault(); return true;
      case 'ArrowLeft': case 'a': case 'A':
      case 'ArrowRight': case 'd': case 'D':
        if (this.jobMenuState === 'main_menu') {
          this.jobSelectedJob = (this.jobSelectedJob + 1) % 2;
        } else if (this.jobMenuState === 'member_select') {
          this.jobSelectedMember = (this.jobSelectedMember + 1) % party.length;
        } else if (this.jobMenuState === 'job_select') {
          this.jobSelectedJob = (this.jobSelectedJob + 1) % unlockedJobs.length;
        } else if (this.jobMenuState === 'ability_select') {
          const purchasable = GameState.getPurchasableAbilities(this.jobSelectedMember);
          if (purchasable.length > 0) this.jobSelectedAbility = (this.jobSelectedAbility + 1) % purchasable.length;
        }
        this._updateJobMenu();
        e.preventDefault(); return true;
      case 'z': case 'Z': case 'Enter':
        if (this.jobMenuState === 'main_menu') {
          if (this.jobSelectedJob === 0) {
            // Change Job
            this.jobMenuState = 'member_select';
            this.jobSelectedMember = 0;
          } else {
            // Learn Abilities
            this.jobMenuState = 'member_select';
            this.jobSelectedMember = 0;
            this._isAbilityMode = true;
          }
        } else if (this.jobMenuState === 'member_select') {
          if (this._isAbilityMode) {
            this.jobMenuState = 'ability_select';
            this.jobSelectedAbility = 0;
          } else {
            this.jobMenuState = 'job_select';
            this.jobSelectedJob = 0;
            const char = party[this.jobSelectedMember];
            const idx = unlockedJobs.indexOf(char.job);
            if (idx >= 0) this.jobSelectedJob = idx;
          }
        } else if (this.jobMenuState === 'job_select') {
          this.jobMenuState = 'confirm';
        } else if (this.jobMenuState === 'confirm') {
          GameState.changeJob(this.jobSelectedMember, unlockedJobs[this.jobSelectedJob]);
          this._closeJobMenu();
          this.dialogueActive = false;
        } else if (this.jobMenuState === 'ability_select') {
          const purchasable = GameState.getPurchasableAbilities(this.jobSelectedMember);
          if (purchasable.length > 0 && purchasable[this.jobSelectedAbility].affordable) {
            this.jobMenuState = 'confirm_ability';
          }
        } else if (this.jobMenuState === 'confirm_ability') {
          const purchasable = GameState.getPurchasableAbilities(this.jobSelectedMember);
          const ab = purchasable[this.jobSelectedAbility];
          if (ab && ab.affordable) {
            GameState.buyAbility(this.jobSelectedMember, ab.name);
            this.jobMenuState = 'ability_select';
          }
        }
        this._updateJobMenu();
        e.preventDefault(); return true;
      case 'x': case 'X': case 'Escape':
        if (this.jobMenuState === 'confirm_ability') {
          this.jobMenuState = 'ability_select';
        } else if (this.jobMenuState === 'confirm') {
          this.jobMenuState = 'job_select';
        } else if (this.jobMenuState === 'ability_select') {
          this.jobMenuState = 'member_select';
          this._isAbilityMode = true;
        } else if (this.jobMenuState === 'job_select') {
          this.jobMenuState = 'member_select';
          this._isAbilityMode = false;
        } else if (this.jobMenuState === 'member_select') {
          this.jobMenuState = 'main_menu';
          this._isAbilityMode = false;
        } else {
          this._closeJobMenu();
          this.dialogueActive = false;
        }
        this._updateJobMenu();
        e.preventDefault(); return true;
    }
    return false;
  }

  _closeJobMenu() {
    if (this.jobMenuDiv) {
      this.jobMenuDiv.remove();
      this.jobMenuDiv = null;
    }
    if (this.jobMenuPortraitImg) { this.jobMenuPortraitImg.remove(); this.jobMenuPortraitImg = null; }
    this.jobMenuState = null;
  }

  openMenu() {
    this.player.setVelocity(0, 0);
    this.scene.launch('Menu', { parentScene: this.scene.settings.key });
    this.scene.pause();
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
    if (this.jobMenuDiv) { this.jobMenuDiv.remove(); this.jobMenuDiv = null; }
    if (this.jobMenuPortraitImg) { this.jobMenuPortraitImg.remove(); this.jobMenuPortraitImg = null; }
    if (this.shopDiv) { this.shopDiv.remove(); this.shopDiv = null; }
    if (this.innDiv) { this.innDiv.remove(); this.innDiv = null; }
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

  /**
   * Phase 10: per-identity NPC walk anims from npc_sheet_<artKey> spritesheets
   * (same 12-frame layout as player_field). No-op for keys without a sheet.
   */
  createNpcAnimations(artKey) {
    const texKey = `npc_sheet_${artKey}`;
    if (!this.textures.exists(texKey) || this.anims.exists(`npc-walk-${artKey}-down`)) return;
    const base = `npc-walk-${artKey}`;
    this.anims.create({ key: `${base}-down`, frames: this.anims.generateFrameNumbers(texKey, { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: `${base}-left`, frames: this.anims.generateFrameNumbers(texKey, { start: 3, end: 5 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: `${base}-right`, frames: this.anims.generateFrameNumbers(texKey, { start: 6, end: 8 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: `${base}-up`, frames: this.anims.generateFrameNumbers(texKey, { start: 9, end: 11 }), frameRate: 8, repeat: -1 });
  }

  generateMapData() {
    const town = this._town();
    // Non-village towns render from WorldData config
    if (this.townKey !== 'village') {
      const map = [];
      for (let y = 0; y < town.rows; y++) {
        const row = [];
        for (let x = 0; x < town.cols; x++) {
          let tile = T_FLOOR;
          if (x === 0 || x === town.cols - 1 || y === 0) tile = T_WALL;
          if (y === town.rows - 1) { tile = x === town.exitX ? T_PATH : T_WALL; }
          row.push(tile);
        }
        map.push(row);
      }
      town.buildings.forEach(([x, y, w, h]) => {
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (map[y + dy] && map[y + dy][x + dx] !== undefined) {
              map[y + dy][x + dx] = dy === 0 ? T_BUILDING_ROOF : T_BUILDING_WALL;
            }
          }
        }
      });
      town.paths.forEach(p => {
        if (p.dir === 'v') {
          for (let y = p.from; y <= p.to; y++) map[y][p.x] = T_PATH;
        } else {
          for (let x = p.from; x <= p.to; x++) map[p.y][x] = T_PATH;
        }
      });
      town.woods.forEach(([x, y]) => { if (map[y] && map[y][x] !== undefined) map[y][x] = T_WOOD; });
      return map;
    }
    // Village of Verdan — legacy exact map (tests + saves depend on it)
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