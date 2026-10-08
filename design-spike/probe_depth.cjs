// Verify back-row depth fix: 3 slimes, back slime must render BEHIND front
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
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime', 'slime', 'slime']));
  await page.waitForTimeout(1200);
  const depth = await page.evaluate(() => {
    const b = window.__soren.scene('Battle');
    return b.enemySprites.map(s => ({ y: s.y, depth: s.depth }));
  });
  console.log('depths [y, depth]:', JSON.stringify(depth));
  await page.screenshot({ path: '/tmp/depth_check.png' });
  await browser.close();
})();
