import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { ITEMS, getItem } from '../game/ItemData.js';

/**
 * BattleScene — turn-based combat prototype.
 * Side-view battle: player (left) vs enemies (right).
 * Player stats are loaded from GameState (persistent across battles).
 */

const ENEMY_TEMPLATES = {
  slime: {
    name: 'Slime', hp: 15, maxHp: 15, atk: 6, def: 2, agi: 4,
    color: 0x44cc44, exp: 5, gold: 10,
  },
  bat: {
    name: 'Bat', hp: 10, maxHp: 10, atk: 8, def: 1, agi: 10,
    color: 0x8844cc, exp: 7, gold: 12,
  },
  goblin: {
    name: 'Goblin', hp: 20, maxHp: 20, atk: 9, def: 4, agi: 6,
    color: 0xcc6644, exp: 12, gold: 20,
  },
};

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  create(data) {
    this.domElements = [];
    this.transitioning = false;

    // --- Battle setup ---
    // Load full party from persistent GameState
    const gs = GameState.get();
    this.party = gs.party.map((char, i) => ({
      ...char,
      alive: char.hp > 0,
      defending: false,
      side: 'player',
      id: 'player_' + i,
      partyIndex: i,
    }));

    // Enemies (1-3 from data, or random)
    const enemyTypes = data?.enemies || ['slime'];
    this.enemies = enemyTypes.map((type, i) => {
      const tmpl = ENEMY_TEMPLATES[type] || ENEMY_TEMPLATES.slime;
      return { ...JSON.parse(JSON.stringify(tmpl)), type, index: i, defending: false, alive: true, side: 'enemy', id: 'enemy_' + i };
    });

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

    // Player sprites (placeholder — colored squares, one per party member)
    this.playerSprites = [];
    const partyColors = [0x4488ff, 0xff8844, 0x44ff88, 0xff44ff];
    this.party.forEach((char, i) => {
      const x = 40 + i * 30;
      const sprite = this.add.rectangle(x, 120, 20, 28, partyColors[i % partyColors.length]);
      sprite.setStrokeStyle(1, 0xffffff, 0.5);
      this.playerSprites.push(sprite);
    });
    this.playerSprite = this.playerSprites[0]; // primary for backwards-compat

    // Enemy sprites (placeholder — colored squares)
    // Spread them out more for readability
    this.enemySprites = [];
    this.enemyLabelDivs = [];
    this.enemies.forEach((enemy, i) => {
      const spacing = 48;
      const startX = 180;
      const x = startX + (i % 2) * spacing;
      const y = 90 + Math.floor(i / 2) * 50;
      const sprite = this.add.rectangle(x, y, 24, 24, enemy.color);
      sprite.setStrokeStyle(1, 0xffffff, 0.5);
      this.enemySprites.push(sprite);
    });

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
      const worldY = 90 + Math.floor(i / 2) * 50;
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
            const actions = ['FIGHT', 'ITEM', 'DEFEND', 'FLEE'];
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
            const actions = ['FIGHT', 'ITEM', 'DEFEND', 'FLEE'];
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
          }
          e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D':
          if (this.battleState === 'target_select') {
            const alive = this.enemies.filter(en => en.alive);
            if (alive.length > 0) {
              this.selectedTarget = (this.selectedTarget + 1) % alive.length;
              this.updateEnemyLabels();
            }
          }
          e.preventDefault(); break;
        case 'z': case 'Z': case 'Enter':
          if (this.battleState === 'action_select') {
            const actions = ['FIGHT', 'ITEM', 'DEFEND', 'FLEE'];
            const action = actions[this.selectedAction];
            if (action === 'FIGHT') {
              const alive = this.enemies.filter(en => en.alive);
              if (alive.length > 0) {
                this.selectedTarget = 0;
                this.battleState = 'target_select';
                this.log('Select a target.');
                this.updateActionMenu();
                this.updateEnemyLabels();
              }
            } else if (action === 'ITEM') {
              this.selectedItem = 0;
              this.selectedAlly = 0;
              this.battleState = 'item_select';
              this.log('Select an item.');
              this.updateActionMenu();
            } else {
              this.executeAction(action);
            }
          } else if (this.battleState === 'target_select') {
            const alive = this.enemies.filter(en => en.alive);
            if (this.selectedTarget >= alive.length) this.selectedTarget = 0;
            const target = alive[this.selectedTarget];
            if (target && target.alive) {
              this.battleState = 'animating';
              this.updateEnemyLabels();
              this.executeFight(target);
            }
          } else if (this.battleState === 'item_select') {
            // Confirm item selection — now select ally target
            const inv = this._usableItems();
            if (inv.length === 0) return;
            const item = inv[this.selectedItem];
            const itemDef = getItem(item.name);
            if (itemDef.target === 'ally') {
              this.battleState = 'ally_select';
              this.selectedAlly = 0;
              this.log('Select an ally.');
              this.updateActionMenu();
            } else if (itemDef.target === 'enemy') {
              // Use on enemy directly (only one enemy for now, or first alive)
              this.useItem(item.name, null);
            }
          } else if (this.battleState === 'ally_select') {
            const aliveAllies = this.party.filter(p => p.alive);
            if (this.selectedAlly >= aliveAllies.length) this.selectedAlly = 0;
            const ally = aliveAllies[this.selectedAlly];
            if (ally) {
              const inv = this._usableItems();
              const item = inv[this.selectedItem];
              if (item) this.useItem(item.name, ally);
            }
          }
          e.preventDefault(); break;
        case 'x': case 'X': case 'Escape':
          if (this.battleState === 'target_select') {
            this.battleState = 'action_select';
            this.log('Select an action.');
            this.updateActionMenu();
            this.updateEnemyLabels();
          } else if (this.battleState === 'item_select') {
            this.battleState = 'action_select';
            this.log('Select an action.');
            this.updateActionMenu();
          } else if (this.battleState === 'ally_select') {
            this.battleState = 'item_select';
            this.log('Select an item.');
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
        if (unit.side === 'player') {
          this.activePartyIndex = this.party.indexOf(unit);
          this.battleState = 'action_select';
          this.selectedAction = 0;
          this.log(unit.name + "'s turn.");
          this.updateActionMenu();
        } else {
          this.battleState = 'enemy_delay';
          this.log(unit.name + "'s turn.");
          // Use setTimeout instead of update() — update() doesn't fire in launched scenes
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

      case 'FLEE':
        if (Math.random() < 0.5) {
          this.log('Fled successfully!');
          setTimeout(() => this.endBattle('flee'), 800);
          return;
        } else {
          this.log('Failed to flee!');
        }
        player.defending = false;
        break;
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
    const origX = playerSprite.x;
    const lungeX = targetSprite.x - 50;

    // Manual lunge via requestAnimationFrame (Phaser tweens don't run in launched scenes)
    const startTime = performance.now();
    const LUNGE_MS = 400; // lunge duration
    const animateLunge = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed < LUNGE_MS) {
        const t = elapsed / LUNGE_MS;
        playerSprite.x = origX + (lungeX - origX) * (1 - (1 - t) * (1 - t)); // easeOut
        requestAnimationFrame(animateLunge);
      } else {
        playerSprite.x = lungeX;
        // Impact
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
          // Lunge back immediately (parallel with fade)
          const backStart = performance.now();
          const animateBack = () => {
            const be = performance.now() - backStart;
            if (be < LUNGE_MS) {
              const t = be / LUNGE_MS;
              playerSprite.x = lungeX + (origX - lungeX) * (t * t);
              requestAnimationFrame(animateBack);
            } else {
              playerSprite.x = origX;
              // Wait for fade to finish, then advance turn
              this._lungeBackTimeout = setTimeout(() => this.afterPlayerAction(), Math.max(0, 600 - LUNGE_MS));
            }
          };
          requestAnimationFrame(animateBack);
        } else {
          // Hold at lunge position for 300ms (visible impact pause), then lunge back
          this._lungeBackTimeout = setTimeout(() => {
            const backStart = performance.now();
            const backFromX = lungeX;
            const animateBack = () => {
              const be = performance.now() - backStart;
              if (be < LUNGE_MS) {
                const t = be / LUNGE_MS;
                playerSprite.x = backFromX + (origX - backFromX) * (t * t);
                requestAnimationFrame(animateBack);
              } else {
                playerSprite.x = origX;
                this.afterPlayerAction();
              }
            };
            requestAnimationFrame(animateBack);
          }, 300);
        }
      }
    };
    requestAnimationFrame(animateLunge);
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
    const enemySprite = this.enemySprites[enemy.index];
    // Target a random alive party member
    const aliveParty = this.party.filter(p => p.alive);
    const target = aliveParty[Math.floor(Math.random() * aliveParty.length)];
    const playerSprite = this.playerSprites[target.partyIndex];
    const origX = enemySprite.x;
    const lungeX = playerSprite.x + 50;

    // Manual lunge via requestAnimationFrame
    const startTime = performance.now();
    const LUNGE_MS = 400;
    const animateLunge = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed < LUNGE_MS) {
        const t = elapsed / LUNGE_MS;
        enemySprite.x = origX + (lungeX - origX) * (1 - (1 - t) * (1 - t));
        requestAnimationFrame(animateLunge);
      } else {
        enemySprite.x = lungeX;
        // Impact
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
        }

        // Lunge back via rAF
        const backStart = performance.now();
        const backFromX = lungeX;
        const animateBack = () => {
          const be = performance.now() - backStart;
          if (be < LUNGE_MS) {
            const t = be / LUNGE_MS;
            enemySprite.x = backFromX + (origX - backFromX) * (t * t);
            requestAnimationFrame(animateBack);
          } else {
            enemySprite.x = origX;
            this.updateAllDom();
            this.checkBattleEnd();
            if (this.battleState !== 'ended') {
              this.currentTurnIndex++;
              this.battleState = 'turn_start';
              this.updateActionMenu();
              this._turnTimeout = setTimeout(() => this.processNextTurn(), 100);
            }
          }
        };
        requestAnimationFrame(animateBack);
      }
    };
    requestAnimationFrame(animateLunge);
  }

  // Called from updateAnimation when animPhase starts with 'enemy_'
  updateEnemyAnimation(dt) {
    // No longer used — animations driven by setTimeout
  }

  calcDamage(atk, def) {
    const variance = 0.85 + Math.random() * 0.3; // 0.85–1.15
    const base = atk * (atk / Math.max(1, def));
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
      // On defeat, restore to full HP (for prototype — later this goes to game over)
      GameState.fullHeal();
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
        // Resume the previous scene (Overworld/Town was paused)
        const returnScene = this.scene.settings.data?.returnScene || 'Overworld';
        this.scene.stop('Battle');
        this.scene.resume(returnScene, { battleResult: result, rewards });
      });
    });
  }

  flashSprite(sprite) {
    if (!sprite) return;
    // Manual flash via rAF (Phaser tweens don't run in launched scenes)
    const startTime = performance.now();
    const duration = 240; // 3 flashes × 80ms
    const animateFlash = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed < duration) {
        const phase = Math.floor(elapsed / 80) % 2;
        if (phase === 0) {
          sprite.setTint(0xff4444);
        } else {
          sprite.setTint(0xffffff);
        }
        requestAnimationFrame(animateFlash);
      } else {
        sprite.setTint(0xffffff);
      }
    };
    requestAnimationFrame(animateFlash);
  }

  screenShake() {
    // Manual shake via rAF (Phaser camera shake doesn't work in launched scenes)
    const cam = this.cameras.main;
    const startTime = performance.now();
    const duration = 150;
    const intensity = 4; // pixels
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

  showDamageNumber(sprite, dmg) {
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
      transform: translate(-50%, 0);
      color: #ffff44;
      font-size: 18px;
      font-weight: bold;
      font-family: "Courier New", monospace;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.9);
      pointer-events: none;
      z-index: 40;
      transition: top 1.2s ease-out, opacity 1.2s ease-out;
      opacity: 1;
    `;
    div.textContent = dmg;
    container.appendChild(div);
    // Animate upward + fade (longer duration for visibility)
    setTimeout(() => {
      div.style.top = (sprite.y * scaleY - 60) + 'px';
      div.style.opacity = '0';
    }, 100);
    setTimeout(() => div.remove(), 1500);
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
    cssParts.push('font-family: "Courier New", monospace');
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
      return `
        <div style="flex:1;min-width:120px;max-width:200px;padding:4px 8px;border-right:1px solid rgba(255,255,255,0.1)">
          <div style="color:${nameColor};font-weight:${isActive?'bold':'normal'}">${isActive?'▶ ':''}${p.name}</div>
          <div style="font-size:10px;color:#aaa">${p.job} Lv.${p.level}</div>
          <div style="font-size:10px;color:#ccc;margin-top:2px">HP: ${p.hp}/${p.maxHp}</div>
          <div style="height:4px;background:#330000;width:100%;margin:1px 0;border-radius:2px">
            <div style="height:4px;background:${hpColor};width:${hpPct}%;border-radius:2px"></div>
          </div>
          <div style="font-size:10px;color:#ccc;margin-top:1px">MP: ${p.mp}/${p.maxMp}</div>
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
      const actions = ['FIGHT', 'ITEM', 'DEFEND', 'FLEE'];
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
    } else if (this.battleState === 'ally_select') {
      this.actionMenuDiv.style.display = 'block';
      const aliveAllies = this.party.filter(p => p.alive);
      this.actionMenuDiv.innerHTML = aliveAllies.map((ally, i) => {
        const prefix = i === this.selectedAlly ? '▶' : '　';
        const color = i === this.selectedAlly ? '#ffff00' : '#888';
        return `<span style="color:${color};display:inline-block;width:16px">${prefix}</span> ${ally.name} (${ally.hp}/${ally.maxHp})`;
      }).join('<br>');
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

    GameState.removeItem(itemName, 1);
    this.updateAllDom();

    // Advance turn after a short delay
    this.battleState = 'animating';
    this._itemTimeout = setTimeout(() => this.afterPlayerAction(), 1000);
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
          `<div style="font-size:10px;color:#ccc">${enemy.hp}/${enemy.maxHp}</div>` +
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
        font-size: 18px;
        font-family: "Courier New", monospace;
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
  }

  shutdown() {
    this.cleanupDom();
  }
}