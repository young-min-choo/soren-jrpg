// Verify: lunge at BACK-row enemy keeps party sprite in FRONT (depth 30 > 20)
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
  const res = await page.evaluate(() => {
    const b = window.__soren.scene('Battle');
    return { pd: b.playerSprites.map(s => s.depth), ed: b.enemySprites.map(s => s.depth) };
  });
  console.log('DEPTHS:', JSON.stringify(res));
  await browser.close();
})();
