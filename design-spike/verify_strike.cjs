// Capture the strike moment: drive a battle, screenshot at the snap frame.
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'https://soren-jrpg.vercel.app/?test=1';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 820, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game && window.__soren, { timeout: 20000 });
  await page.waitForFunction(() => window.game.scene.getScene('Title').scene.isActive(), { timeout: 15000 });

  await page.keyboard.press('z'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.scene.getScene('Overworld').scene.isActive(), { timeout: 15000 });
  for (let i = 0; i < 45; i++) {
    const active = await page.evaluate(() => !!(window.__soren.scene('Dialogue') && window.__soren.scene('Dialogue').scene.isActive()));
    if (!active) break;
    await page.keyboard.press('z'); await page.waitForTimeout(260);
  }

  // 1-HP slime for fast kill; force battle
  await page.evaluate(() => {
    const gs = window.__soren.GameState.get();
    // no-op — enemies set via launch data
  });
  await page.evaluate(() => {
    const ow = window.game.scene.getScene('Overworld');
    ow.scene.launch('Battle', { returnScene: 'Overworld', enemies: ['slime', 'slime'] });
    ow.scene.pause();
  });
  await page.waitForFunction(() => window.game.scene.getScene('Battle').scene.isActive(), { timeout: 10000 });
  await page.waitForTimeout(900);

  // FIGHT → confirm; capture DURING the strike window (lunge 400ms + lean 110 + snap 90)
  await page.keyboard.press('z'); await page.waitForTimeout(350);
  const shotPromise = page.evaluate(() => {
    // timestamp the strike: the lean happens right after lunge completes (~400ms after execute)
    return performance.now();
  });
  await page.keyboard.press('z');
  // lunge≈400ms, lean 110ms → snap ≈ 400+110 = 510ms after execute; catch ~430ms in (lean tail)
  await page.waitForTimeout(430);
  await page.screenshot({ path: '/tmp/soren_shots/06_strike_windup.png' });
  await page.waitForTimeout(160); // now in snap/hold
  await page.screenshot({ path: '/tmp/soren_shots/07_strike_snap.png' });
  await page.waitForTimeout(300); // slash arc visible zone
  await page.screenshot({ path: '/tmp/soren_shots/08_impact.png' });

  const state = await page.evaluate(() => {
    const b = window.game.scene.getScene('Battle');
    return { state: b.battleState, log: (b.battleLog || []).slice(-3) };
  });
  console.log('state:', JSON.stringify(state));
  console.log('pageerrors:', errors.length ? errors : 'NONE');
  await browser.close();
})();