// Frame-index sampling (previous probe omitted f by mistake in JSON key order)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  page.on('pageerror', e => console.log('[ERR]', e.message.slice(0,200)));
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
  const res = await page.evaluate(async () => {
    const b = window.__soren.scene('Battle');
    const aria = b.playerSprites[1];
    b.castGesture(aria, b.enemySprites[0], () => {});
    const samples = [];
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 120));
      samples.push([aria.frame.index, Math.round(aria.y * 10) / 10]);
    }
    return samples;
  });
  console.log('[frame, y]:', JSON.stringify(res));
  await browser.close();
})();
