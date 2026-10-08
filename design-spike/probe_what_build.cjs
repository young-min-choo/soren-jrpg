// What does the dev server at :5173 actually SERVE right now?
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  page.on('pageerror', e => console.log('[ERR]', e.message.slice(0,150)));
  await page.goto('http://localhost:5173/?test=1&skipIntro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 20000 });
  await page.keyboard.press('z'); await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.__soren.scene('NewGameFlow'); if (s && s.nameInput) s.nameInput.focus(); });
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => window.__soren.activeSceneKey() === 'Overworld')) break; }
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime']));
  await page.waitForTimeout(1400);
  const res = await page.evaluate(async () => {
    const b = window.__soren.scene('Battle');
    const s0 = b.playerSprites[0];
    const sheetResp = await fetch('/sprites/battle/sheets/soren_battle.png');
    return { tex: s0.texture.key, hasSheetSprite: !!s0._sheet, sheetHttp: sheetResp.status,
             isImage: s0.__proto__.constructor.name };
  });
  console.log('DEV 5173:', JSON.stringify(res));
  await page.screenshot({ path: '/tmp/dev5173_battle.png' });
  await browser.close();
})();
