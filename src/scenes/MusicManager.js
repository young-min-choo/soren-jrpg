import Phaser from 'phaser';

/**
 * MusicManager — Phase 9 procedural chiptune playback.
 * A tiny non-rendered scene that persists across scene switches and
 * plays the right theme per active scene. Uses HTMLAudio elements
 * (simple, reliable, loop-perfect files).
 *
 * Theme map (public/audio/*.ogg):
 *   Title -> title, Town* -> village, Overworld -> overworld,
 *   Dungeon/Embers/TideTemple/HollowDeep/StormSpire/ConduitGate/Conduit
 *     -> per-dungeon themes, Battle -> battle (boss -> boss_theme),
 *   Menu/Dialogue -> inherits current field theme.
 */
const THEME_FOR_SCENE = {
  Title: 'title_theme',
  NewGameFlow: 'title_theme',
  Overworld: 'overworld_theme',
  Town: 'village_theme',
  PortMeridian: 'port_theme',
  Stonewatch: 'stonewatch_theme',
  Skyhold: 'skyhold_theme',
  Aurelia: 'skyhold_theme',
  Dungeon: 'dungeon_theme',
  Embers: 'embers_theme',
  TideTemple: 'tide_theme',
  HollowDeep: 'hollow_theme',
  StormSpire: 'spire_theme',
  ConduitGate: 'boss_theme',
  Conduit: 'betrayal_theme',
  // Battle/Menu/Dialogue handled dynamically
};

export default class MusicManager extends Phaser.Scene {
  constructor() {
    super('MusicManager');
    this.currentKey = null;
    this.audio = null;
  }

  create() {
    // We are the first scene in the array, so Phaser auto-starts US instead of
    // Boot. Kick the normal boot chain off.
    if (!this.scene.manager.getScene('Boot').scene.isActive()) {
      this.scene.launch('Boot');
    }
    // Watch for the active scene every 500ms (simple, robust vs event races).
    // Menu/Dialogue/Battle overlays don't change the underlying field theme
    // unless they're the top-most scene for a while.
    this._watchTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        const active = this.scene.manager.getScenes(true).filter((s) =>
          s.scene.key !== 'MusicManager' && s.scene.key !== 'Boot');
        // prefer the last-started gameplay scene (arrays preserve start order)
        const pick = active[active.length - 1] || null;
        const key = pick ? pick.scene.key : null;
        if (key && key !== this._lastSeenKey) {
          this._lastSeenKey = key;
          this.onSceneStart(key);
        }
      },
    });
  }

  onSceneStart(sceneKey) {
    let theme = THEME_FOR_SCENE[sceneKey];
    if (sceneKey === 'Battle') {
      const battle = this.scene.get('Battle');
      const isBoss = battle?.battleData?.isBoss ||
        (battle?.enemies ?? []).some((e) => e.boss);
      theme = isBoss ? 'boss_theme' : 'battle_theme';
    }
    if (sceneKey === 'Menu' || sceneKey === 'Dialogue') return; // keep field theme
    if (!theme || theme === this.currentKey) return;
    this.play(theme);
  }

  play(key, { volume = 0.5 } = {}) {
    if (this.currentKey === key) return;
    this.stop();
    this.currentKey = key;
    const a = new Audio(`audio/${key}.ogg`);
    a.loop = true;
    a.volume = volume;
    // HTMLAudio play() is async; catch autoplay blocks (user gesture needed)
    a.play().catch(() => {
      // Browser autoplay policy: wait for first user gesture, then retry
      const resume = () => {
        a.play().catch(() => {});
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('pointerdown', resume, { once: true });
      window.addEventListener('keydown', resume, { once: true });
    });
    this.audio = a;
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    this.currentKey = null;
  }
}