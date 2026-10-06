// D0 verification: ruins dungeon — capture boss sigil, block, switch, save, exit tiles
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'https://soren-jrpg.vercel.app/?test=1';
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
  // enter dungeon scene directly
  await page.evaluate(() => {
    const sm = window.game.scene;
    sm.stop('Overworld');
    sm.start('Dungeon');
  });
  await page.waitForFunction(() => window.game.scene.getScene('Dungeon').scene.isActive(), { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/soren_shots/d0_ruins_full.png' });

  // teleport around the map to see each special: boss at (8,2), blocks (7,5) (7,8),
  // switches (8,4) (8,9), save (4?,8) — just zoom whole map: use one full shot + a pass over rooms
  const bossVisible = await page.evaluate(() => {
    const d = window.game.scene.getScene('Dungeon');
    const bs = d.bossSprite;
    return { boss: bs && bs.visible, isImage: !!(bs && bs.texture), bossTex: bs && bs.texture ? bs.texture.key : 'rectangle' };
  });
  const blockInfo = await page.evaluate(() => {
    const d = window.game.scene.getScene('Dungeon');
    return (d.blockSprites || []).map(b => b.texture && b.texture.key);
  });
  console.log('boss:', JSON.stringify(bossVisible));
  console.log('blocks:', JSON.stringify(blockInfo));
  console.log('pageerrors:', errors.length ? errors : 'NONE');
  await browser.close();
})();