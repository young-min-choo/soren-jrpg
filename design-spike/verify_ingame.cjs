// In-game visual verification: boot → new game → town → screenshot NPCs →
// open dialogue → screenshot portrait. Saves PNGs for inspection.
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'https://soren-jrpg.vercel.app/?test=1';
  const outDir = '/tmp/soren_shots';
  require('fs').mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 820, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game && window.__soren, { timeout: 20000 });
  await page.waitForFunction(() => window.game.scene.getScene('Title').scene.isActive(), { timeout: 15000 });
  await page.screenshot({ path: `${outDir}/01_title.png` });

  // New game: Z → name entry → Enter (default Soren) → job screen → Enter (default job)
  await page.keyboard.press('z');
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.game.scene.getScene('Overworld').scene.isActive(), { timeout: 15000 });
  await page.waitForTimeout(500);

  // Mash through intro cutscene
  for (let i = 0; i < 45; i++) {
    const active = await page.evaluate(() => {
      const d = window.__soren.scene('Dialogue');
      return !!(d && d.scene.isActive());
    });
    if (!active) break;
    await page.keyboard.press('z');
    await page.waitForTimeout(280);
  }

  // Teleport to the town entrance marker and press Z to enter town
  await page.evaluate(() => window.__soren.teleport('Overworld', 10, 9));
  await page.keyboard.press('z');
  await page.waitForFunction(() => window.game.scene.getScene('Town').scene.isActive(), { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/02_town_npcs.png` });

  // Open dialogue with the nearest NPC (Elder at 11,5 — stand below at 11,6)
  await page.evaluate(() => window.__soren.teleport('Town', 11, 6));
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowUp'); // face up
  await page.waitForTimeout(200);
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const d = window.__soren.scene('Dialogue');
    return !!(d && d.scene.isActive() && !d.isTyping);
  }, { timeout: 8000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/03_dialogue_portrait.png` });

  // Verify portrait canvas rendered (not the '?' fallback)
  const portraitInfo = await page.evaluate(() => {
    const d = window.__soren.scene('Dialogue');
    const canvas = d.domElements ? d.domElements[0].querySelector('canvas') : null;
    return {
      hasPortraitCanvas: !!canvas,
      speaker: d.dialogueData.speaker,
    };
  });

  // Close dialogue; screenshot the Job Master NPC too
  for (let i = 0; i < 8; i++) { await page.keyboard.press('z'); await page.waitForTimeout(150); }
  await page.evaluate(() => window.__soren.teleport('Town', 8, 9));
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/04_jobmaster.png` });

  // All NPC textures in use?
  const texReport = await page.evaluate(() => {
    const town = window.game.scene.getScene('Town');
    return town.npcs.map(n => ({
      name: n.getData('name'),
      artKey: n.getData('artKey'),
      texture: n.texture.key,
      isRealArt: n.texture.key.startsWith('npc_'),
    }));
  });

  console.log('portrait:', JSON.stringify(portraitInfo));
  console.log('npcs:', JSON.stringify(texReport, null, 1));
  console.log('pageerrors:', errors.length ? errors : 'NONE');
  await browser.close();
})();