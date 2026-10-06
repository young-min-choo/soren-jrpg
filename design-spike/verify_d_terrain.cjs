// D (terrain) verification: town + overworld + dungeon w/ floor variants
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
  for (let i = 0; i < 50; i++) {
    const d = await page.evaluate(() => { const dd = window.__soren.scene('Dialogue'); return !!(dd && dd.scene.isActive()); });
    if (!d) break;
    await page.keyboard.press('z'); await page.waitForTimeout(240);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/soren_shots/d_overworld.png' });

  // town
  await page.evaluate(() => window.__soren.teleport('Overworld', 10, 9));
  await page.keyboard.press('z');
  await page.waitForFunction(() => window.game.scene.getScene('Town').scene.isActive(), { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/soren_shots/d_town_new.png' });

  // dungeon (variants)
  await page.evaluate(() => {
    const sm = window.game.scene;
    sm.stop('Town');
    sm.start('Dungeon');
  });
  await page.waitForFunction(() => window.game.scene.getScene('Dungeon').scene.isActive(), { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/soren_shots/d_dungeon_variants.png' });

  // variant stats: count frames 11/12 (tilemap idx) on the layer
  const stats = await page.evaluate(() => {
    const d = window.game.scene.getScene('Dungeon');
    const layer = d.groundLayer;
    const counts = {};
    for (let y = 0; y < layer.height; y++)
      for (let x = 0; x < layer.width; x++) {
        const t = layer.getTileAt(x, y);
        if (!t) continue;
        const idx = t.index;
        counts[idx] = (counts[idx] || 0) + 1;
      }
    return counts;
  });
  console.log('tile index histogram:', JSON.stringify(stats));
  console.log('pageerrors:', errors.length ? errors : 'NONE');
  await browser.close();
})();