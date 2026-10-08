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
    const s = b.playerSprites[0];
    const out = [];
    b.strikeGesture(s, 1, () => {});
    for (let i = 0; i < 11; i++) {
      out.push([s.frame.name, Math.round(s.x)]);
      await new Promise(r2 => setTimeout(r2, 55));
    }
    return out;
  });
  console.log('SAMPLES [frame,x]:', JSON.stringify(samples));
  await browser.close();
})();
