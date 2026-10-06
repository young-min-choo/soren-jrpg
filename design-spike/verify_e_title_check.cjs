// E closeout: reproduce the queued Title-overlay oddity — enter dungeon, screenshot,
// check for Title DOM text leaking over the dungeon view.
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

  // Enter the dungeon via teleport + marker
  await page.evaluate(() => { window.__soren.teleport('Overworld', 10, 9); });
  await page.waitForTimeout(300);
  await page.keyboard.press('z'); await page.waitForTimeout(600);
  await page.keyboard.press('z'); await page.waitForTimeout(1500);
  const sceneKey = await page.evaluate(() => window.__soren.activeSceneKey ? window.__soren.activeSceneKey() : 'unknown');
  const titleActive = await page.evaluate(() => window.game.scene.getScene('Title').scene.isActive());
  // Inspect DOM overlays: any element containing SOREN / Press z text?
  const overlayText = await page.evaluate(() => {
    const hits = [];
    document.querySelectorAll('#game-container div').forEach(d => {
      const t = (d.textContent || '').trim();
      if (t && (t.includes('SOREN') || t.includes('Press z to Start')) && d.offsetParent !== null) {
        hits.push({ text: t.slice(0, 40), vis: getComputedStyle(d).display, z: getComputedStyle(d).zIndex });
      }
    });
    return hits;
  });
  await page.screenshot({ path: 'design-spike/e_dungeon_title_check.png' });
  console.log('scene:' + sceneKey, 'titleActive:' + titleActive);
  console.log('leaked overlays:' + JSON.stringify(overlayText));
  console.log('ERRORS:' + (errors.join(' | ') || 'none'));
  await browser.close();
})();