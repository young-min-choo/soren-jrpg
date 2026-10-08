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
  const r = await page.evaluate(async () => {
    const b = window.__soren.scene('Battle');
    const s = b.playerSprites[0];
    const x0 = s.x;
    b.strikeGesture(s, 1, () => {});
    await new Promise(r2 => setTimeout(r2, 150)); // stance done, dash running
    const midX = s.x;
    await new Promise(r2 => setTimeout(r2, 120)); // landed at contact
    const contactX = s.x;
    await new Promise(r2 => setTimeout(r2, 550)); // settle done
    return { x0, midX, contactX, settled: s.x === x0, frame: s.frame.name,
             sx: s.scaleX };
  });
  console.log('DASH:', JSON.stringify(r));
  await browser.close();
})();
