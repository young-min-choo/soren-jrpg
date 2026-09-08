/**
 * Test hooks — exposes game internals to the E2E suite.
 * Active ONLY when the page URL has ?test=1 — normal players never get it.
 * Read/write only; contains no game logic of its own.
 */
import GameState from './game/GameState.js';
import { getStatsForLevel } from './game/JobData.js';
import { SaveSystem } from './game/SaveSystem.js';

export function installTestHooks(game) {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('test')) return;

  // ?skipIntro=1 — fast path for the phase-1-6 suites: every GameState.reset
  // (i.e. every new-game flow completion) re-marks the intro as played, so
  // the Overworld boots straight into gameplay without the intro cutscene.
  if (params.has('skipIntro')) {
    const origReset = GameState.reset.bind(GameState);
    GameState.reset = (...args) => {
      origReset(...args);
      GameState.setFlag('introDone', true);
    };
  }

  const scene = (key) => game.scene.getScene(key);
  const activeSceneKey = () => {
    const scenes = ['NewGameFlow', 'Overworld', 'Town', 'Dungeon', 'Embers', 'Battle', 'Menu', 'Dialogue', 'Title'];
    return scenes.find((k) => {
      const s = game.scene.getScene(k);
      return s && s.scene.isActive();
    }) || null;
  };

  window.__soren = {
    game,
    GameState,
    SaveSystem,
    getStatsForLevel,
    scene,
    activeSceneKey,

    // Party panel shows real positions; tile helper for teleporting (field scenes)
    // Uses body.reset() so the Arcade Physics body AND sprite move together —
    // setting sprite.x/y directly gets overridden by the body on the next step.
    teleport(sceneKey, tileX, tileY, tileSize = 32) {
      const s = scene(sceneKey);
      const x = tileX * tileSize + tileSize / 2;
      const y = tileY * tileSize + tileSize / 2;
      if (s.player.body) { s.player.body.reset(x, y); }
      s.player.x = x;
      s.player.y = y;
      s.player.setVelocity(0, 0);
      if (s._lastPlayerX !== undefined) { s._lastPlayerX = x; s._lastPlayerY = y; }
    },

    // Force a battle with chosen enemy types (bypasses random encounter RNG)
    startBattle(sceneKey, enemies, extra = {}) {
      const s = scene(sceneKey);
      s.transitioning = false;
      s.scene.launch('Battle', { returnScene: sceneKey, enemies, ...extra });
      s.scene.pause();
    },

    // Make the party reliably winnable for battle-flow tests
    godMode() {
      for (const char of GameState.get().party) {
        const stats = getStatsForLevel(char.job, 20);
        Object.assign(char, stats, { maxHp: stats.hp, maxMp: stats.mp, hp: stats.hp, mp: stats.mp, level: 20, alive: true });
      }
    },

    // Drain the party for lose-path tests: nearly dead AND weak,
    // so the enemy reliably wipes them (a full-strength party would
    // one-shot everything and win instead).
    drainMode() {
      for (const char of GameState.get().party) {
        char.hp = 1; char.mp = 0;
        char.atk = 1; char.mag = 1; char.agi = 1;
      }
    },

    // Give items for item-use tests
    giveItem(name, qty = 1) { GameState.addItem(name, qty); },

    // Read the current battle's state for assertions
    battleSnapshot() {
      const b = scene('Battle');
      if (!b || !b.scene.isActive()) return null;
      return {
        state: b.battleState,
        log: [...b.battleLog],
        party: b.party.map(p => ({ name: p.name, hp: p.hp, maxHp: p.maxHp, mp: p.mp, alive: p.alive })),
        enemies: b.enemies.map(e => ({ name: e.name, hp: e.hp, maxHp: e.maxHp, alive: e.alive })),
        turnIndex: b.currentTurnIndex,
      };
    },

    // Auto-press Z on an interval (used to mash through battles)
    autoConfirm(ms = 250) {
      const timer = setInterval(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'z' }));
      }, ms);
      return () => clearInterval(timer);
    },

    // Dungeon helpers
    dungeon: {
      blocks() {
        const d = scene('Dungeon');
        return d.blockSprites.map(b => ({ gridX: b.getData('gridX'), gridY: b.getData('gridY') }));
      },
      solved() { return scene('Dungeon').puzzleSolved; },
      bossDefeated() { return scene('Dungeon').bossDefeated; },
      mapTile(x, y) { return scene('Dungeon').mapData[y][x]; },
      // Snap a block onto a switch (test-side puzzle solve; game logic still runs)
      placeBlock(blockIdx, gridX, gridY) {
        const d = scene('Dungeon');
        const b = d.blockSprites[blockIdx];
        b.setData('gridX', gridX); b.setData('gridY', gridY);
        b.x = gridX * 32 + 16; b.y = gridY * 32 + 16;
        d.checkBlockOnSwitch(b, gridX, gridY);
      },
    },

    // Cave of Embers helpers
    embers: {
      bossDefeated() { return scene('Embers').bossDefeated; },
      solved() { return scene('Embers').puzzleSolved; },
      mapTile(x, y) { return scene('Embers').mapData[y][x]; },
      switches() { return [...scene('Embers').switchStates]; },
    },
  };
}