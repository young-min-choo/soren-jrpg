import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import { STARTING_JOBS, JOBS, getStatsForLevel } from '../game/JobData.js';
import { getActiveStatuses, STATUS_EFFECTS } from '../game/StatusEffectData.js';

/**
 * NewGameFlow — two screens: Name Entry, then Job Choice.
 * Launched as an overlay from TitleScene ("New Game"); on completion
 * resets GameState with the chosen name/job and starts the Overworld.
 * The intro cutscene then plays on first Overworld entry.
 *
 * All input is raw DOM key events (project pattern) — arrow/enter/backspace.
 */

const NAME_MAX = 8;
const LETTERS = [
  'ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ  ', // rows: cycle through
];

export default class NewGameFlowScene extends Phaser.Scene {
  constructor() {
    super('NewGameFlow');
  }

  create() {
    this.domElements = [];
    this.container = document.getElementById('game-container');
    this.stage = 'name'; // 'name' → 'job'
    this.playerName = '';
    this.jobIndex = 0;

    // Overlay
    this.overlayDiv = document.createElement('div');
    this.overlayDiv.style.cssText = `
      position: absolute; left: 0; top: 0; width: 768px; height: 672px;
      background: rgba(0, 0, 10, 0.92); z-index: 100; pointer-events: none;
      font-family: "VT323", monospace;
    `;
    this.container.appendChild(this.overlayDiv);
    this.domElements.push(this.overlayDiv);

    this.panelDiv = document.createElement('div');
    this.panelDiv.style.cssText = `
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: 600px; min-height: 300px; padding: 24px; box-sizing: border-box;
      background: rgba(20, 20, 50, 0.95); border: 2px solid rgba(255,255,255,0.3);
      border-radius: 6px; color: #fff; z-index: 101; pointer-events: none;
      font-family: "VT323", monospace;
    `;
    this.container.appendChild(this.panelDiv);
    this.domElements.push(this.panelDiv);

    this.handleKeyDown = (e) => this.onKey(e);
    window.addEventListener('keydown', this.handleKeyDown);

    // Real text input for name entry. A focused editable puts Vimium C /
    // key-grabbing extensions into insert mode, so single letters reach the
    // game instead of triggering browser-shortcut commands (p = pin, t = new
    // tab, r = reload …). Kept as a separate node (never inside panelDiv,
    // whose innerHTML is rewritten on every render).
    this.nameInput = document.createElement('input');
    this.nameInput.maxLength = NAME_MAX;
    this.nameInput.autocomplete = 'off';
    this.nameInput.spellcheck = false;
    this.nameInput.autocapitalize = 'characters';
    this.nameInput.style.cssText = `
      position: absolute; left: 50%; top: calc(50% - 88px); transform: translateX(-50%);
      width: 400px; text-align: center; font-size: 36px; letter-spacing: 6px;
      font-family: "VT323", monospace; color: #fff; background: transparent;
      border: none; border-bottom: 2px solid rgba(255,255,255,0.4);
      padding: 4px 0; outline: none; z-index: 102; pointer-events: auto; display: none;
    `;
    this.container.appendChild(this.nameInput);
    this.domElements.push(this.nameInput);
    this._refocusOnClick = () => {
      if (this.stage === 'name' && this.nameInput) this.nameInput.focus();
    };
    this.container.addEventListener('click', this._refocusOnClick);

    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this.handleKeyDown);
      this.container.removeEventListener('click', this._refocusOnClick);
      this.domElements.forEach(el => el.remove());
      this.domElements = [];
    });

    this.render();
  }

  update() {} // launched-scene pattern: input handled in keydown handler

  onKey(e) {
    const k = e.key;
    if (this.stage === 'name') {
      // Text input is handled by nameInput (real <input>, focused — browser
      // extensions like Vimium C pass keys through to focused editables).
      const usingInput = document.activeElement === this.nameInput;
      if (k === 'Enter') {
        this.playerName = ((this.nameInput?.value || '') + this.playerName).trim().slice(0, NAME_MAX);
        if (this.playerName.length === 0) this.playerName = 'Soren';
        if (this.nameInput) this.nameInput.style.display = 'none';
        this.stage = 'job';
        e.preventDefault();
        this.render();
        return;
      } else if (k === 'Escape') {
        this.stage = 'job'; // skip customization entirely
        if (this.nameInput) this.nameInput.style.display = 'none';
        e.preventDefault();
        this.render();
        return;
      } else if (k === 'Tab') {
        e.preventDefault(); // keep keyboard focus inside the dialog
        return;
      }
      if (usingInput) {
        // Let the native <input> insert the character — preventDefault here
        // would silently swallow the keystroke (the "Soren" bug).
        return;
      }
      // Input not focused (e.g. auto-focus lost): still accept typing directly
      if (/^[a-zA-Z]$/.test(k) && this.playerName.length < NAME_MAX) {
        this.playerName += k;
      } else if (k === 'Backspace' && this.playerName.length > 0) {
        this.playerName = this.playerName.slice(0, -1);
      }
      e.preventDefault();
      this.render();
      return;
    } else if (this.stage === 'job') {
      if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        this.jobIndex = (this.jobIndex - 1 + STARTING_JOBS.length) % STARTING_JOBS.length;
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        this.jobIndex = (this.jobIndex + 1) % STARTING_JOBS.length;
      } else if (k === 'Enter' || k === 'z' || k === 'Z') {
        this.finish();
        return;
      } else if (k === 'Escape') {
        this.stage = 'name';
      }
    }
    e.preventDefault();
    this.render();
  }

  finish() {
    const job = STARTING_JOBS[this.jobIndex];
    GameState.reset(this.playerName || 'Soren', job);
    this.scene.stop();
    this.scene.start('Overworld'); // intro cutscene fires on first entry
  }

  render() {
    if (!this.panelDiv) return;
    if (this.stage === 'name') {
      // The <input> shows the typed name itself (native caret — no fake cursor).
      // Its value is the source of truth here; re-render only refreshes the label.
      const typed = this.nameInput?.value || '';
      this.panelDiv.innerHTML = `
        <div style="font-size: 26px;color:#ffff00;margin-bottom:8px">Name your hero</div>
        <div style="height:52px"></div>
        <div style="font-size: 16px;color:#888;margin-top:10px">Click the field if keys don't register · Enter confirms${typed ? '' : ' (blank = Soren)'} · Esc skips all</div>
      `;
      if (this.nameInput) {
        this.nameInput.style.display = 'block';
        if (document.activeElement !== this.nameInput) this.nameInput.focus();
      }
    } else {
      const jobName = STARTING_JOBS[this.jobIndex];
      const job = JOBS[jobName];
      const stats = getStatsForLevel(jobName, 1);
      const texture = {
        Warrior: 'From a guard family. The party knight will notice your combat instinct.',
        Mage: 'From a scholar family. You are more attuned to the relics\' resonance.',
        Ranger: 'From the frontier. An outsider among outsiders — Kael will warm to you.',
        Monk: 'From a monastery. You sense what others hide — like a certain "healer".',
      }[jobName];
      const rows = STARTING_JOBS.map((j, i) => {
        const sel = i === this.jobIndex;
        const color = sel ? '#ffff00' : '#ccc';
        const prefix = sel ? '▶' : ' ';
        return `<div style="color:${color};font-size: 20px;margin:3px 0"><span style="display:inline-block;width:18px">${prefix}</span>${JOBS[j].name}</div>`;
      }).join('');
      this.panelDiv.innerHTML = `
        <div style="font-size: 26px;color:#ffff00;margin-bottom:6px">Choose your path — ${this.playerName}</div>
        <div style="display:flex;gap:24px">
          <div style="min-width:180px">${rows}</div>
          <div style="flex:1;font-size: 17px;color:#ccc">
            <div style="color:#fff;font-weight:bold;margin-bottom:4px">${job.name}</div>
            <div style="color:#aaa;margin-bottom:8px">${job.description}</div>
            <div style="font-size: 16px;color:#888;margin-bottom:8px">HP ${stats.hp} · MP ${stats.mp} · ATK ${stats.atk} · DEF ${stats.def} · MAG ${stats.mag} · AGI ${stats.agi}</div>
            <div style="font-size: 16px;color:#6f6f9f;font-style:italic">${texture}</div>
          </div>
        </div>
        <div style="font-size: 16px;color:#888;margin-top:14px">↑↓ choose · Enter begin · Esc back</div>
      `;
    }
  }
}