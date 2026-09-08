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
      font-family: "Courier New", monospace;
    `;
    this.container.appendChild(this.overlayDiv);
    this.domElements.push(this.overlayDiv);

    this.panelDiv = document.createElement('div');
    this.panelDiv.style.cssText = `
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: 600px; min-height: 300px; padding: 24px; box-sizing: border-box;
      background: rgba(20, 20, 50, 0.95); border: 2px solid rgba(255,255,255,0.3);
      border-radius: 6px; color: #fff; z-index: 101; pointer-events: none;
      font-family: "Courier New", monospace;
    `;
    this.container.appendChild(this.panelDiv);
    this.domElements.push(this.panelDiv);

    this.handleKeyDown = (e) => this.onKey(e);
    window.addEventListener('keydown', this.handleKeyDown);
    this.events.on('shutdown', () => {
      window.removeEventListener('keydown', this.handleKeyDown);
      this.domElements.forEach(el => el.remove());
      this.domElements = [];
    });

    this.render();
  }

  update() {} // launched-scene pattern: input handled in keydown handler

  onKey(e) {
    const k = e.key;
    if (this.stage === 'name') {
      if (/^[a-zA-Z]$/.test(k) && this.playerName.length < NAME_MAX) {
        this.playerName += k;
      } else if (k === 'Backspace') {
        this.playerName = this.playerName.slice(0, -1);
      } else if (k === 'Enter') {
        if (this.playerName.length === 0) this.playerName = 'Soren';
        this.stage = 'job';
      } else if (k === 'Escape') {
        this.stage = 'job'; // skip customization entirely
      }
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
      const shown = this.playerName + (Math.floor(Date.now() / 500) % 2 === 0 ? '_' : '');
      this.panelDiv.innerHTML = `
        <div style="font-size:18px;color:#ffff00;margin-bottom:8px">Name your hero</div>
        <div style="font-size:26px;letter-spacing:6px;min-height:40px;color:#fff;border-bottom:2px solid rgba(255,255,255,0.4);padding:4px 0">${shown || '<span style="color:#555">Soren</span>'}</div>
        <div style="font-size:11px;color:#888;margin-top:10px">Type letters · Backspace deletes · Enter confirms${this.playerName ? '' : ' (blank = Soren)'} · Esc skips all</div>
      `;
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
        return `<div style="color:${color};font-size:14px;margin:3px 0"><span style="display:inline-block;width:18px">${prefix}</span>${JOBS[j].name}</div>`;
      }).join('');
      this.panelDiv.innerHTML = `
        <div style="font-size:18px;color:#ffff00;margin-bottom:6px">Choose your path — ${this.playerName}</div>
        <div style="display:flex;gap:24px">
          <div style="min-width:180px">${rows}</div>
          <div style="flex:1;font-size:12px;color:#ccc">
            <div style="color:#fff;font-weight:bold;margin-bottom:4px">${job.name}</div>
            <div style="color:#aaa;margin-bottom:8px">${job.description}</div>
            <div style="font-size:11px;color:#888;margin-bottom:8px">HP ${stats.hp} · MP ${stats.mp} · ATK ${stats.atk} · DEF ${stats.def} · MAG ${stats.mag} · AGI ${stats.agi}</div>
            <div style="font-size:11px;color:#6f6f9f;font-style:italic">${texture}</div>
          </div>
        </div>
        <div style="font-size:11px;color:#888;margin-top:14px">↑↓ choose · Enter begin · Esc back</div>
      `;
    }
  }
}