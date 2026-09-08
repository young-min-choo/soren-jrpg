// Shared helpers for the Soren E2E suite.
// The game is keyboard-driven: all input is dispatched as real DOM key events
// on window (same channel the scenes listen on).

export const GAME_URL = 'http://localhost:5176/?test=1';
export const GAME_URL_SKIP_INTRO = 'http://localhost:5176/?test=1&skipIntro=1';

export async function boot(page, opts = {}) {
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });
  await page.goto(opts.newGame ? GAME_URL_SKIP_INTRO : GAME_URL);
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => window.__soren && window.game?.scene, { timeout: 15000 });
  // Wait for Phaser 'ready' + Boot→Title transition
  await page.waitForFunction(() => window.__soren.activeSceneKey() !== null, { timeout: 15000 });

  if (opts.newGame) {
    // Phase 7 flow: Z opens NewGameFlow; blank name + default job.
    // (URL carries skipIntro=1 so no cutscene — straight to playable Overworld.)
    await page.keyboard.press('z');
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter'); // blank name = Soren
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter'); // Warrior default
    await expectScene(page, 'Overworld', 15000);
    await page.waitForTimeout(400);
  }
  return errors;
}

// After page.reload(), the game is back at Title. Runs the fast new-game
// flow (same as boot's newGame path) for tests that reload mid-suite.
export async function newGameFast(page) {
  await page.keyboard.press('z');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  await expectScene(page, 'Overworld', 15000);
  await page.waitForTimeout(400);
}

export function press(page, key, times = 1, delayMs = 60) {
  // Real key events via page.keyboard → goes through the browser's own
  // keydown/keyup pipeline on window, exactly like a human player.
  return page.keyboard.press(key, { delay: delayMs * 0 + undefined }); // placeholder, replaced below
}

export async function tap(page, key, times = 1, delayMs = 80) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(delayMs);
  }
}

export async function activeScene(page) {
  return page.evaluate(() => window.__soren.activeSceneKey());
}

export async function expectScene(page, key, timeoutMs = 15000) {
  await page.waitForFunction(
    (k) => window.__soren.activeSceneKey() === k,
    key,
    { timeout: timeoutMs },
  );
}

export async function snap(page) {
  return page.evaluate(() => window.__soren.battleSnapshot());
}

export async function evalIn(page, fn) {
  return page.evaluate(fn);
}