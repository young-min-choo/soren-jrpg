// Real flow: enemy attacked via processNextTurn? Simpler: call executeFight path
// manually via strikeGesture WITH targetX = enemy position - 30:
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
  // capture at contact: windup200+run300+~30ms
  await page.evaluate(() => {
    const b = window.__soren.scene('Battle');
    const s = b.playerSprites[0];
    const enemy = b.enemySprites[0];
    b.strikeGesture(s, 1, () => {}, { targetX: enemy.x - 30 });
  });
  await page.waitForTimeout(560);
  await page.screenshot({ path: '/tmp/trip_contact.png' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/trip_return.png' });
  await browser.close();
})();
