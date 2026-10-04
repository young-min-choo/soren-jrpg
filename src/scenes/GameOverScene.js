import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { SaveSystem } from '../game/SaveSystem.js';

/**
 * GameOverScene — party-wiped state (design doc §408).
 * DOM overlay: "GAME OVER" + Load last save / Title options.
 * Launched from BattleScene when the whole party falls. The Battle scene
 * stays paused behind it; choosing Load swaps scenes via _applyLoadedState
 * (same mechanism MenuScene uses), choosing Title stops field scenes.
 *
 * Note: on defeat we NO LONGER free-full-heal. The player loads a save or
 * returns to Title — the classic JRPG death tax.
 */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create() {
    this.domElements = [];
    this.index = 0; // 0 = Load last save, 1 = Title
    this.container = document.getElementById('game-container');

    this.cameras.main.setBackgroundColor('#000000');

    // Full-screen overlay
    this.overlayDiv = document.createElement('div');
    this.overlayDiv.style.cssText = `
      position: absolute; left: 0; top: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.85);
      z-index: 200; pointer-events: none;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    `;
    this.container.appendChild(this.overlayDiv);
    this.domElements.push(this.overlayDiv);

    // Title
    const title = document.createElement('div');
    title.textContent = 'GAME OVER';
    title.style.cssText = `
      font-family: "Press Start 2P", monospace; font-size: 36px; font-weight: bold;
      color: #dd4444; letter-spacing: 4px; margin-bottom: 24px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    `;
    this.overlayDiv.appendChild(title);

    // Options
    this.optionsDiv = document.createElement('div');
    this.overlayDiv.appendChild(this.optionsDiv);

    this.render();

    // Brief input lockout so a mashed Z during the death fade doesn't
    // instantly confirm the first option
    this.inputLockedUntil = performance.now() + 800;

    // Keyboard
    this.handleKeyDown = (e) => {
      if (performance.now() < this.inputLockedUntil) {
        e.preventDefault();
        return;
      }
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W':
        case 'ArrowLeft': case 'a': case 'A':
          this.index = (this.index - 1 + 2) % 2;
          this.render();
          e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S':
        case 'ArrowRight': case 'd': case 'D':
          this.index = (this.index + 1) % 2;
          this.render();
          e.preventDefault(); break;
        case 'z': case 'Z': case 'Enter':
          this.confirm();
          e.preventDefault(); break;
        case 'X': case 'x': case 'Escape':
          // X = Title as well
          this.confirmTitle();
          e.preventDefault(); break;
      }
    };
    window.addEventListener('keydown', this.handleKeyDown);

    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this.handleKeyDown);
      this.domElements.forEach(el => el.remove());
      this.domElements = [];
    });
  }

  render() {
    const slots = SaveSystem.getSaveSlots();
    const hasSave = !slots.every(s => s.empty) || SaveSystem.hasAutosave();
    const options = [
      { key: 'load', label: 'Load Last Save', disabled: !hasSave },
      { key: 'title', label: 'Return to Title' },
    ];
    let html = '';
    options.forEach((opt, i) => {
      const sel = i === this.index;
      const prefix = sel ? '▶' : '　';
      const color = opt.disabled ? '#666' : (sel ? '#ffff00' : '#ccc');
      html += `<div style="color:${color};font-size: 22px;font-family:'VT323',monospace;margin:10px 0;pointer-events:none">${prefix} ${opt.label}</div>`;
    });
    this.optionsDiv.innerHTML = html;
  }

  confirm() {
    if (this.index === 0) this.confirmLoad();
    else this.confirmTitle();
  }

  confirmLoad() {
    // Find the most recent non-empty slot (or autosave)
    const slots = SaveSystem.getSaveSlots();
    let best = -1, bestTime = -1;
    slots.forEach((s, i) => {
      if (!s.empty && s.timestamp > bestTime) { bestTime = s.timestamp; best = i; }
    });
    if (best < 0 && SaveSystem.hasAutosave()) {
      const auto = SaveSystem.loadAutosave();
      if (auto) {
        this._applyLoadedState(auto);
      } else {
        this.confirmTitle();
      }
      return;
    }
    if (best < 0) { this.confirmTitle(); return; }
    const data = SaveSystem.load(best);
    if (data) this._applyLoadedState(data);
    else this.confirmTitle();
  }

  _applyLoadedState(data) {
    const gs = GameState.get();
    Object.keys(gs).forEach(key => {
      if (data[key] !== undefined) {
        gs[key] = data[key];
      }
    });
    // Stop everything (active OR paused — paused scenes keep DOM overlays),
    // then start the saved scene
    this.scene.stop(); // GameOver
    const sceneManager = this.scene.manager;
    ['Overworld', 'Town', 'PortMeridian', 'Stonewatch', 'Skyhold', 'Aurelia', 'Dungeon', 'TideTemple', 'HollowDeep', 'StormSpire', 'ConduitGate', 'Conduit', 'Embers', 'Dialogue', 'Battle', 'Menu'].forEach(sceneKey => {
      const scene = sceneManager.getScene(sceneKey);
      if (scene && (scene.scene.isActive() || scene.scene.isPaused())) sceneManager.stop(sceneKey);
    });
    sceneManager.start(data.scene || 'Overworld');
  }

  confirmTitle() {
    this.scene.stop();
    const sceneManager = this.scene.manager;
    ['Overworld', 'Town', 'PortMeridian', 'Stonewatch', 'Skyhold', 'Aurelia', 'Dungeon', 'TideTemple', 'HollowDeep', 'StormSpire', 'ConduitGate', 'Conduit', 'Embers', 'Dialogue', 'Battle', 'Menu'].forEach(sceneKey => {
      const scene = sceneManager.getScene(sceneKey);
      if (scene && (scene.scene.isActive() || scene.scene.isPaused())) sceneManager.stop(sceneKey);
    });
    sceneManager.start('Title');
  }
}