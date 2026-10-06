// E closeout: enter the Ancient Ruins dungeon (marker at 16,4) and check for
// Title-scene DOM text leaking over the dungeon view (queued historical oddity).
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

  // Teleport NEXT TO the ruins marker (16,4): stand at 16,5 (below it)
  await page.evaluate(() => {
    const ow = window.game.scene.getScene('Overworld');
    window.__soren.teleport('Overworld', 16, 5);
    ow.player.body.reset(16 * 32 + 16, 5 * 32 + 16);
  });
  await page.waitForTimeout(400);
  // walk up one tile onto the marker adjacency then press z
  await page.keyboard.down('w'); await page.waitForTimeout(380); await page.keyboard.up('w');
  await page.waitForTimeout(300);
  await page.keyboard.press('z'); await page.waitForTimeout(1400);
  const state = await page.evaluate(() => {
    const sm = window.game.scene;
    const dungeon = sm.getScene('Dungeon');
    const title = sm.getScene('Title');
    return {
      dungeonActive: dungeon ? dungeon.scene.isActive() : false,
      titleActive: title.scene.isActive(),
      titleDomChildren: Array.from(document.querySelectorAll('#game-container div'))
        .filter(d => d.offsetParent !== null && /SOREN|Press z/i.test(d.textContent || ''))
        .map(d => (d.textContent || '').trim().slice(0, 30)),
    };
  });
  await page.screenshot({ path: 'design-spike/e_dungeon_title_check2.png' });
  console.log(JSON.stringify(state));
  console.log('ERRORS:' + (errors.join(' | ') || 'none'));
  await browser.close();
})();