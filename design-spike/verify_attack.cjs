// Drive a battle via test hooks, capture canvas frames at attack impact to see
// what the animation actually renders (flash? shake? damage number?).
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

  // New game fast-path: Z → Enter → Enter
  await page.keyboard.press('z'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.scene.getScene('Overworld').scene.isActive(), { timeout: 15000 });
  // skip intro
  for (let i = 0; i < 45; i++) {
    const active = await page.evaluate(() => !!(window.__soren.scene('Dialogue') && window.__soren.scene('Dialogue').scene.isActive()));
    if (!active) break;
    await page.keyboard.press('z'); await page.waitForTimeout(260);
  }

  // Force a battle via test hook
  await page.evaluate(() => {
    const ow = window.game.scene.getScene('Overworld');
    ow.scene.launch('Battle', { returnScene: 'Overworld', enemies: ['slime', 'slime'] });
    ow.scene.pause();
  });
  await page.waitForFunction(() => window.game.scene.getScene('Battle').scene.isActive(), { timeout: 10000 });
  await page.waitForTimeout(900);

  // Kill the first slime with Z (FIGHT default) → target select → Z confirm
  // Record frames DURING the attack: capture at ~200ms intervals via toDataURL
  const frames = [];
  await page.evaluate(() => {
    window.__frames = [];
    const canvas = document.querySelector('canvas');
    const t0 = performance.now();
    const grab = () => {
      const t = performance.now() - t0;
      window.__frames.push({ t, data: canvas.toDataURL('image/png').length });
      if (t < 2600) requestAnimationFrame(grab);
    };
    requestAnimationFrame(grab);
  });
  // FIGHT: press Z (action_select → target_select), then Z (execute)
  await page.keyboard.press('z'); await page.waitForTimeout(350);
  await page.keyboard.press('z');
  await page.waitForTimeout(2800);

  // Sample battle state timeline: what battleState was set during the attack?
  const state = await page.evaluate(() => {
    const b = window.game.scene.getScene('Battle');
    return {
      battleState: b.battleState,
      log: b.battleLog ? b.battleLog.slice(-4) : null,
      playerX: b.playerSprites ? b.playerSprites[0].x : null,
      enemy1hp: b.enemies && b.enemies[0] ? b.enemies[0].hp : null,
      dmgDivs: document.querySelectorAll('#game-container div').length,
    };
  });
  console.log('state after attack:', JSON.stringify(state, null, 1));
  console.log('pageerrors:', errors.length ? errors : 'NONE');
  await page.screenshot({ path: '/tmp/soren_shots/05_mid_battle.png' });
  await browser.close();
})();