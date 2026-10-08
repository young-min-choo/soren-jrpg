// Correct frame readout: frame.name gives string; sample during and AFTER
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
    b.castGesture(aria, b.enemySprites[0], () => {});
    await new Promise(r => setTimeout(r, 260));
    const castMid = aria.frame.name;
    await new Promise(r => setTimeout(r, 450));
    const castAfter = aria.frame.name;
    b.strikeGesture(soren, 1, () => {});
    await new Promise(r => setTimeout(r, 200));
    const slashMid = soren.frame.name;
    await new Promise(r => setTimeout(r, 400));
    const slashAfter = soren.frame.name;
    return { castMid, castAfter, slashMid, slashAfter,
      castRose: Math.round(aria.y), ariaHome: Math.round(aria._homeY) };
  });
  console.log(JSON.stringify(res));
  await browser.close();
})();
