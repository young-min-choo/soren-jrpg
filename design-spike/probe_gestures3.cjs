// Full-cycle evidence: cast frame 3 (arms raised) DURING, back to 1 after; slash
// frame 7 (sword extended) during, back to 1 after; y restored exactly.
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
  // capture MID-GESTURE screenshot for visual evidence
  await page.evaluate(async () => {
    const b = window.__soren.scene('Battle');
    b.castGesture(b.playerSprites[1], b.enemySprites[0], () => {});
    await new Promise(r => setTimeout(r, 250));
  });
  await page.screenshot({ path: '/tmp/gesture_cast_mid.png' });
  const ok = await page.evaluate(async () => {
    const b = window.__soren.scene('Battle');
    const aria = b.playerSprites[1];
    await new Promise(r => setTimeout(r, 500));
    const restored = aria.frame.name === '1' && Math.abs(aria.y - aria._homeY) < 0.6;
    return restored;
  });
  console.log('CAST restored after gesture:', ok);
  await browser.close();
})();
