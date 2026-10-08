// Reproduce Choo's exact state: his game session had Soren renamed 'Peter'
// via the NEW GAME flow (not skipIntro test default). Check: does the
// new-game-flow battle still find battlesheet_soren_battle?
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  page.on('console', m => { if (m.text().includes('battlesheet')) console.log('[console]', m.text().slice(0,150)); });
  page.on('pageerror', e => console.log('[ERR]', e.message.slice(0,200)));
  await page.goto('http://localhost:5176/?test=1&skipIntro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 15000 });
  await page.keyboard.press('z'); await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.__soren.scene('NewGameFlow'); if (s && s.nameInput) s.nameInput.focus(); });
  await page.keyboard.type('Peter');
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => window.__soren.activeSceneKey() === 'Overworld')) break; }
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime', 'jellyfish']));
  await page.waitForTimeout(1400);
  const info = await page.evaluate(() => {
    const b = window.__soren.scene('Battle');
    return b.playerSprites.map((s, i) => ({ i, tex: s.texture && s.texture.key, hasSheet: !!s._sheet, frame: s.frame && s.frame.name, x: s.x, y: s.y, visible: s.visible, alpha: s.alpha, scale: s.scaleY }));
  });
  console.log(JSON.stringify(info, null, 1));
  await page.screenshot({ path: '/tmp/probe_renamed.png' });
  await browser.close();
})();
