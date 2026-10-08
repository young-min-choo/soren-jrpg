// Wire probe: swap the player battle sprite to the new sheet-driven sprite
// (12 frames + specials) and screenshot. Pure evidence gathering.
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
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime', 'bat']));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/tmp/battle_sheet_now.png' });
  console.log('frame info:', JSON.stringify(await page.evaluate(() => {
    const b = window.__soren.scene('Battle');
    return b.playerSprites.map(s => ({ y: Math.round(s.y), scaleY: +s.scaleY.toFixed(3), tex: s.texture.key }));
  })));
  await browser.close();
})();
