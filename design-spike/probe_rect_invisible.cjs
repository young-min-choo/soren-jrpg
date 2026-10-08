// THE RECT THEORY: spriteKey='soren' (stale save) → texKey bsprite_soren missing
// → RECT fallback #4488ff 20x28 at x=40,y=120... on Choo's bg = visible-ish?
// Actually check: is the rect color the reason it disappears? Simulate:
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
  // force stale spriteKey on party[0]
  await page.evaluate(() => { const gs = window.__soren.GameState.get(); gs.party[0].spriteKey = 'soren'; });
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime']));
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const b = window.__soren.scene('Battle');
    const s = b.playerSprites[0];
    return { tex: s.texture && s.texture.key, isRect: !s._isSprite, fill: s.fillColor, w: s.width, h: s.height, vis: s.visible };
  });
  console.log('stale spriteKey →', JSON.stringify(info));
  await page.screenshot({ path: '/tmp/rect_invisible.png' });
  await browser.close();
})();
