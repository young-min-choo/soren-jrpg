// THE renamed + job-select path with real battle, all sprites:
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  page.on('pageerror', e => console.log('[ERR]', e.message.slice(0,200)));
  await page.goto('http://localhost:5176/?test=1&skipIntro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 15000 });
  await page.keyboard.press('z'); await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.__soren.scene('NewGameFlow'); if (s && s.nameInput) s.nameInput.focus(); });
  await page.keyboard.type('Peter');
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  // first Enter = skip job (default), keep simple; then enter overworld
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => window.__soren.activeSceneKey() === 'Overworld')) break; }
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime', 'slime', 'slime']));
  await page.waitForTimeout(1400);
  const info = await page.evaluate(() => {
    const b = window.__soren.scene('Battle');
    return {
      partyName: b.party[0].name,
      s0: { tex: b.playerSprites[0].texture.key, vis: b.playerSprites[0].visible, f: b.playerSprites[0].frame.name, a: b.playerSprites[0].alpha, z: b.playerSprites[0].depth, x: b.playerSprites[0].x },
    };
  });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: '/tmp/peter_battle.png' });
  await browser.close();
})();
