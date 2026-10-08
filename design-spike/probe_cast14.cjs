const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  await page.goto('http://localhost:5176/?test=1&skipIntro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 15000 });
  await page.keyboard.press('z'); await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.__soren.scene('NewGameFlow'); if (s && s.nameInput) s.nameInput.focus(); });
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => window.__soren.activeSceneKey() === 'Overworld')) break; }
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime']));
  await page.waitForTimeout(1200);
  const samples = await page.evaluate(async () => {
    const b = window.__soren.scene('Battle');
    const aria = b.playerSprites[1];
    const pre = { tex: aria.texture.key, feCast: aria._feCast, castSheet: aria._castSheet };
    let hitAt = -1;
    b.castGesture(aria, b.enemySprites[0], () => { hitAt = Date.now(); });
    const t0 = Date.now();
    const out = [];
    for (let i = 0; i < 16; i++) {
      out.push([aria.frame.name, Math.round(aria.y)]);
      await new Promise(r => setTimeout(r, 55));
    }
    return { pre, script: out, hitMs: hitAt ? hitAt - t0 : null, post: aria.texture.key };
  });
  console.log('CAST14:', JSON.stringify(samples));
  await browser.close();
})();
