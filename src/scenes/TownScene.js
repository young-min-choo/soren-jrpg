import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { JOBS, STARTING_JOBS, UNLOCKABLE_JOBS, getStatsForLevel } from '../game/JobData.js';

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

    // Job Master NPC — allows changing party jobs (FF3-style)
    const npc3X = 8 * TILE_SIZE + TILE_SIZE / 2;
    const npc3Y = 8 * TILE_SIZE + TILE_SIZE / 2;
    const npc3 = this.physics.add.staticSprite(npc3X, npc3Y, 'player_field', 1);
    npc3.setTint(0x44ff44);
    npc3.setData('name', 'Job Master');
    npc3.setData('isJobMaster', true);
    npc3.setData('dialogue', {
      speaker: 'Job Master', portrait: null,
      pages: [
        'I can help you and your party change jobs.',
        'The path you walk is yours to choose.',
      ],
    });
    this.npcs.push(npc3);

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

    // Job Master opens job change menu instead of dialogue
    if (npc.getData('isJobMaster')) {
      this.openJobMenu();
      return;
    }

    const dialogueData = npc.getData('dialogue');
    this.scene.launch('Dialogue', {
      ...dialogueData,
      onComplete: (choiceValue) => {
        this.dialogueActive = false;
        if (choiceValue) console.log(`Player chose: ${choiceValue}`);
      }
    });
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
      font-family: "Courier New", monospace; color: #ffffff;
      z-index: 50; pointer-events: none;
      border-radius: 4px; overflow: hidden;
    `;
    container.appendChild(this.jobMenuDiv);
    this._updateJobMenu();
  }

  _updateJobMenu() {
    if (!this.jobMenuDiv) return;
    const party = GameState.getParty();

    if (this.jobMenuState === 'main_menu') {
      const options = ['Change Job', 'Learn Abilities'];
      let html = '<div style="font-size:14px;color:#ffff00;margin-bottom:8px">Job Master</div>';
      html += '<div style="font-size:12px;color:#aaa;margin-bottom:10px">What would you like to do?</div>';
      options.forEach((opt, i) => {
        const sel = i === this.jobSelectedJob;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        html += `<div style="color:${color};font-size:13px;margin:6px 0"><span style="display:inline-block;width:16px">${prefix}</span>${opt}</div>`;
      });
      html += '<div style="color:#888;font-size:11px;margin-top:8px">Z: Select | X: Leave</div>';
      this.jobMenuDiv.innerHTML = html;
      return;
    }

    if (this.jobMenuState === 'member_select') {
      let html = '<div style="font-size:14px;color:#ffff00;margin-bottom:8px">Choose a party member:</div>';
      party.forEach((char, i) => {
        const sel = i === this.jobSelectedMember;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        const jp = char.jp && char.jp[char.job] || 0;
        html += `<div style="color:${color};font-size:13px;margin:4px 0"><span style="display:inline-block;width:16px">${prefix}</span>${char.name} — ${char.job} (Lv.${char.level}, ${jp}JP)</div>`;
      });
      html += '<div style="color:#888;font-size:11px;margin-top:8px">Z: Select | X: Back</div>';
      this.jobMenuDiv.innerHTML = html;
      return;
    }

    if (this.jobMenuState === 'job_select') {
      const char = party[this.jobSelectedMember];
      const unlockedJobs = GameState.get().unlockedJobs;
      let html = `<div style="font-size:14px;color:#ffff00;margin-bottom:8px">${char.name} — Current: ${char.job}</div>`;
      html += '<div style="font-size:12px;color:#aaa;margin-bottom:6px">Choose a new job:</div>';
      unlockedJobs.forEach((jobName, i) => {
        const sel = i === this.jobSelectedJob;
        const prefix = sel ? '▶' : '　';
        const color = sel ? '#ffff00' : '#ccc';
        const isCurrent = jobName === char.job;
        const currentTag = isCurrent ? ' <span style="color:#888">(current)</span>' : '';
        const job = JOBS[jobName];
        const desc = job ? job.description : '';
        html += `<div style="color:${color};font-size:13px;margin:4px 0"><span style="display:inline-block;width:16px">${prefix}</span>${jobName}${currentTag} — <span style="font-size:10px;color:#888">${desc}</span></div>`;
      });
      html += '<div style="color:#888;font-size:11px;margin-top:8px">Z: Confirm | X: Back</div>';
      this.jobMenuDiv.innerHTML = html;
      return;
    }

    if (this.jobMenuState === 'ability_select') {
      const char = party[this.jobSelectedMember];
      const jp = char.jp && char.jp[char.job] || 0;
      const purchasable = GameState.getPurchasableAbilities(this.jobSelectedMember);
      const learned = char.learnedAbilities[char.job] || [];
      let html = `<div style="font-size:14px;color:#ffff00;margin-bottom:8px">${char.name} — ${char.job} (${jp} JP)</div>`;
      if (learned.length > 0) {
        html += '<div style="font-size:11px;color:#44dd44;margin-bottom:6px">Learned: ' + learned.join(', ') + '</div>';
      }
      if (purchasable.length === 0) {
        html += '<div style="color:#888;font-size:12px">All abilities for this job have been learned!</div>';
      } else {
        html += '<div style="font-size:12px;color:#aaa;margin-bottom:6px">Available to learn:</div>';
        purchasable.forEach((ab, i) => {
          const sel = i === this.jobSelectedAbility;
          const prefix = sel ? '▶' : '　';
          const color = sel ? '#ffff00' : (ab.affordable ? '#ccc' : '#666');
          const costColor = ab.affordable ? '#44dd44' : '#ff4444';
          html += `<div style="color:${color};font-size:13px;margin:4px 0"><span style="display:inline-block;width:16px">${prefix}</span>${ab.name} (<span style="color:${costColor}">${ab.jpCost}JP</span>) — <span style="font-size:10px;color:#888">${ab.description}</span></div>`;
        });
      }
      html += '<div style="color:#888;font-size:11px;margin-top:8px">Z: Learn | X: Back</div>';
      this.jobMenuDiv.innerHTML = html;
      return;
    }

    if (this.jobMenuState === 'confirm') {
      const char = party[this.jobSelectedMember];
      const unlockedJobs = GameState.get().unlockedJobs;
      const newJob = unlockedJobs[this.jobSelectedJob];
      let html = `<div style="font-size:14px;color:#ffff00;margin-bottom:8px">Confirm job change?</div>`;
      html += `<div style="font-size:13px;margin:4px 0">${char.name}: ${char.job} → ${newJob}</div>`;
      html += '<div style="font-size:11px;color:#aaa;margin-top:8px">HP/MP will be adjusted. Learned abilities are kept.</div>';
      html += '<div style="font-size:12px;color:#888;margin-top:8px">Z: Confirm | X: Cancel</div>';
      this.jobMenuDiv.innerHTML = html;
      return;
    }

    if (this.jobMenuState === 'confirm_ability') {
      const char = party[this.jobSelectedMember];
      const purchasable = GameState.getPurchasableAbilities(this.jobSelectedMember);
      const ab = purchasable[this.jobSelectedAbility];
      if (!ab) { this.jobMenuState = 'ability_select'; this._updateJobMenu(); return; }
      let html = `<div style="font-size:14px;color:#ffff00;margin-bottom:8px">Learn ${ab.name}?</div>`;
      html += `<div style="font-size:13px;margin:4px 0">Cost: ${ab.jpCost} JP (You have ${char.jp[char.job] || 0} JP)</div>`;
      html += `<div style="font-size:11px;color:#aaa;margin-top:4px">${ab.description}</div>`;
      html += '<div style="font-size:12px;color:#888;margin-top:8px">Z: Confirm | X: Cancel</div>';
      this.jobMenuDiv.innerHTML = html;
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
    this.jobMenuState = null;
  }

  openMenu() {
    this.player.setVelocity(0, 0);
    this.scene.launch('Menu', { parentScene: 'Town' });
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