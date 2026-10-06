// E closeout: capture thunder_ogre battle sprite in-game (pedestal fix verification).
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'http://localhost:4173/?test=1';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 820, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game && window.__soren, { timeout: 20000 });
  await page.waitForFunction(() => window.game.scene.getScene('Title').scene.isActive(), { timeout: 15000 });

  await page.keyboard.press('z'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.scene.getScene('Overworld').scene.isActive(), { timeout: 15000 });
  for (let i = 0; i < 45; i++) {
    const active = await page.evaluate(() => !!(window.__soren.scene('Dialogue') && window.__soren.scene('Dialogue').scene.isActive()));
    if (!active) break;
    await page.keyboard.press('z'); await page.waitForTimeout(260);
  }

  await page.evaluate(() => {
    const ow = window.game.scene.getScene('Overworld');
    ow.scene.launch('Battle', { returnScene: 'Overworld', enemies: ['thunderOgre'] });
    ow.scene.pause();
  });
  await page.waitForFunction(() => window.game.scene.getScene('Battle').scene.isActive(), { timeout: 10000 });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: 'design-spike/e_thunder_ogre_ingame.png' });
  const errOut = errors.join(' | ');
  console.log('ERRORS:' + (errOut || 'none'));
  await browser.close();
})();