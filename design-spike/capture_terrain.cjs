// Capture in-game shots of each terrain: overworld, town, ruins dungeon, ember dungeon, spire, tide
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
  // mash through intro dialogue
  for (let i = 0; i < 50; i++) {
    const dlgActive = await page.evaluate(() => {
      const d = window.__soren.scene('Dialogue');
      return !!(d && d.scene.isActive());
    });
    if (!dlgActive) break;
    await page.keyboard.press('z'); await page.waitForTimeout(240);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/soren_shots/t01_overworld.png' });

  // town
  await page.evaluate(() => { window.__soren.teleport('Overworld', 10, 9); });
  await page.keyboard.press('z');
  await page.waitForFunction(() => window.game.scene.getScene('Town').scene.isActive(), { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/soren_shots/t02_town.png' });

  // back to overworld, then dungeons via scene.start on themed scenes
  const dungeonKeys = [['Dungeon', 't03_ruins'], ['Embers', 't04_ember'], ['RelicDungeon', 't05_relic']];
  for (const [key, shot] of dungeonKeys) {
    await page.evaluate((k) => {
      // stop current field scene and start dungeon (via scene keys, Phaser-4 safe)
      sm = window.game.scene;
      ['Town', 'Overworld', 'Dungeon', 'Embers', 'RelicDungeon'].forEach((s2) => {
        try { if (sm.isActive(s2)) sm.stop(s2); } catch (e) {}
      });
      sm.start(k);
    }, key);
    await page.waitForFunction((k) => window.game.scene.getScene(k).scene.isActive(), key, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: `/tmp/soren_shots/${shot}.png` });
  }

  console.log('pageerrors:', errors.length ? errors : 'NONE');
  await browser.close();
})();