import Phaser from 'phaser';
import GameState from '../game/GameState.js';

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
    // Load player from persistent GameState (HP carries over between battles)
    const gs = GameState.get();
    this.player = { ...gs, defending: false };

    // Enemies (1-3 from data, or random)
    const enemyTypes = data?.enemies || ['slime'];
    this.enemies = enemyTypes.map((type, i) => {
      const tmpl = ENEMY_TEMPLATES[type] || ENEMY_TEMPLATES.slime;
      return { ...JSON.parse(JSON.stringify(tmpl)), type, index: i, defending: false, alive: true };
    });

    // Build turn order: sort all units by AGI descending
    this.allUnits = [
      { ...this.player, side: 'player', id: 'player', alive: true },
      ...this.enemies.map(e => ({ ...e, side: 'enemy', id: 'enemy_' + e.index, alive: true })),
    ];
    this.turnOrder = [...this.allUnits].sort((a, b) => b.agi - a.agi);
    this.currentTurnIndex = 0;

    // State: 'intro' → 'player_turn' → 'enemy_turn' → 'action_select' → 'result'
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

    // Player sprite (placeholder — blue square)
    const playerSprite = this.add.rectangle(64, 120, 20, 28, 0x4488ff);
    playerSprite.setStrokeStyle(1, 0xffffff, 0.5);
    this.playerSprite = playerSprite;

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
      maxWidth: '280px', textAlign: 'right',
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
        case 'ArrowUp': case 'w': case 'W': this.keys.up = true; e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S': this.keys.down = true; e.preventDefault(); break;
        case 'ArrowLeft': case 'a': case 'A': this.keys.left = true; e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D': this.keys.right = true; e.preventDefault(); break;
        case 'z': case 'Z': case 'Enter': this.confirmPressed = true; e.preventDefault(); break;
        case 'x': case 'X': case 'Escape': this.cancelPressed = true; e.preventDefault(); break;
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

    // Start battle after intro fade
    this.time.delayedCall(500, () => {
      this.battleState = 'turn_start';
      this.log('A ' + this.enemies.map(e => e.name).join(' and ') + ' appeared!');
      this.updateAllDom();
    });
  }

  update() {
    if (this.transitioning) return;

    if (this.battleState === 'action_select') {
      // Navigate action menu
      const actions = ['FIGHT', 'DEFEND', 'FLEE'];
      if (this.keys.down || this.keys.up) {
        if (this.keys.down) {
          this.selectedAction = (this.selectedAction + 1) % actions.length;
          this.keys.down = false;
        }
        if (this.keys.up) {
          this.selectedAction = (this.selectedAction - 1 + actions.length) % actions.length;
          this.keys.up = false;
        }
        this.updateActionMenu();
      }

      if (this.confirmPressed) {
        this.confirmPressed = false;
        const action = actions[this.selectedAction];
        if (action === 'FIGHT') {
          // Enter target selection
          const aliveEnemies = this.enemies.filter(e => e.alive);
          if (aliveEnemies.length === 0) return;
          this.selectedTarget = 0;
          this.battleState = 'target_select';
          this.log('Select a target.');
          this.updateActionMenu();
          this.updateEnemyLabels();
        } else {
          this.executeAction(action);
        }
      }
    } else if (this.battleState === 'target_select') {
      // Navigate enemy targets with up/down
      const aliveEnemies = this.enemies.filter(e => e.alive);
      if (aliveEnemies.length === 0) {
        this.battleState = 'action_select';
        return;
      }
      if (this.keys.down || this.keys.right) {
        this.selectedTarget = (this.selectedTarget + 1) % aliveEnemies.length;
        this.keys.down = false;
        this.keys.right = false;
        this.updateEnemyLabels();
      }
      if (this.keys.up || this.keys.left) {
        this.selectedTarget = (this.selectedTarget - 1 + aliveEnemies.length) % aliveEnemies.length;
        this.keys.up = false;
        this.keys.left = false;
        this.updateEnemyLabels();
      }
      if (this.confirmPressed) {
        this.confirmPressed = false;
        const target = aliveEnemies[this.selectedTarget];
        this.executeFight(target);
      }
      if (this.cancelPressed) {
        this.cancelPressed = false;
        this.battleState = 'action_select';
        this.log('Select an action.');
        this.updateActionMenu();
        this.updateEnemyLabels();
      }
    } else if (this.battleState === 'turn_start') {
      // Process next unit in turn order
      this.processNextTurn();
    } else if (this.battleState === 'enemy_action') {
      // Enemy AI runs automatically
      this.time.delayedCall(600, () => {
        this.executeEnemyAction();
      });
      this.battleState = 'waiting';
    }

    // Reset one-shot flags
    this.confirmPressed = false;
    this.cancelPressed = false;
  }

  processNextTurn() {
    // Skip dead units
    while (this.currentTurnIndex < this.turnOrder.length) {
      const unit = this.turnOrder[this.currentTurnIndex];
      if (unit.alive) {
        if (unit.side === 'player') {
          this.battleState = 'action_select';
          this.selectedAction = 0;
          this.log("Soren's turn.");
          this.updateActionMenu();
        } else {
          this.battleState = 'enemy_action';
          this.log(unit.name + "'s turn.");
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
  }

  executeAction(action) {
    const player = this.allUnits[0];
    if (!player.alive) return;

    switch (action) {
      case 'DEFEND':
        this.player.defending = true;
        this.log('Soren is defending! (damage halved next turn)');
        break;

      case 'FLEE':
        if (Math.random() < 0.5) {
          this.log('Fled successfully!');
          this.time.delayedCall(800, () => this.endBattle('flee'));
          return;
        } else {
          this.log('Failed to flee!');
        }
        this.player.defending = false;
        break;
    }

    this.updateAllDom();
    this.checkBattleEnd();
    if (this.battleState !== 'ended') {
      this.currentTurnIndex++;
      this.battleState = 'turn_start';
      this.updateActionMenu(); // hide menu
    }
  }

  executeFight(target) {
    const player = this.allUnits[0];
    if (!player.alive || !target || !target.alive) return;

    const dmg = this.calcDamage(player.atk, target.def);
    target.hp -= dmg;
    this.log(`Soren attacks ${target.name} for ${dmg} damage!`);
    this.flashSprite(this.enemySprites[target.index]);
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      this.allUnits.find(u => u.id === 'enemy_' + target.index).alive = false;
      this.enemySprites[target.index].setVisible(false);
      this.log(`${target.name} is defeated!`);
    }
    this.player.defending = false;

    this.updateAllDom();
    this.checkBattleEnd();
    if (this.battleState !== 'ended') {
      this.currentTurnIndex++;
      this.battleState = 'turn_start';
      this.updateActionMenu(); // hide menu
    }
  }

  executeEnemyAction() {
    // Simple AI: attack player
    const aliveEnemies = this.enemies.filter(e => e.alive);
    if (aliveEnemies.length === 0) return;

    const enemy = aliveEnemies[0]; // first alive enemy attacks
    const player = this.allUnits[0];
    if (!player.alive) return;

    let dmg = this.calcDamage(enemy.atk, player.def);
    if (this.player.defending) {
      dmg = Math.floor(dmg / 2);
    }

    player.hp -= dmg;
    this.player.hp = player.hp;
    this.log(`${enemy.name} attacks Soren for ${dmg} damage!`);
    this.flashSprite(this.playerSprite);

    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      this.log('Soren has fallen!');
    }

    this.updateAllDom();
    this.checkBattleEnd();
    if (this.battleState !== 'ended') {
      this.currentTurnIndex++;
      this.battleState = 'turn_start';
      this.updateActionMenu(); // hide menu
    }
  }

  calcDamage(atk, def) {
    const variance = 0.85 + Math.random() * 0.3; // 0.85–1.15
    const base = atk * (atk / Math.max(1, def));
    return Math.max(1, Math.floor(base * variance));
  }

  checkBattleEnd() {
    // Check player death
    if (this.allUnits[0].hp <= 0) {
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

    // Save player HP/MP back to GameState (persists across battles)
    const gs = GameState.get();
    gs.hp = this.allUnits[0].hp;
    gs.mp = this.allUnits[0].mp;

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

    this.time.delayedCall(2000, () => {
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
    this.tweens.add({
      targets: sprite,
      alpha: 0.3,
      duration: 80,
      yoyo: true,
      repeat: 1,
    });
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
    if (styles.display) cssParts.push('display: ' + styles.display);
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
    // --- Party panel (bottom strip) ---
    // One column per party member. For now just Soren.
    const p = this.allUnits[0];
    const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
    const mpPct = Math.max(0, (p.mp / p.maxMp) * 100);
    this.partyPanelDiv.innerHTML =
      `<div style="min-width:140px">` +
      `<div style="color:#88ff88;font-weight:bold">${p.name}</div>` +
      `<div style="font-size:11px;color:#aaa">${p.job} Lv.${p.level}</div>` +
      `<div style="margin-top:2px">HP: ${p.hp}/${p.maxHp}</div>` +
      `<div style="height:4px;background:#333;border-radius:2px;margin-top:1px">` +
        `<div style="height:4px;background:#44dd44;width:${hpPct}%;border-radius:2px"></div>` +
      `</div>` +
      `<div style="margin-top:1px">MP: ${p.mp}/${p.maxMp}</div>` +
      `<div style="height:3px;background:#333;border-radius:2px;margin-top:1px">` +
        `<div style="height:3px;background:#4488ff;width:${mpPct}%;border-radius:2px"></div>` +
      `</div>` +
      `</div>`;

    // --- Enemy labels (near each sprite) ---
    this.updateEnemyLabels();

    // Action menu
    this.updateActionMenu();
  }

  updateActionMenu() {
    const actions = ['FIGHT', 'DEFEND', 'FLEE'];
    const lines = actions.map((a, i) =>
      (i === this.selectedAction ? '<span style="color:#ffff00">▶ ' : '<span style="color:#888">&nbsp;&nbsp; ') + a + '</span>'
    );
    this.actionMenuDiv.innerHTML = lines.join('<br>');
    // Show/hide action menu
    if (this.battleState === 'action_select') {
      this.actionMenuDiv.style.display = 'block';
    } else if (this.battleState === 'target_select') {
      this.actionMenuDiv.style.display = 'block';
      this.actionMenuDiv.innerHTML = '<span style="color:#ffff00">▶ FIGHT</span><br><span style="color:#aaa;font-size:11px">Choose target (↑↓, Z, X)</span>';
    } else {
      this.actionMenuDiv.style.display = 'none';
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
        const borderStyle = isTargeted ? 'border:1px solid #ffff00;padding:2px;' : '';
        div.innerHTML =
          `<div style="${borderStyle}color:${nameColor}">${isTargeted ? '▶ ' : ''}${enemy.name}</div>` +
          `<div style="font-size:10px;color:#ccc">${enemy.hp}/${enemy.maxHp}</div>` +
          `<div style="height:3px;background:#440000;width:60px;margin:1px auto 0;border-radius:2px">` +
            `<div style="height:3px;background:#dd4444;width:${hpPct}%;border-radius:2px"></div>` +
          `</div>`;
        div.style.display = 'block';
      } else {
        div.style.display = 'none';
      }
    });
  }

  updateBattleLog() {
    this.battleLogDiv.innerHTML = this.battleLog.map(l => '• ' + l).join('<br>');
  }

  cleanupDom() {
    this.domElements.forEach(el => el.remove());
    this.domElements = [];
  }

  shutdown() {
    this.cleanupDom();
  }
}