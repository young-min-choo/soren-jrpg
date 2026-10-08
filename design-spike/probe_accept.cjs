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
    const aria = b.playerSprites[1], soren = b.playerSprites[0];
    b.castGesture(aria, b.enemySprites[0], () => {});
    await new Promise(r => setTimeout(r, 260));
    const castMid = aria.frame.name;
    await new Promise(r => setTimeout(r, 460));
    const castRestored = aria.frame.name == 1 && Math.abs(aria.y - aria._homeY) < 0.5;
    b.strikeGesture(soren, 1, () => {});
    await new Promise(r => setTimeout(r, 115));
    const slashLean = soren.frame.name;
    await new Promise(r => setTimeout(r, 115));
    const slashStrike = soren.frame.name;
    await new Promise(r => setTimeout(r, 400));
    const slashRestored = soren.frame.name == 1 && Math.abs(soren.y - soren._homeY) < 1.9;
    return { castMid, castRestored, slashLean, slashStrike, slashRestored };
  });
  console.log('ACCEPT:', JSON.stringify(res));
  await page.screenshot({ path: '/tmp/gesture_final.png' });
  await browser.close();
})();
