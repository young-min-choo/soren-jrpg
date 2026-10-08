// Live probe: verify current battle scene renders static images and measure
// what a bob loop would look like (y ± 1-2px, ~900ms period).
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
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime']));
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => {
    const b = window.__soren.scene('Battle');
    return { tex: b.enemySprites[0] && b.enemySprites[0].texture.key, y: b.enemySprites[0] && b.enemySprites[0].y };
  });
  console.log('battle sprite:', JSON.stringify(info));
  await page.screenshot({ path: '/tmp/battle_before.png' });
  await browser.close();
})();
