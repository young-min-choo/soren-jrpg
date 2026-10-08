import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { ITEMS, getItem } from '../game/ItemData.js';
import { STATUS_EFFECTS, applyStatus, removeStatus, hasStatus, processStatusTick, getActiveStatuses } from '../game/StatusEffectData.js';
import { spawnEnemies } from '../game/EnemyData.js';

/**
 * BattleScene — turn-based combat prototype.
 * Side-view battle: player (left) vs enemies (right).
 * Player stats are loaded from GameState (persistent across battles).
 * Enemy templates live in src/game/EnemyData.js.
 */

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create(data) {
    this.domElements = [];
    this.transitioning = false;

    // --- Battle setup ---
    // Load full party from persistent GameState (with equipment bonuses applied)
    const gs = GameState.get();
    this.party = gs.party.map((char, i) => ({
      ...GameState.effectiveChar(i),
      alive: char.hp > 0,
      defending: false,
      side: 'player',
      id: 'player_' + i,
      partyIndex: i,
      statusEffects: {},
    }));
    this.battleData = data || {};
    this._phaseMorphed = false;

    // Enemies — spawned from EnemyData (type names → deep-copied instances)
    const enemyTypes = data?.enemies || ['slime'];
    this.enemies = spawnEnemies(enemyTypes);

    // Build turn order: all alive party members + enemies, sorted by AGI
    this.allUnits = [
      ...this.party.filter(p => p.alive),
      ...this.enemies,
    ];
    this.turnOrder = [...this.allUnits].sort((a, b) => b.agi - a.agi);
    this.currentTurnIndex = 0;

    // State: 'intro' → 'action_select' → 'target_select' → 'animating' → 'enemy_delay' → 'ended'
    this.battleState = 'intro';
    this.selectedAction = 0;
    this.selectedTarget = 0;
    this.battleLog = [];

    // --- Visual setup ---
    this.cameras.main.setBackgroundColor('#1a1a2e');
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Background (simple gradient via rectangle)
    this.add.rectangle(128, 80, 256, 160, 0x2a2a4e);
    this.add.rectangle(128, 150, 256, 48, 0x1a3a1a); // ground

    // Party sprites (Phase 9: AI battle sprite if texture exists, else legacy rect)
    // Sprite resolved via char.spriteKey (stable art identity) — NOT the
    // display name, which the player can rename at will.
    this.playerSprites = [];
    const partyColors = [0x4488ff, 0xff8844, 0x44ff88, 0xff44ff];
    this.party.forEach((char, i) => {
      const x = 40 + i * 30;
      const artKey = char.spriteKey || 'soren_battle'; // protagonist art for unnamed/legacy-party entries
      // Phase 10: battle ACTION sheets — party members with a 48x96 sheet
      // (16x24 frames, walk-grid + arms-raised/jump specials) get a real
      // animated sprite; base position scaled up 2x (16x24 → 32x48 display).
      let sprite;
      const sheetKey = `battlesheet_${artKey}`;
      // Phase 10b trial: hero (slot 0) prefers the FE-style pair sheet
      // (104x72 frames: 0 = stand, 1 = swing) — FE proportions, i2i art.
      const feKey = `fesheet_${artKey}`;
      if (i === 0 && this.textures.exists(feKey)) {
        sprite = this.add.sprite(x, 120, feKey, 0);
        sprite._isSprite = true;
        sprite._sheet = feKey;
        sprite._fe19 = this.textures.get(feKey).frameTotal > 10; // 19-frame strip
        sprite._fePair = !sprite._fe19;     // gestures: script runner vs pair frames
        sprite._baseScale = 0.66;  // breathing + suspend restore THIS, not 1
        sprite.setScale(0.66);     // 95x72 cell → display figure ≈48px
        sprite.setOrigin(0.5, 1.0);
        sprite.y = 128;            // ground line (shared with chibi party)
        sprite._homeY = sprite.y;
      } else if (this.textures.exists(sheetKey)) {
        sprite = this.add.sprite(x, 120, sheetKey, 1); // frame 1 = row0 stand
        sprite._isSprite = true;
        sprite._sheet = sheetKey;
        sprite.setScale(2);
        sprite.setOrigin(0.5, 1.0); // feet on the ground strip; bob scales from feet
        sprite.y = 128;             // ground line for 48px-tall feet-anchored sprite
        sprite._homeY = sprite.y;
        // per-artKey walk/cast/slash anims (idle = gentle walk-in-place is
        // too busy; stand frame + breathing driver handles idle)
        if (!this.anims.exists(`battleanim_${artKey}_cast`)) {
          this.anims.create({ key: `battleanim_${artKey}_cast`, frames: this.anims.generateFrameNumbers(sheetKey, { frames: [3, 3, 3] }), frameRate: 6, repeat: 0 });
        }
      } else {
        const texKey = `bsprite_${artKey}`;
        if (this.textures.exists(texKey)) {
          sprite = this.add.image(x, 120, texKey);
          sprite._isSprite = true;
        } else {
          sprite = this.add.rectangle(x, 120, 20, 28, partyColors[i % partyColors.length]);
          sprite.setStrokeStyle(1, 0xffffff, 0.5);
        }
      }
      this.playerSprites.push(sprite);
    });
    // Players always render ABOVE enemy rows: a lunge at a back-row target
    // walks the attacker THROUGH/past front-row enemies (FE convention —
    // attacks on back rows show the unit in front of the front line).
    this.playerSprites.forEach(s => s.setDepth(30));
    this.playerSprite = this.playerSprites[0]; // primary for backwards-compat

    // Enemy sprites (Phase 9: AI battle sprite if texture exists, else legacy rect)
    // Spread them out more for readability
    this.enemySprites = [];
    this.enemyLabelDivs = [];
    this.enemies.forEach((enemy, i) => {
      const spacing = 48;
      const startX = 180;
      const x = startX + (i % 2) * spacing;
      // rows anchored to the ground strip (ground rect spans y=126..174):
      // row 0 at y=110 puts sprite feet ≈120 on the grass; row 1 at 138.
      const y = 128 + Math.floor(i / 2) * 14;
      // depth = row-based: BACK rows must render BEHIND front rows (Phase 10
      // fix — creation order made row 1 draw over row 0 whenever sprites
      // got big/sheet-driven). Depth descending by row: back = 10, front = 20.
      const depth = 20 - Math.floor(i / 2) * 10;
      // EnemyData keys are camelCase (caveSpider); art files are snake_case
      // (cave_spider) — normalize so every enemy gets its real sprite.
      const artKey = enemy.type.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      // Two enemies share art with differently-named files:
      const ART_ALIAS = { ruins_zombie: 'zombie', wolf_pack: 'dire_wolf' };
      const texKey = `bsprite_${ART_ALIAS[artKey] || artKey}`;
      let sprite;
      if (this.textures.exists(texKey)) {
        sprite = this.add.image(x, y, texKey);
        sprite._isSprite = true;
        // feet-anchor like the party (center-origin left enemies hovering
        // above the grass once the party moved to a shared feet line)
        sprite.setOrigin(0.5, 0.94); // 32px art: ~2px bottom margin = feet
        sprite.setDepth(depth);
      } else {
        sprite = this.add.rectangle(x, y, 24, 24, enemy.color);
        sprite.setStrokeStyle(1, 0xffffff, 0.5);
        sprite.setDepth(depth);
      }
      this.enemySprites.push(sprite);
    });

    // --- Idle "breathing" loop (Phase 10 polish) ---
    // Battle sprites are single-pose images; a shared rAF loop applies an
    // ease-in-out squash-and-stretch bob (y ±1px, scaleY 1.0→0.94, scaleX
    // mirrored) with a per-sprite phase offset so the row doesn't move in
    // lockstep. update() isn't reliable in launched scenes, so this runs its
    // own rAF; killIdle kills it (shutdown). Gestures (lunge/cast) mutate
    // sprite.y/scale too — each gesture function calls suspendIdle(sprite)
    // and resumeIdle(sprite) so breath doesn't fight the gesture.
    this._idleSprites = [...this.playerSprites, ...this.enemySprites];
    this._idleSuspended = new Set();
    this._idleT0 = performance.now();
    this._idleRaf = requestAnimationFrame(this._idleStep = (now) => {
      this._idleTick(now);
    });
    this.events.once('shutdown', () => this._killIdle());

    // --- DOM text overlays (FF1-3 style layout) ---
    const container = document.getElementById('game-container');

    // Battle title (top center, small)
    this.titleDiv = this.createDomText('BATTLE', container, {
      left: '50%', top: '4px',
      transform: 'translateX(-50%)',
      fontSize: '14px', fontWeight: 'bold', color: '#666688',
    });

    // Enemy labels — positioned near each enemy sprite
    // Game world: 256×224. Canvas displayed: 768×672. Scale = 3x.
    const SCALE = 3;
    this.enemyLabelDivs = [];
    this.enemies.forEach((enemy, i) => {
      const spacing = 48;
      const startX = 180;
      const worldX = startX + (i % 2) * spacing;
      const worldY = 110 + Math.floor(i / 2) * 28;
      const labelDiv = this.createDomText('', container, {
        left: (worldX * SCALE) + 'px',
        top: ((worldY + 18) * SCALE) + 'px',
        transform: 'translateX(-50%)',
        fontSize: '11px', color: '#ffaaaa', textAlign: 'center',
        whiteSpace: 'nowrap',
      });
      this.enemyLabelDivs.push(labelDiv);
    });

    // Party panel (very bottom strip — always visible)
    this.partyPanelDiv = this.createDomText('', container, {
      left: '0px', bottom: '0px',
      width: '768px',
      fontSize: '13px', color: '#ffffff',
      background: 'rgba(20, 20, 50, 0.85)',
      borderTop: '1px solid rgba(255,255,255,0.2)',
      padding: '8px 12px',
      boxSizing: 'border-box',
      display: 'flex',
      gap: '20px',
      zIndex: '25',
    });

    // Action menu (appears ABOVE party panel when it's player's turn)
    this.actionMenuDiv = this.createDomText('', container, {
      left: '12px', bottom: '100px',
      fontSize: '14px', color: '#ffffff', lineHeight: '1.6',
      background: 'rgba(30, 30, 60, 0.95)',
      border: '1px solid rgba(255,255,255,0.3)',
      padding: '8px 12px',
      boxSizing: 'border-box',
      display: 'none',
      zIndex: '26',
    });

    // Battle log (right side, above party panel)
    this.battleLogDiv = this.createDomText('', container, {
      right: '12px', bottom: '100px',
      fontSize: '11px', color: '#aaaaff', lineHeight: '1.4',
      maxWidth: '280px', maxHeight: '60px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      background: 'rgba(20, 20, 50, 0.85)',
      border: '1px solid rgba(255,255,255,0.15)',
      padding: '6px 10px', boxSizing: 'border-box',
      textAlign: 'right',
      zIndex: '24',
    });

    // Message (center, for win/lose)
    this.messageDiv = this.createDomText('', container, {
      left: '50%', top: '45%',
      transform: 'translate(-50%, -50%)',
      fontSize: '28px', fontWeight: 'bold', color: '#ffffff',
      display: 'none',
      zIndex: '30',
    });

    // --- Input (raw DOM, same pattern as field scenes) ---
    this.keys = { up: false, down: false, left: false, right: false };
    this.confirmPressed = false;
    this.cancelPressed = false;

    this.handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
          if (this.battleState === 'action_select') {
            const actions = ['FIGHT', 'MAGIC', 'ITEM', 'DEFEND', 'FLEE'];
            this.selectedAction = (this.selectedAction - 1 + actions.length) % actions.length;
            this.updateActionMenu();
          } else if (this.battleState === 'target_select') {
            const alive = this.enemies.filter(en => en.alive);
            if (alive.length > 0) {
              this.selectedTarget = (this.selectedTarget - 1 + alive.length) % alive.length;
              this.updateEnemyLabels();
            }
          } else if (this.battleState === 'item_select') {
            const inv = this._usableItems();
            if (inv.length > 0) {
              this.selectedItem = (this.selectedItem - 1 + inv.length) % inv.length;
              this.updateActionMenu();
            }
          } else if (this.battleState === 'magic_select') {
            const abilities = this._magicAbilities();
            if (abilities.length > 0) {
              this.selectedSpell = (this.selectedSpell - 1 + abilities.length) % abilities.length;
              this.updateActionMenu();
            }
          } else if (this.battleState === 'ally_select') {
            const aliveAllies = this.party.filter(p => p.alive);
            if (aliveAllies.length > 0) {
              this.selectedAlly = (this.selectedAlly - 1 + aliveAllies.length) % aliveAllies.length;
              this.updateActionMenu();
            }
          }
          e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S':
          if (this.battleState === 'action_select') {
            const actions = ['FIGHT', 'MAGIC', 'ITEM', 'DEFEND', 'FLEE'];
            this.selectedAction = (this.selectedAction + 1) % actions.length;
            this.updateActionMenu();
          } else if (this.battleState === 'target_select') {
            const alive = this.enemies.filter(en => en.alive);
            if (alive.length > 0) {
              this.selectedTarget = (this.selectedTarget + 1) % alive.length;
              this.updateEnemyLabels();
            }
          } else if (this.battleState === 'item_select') {
            const inv = this._usableItems();
            if (inv.length > 0) {
              this.selectedItem = (this.selectedItem + 1) % inv.length;
              this.updateActionMenu();
            }
          } else if (this.battleState === 'magic_select') {
            const abilities = this._currentAbilities();
            if (abilities.length > 0) {
              this.selectedSpell = (this.selectedSpell + 1) % abilities.length;
              this.updateActionMenu();
            }
          } else if (this.battleState === 'ally_select') {
            const aliveAllies = this.party.filter(p => p.alive);
            if (aliveAllies.length > 0) {
              this.selectedAlly = (this.selectedAlly + 1) % aliveAllies.length;
              this.updateActionMenu();
            }
          }
          e.preventDefault(); break;
        case 'ArrowLeft': case 'a': case 'A':
          if (this.battleState === 'target_select') {
            const alive = this.enemies.filter(en => en.alive);
            if (alive.length > 0) {
              this.selectedTarget = (this.selectedTarget - 1 + alive.length) % alive.length;
              this.updateEnemyLabels();
            }
          } else if (this.battleState === 'action_select') {
            const actions = ['FIGHT', 'MAGIC', 'ITEM', 'DEFEND', 'FLEE'];
            this.selectedAction = (this.selectedAction - 1 + actions.length) % actions.length;
            this.updateActionMenu();
          } else if (this.battleState === 'item_select') {
            const inv = this._usableItems();
            if (inv.length > 0) {
              this.selectedItem = (this.selectedItem - 1 + inv.length) % inv.length;
              this.updateActionMenu();
            }
          } else if (this.battleState === 'magic_select') {
            const abilities = this._magicAbilities();
            if (abilities.length > 0) {
              this.selectedSpell = (this.selectedSpell - 1 + abilities.length) % abilities.length;
              this.updateActionMenu();
            }
          } else if (this.battleState === 'ally_select') {
            const aliveAllies = this.party.filter(p => p.alive);
            if (aliveAllies.length > 0) {
              this.selectedAlly = (this.selectedAlly - 1 + aliveAllies.length) % aliveAllies.length;
              this.updateAllyMarker();
            }
          }
          e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D':
          if (this.battleState === 'target_select') {
            const alive = this.enemies.filter(en => en.alive);
            if (alive.length > 0) {
              this.selectedTarget = (this.selectedTarget + 1) % alive.length;
              this.updateEnemyLabels();
            }
          } else if (this.battleState === 'action_select') {
            const actions = ['FIGHT', 'MAGIC', 'ITEM', 'DEFEND', 'FLEE'];
            this.selectedAction = (this.selectedAction + 1) % actions.length;
            this.updateActionMenu();
          } else if (this.battleState === 'item_select') {
            const inv = this._usableItems();
            if (inv.length > 0) {
              this.selectedItem = (this.selectedItem + 1) % inv.length;
              this.updateActionMenu();
            }
          } else if (this.battleState === 'magic_select') {
            const abilities = this._currentAbilities();
            if (abilities.length > 0) {
              this.selectedSpell = (this.selectedSpell + 1) % abilities.length;
              this.updateActionMenu();
            }
          } else if (this.battleState === 'ally_select') {
            const aliveAllies = this.party.filter(p => p.alive);
            if (aliveAllies.length > 0) {
              this.selectedAlly = (this.selectedAlly + 1) % aliveAllies.length;
              this.updateAllyMarker();
            }
          }
          e.preventDefault(); break;
        case 'z': case 'Z': case 'Enter':
          if (this.battleState === 'action_select') {
            const actions = ['FIGHT', 'MAGIC', 'ITEM', 'DEFEND', 'FLEE'];
            const action = actions[this.selectedAction];
            if (action === 'FIGHT') {
              const alive = this.enemies.filter(en => en.alive);
              if (alive.length > 0) {
                this.selectedTarget = 0;
                this.battleState = 'target_select';
                this.updateActionMenu();
                this.updateEnemyLabels();
              }
            } else if (action === 'MAGIC') {
              const caster = this.turnOrder[this.currentTurnIndex];
              if (hasStatus(caster, 'silence')) {
                this.log(`${caster.name} is silenced — cannot cast magic!`);
              } else {
                const abilities = this._magicAbilities();
                if (abilities.length === 0) {
                  this.log('No magic available.');
                } else {
                  this.selectedSpell = 0;
                  this.battleState = 'magic_select';
                  this.updateActionMenu();
                }
              }
            } else if (action === 'ITEM') {
              this.selectedItem = 0;
              this.selectedAlly = 0;
              this.battleState = 'item_select';
              this.updateActionMenu();
            } else {
              this.executeAction(action);
            }
          } else if (this.battleState === 'target_select') {
            const alive = this.enemies.filter(en => en.alive);
            if (this.selectedTarget >= alive.length) this.selectedTarget = 0;
            const target = alive[this.selectedTarget];
            if (target && target.alive) {
              if (this._pendingAbility) {
                this.battleState = 'animating';
                this.updateEnemyLabels();
                this.castAbility(this._pendingAbility, target);
                this._pendingAbility = null;
              } else {
                this.battleState = 'animating';
                this.updateEnemyLabels();
                this.executeFight(target);
              }
            }
          } else if (this.battleState === 'item_select') {
            const inv = this._usableItems();
            if (inv.length === 0) return;
            const item = inv[this.selectedItem];
            const itemDef = getItem(item.name);
            if (itemDef.target === 'ally') {
              this.battleState = 'ally_select';
              this.selectedAlly = 0;
              this.updateActionMenu();
            } else if (itemDef.target === 'enemy') {
              // Use on enemy directly (only one enemy for now, or first alive)
              this.useItem(item.name, null);
            }
          } else if (this.battleState === 'magic_select') {
            // Confirm spell selection — determine target type
            const abilities = this._currentAbilities();
            if (abilities.length === 0) return;
            const ability = abilities[this.selectedSpell];
            const caster = this.turnOrder[this.currentTurnIndex];
            if (caster.mp < ability.mpCost) {
              this.log('Not enough MP!');
            } else if (ability.type === 'heal') {
              // Heal targets an ally
              this.battleState = 'ally_select';
              this.selectedAlly = 0;
              this._pendingAbility = ability;
              this.updateActionMenu();
            } else if (ability.type === 'magic' || ability.type === 'physical') {
              // Offensive ability targets an enemy
              this.battleState = 'target_select';
              this.selectedTarget = 0;
              this._pendingAbility = ability;
              this.updateActionMenu();
              this.updateEnemyLabels();
            } else if (ability.type === 'buff') {
              // Buff targets self
              this.castAbility(ability, caster);
            }
          } else if (this.battleState === 'ally_select') {
            const aliveAllies = this.party.filter(p => p.alive);
            if (this.selectedAlly >= aliveAllies.length) this.selectedAlly = 0;
            const ally = aliveAllies[this.selectedAlly];
            if (ally) {
              if (this._pendingAbility) {
                this.castAbility(this._pendingAbility, ally);
                this._pendingAbility = null;
              } else {
                const inv = this._usableItems();
                const item = inv[this.selectedItem];
                if (item) this.useItem(item.name, ally);
              }
            }
          }
          e.preventDefault(); break;
        case 'x': case 'X': case 'Escape':
          if (this.battleState === 'target_select') {
            if (this._pendingAbility) {
              this.battleState = 'magic_select';
              this._pendingAbility = null;
            } else {
              this.battleState = 'action_select';
            }
            this.updateActionMenu();
            this.updateEnemyLabels();
          } else if (this.battleState === 'item_select') {
            this.battleState = 'action_select';
            this.updateActionMenu();
          } else if (this.battleState === 'magic_select') {
            this.battleState = 'action_select';
            this._pendingAbility = null;
            this.updateActionMenu();
          } else if (this.battleState === 'ally_select') {
            this.battleState = 'item_select';
            if (this.allyMarkerDiv) { this.allyMarkerDiv.remove(); this.allyMarkerDiv = null; }
            this.updateActionMenu();
          }
          e.preventDefault(); break;
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

    // Start battle after intro (setTimeout — delayedCall doesn't fire in launched scenes)
    setTimeout(() => {
      this.battleState = 'turn_start';
      this.log('A ' + this.enemies.map(e => e.name).join(' and ') + ' appeared!');
      this.updateAllDom();
      this._turnTimeout = setTimeout(() => this.processNextTurn(), 100);
    }, 500);
  }

  update(time, delta) {
    if (this.transitioning) return;
    this._delta = delta || 16;
    // All battle logic is now handled by:
    // - handleKeyDown (direct input processing)
    // - setTimeout chains (turn progression, animations)
    // update() is not called reliably in launched scenes, so we don't use it.
    // Reset one-shot flags (safety)
    this.confirmPressed = false;
    this.cancelPressed = false;
  }

  processNextTurn() {
    // Skip dead units
    while (this.currentTurnIndex < this.turnOrder.length) {
      const unit = this.turnOrder[this.currentTurnIndex];
      if (unit.alive) {
        // Process status effects at start of turn
        const { skipped } = processStatusTick(unit, (msg) => this.log(msg));
        this.updateAllDom();
        if (!unit.alive) {
          // Unit died from status tick damage — check end/morph before advancing
          this.updateAllDom();
          this.checkBattleEnd();
          if (this.battleState !== 'ended') {
            this.currentTurnIndex++;
            this._turnTimeout = setTimeout(() => this.processNextTurn(), 500);
          }
          return;
        }
        if (skipped) {
          // Unit can't act (e.g. asleep) — skip turn
          this.currentTurnIndex++;
          this._turnTimeout = setTimeout(() => this.processNextTurn(), 1000);
          return;
        }

        if (unit.side === 'player') {
          this.activePartyIndex = this.party.indexOf(unit);
          this.battleState = 'action_select';
          this.selectedAction = 0;
          this.updateActionMenu();
        } else {
          this.battleState = 'enemy_delay';
          this.log(unit.name + " acts.");
          this._enemyDelayTimeout = setTimeout(() => this.executeEnemyAction(), 600);
        }
        this.updateAllDom();
        return;
      }
      this.currentTurnIndex++;
    }

    // All turns processed — start new round
    this.currentTurnIndex = 0;
    // Remove dead units from turn order
    this.turnOrder = this.turnOrder.filter(u => u.alive);
    if (this.turnOrder.length === 0) {
      this.endBattle('draw');
      return;
    }
    this.battleState = 'turn_start';
    // Process next turn via setTimeout
    this._turnTimeout = setTimeout(() => this.processNextTurn(), 100);
  }

  executeAction(action) {
    const player = this.turnOrder[this.currentTurnIndex];
    if (!player.alive) return;

    switch (action) {
      case 'DEFEND':
        player.defending = true;
        this.log(player.name + ' is defending! (damage halved next turn)');
        break;

      case 'FLEE': {
        // Bosses block escape (design doc §9)
        const isBossFight = this.enemies.some(e => e.alive && e.boss) || !!this.battleData.isBoss;
        if (isBossFight) {
          this.log('Cannot escape this battle!');
          break;
        }
        const fleeAbility = (GameState.getAllAbilities(this.party.indexOf(player)).some(a => a.type === 'flee'));
        const fleeChance = fleeAbility ? 0.75 : 0.5;
        if (Math.random() < fleeChance) {
          this.log('Fled successfully!');
          setTimeout(() => this.endBattle('flee'), 800);
          return;
        } else {
          this.log('Failed to flee!');
        }
        player.defending = false;
        break;
      }
    }

    this.updateAllDom();
    this.checkBattleEnd();
    if (this.battleState !== 'ended') {
      this.currentTurnIndex++;
      this.battleState = 'turn_start';
      this.updateActionMenu();
      // Process next turn via setTimeout
      this._turnTimeout = setTimeout(() => this.processNextTurn(), 100);
    }
  }

  executeFight(target) {
    const player = this.turnOrder[this.currentTurnIndex];
    if (!player.alive || !target || !target.alive) return;

    this.battleState = 'animating';
    const playerSprite = this.playerSprites[player.partyIndex];
    const targetSprite = this.enemySprites[target.index];
    // FULL FE-STYLE ATTACK TRIP (Phase 10d — smooth version):
    //   windup AT HOME → run to the target (dash frame) → swing lands →
    //   follow-through → return frame while walking back → stand + idle.
    // One gesture owns the whole trip (no frozen-pose slides between them);
    // contact (damage/flash) fires while the swing frame is held.
    const origX = playerSprite.x;
    const lungeX = targetSprite.x - 30; // blade-point stand-off (FE tight)
    this.suspendIdle(playerSprite);
    this.strikeGesture(playerSprite, 1, () => {
      // ── CONTACT: the swing frame is held at the target from here ──
      this.slashArc(targetSprite, 1);
      const dmg = this.calcDamage(player.atk, target.def);
      target.hp -= dmg;
      this.log(`${player.name} attacks ${target.name} for ${dmg} damage!`);
      this.flashSprite(targetSprite);
      this.screenShake();
      this.showDamageNumber(targetSprite, dmg);

      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        this.log(`${target.name} is defeated!`);
        // Death fade runs IN PARALLEL with lunge-back (not sequential)
        const fadeStart = performance.now();
        const animateFade = () => {
          const fe = performance.now() - fadeStart;
          if (fe < 600) {
            targetSprite.setAlpha(1 - fe / 600);
            requestAnimationFrame(animateFade);
          } else {
            targetSprite.setVisible(false);
            targetSprite.setAlpha(1);
          }
        };
        requestAnimationFrame(animateFade);
        // Walk back immediately after the strike settles (parallel with fade)
        setTimeout(() => {
          this._lungeBackTimeout = setTimeout(() => this.afterPlayerAction(), Math.max(0, 600 - 300));
        }, 300);
      } else {
        // Return-phase runs inside strikeGesture; counter + turn advance after
        setTimeout(() => {
          if (target.counterPhysical && target.alive) {
            const counterDmg = Math.max(1, Math.floor(this.calcDamage(target.atk, player.def) * 0.6));
            player.hp -= counterDmg;
            this.log(`${target.name} counters! ${player.name} takes ${counterDmg} damage!`);
            this.flashSprite(playerSprite);
            this.showDamageNumber(playerSprite, counterDmg, '#ff8888');
            if (player.hp <= 0) {
              player.hp = 0;
              player.alive = false;
              this.log(`${player.name} has fallen!`);
              playerSprite.setVisible(false);
            }
          }
          setTimeout(() => this.afterPlayerAction(), 320);
        }, 260);
      }
    }, { targetX: lungeX });
  }

  // Called from update() when battleState === 'animating'
  updateAnimation(dt) {
    // No longer used — animations driven by setTimeout
  }

  afterPlayerAction() {
    const player = this.turnOrder[this.currentTurnIndex];
    if (player) player.defending = false;
    this.updateAllDom();
    this.checkBattleEnd();
    if (this.battleState !== 'ended') {
      this.currentTurnIndex++;
      this.battleState = 'turn_start';
      this.updateActionMenu();
      // Process next turn via setTimeout — update() doesn't fire in launched scenes
      this._turnTimeout = setTimeout(() => this.processNextTurn(), 100);
    }
  }

  executeEnemyAction() {
    const enemy = this.turnOrder[this.currentTurnIndex];
    if (!enemy || !enemy.alive || enemy.side !== 'enemy') {
      this.currentTurnIndex++;
      this.battleState = 'turn_start';
      this._turnTimeout = setTimeout(() => this.processNextTurn(), 100);
      return;
    }

    const player = this.turnOrder[this.currentTurnIndex];
    if (!player.alive) return;

    this.battleState = 'animating';

    // ── Enemy AI (design doc §8): weighted, situation-aware ──
    const aliveParty = this.party.filter(p => p.alive);
    if (aliveParty.length === 0) return;
    const target = aliveParty[Math.floor(Math.random() * aliveParty.length)];
    const enemySprite = this.enemySprites[enemy.index];

    // Healer archetype: heal the most wounded OTHER enemy if any is hurt
    if (enemy.healAlly) {
      const wounded = this.enemies.filter(e => e.alive && e !== enemy && e.hp < e.maxHp * 0.5);
      if (wounded.length > 0 && Math.random() < 0.6) {
        const ally = wounded[0];
        const healed = Math.floor(ally.maxHp * 0.25);
        ally.hp = Math.min(ally.maxHp, ally.hp + healed);
        this.log(`${enemy.name} heals ${ally.name}! (+${healed} HP)`);
        const sprite = this.enemySprites[ally.index];
        if (sprite) this.showDamageNumber(sprite, healed, '#44ff44');
        this.updateAllDom();
        this._enemyDelayTimeout = setTimeout(() => {
          this.currentTurnIndex++;
          this.battleState = 'turn_start';
          this._turnTimeout = setTimeout(() => this.processNextTurn(), 400);
        }, 800);
        return;
      }
    }

    // Spellcasters: sometimes cast instead of attacking
    if (enemy.spell && Math.random() < 0.45) {
      const spellDmg = Math.floor(enemy.spell.power * enemy.atk * (0.9 + Math.random() * 0.2));
      let dmg = spellDmg;
      if (target.defending) dmg = Math.floor(dmg / 2);
      target.hp -= dmg;
      this.log(`${enemy.name} casts ${enemy.spell.name}! ${target.name} takes ${dmg} damage!`);
      const playerSprite = this.playerSprites[target.partyIndex];
      this.flashSprite(playerSprite);
      this.screenShake();
      this.showDamageNumber(playerSprite, dmg, '#aa88ff');
      // Spell secondary effects
      if (enemy.stunChance && Math.random() < enemy.stunChance) {
        applyStatus(target, 'stun');
        this.log(`${target.name} is stunned!`);
      }
      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        this.log(`${target.name} has fallen!`);
        playerSprite.setVisible(false);
      }
      this.updateAllDom();
      this._enemyDelayTimeout = setTimeout(() => {
        this.currentTurnIndex++;
        this.battleState = 'turn_start';
        this._turnTimeout = setTimeout(() => this.processNextTurn(), 100);
      }, 1000);
      return;
    }

    // Physical attack — full FE trip (mirrors executeFight Phase 10d):
    // windup at home → run (dash frame) → swing lands → follow → return home.
    const playerSprite = this.playerSprites[target.partyIndex];
    const origX = enemySprite.x;
    const lungeX = playerSprite.x + 30; // blade-point stand-off (FE tight)
    this.suspendIdle(enemySprite);
    this.strikeGesture(enemySprite, -1, () => {
      // ── CONTACT: swing frame held at the party member ──
      this.slashArc(playerSprite, -1);
      let dmg = this.calcDamage(enemy.atk, target.def);
      if (target.defending) {
        dmg = Math.floor(dmg / 2);
      }
      target.hp -= dmg;
      this.log(`${enemy.name} attacks ${target.name} for ${dmg} damage!`);
      this.flashSprite(playerSprite);
      this.screenShake();
      this.showDamageNumber(playerSprite, dmg);

      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        this.log(`${target.name} has fallen!`);
        // Hide fallen party member's sprite
        playerSprite.setVisible(false);
      } else {
        // Status-on-hit chances (per-enemy hooks; default small poison chance)
        const poisonChance = enemy.poisonChance !== undefined ? enemy.poisonChance : 0.2;
        if (Math.random() < poisonChance) {
          applyStatus(target, 'poison');
          this.log(`${target.name} is poisoned!`);
        } else if (enemy.silenceChance && Math.random() < enemy.silenceChance) {
          applyStatus(target, 'silence');
          this.log(`${target.name} is silenced!`);
        } else if (enemy.stunChance && Math.random() < enemy.stunChance) {
          applyStatus(target, 'stun');
          this.log(`${target.name} is stunned!`);
        }
      }

      // Turn advance after the return walk completes inside the gesture
      setTimeout(() => {
        this.updateAllDom();
        this.checkBattleEnd();
        if (this.battleState !== 'ended') {
          this.currentTurnIndex++;
          this.battleState = 'turn_start';
          this.updateActionMenu();
          this._turnTimeout = setTimeout(() => this.processNextTurn(), 100);
        }
      }, 420);
    }, { targetX: lungeX });
  }

  // Called from updateAnimation when animPhase starts with 'enemy_'
  updateEnemyAnimation(dt) {
    // No longer used — animations driven by setTimeout
  }

  calcDamage(atk, def) {
    // Linear FF-style: atk − def/2 (balance pass 2026-10-09). The original
    // atk²/def is quadratic in atk — with growth curves to atk 51+ vs zone
    // def 12-17, endgame hits exploded (216-588 dmg vs 55-90 HP pools) and
    // every random fight died in round 1. Linear keeps the same def-matters
    // shape; variance ±10% (was ±15%). Sim verified vs the retuned enemy
    // table (EnemyData this commit): random fights 1-3 rounds / ≤8% pool
    // lost, bosses 4-5 rounds / ≤20% pool, under-leveled (−3) = 5-6 rounds
    // and survivable. 
    const variance = 0.9 + Math.random() * 0.2; // 0.90–1.10
    const base = atk - def / 2;
    return Math.max(1, Math.floor(base * variance));
  }

  checkBattleEnd() {
    // Check all party members dead
    const aliveParty = this.party.filter(p => p.alive);
    if (aliveParty.length === 0) {
      this.endBattle('lose');
      return;
    }
    // Check all enemies dead
    const aliveEnemies = this.enemies.filter(e => e.alive);
    if (aliveEnemies.length === 0) {
      // Finale two-phase morph: Aldric p1 → p2 (design doc: phase transitions)
      if (!this._phaseMorphed && this.enemies.some(e => e.type === 'boss_aldric_p1')) {
        this._phaseMorphed = true;
        this.battleState = 'ended'; // freeze callers — our timeout resumes the battle
        const idx = this.enemies.findIndex(e => e.type === 'boss_aldric_p1');
        const p1 = this.enemies[idx];
        const p2 = spawnEnemies(['boss_aldric_p2'])[0];
        p2.index = idx;
        this.enemies[idx] = p2;
        // Shared-reference swap in turn order (p1 may have been filtered out already)
        const toIdx = this.turnOrder.indexOf(p1);
        if (toIdx >= 0) this.turnOrder[toIdx] = p2; else this.turnOrder.push(p2);
        this.log('Aldric rises — hollowed by grief. The relics scream.');
        this.messageDiv.textContent = 'HE WON\'T FALL.';
        this.messageDiv.style.display = 'block';
        setTimeout(() => { this.messageDiv.style.display = 'none'; }, 1200);
        const sprite = this.enemySprites[idx];
        if (sprite) {
          sprite.setVisible(true);
          if (sprite._isSprite) {
            // Phase 9 AI sprite: swap texture to the p2 sprite
            const texKey = `bsprite_${p2.type}`;
            if (this.textures.exists(texKey)) sprite.setTexture(texKey);
          } else {
            sprite.setFillStyle(p2.color);
            sprite.setStrokeStyle(2, 0x8833aa);
          }
        }
        this.updateAllDom();
        this.currentTurnIndex = 0; // new round
        this._turnTimeout = setTimeout(() => this.processNextTurn(), 1200);
        return;
      }
      const totalExp = this.enemies.reduce((sum, e) => sum + e.exp, 0);
      const totalGold = this.enemies.reduce((sum, e) => sum + e.gold, 0);
      this.log(`Victory! Gained ${totalExp} EXP and ${totalGold} gold.`);
      this.endBattle('win', { exp: totalExp, gold: totalGold });
      return;
    }
  }

  endBattle(result, rewards) {
    this.battleState = 'ended';
    this.transitioning = true;

    // Save party HP/MP back to GameState (persists across battles)
    GameState.syncFromBattle(this.party);

    if (result === 'win') {
      GameState.applyBattleResult(result, rewards);
    } else if (result === 'lose') {
      // Party wiped → real Game Over (design doc §408): load save or Title.
      // No more free full-heal on defeat.
    }

    let message = '';
    if (result === 'win') message = 'VICTORY!';
    else if (result === 'lose') message = 'DEFEAT...';
    else if (result === 'flee') message = 'Escaped!';

    this.messageDiv.textContent = message;
    this.messageDiv.style.display = 'block';

    setTimeout(() => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        const returnScene = this.scene.settings.data?.returnScene || 'Overworld';
        this.scene.stop('Battle');
        if (result === 'lose') {
          // Game Over: launch the GameOver scene over the (paused) return scene
          this.scene.launch('GameOver');
        } else {
          this.scene.resume(returnScene, { battleResult: result, rewards });
        }
      });
    });
  }

  // ── FF-style strike gestures (rAF-only; launched-scene safe) ──────────
  // The attacker plays a physical motion at impact: lean back (wind-up),
  // snap toward the target (strike), hold the pose through contact, return.
  // dir = +1 striking rightward, -1 leftward. Weapon arc = white slash div
  // sweeping across the target (FF1R/FF4-6 slash streak read).

  strikeGesture(attackerSprite, dir, onContact, opts = {}) {
    if (!attackerSprite) { onContact(); return; }
    // FE SCRIPT RUNNER (Phase 10e). When the attacker carries the 19-frame
    // FE strip (_fe19), playback follows EIRIKA'S REAL SCRIPT TIMING
    // (verbatim 60fps ticks from the actual game's mode-1 script):
    //   stand 1 → settle 4 → coil 2 → windup 2 → HOLD 10 → uncoil 4 →
    //   sweep 4 → drive 5 → CONTACT smear (hit fires mid-swing) →
    //   carry 3 → follow 3 → recover 3 (hold) → 2×5 back-step → stand.
    // Everything runs with continuous movement between frames (no freezes).
    const origX = attackerSprite.x;
    const isSheet = !!(attackerSprite._sheet && attackerSprite.setTexture);
    const fe19 = !!attackerSprite._fe19;
    const fePair = !!attackerSprite._fePair;
    if (isSheet || fe19 || fePair || attackerSprite._isSprite) this.suspendIdle(attackerSprite);
    const targetX = opts.targetX !== undefined ? opts.targetX : origX + 14 * dir;

    if (fe19) {
      // tick = 60fps game-frame; ms tick = 1000/60
      const T = 1000 / 60;
      // [frame, ticks, xProgress] — x moves ONLY during motion frames:
      // home→ target across frames 5-9 (the commit), target→ home on 13-18.
      // NOTE: sheet frames 2-4 are the deep-crouch family (read tiny). The
      // hold beat maps to frame 5 (full-size coil) — FE holds read on the
      // coil, not the crouch.
      const SCRIPT = [
        [0, 1, 0.0], [1, 4, 0.0], [5, 2, 0.06], [5, 2, 0.10], [5, 10, 0.10],
        [6, 4, 0.28], [6, 4, 0.52], [7, 5, 0.80], [8, 2, 1.0],
        [9, 3, 1.0], [10, 3, 1.0], [11, 3, 1.0],                 // contact+follow+recover
        [12, 2, 0.9], [13, 2, 0.72], [14, 2, 0.5], [15, 2, 0.3], // walk back
        [16, 2, 0.16], [17, 2, 0.06], [18, 2, 0.0], [0, 1, 0.0],
      ];
      const swingIdx = 9; // hit fires when frame 9 (smear carry-through) SHOWS
      let acc = 0;
      const run = (stepIdx) => {
        if (stepIdx >= SCRIPT.length) {
          attackerSprite.setFrame(0);
          this.resumeIdle(attackerSprite);
          return;
        }
        const [frame, ticks, prog] = SCRIPT[stepIdx];
        attackerSprite.setFrame(frame);
        const fromX = stepIdx === 0 ? origX : attackerSprite.x;
        const toX = origX + (targetX - origX) * prog;
        // frames 8-10 (contact chain) fire the hit callback exactly once
        if (frame === swingIdx && stepIdx === 9) onContact();
        this._tweenX(attackerSprite, fromX, toX, ticks * T, () => {
          run(stepIdx + 1);
        });
      };
      run(0);
      return;
    }

    // ── fallback trip (chibi sheets / 6-cell FE pair / plain images) ──
    const STANCE_MS = 200;
    const RUN_MS = 300;
    const SWING_MS = 170;
    const FOLLOW_MS = 110;
    const RET_MS = 330;
    const targetX2 = targetX;
    const F = fePair
      ? { windup: 1, dash: 2, swing: 3, follow: 4, ret: 5, stand: 0 }
      : { windup: 4, dash: 7, swing: 7, follow: 1, ret: 4, stand: 1 };
    attackerSprite.setFrame(F.windup);
    this._tweenX(attackerSprite, origX, origX - 6 * dir, STANCE_MS, () => {
      attackerSprite.setFrame(F.dash);
      this._tweenX(attackerSprite, origX - 6 * dir, targetX2, RUN_MS, () => {
        attackerSprite.setFrame(F.swing);
        onContact();
        setTimeout(() => {
          attackerSprite.setFrame(F.follow);
          setTimeout(() => {
            attackerSprite.setFrame(F.ret);
            this._tweenX(attackerSprite, targetX2, origX, RET_MS, () => {
              attackerSprite.setFrame(F.stand);
              this.resumeIdle(attackerSprite);
            });
          }, FOLLOW_MS);
        }, SWING_MS);
      });
    });
  }

  _tweenX(sprite, fromX, toX, ms, done) {
    const t0 = performance.now();
    const step = () => {
      const e = performance.now() - t0;
      if (e < ms) {
        const t = e / ms;
        const ease = t * t; // easeIn — accel into the dash, reads as commitment
        sprite.x = fromX + (toX - fromX) * ease;
        requestAnimationFrame(step);
      } else {
        sprite.x = toX;
        if (done) done();
      }
    };
    requestAnimationFrame(step);
  }

  _tweenRot(sprite, fromR, toR, fromX, toX, ms, done) {
    const t0 = performance.now();
    const step = () => {
      const e = performance.now() - t0;
      if (e < ms) {
        const t = e / ms;
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
        sprite.rotation = fromR + (toR - fromR) * ease;
        sprite.x = fromX + (toX - fromX) * ease;
        requestAnimationFrame(step);
      } else {
        sprite.rotation = toR; sprite.x = toX;
        if (done) done();
      }
    };
    requestAnimationFrame(step);
  }

  // White slash arc sweeping over the target, 180ms, then gone.
  slashArc(targetSprite, dir = 1) {
    if (!targetSprite) return;
    const container = document.getElementById('game-container');
    if (!container) return;
    const canvas = document.querySelector('canvas');
    const cr = canvas.getBoundingClientRect();
    const scaleX = cr.width / 256, scaleY = cr.height / 224;
    const div = document.createElement('div');
    const px = targetSprite.x * scaleX, py = targetSprite.y * scaleY;
    div.style.cssText = `
      position: absolute; left: ${px - 30}px; top: ${py - 40}px;
      width: 60px; height: 60px; pointer-events: none; z-index: 45;
      border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: #ffffff; border-right-color: rgba(255,255,255,0.6);
      transform: rotate(${-30 * dir}deg);
      filter: drop-shadow(0 0 4px rgba(255,255,255,0.9));
      opacity: 1;
    `;
    container.appendChild(div);
    const t0 = performance.now();
    const DUR = 180;
    const step = () => {
      const e = performance.now() - t0;
      if (e < DUR) {
        const t = e / DUR;
        div.style.transform = `rotate(${(-30 + 140 * t) * dir}deg)`;
        div.style.opacity = String(1 - t * t);
        requestAnimationFrame(step);
      } else {
        div.remove();
      }
    };
    requestAnimationFrame(step);
  }

  // Caster gesture for magic: rise + glow pulse on the caster, magic circle on
  // target, then DESCENT back to the caster's start Y (bug fix: the old
  // version only used rAF during the 340ms rise and never restored y, so the
  // caster stayed floating ~5px higher after every spell).
  castGesture(casterSprite, targetSprite, onContact) {
    if (!casterSprite) { onContact(); return; }
    this.suspendIdle(casterSprite); // breath must not fight the gesture
    const t0 = performance.now();
    const startY = casterSprite.y;
    const CHARGE_MS = 340, SETTLE_MS = 220;
    let contactFired = false;
    // Sheet casters: hold the arms-raised frame through the whole gesture
    const artKey = casterSprite._sheet ? casterSprite._sheet.replace('battlesheet_', '') : null;
    const isSheetCaster = !!(casterSprite._sheet && artKey && this.textures.exists(casterSprite._sheet));
    if (isSheetCaster) casterSprite.setFrame(3); // row0 col3 = both arms raised
    const step = (now) => {
      const e = now - t0;
      if (e < CHARGE_MS) {
        const t = e / CHARGE_MS;
        // rise ~5px over charge, easeInOut — reproducible, no per-frame drift
        casterSprite.y = startY - 5 * Math.sin(t * Math.PI / 2);
        if (!isSheetCaster) casterSprite.setTint(0xaaffff); // arcane glow
      } else {
        if (!contactFired) {
          contactFired = true;
          casterSprite.clearTint();
          onContact();
          if (targetSprite) this.magicCircle(targetSprite);
        }
        // settle: descend back to startY, easeOut — always ends exactly home
        const t = Math.min(1, (e - CHARGE_MS) / SETTLE_MS);
        casterSprite.y = startY - 5 * (1 - t) * (1 - t);
        if (t >= 1) {
          casterSprite.y = startY;
          casterSprite.setFrame(1); // back to stand
          this.resumeIdle(casterSprite);
          return;
        }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Expanding ring under/over the target — the spell-landing read.
  magicCircle(targetSprite) {
    const container = document.getElementById('game-container');
    if (!container || !targetSprite) return;
    const canvas = document.querySelector('canvas');
    const cr = canvas.getBoundingClientRect();
    const scaleX = cr.width / 256, scaleY = cr.height / 224;
    const div = document.createElement('div');
    const px = targetSprite.x * scaleX, py = targetSprite.y * scaleY;
    div.style.cssText = `
      position: absolute; left: ${px}px; top: ${py}px;
      width: 8px; height: 8px; margin: -4px 0 0 -4px;
      border: 2px solid rgba(170, 200, 255, 0.95); border-radius: 50%;
      pointer-events: none; z-index: 45;
      box-shadow: 0 0 6px rgba(170,200,255,0.9);
      transition: width 0.35s ease-out, height 0.35s ease-out,
                  margin 0.35s ease-out, opacity 0.35s ease-out;
      opacity: 1;
    `;
    container.appendChild(div);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      div.style.width = '64px'; div.style.height = '64px';
      div.style.margin = '-32px 0 0 -32px';
      div.style.opacity = '0';
    }));
    setTimeout(() => div.remove(), 420);
  }

  // ── Idle breathing driver ──────────────────────────────────────────
  _idleTick(now) {
    if (!this.scene || !this.scene.isActive()) return; // scene gone — stop
    const t0 = this._idleT0;
    const PERIOD = 900;
    for (const s of this._idleSprites) {
      if (!s || this._idleSuspended.has(s)) continue;
      if (s._isSprite !== true) continue; // legacy rects stay still
      if (s.visible === false) continue;  // dead enemy — stop breathing
      const phase = ((s.x * 7 + s.y * 13) % PERIOD) / PERIOD; // stable per-sprite offset
      const w = Math.sin((now - t0) / PERIOD * Math.PI * 2 + phase * Math.PI * 2);
      // squash-stretch: breath in = up + thin, breath out = down + wide
      // (relative to the sprite's base scale — custom-scale sprites keep it)
      const bs = (s._baseScale ?? 1);
      s.y = s._homeY !== undefined ? s._homeY : (s._homeY = s.y);
      s.scaleY = bs * (1 + 0.03 * w);
      s.scaleX = bs * (1 - 0.02 * w);
      s.y = s._homeY - Math.max(0, w) * 1.5; // rise 1.5px on inhale only
    }
    this._idleRaf = requestAnimationFrame(this._idleStep);
  }

  suspendIdle(sprite) {
    if (!sprite) return;
    this._idleSuspended.add(sprite);
    // restore the sprite's BASE scale (breathing writes absolute 1±w — sprites
    // with a custom base scale, e.g. FE-pair 0.56, must not get reset to 1)
    sprite.scaleX = (sprite._baseScale ?? 1);
    sprite.scaleY = (sprite._baseScale ?? 1);
    if (sprite._homeY !== undefined) sprite.y = sprite._homeY;
  }

  resumeIdle(sprite) {
    if (!sprite) return;
    this._idleSuspended.delete(sprite);
  }

  _killIdle() {
    if (this._idleRaf) cancelAnimationFrame(this._idleRaf);
    this._idleRaf = null;
  }

  flashSprite(sprite) {
    if (!sprite) return;
    // Manual strobe via rAF (Phaser tweens don't run in launched scenes).
    // Both paths: 3 strobes × 90ms alternating white/red — reads as an impact hit.
    const startTime = performance.now();
    const duration = 270; // 3 flashes × 90ms
    const isRect = !sprite._isSprite;
    const origColor = isRect ? sprite.fillColor : null;
    const animateFlash = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed < duration) {
        const phase = Math.floor(elapsed / 90) % 2;
        if (isRect) {
          sprite.setFillStyle(phase === 0 ? 0xff4444 : origColor);
        } else if (phase === 0) {
          sprite.setTint(0xff4444);
        } else {
          sprite.setTint(0xffffff);
        }
        requestAnimationFrame(animateFlash);
      } else {
        if (isRect) sprite.setFillStyle(origColor);
        else sprite.clearTint();
      }
    };
    requestAnimationFrame(animateFlash);
  }

  screenShake() {
    // Manual shake via rAF (Phaser camera shake doesn't work in launched scenes)
    const cam = this.cameras.main;
    const startTime = performance.now();
    const duration = 280;
    const intensity = 9; // pixels — tuned to be FEELT at 3x canvas scale
    const animateShake = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed < duration) {
        const decay = 1 - elapsed / duration;
        cam.setScroll(
          (Math.random() - 0.5) * intensity * decay,
          (Math.random() - 0.5) * intensity * decay
        );
        requestAnimationFrame(animateShake);
      } else {
        cam.setScroll(0, 0);
      }
    };
    requestAnimationFrame(animateShake);
  }

  showDamageNumber(sprite, dmg, color) {
    const container = document.getElementById('game-container');
    if (!container || !sprite) return;
    const canvas = document.querySelector('canvas');
    const cr = canvas.getBoundingClientRect();
    const scaleX = cr.width / 256; // battle canvas is 256 wide
    const scaleY = cr.height / 224; // battle canvas is 224 tall
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute;
      left: ${sprite.x * scaleX}px;
      top: ${sprite.y * scaleY - 10}px;
      transform: translate(-50%, 0) scale(0.5);
      color: ${color || '#ffff44'};
      font-size: 34px;
      font-weight: bold;
      font-family: "VT323", monospace;
      text-shadow: 2px 2px 0 rgba(0,0,0,0.95), -1px -1px 0 rgba(0,0,0,0.7);
      pointer-events: none;
      z-index: 40;
      transition: top 0.9s cubic-bezier(0.2, 0.8, 0.4, 1), opacity 0.9s ease-out, transform 0.15s ease-out;
      opacity: 1;
    `;
    div.textContent = dmg;
    container.appendChild(div);
    // Pop-in scale (0.5x → 1.15x overshoot reads as impact), then rise + fade
    requestAnimationFrame(() => requestAnimationFrame(() => {
      div.style.transform = 'translate(-50%, 0) scale(1.15)';
    }));
    setTimeout(() => {
      div.style.transform = 'translate(-50%, 0) scale(1)';
      div.style.top = (sprite.y * scaleY - 56) + 'px';
      div.style.opacity = '0';
    }, 260);
    setTimeout(() => div.remove(), 1300);
  }

  log(text) {
    this.battleLog.push(text);
    if (this.battleLog.length > 5) this.battleLog.shift();
    this.updateBattleLog();
  }

  // --- DOM helper methods ---
  createDomText(text, container, styles) {
    const div = document.createElement('div');
    const cssParts = [];
    cssParts.push('position: absolute');
    if (styles.left) cssParts.push('left: ' + styles.left);
    if (styles.right) cssParts.push('right: ' + styles.right);
    if (styles.top) cssParts.push('top: ' + styles.top);
    if (styles.bottom) cssParts.push('bottom: ' + styles.bottom);
    if (styles.width) cssParts.push('width: ' + styles.width);
    if (styles.transform) cssParts.push('transform: ' + styles.transform);
    cssParts.push('color: ' + (styles.color || '#ffffff'));
    cssParts.push('font-family: "VT323", monospace');
    cssParts.push('font-size: ' + (styles.fontSize || '14px'));
    if (styles.fontWeight) cssParts.push('font-weight: ' + styles.fontWeight);
    if (styles.lineHeight) cssParts.push('line-height: ' + styles.lineHeight);
    if (styles.textAlign) cssParts.push('text-align: ' + styles.textAlign);
    if (styles.maxWidth) cssParts.push('max-width: ' + styles.maxWidth);
    if (styles.maxHeight) cssParts.push('max-height: ' + styles.maxHeight);
    if (styles.overflow) cssParts.push('overflow: ' + styles.overflow);
    if (styles.display) cssParts.push('display: ' + styles.display);
    if (styles.flexDirection) cssParts.push('flex-direction: ' + styles.flexDirection);
    if (styles.justifyContent) cssParts.push('justify-content: ' + styles.justifyContent);
    if (styles.background) cssParts.push('background: ' + styles.background);
    if (styles.border) cssParts.push('border: ' + styles.border);
    if (styles.borderTop) cssParts.push('border-top: ' + styles.borderTop);
    if (styles.padding) cssParts.push('padding: ' + styles.padding);
    if (styles.boxSizing) cssParts.push('box-sizing: ' + styles.boxSizing);
    if (styles.gap) cssParts.push('gap: ' + styles.gap);
    if (styles.whiteSpace) cssParts.push('white-space: ' + styles.whiteSpace);
    if (styles.zIndex) cssParts.push('z-index: ' + styles.zIndex);
    else cssParts.push('z-index: 20');
    cssParts.push('pointer-events: none');
    cssParts.push('text-shadow: 1px 1px 2px rgba(0,0,0,0.8)');
    div.style.cssText = cssParts.join('; ');
    div.textContent = text;
    container.appendChild(div);
    this.domElements.push(div);
    return div;
  }

  updateAllDom() {
    // --- Party panel (bottom strip) — one column per party member ---
    const partyHtml = this.party.map((p, i) => {
      const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
      const mpPct = Math.max(0, (p.mp / p.maxMp) * 100);
      const hpColor = p.alive ? (hpPct > 50 ? '#44dd44' : hpPct > 25 ? '#ddaa44' : '#dd4444') : '#666';
      const isActive = this.turnOrder[this.currentTurnIndex] === p;
      const nameColor = isActive ? '#ffff00' : (p.alive ? '#ffffff' : '#666');
      const statuses = getActiveStatuses(p);
      const statusIcons = statuses.map(s => {
        const def = STATUS_EFFECTS[s];
        return def ? `<span style="color:${def.color};font-size: 13px;margin-left:4px">${def.icon}</span>` : '';
      }).join('');
      return `
        <div style="flex:1;min-width:120px;max-width:200px;padding:4px 8px;border-right:1px solid rgba(255,255,255,0.1)">
          <div style="color:${nameColor};font-weight:${isActive?'bold':'normal'}">${isActive?'▶ ':''}${p.name}${statusIcons}</div>
          <div style="font-size: 14px;color:#aaa">${p.job} Lv.${p.level}</div>
          <div style="font-size: 14px;color:#ccc;margin-top:2px">HP: ${p.hp}/${p.maxHp}</div>
          <div style="height:4px;background:#330000;width:100%;margin:1px 0;border-radius:2px">
            <div style="height:4px;background:${hpColor};width:${hpPct}%;border-radius:2px"></div>
          </div>
          <div style="font-size: 14px;color:#ccc;margin-top:1px">MP: ${p.mp}/${p.maxMp}</div>
          <div style="height:3px;background:#000033;width:100%;margin:1px 0;border-radius:2px">
            <div style="height:3px;background:#4444dd;width:${mpPct}%;border-radius:2px"></div>
          </div>
        </div>`;
    }).join('');
    this.partyPanelDiv.innerHTML = partyHtml;

    // --- Enemy labels (near each sprite) ---
    this.updateEnemyLabels();

    // Action menu
    this.updateActionMenu();
  }

  updateActionMenu() {
    if (this.battleState === 'action_select') {
      const actions = ['FIGHT', 'MAGIC', 'ITEM', 'DEFEND', 'FLEE'];
      this.actionMenuDiv.style.display = 'block';
      this.actionMenuDiv.innerHTML = actions.map((a, i) => {
        const prefix = i === this.selectedAction ? '▶' : '　';
        const color = i === this.selectedAction ? '#ffff00' : '#888';
        return `<span style="color:${color};display:inline-block;width:16px">${prefix}</span> ${a}`;
      }).join('<br>');
    } else if (this.battleState === 'item_select') {
      this.actionMenuDiv.style.display = 'block';
      const inv = this._usableItems();
      if (inv.length === 0) {
        this.actionMenuDiv.innerHTML = '<span style="color:#888">No items available.</span>';
      } else {
        this.actionMenuDiv.innerHTML = inv.map((item, i) => {
          const prefix = i === this.selectedItem ? '▶' : '　';
          const color = i === this.selectedItem ? '#ffff00' : '#888';
          return `<span style="color:${color};display:inline-block;width:16px">${prefix}</span> ${item.name} x${item.qty}`;
        }).join('<br>');
      }
    } else if (this.battleState === 'magic_select') {
      this.actionMenuDiv.style.display = 'block';
      const abilities = this._magicAbilities();
      if (abilities.length === 0) {
        this.actionMenuDiv.innerHTML = '<span style="color:#888">No abilities available.</span>';
      } else {
        this.actionMenuDiv.innerHTML = abilities.map((ab, i) => {
          const prefix = i === this.selectedSpell ? '▶' : '　';
          const color = i === this.selectedSpell ? '#ffff00' : '#888';
          const canAfford = this.turnOrder[this.currentTurnIndex].mp >= ab.mpCost;
          const cost = canAfford ? `${ab.mpCost}MP` : `<span style="color:#ff4444">${ab.mpCost}MP</span>`;
          return `<span style="color:${color};display:inline-block;width:16px">${prefix}</span> ${ab.name} (${cost})`;
        }).join('<br>');
      }
    } else if (this.battleState === 'ally_select') {
      // Don't show text list — use ▼ marker above party sprite + panel highlight
      this.actionMenuDiv.style.display = 'none';
      this.updateAllyMarker();
    } else {
      this.actionMenuDiv.style.display = 'none';
    }
  }

  _usableItems() {
    return GameState.getInventory().filter(item => {
      const def = getItem(item.name);
      return def && item.qty > 0;
    });
  }

  _currentAbilities() {
    const caster = this.turnOrder[this.currentTurnIndex];
    if (!caster) return [];
    return GameState.getAllAbilities(this.party.indexOf(caster));
  }

  // Magic/heal abilities (shown under MAGIC)
  _magicAbilities() {
    return this._currentAbilities().filter(a => a.type === 'magic' || a.type === 'heal');
  }

  // Physical abilities (shown under FIGHT submenu)
  _fightAbilities() {
    return this._currentAbilities().filter(a => a.type === 'physical');
  }

  castAbility(ability, target) {
    const caster = this.turnOrder[this.currentTurnIndex];
    if (!caster || !target) return;
    if (caster.mp < ability.mpCost) {
      this.log('Not enough MP!');
      this.battleState = 'action_select';
      this.updateActionMenu();
      return;
    }
    caster.mp -= ability.mpCost;

    this.battleState = 'animating';
    if (this.allyMarkerDiv) { this.allyMarkerDiv.remove(); this.allyMarkerDiv = null; }
    if (this.targetArrowDiv) { this.targetArrowDiv.remove(); this.targetArrowDiv = null; }

    this.log(`${caster.name} casts ${ability.name}!`);

    if (ability.type === 'heal') {
      const sprite = target.side === 'player' ? this.playerSprites[target.partyIndex] : this.enemySprites[target.index];
      const casterSprite = caster.side === 'player' ? this.playerSprites[caster.partyIndex] : this.enemySprites[caster.index];
      this.castGesture(casterSprite, sprite, () => {
        const healAmt = Math.floor(caster.mag * ability.power);
        const healed = Math.min(healAmt, target.maxHp - target.hp);
        target.hp += healed;
        this.log(`${target.name} recovers ${healed} HP!`);
        if (sprite) this.showDamageNumber(sprite, healed, '#44ff44');
        this.updateAllDom();
        this._finishCast();
      });
      return;
    } else if (ability.type === 'magic') {
      const sprite = this.enemySprites[target.index];
      const casterSprite = caster.side === 'player' ? this.playerSprites[caster.partyIndex] : this.enemySprites[caster.index];
      this.castGesture(casterSprite, sprite, () => {
        const dmg = Math.floor(caster.mag * ability.power * (0.85 + Math.random() * 0.3));
        target.hp -= dmg;
        this.log(`${target.name} takes ${dmg} damage!`);
        if (sprite) {
          this.flashSprite(sprite);
          this.screenShake();
          this.showDamageNumber(sprite, dmg, '#ff8844');
        }
        if (target.hp <= 0) {
          target.hp = 0;
          target.alive = false;
          this.log(`${target.name} is defeated!`);
          if (sprite) sprite.setVisible(false);
        }
        this.updateAllDom();
        this._magicTimeout = setTimeout(() => this.afterPlayerAction(), 700);
      });
      return;
    } else if (ability.type === 'physical') {
      const dmg = Math.floor(caster.atk * ability.power * (0.85 + Math.random() * 0.3));
      target.hp -= dmg;
      this.log(`${target.name} takes ${dmg} damage!`);
      const sprite = this.enemySprites[target.index];
      if (sprite) {
        this.slashArc(sprite, 1);
        this.flashSprite(sprite);
        this.screenShake();
        this.showDamageNumber(sprite, dmg, '#ffff44');
      }
      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        this.log(`${target.name} is defeated!`);
        if (sprite) sprite.setVisible(false);
      }
    } else if (ability.type === 'buff') {
      caster.defending = true;
      this.log(`${caster.name} is defending!`);
    }

    this.updateAllDom();

    // Check battle end
    this.checkBattleEnd();
    if (this.battleState !== 'ended') {
      this._magicTimeout = setTimeout(() => this.afterPlayerAction(), 1000);
    }
  }

  // heal-cast completion path (async via castGesture callback)
  _finishCast() {
    this.checkBattleEnd();
    if (this.battleState !== 'ended') {
      this._magicTimeout = setTimeout(() => this.afterPlayerAction(), 700);
    }
  }

  useItem(itemName, ally) {
    const def = getItem(itemName);
    if (!def) return;

    const user = this.turnOrder[this.currentTurnIndex];
    const target = ally || this.enemies.find(e => e.alive);
    if (!target) return;

    this.log(`${user.name} uses ${def.name}!`);

    if (def.type === 'heal') {
      const healed = Math.min(def.power, target.maxHp - target.hp);
      target.hp += healed;
      this.log(`${target.name} recovers ${healed} HP!`);
      const sprite = target.side === 'player' ? this.playerSprites[target.partyIndex] : this.enemySprites[target.index];
      if (sprite) this.showDamageNumber(sprite, healed, '#44ff44');
    } else if (def.type === 'mp_heal') {
      const restored = Math.min(def.power, target.maxMp - target.mp);
      target.mp += restored;
      this.log(`${target.name} recovers ${restored} MP!`);
    } else if (def.type === 'revive') {
      if (!target.alive) {
        target.alive = true;
        target.hp = def.power;
        const sprite = this.playerSprites[target.partyIndex];
        if (sprite) sprite.setVisible(true);
        this.log(`${target.name} is revived!`);
      } else {
        this.log('It has no effect.');
      }
    } else if (def.type === 'cure_status') {
      if (hasStatus(target, def.status)) {
        removeStatus(target, def.status);
        this.log(`${target.name} is cured of ${STATUS_EFFECTS[def.status].name}!`);
      } else {
        this.log('It has no effect.');
      }
    } else if (def.type === 'damage') {
      target.hp -= def.power;
      this.log(`${target.name} takes ${def.power} damage!`);
      this.showDamageNumber(this.enemySprites[target.index], def.power, '#ff4444');
      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        this.log(`${target.name} is defeated!`);
        const ts = this.enemySprites[target.index];
        if (ts) ts.setVisible(false);
      }
    }

    if (this.allyMarkerDiv) { this.allyMarkerDiv.remove(); this.allyMarkerDiv = null; }

    GameState.removeItem(itemName, 1);
    this.battleState = 'animating';
    this.updateAllDom();

    // Advance turn after a short delay
    this._itemTimeout = setTimeout(() => this.afterPlayerAction(), 1000);
  }

  updateAllyMarker() {
    // Remove old marker
    if (this.allyMarkerDiv) {
      this.allyMarkerDiv.remove();
      this.allyMarkerDiv = null;
    }
    // Clear old panel highlights
    if (this.partyPanelDiv) {
      const cols = this.partyPanelDiv.querySelectorAll(':scope > div');
      cols.forEach(col => {
        if (col.style) {
          col.style.background = '';
          col.style.boxShadow = '';
        }
      });
    }

    if (this.battleState !== 'ally_select') return;

    const aliveAllies = this.party.filter(p => p.alive);
    if (this.selectedAlly >= aliveAllies.length) this.selectedAlly = 0;
    const ally = aliveAllies[this.selectedAlly];
    if (!ally) return;

    const sprite = this.playerSprites[ally.partyIndex];
    if (!sprite) return;

    // Create ▼ marker above party sprite
    const container = document.getElementById('game-container');
    const canvas = document.querySelector('canvas');
    const cr = canvas.getBoundingClientRect();
    const scaleX = cr.width / 256;
    const scaleY = cr.height / 224;
    const markerX = sprite.x * scaleX;
    const markerY = (sprite.y - 22) * scaleY;

    this.allyMarkerDiv = document.createElement('div');
    this.allyMarkerDiv.style.cssText = `position:absolute;left:${markerX}px;top:${markerY}px;transform:translate(-50%,0);color:#ffff00;font-size: 22px;font-family:'VT323',monospace;text-shadow:1px 1px 2px rgba(0,0,0,0.9);pointer-events:none;z-index:40;`;
    this.allyMarkerDiv.textContent = '▼';
    container.appendChild(this.allyMarkerDiv);

    // Highlight party panel entry for selected ally
    if (this.partyPanelDiv) {
      const cols = this.partyPanelDiv.querySelectorAll(':scope > div');
      if (cols[ally.partyIndex]) {
        cols[ally.partyIndex].style.background = 'rgba(255, 255, 0, 0.15)';
        cols[ally.partyIndex].style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 0, 0.4)';
      }
    }
  }

  updateEnemyLabels() {
    const aliveEnemies = this.enemies.filter(e => e.alive);
    this.enemies.forEach((enemy, i) => {
      const div = this.enemyLabelDivs[i];
      if (!div) return;
      if (enemy.alive) {
        const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
        const isTargeted = this.battleState === 'target_select' &&
          aliveEnemies[this.selectedTarget] === enemy;
        const nameColor = isTargeted ? '#ffff00' : '#ffaaaa';
        div.innerHTML =
          `<div style="color:${nameColor}">${enemy.name}</div>` +
          `<div style="font-size: 14px;color:#ccc">${enemy.hp}/${enemy.maxHp}</div>` +
          `<div style="height:3px;background:#440000;width:60px;margin:1px auto 0;border-radius:2px">` +
            `<div style="height:3px;background:#dd4444;width:${hpPct}%;border-radius:2px"></div>` +
          `</div>`;
        div.style.display = 'block';
      } else {
        div.style.display = 'none';
      }
    });

    // --- Target arrow (▼ above the selected enemy sprite) ---
    if (this.targetArrowDiv) {
      this.targetArrowDiv.remove();
      this.targetArrowDiv = null;
    }
    if (this.battleState === 'target_select' && aliveEnemies.length > 0) {
      // Clamp selectedTarget to valid range
      if (this.selectedTarget >= aliveEnemies.length) {
        this.selectedTarget = aliveEnemies.length - 1;
      }
      const target = aliveEnemies[this.selectedTarget];
      const spacing = 48;
      const startX = 180;
      const worldX = startX + (target.index % 2) * spacing;
      const worldY = 90 + Math.floor(target.index / 2) * 50;
      const SCALE = 3;
      const container = document.getElementById('game-container');
      this.targetArrowDiv = document.createElement('div');
      this.targetArrowDiv.style.cssText = `
        position: absolute;
        left: ${(worldX * SCALE)}px;
        top: ${((worldY - 22) * SCALE)}px;
        transform: translateX(-50%);
        color: #ffff00;
        font-size: 26px;
        font-family: "VT323", monospace;
        pointer-events: none;
        z-index: 25;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      `;
      this.targetArrowDiv.textContent = '▼';
      container.appendChild(this.targetArrowDiv);
      this.domElements.push(this.targetArrowDiv);
    }
  }

  updateBattleLog() {
    this.battleLogDiv.innerHTML = this.battleLog.map(l => `<div>• ${l}</div>`).join('');
  }

  cleanupDom() {
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
    if (this.allyMarkerDiv) { this.allyMarkerDiv.remove(); this.allyMarkerDiv = null; }
    if (this.targetArrowDiv) { this.targetArrowDiv.remove(); this.targetArrowDiv = null; }
  }

  shutdown() {
    this.cleanupDom();
  }
}