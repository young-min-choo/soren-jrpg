// Verify the animated gestures: trigger Aria cast (sheet frame 3 = arms raised)
// and Soren attack (slash frames), capture mid-gesture frames as evidence.
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
    const soren = b.playerSprites[0];
    // CAST: run the gesture, sample frame during charge
    b.castGesture(aria, b.enemySprites[0], () => {});
    await new Promise(r => setTimeout(r, 300));
    const castFrame = aria.frame.name || aria.frame.index;
    const castY = aria.y;
    await new Promise(r => setTimeout(r, 400));
    const castRestored = Math.abs(aria.y - aria._homeY) < 0.6 && (aria.frame.index === 1);
    // SLASH: soren attack gesture
    b.strikeGesture(soren, 1, () => {});
    await new Promise(r => setTimeout(r, 100));
    const slashMid = soren.frame.index;
    await new Promise(r => setTimeout(r, 300));
    const slashRestored = soren.frame.index === 1;
    return { castFrame, castRose: aria._homeY - castY > 1, castRestored, slashMid, slashRestored };
  });
  console.log('GESTURES:', JSON.stringify(res));
  await browser.close();
})();
