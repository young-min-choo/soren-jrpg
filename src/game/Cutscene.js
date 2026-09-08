/**
 * Cutscene — minimal script runner for story sequences.
 * A cutscene is an array of steps; each step is a function
 * (scene, ctx) => Promise. The runner locks field input while
 * playing, restores it afterwards, and hides the hint HUD.
 *
 * No JSON VM — steps are composed in code (src/game/story.js),
 * same data-module convention as JobData/ItemData. If event count
 * grows large in Phase 8, revisit.
 */
import GameState from './GameState.js';

export async function runCutscene(scene, steps, ctx = {}) {
  const prevLock = scene.dialogueActive;
  scene.dialogueActive = true;
  // Movement/encounter freeze on the host scene (update() bails when set)
  const prevCutsceneLock = scene.cutsceneLock;
  scene.cutsceneLock = true;
  const statusEl = scene.statusDiv;
  const prevStatus = statusEl ? statusEl.textContent : null;
  if (statusEl) statusEl.style.display = 'none';

  // The host field scene's window keydown handler stays attached while the
  // scene is PAUSED (paused ≠ shutdown). While the cutscene's Dialogue overlay
  // is up, every Z/Enter ALSO sets the paused field scene's confirmPressed;
  // when the field resumes it acts on that stale flag (instant re-trigger).
  // The host ignores input while dialogueActive anyway — the real leak is the
  // flag persisting across the boundary. Clear it on both sides of each step.
  const clearHostConfirm = () => {
    if (scene.confirmPressed !== undefined) scene.confirmPressed = false;
    if (scene.keys) scene.keys.up = scene.keys.down = scene.keys.left = scene.keys.right = false;
  };
  clearHostConfirm();

  try {
    for (const s of steps) {
      await s(scene, ctx);
      clearHostConfirm();
    }
  } finally {
    scene.dialogueActive = prevLock;
    scene.cutsceneLock = prevCutsceneLock;
    clearHostConfirm();
    if (statusEl) {
      statusEl.style.display = '';
      if (prevStatus) statusEl.textContent = prevStatus;
    }
  }
  return ctx;
}

// rAF slide used by panCamera — works in RUNNING scenes regardless of
// Phaser tween state (launched-scene tween unreliability, see skill notes).
function slide(from, to, ms, onFrame) {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed < ms) {
        const t = elapsed / ms;
        const ease = t * t * (3 - 2 * t); // smoothstep
        onFrame(from + (to - from) * ease);
        requestAnimationFrame(tick);
      } else {
        onFrame(to);
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

export const step = {
  /** Dialogue pages (overlay scene). Resolves when dialogue closes. */
  say: (speaker, pages) => (scene) =>
    new Promise((resolve) => {
      scene.scene.launch('Dialogue', { speaker, pages, onComplete: () => resolve() });
    }),

  /** Dialogue with branching choices; resolved value lands in ctx.choice. */
  choose: (speaker, pages, choices) => (scene, ctx) =>
    new Promise((resolve) => {
      scene.scene.launch('Dialogue', {
        speaker,
        pages,
        choices,
        onComplete: (value) => {
          ctx.choice = value;
          resolve();
        },
      });
    }),

  /** Set a story flag (default true). */
  flag: (name, value = true) => () => {
    GameState.setFlag(name, value);
  },

  /** Run a nested script only when cond(scene, ctx) is truthy. */
  when: (cond, steps) => async (scene, ctx) => {
    if (await cond(scene, ctx)) {
      for (const s of steps) await s(scene, ctx);
    }
  },

  wait: (ms) => () => new Promise((r) => setTimeout(r, ms)),

  /** Smoothly pan the camera to center on world coords (px). */
  panCamera: (worldX, worldY, ms = 1200) => (scene) => {
    const cam = scene.cameras.main;
    const bounds = cam.getBounds();
    const toX = bounds.width > 0 ? Phaser.Math.Clamp(worldX - cam.width / 2, 0, bounds.width - cam.width) : worldX - cam.width / 2;
    const toY = bounds.height > 0 ? Phaser.Math.Clamp(worldY - cam.height / 2, 0, bounds.height - cam.height) : worldY - cam.height / 2;
    const fromX = cam.scrollX;
    const fromY = cam.scrollY;
    return Promise.all([
      slide(fromX, toX, ms, (x) => cam.setScroll(x, cam.scrollY)),
      slide(fromY, toY, ms, (y) => cam.setScroll(cam.scrollX, y)),
    ]).then(() => cam.setScroll(toX, toY));
  },

  /** Slide a bodyless sprite (NPC/prop) to a tile center. NOT for the
   *  physics-driven player — the Arcade body would snap it back.
   *  Player cutscene movement comes with Phase 8's NPC cast. */
  move: (sprite, tileX, tileY, ms = 500) => () => {
    const toX = tileX * 32 + 16;
    const toY = tileY * 32 + 16;
    return Promise.all([
      slide(sprite.x, toX, ms, (x) => { sprite.x = x; }),
      slide(sprite.y, toY, ms, (y) => { sprite.y = y; }),
    ]).then(() => { sprite.x = toX; sprite.y = toY; });
  },

  /** Escape hatch for one-off effects. */
  run: (fn) => (scene, ctx) => fn(scene, ctx),
};

// Phaser is imported by the bundler here for Math.Clamp only.
import Phaser from 'phaser';