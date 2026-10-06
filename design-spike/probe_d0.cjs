// Deep probe: why are boss/blocks still rectangles? Inspect textures + strip width at runtime.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 820, height: 720 } });
  await page.goto('http://localhost:4173/?test=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.game && window.__soren, { timeout: 20000 });
  await page.waitForFunction(() => window.game.scene.getScene('Title').scene.isActive(), { timeout: 15000 });
  await page.keyboard.press('z'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.scene.getScene('Overworld').scene.isActive(), { timeout: 15000 });
  for (let i = 0; i < 50; i++) {
    const d = await page.evaluate(() => { const dd = window.__soren.scene('Dialogue'); return !!(dd && dd.scene.isActive()); });
    if (!d) break;
    await page.keyboard.press('z'); await page.waitForTimeout(220);
  }
  await page.evaluate(() => { window.game.scene.stop('Overworld'); window.game.scene.start('Dungeon'); });
  await page.waitForFunction(() => window.game.scene.getScene('Dungeon').scene.isActive(), { timeout: 10000 });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const out = { textures: [] };
    ['dgn_ember','dgn_tide','dgn_hollow','dgn_spire','dgn_ruins'].forEach(k => {
      if (window.game.textures.exists(k)) {
        const t = window.game.textures.get(k);
        out.textures.push({ key: k, w: t.source[0].width, h: t.source[0].height,
          frames: t.getFrameNames() });
      } else out.textures.push({ key: k, missing: true });
    });
    const d = window.game.scene.getScene('Dungeon');
    out.bossIsImage = !!(d.bossSprite && d.bossSprite.texture);
    out.blockCount = (d.blockSprites || []).length;
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();