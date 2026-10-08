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
  await page.evaluate(() => {
    const b = window.__soren.scene('Battle');
    const s = b.playerSprites[0];
    b.strikeGesture(s, 1, () => {}, { targetX: b.enemySprites[0].x - 30 });
  });
  // contact beat: frames (1+4+2+2+10+4+4+5 ticks)*16.67 = 533ms → contact at ~540-630ms
  await page.waitForTimeout(655);
  await page.screenshot({ path: '/tmp/atk19_contact.png' });
  await browser.close();
})();
