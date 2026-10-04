
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  await page.goto('http://localhost:5176/?test=1&skipIntro=1');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => window.__soren && window.game?.scene, { timeout: 15000 });
  await page.keyboard.press('z'); await page.waitForTimeout(400);
  await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__soren.activeSceneKey() === 'Overworld', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(350);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(150);
  const canvas = await page.locator('canvas').boundingBox();
  await page.screenshot({ path: 'design-spike/ingame/ingame_overworld.png', clip: canvas });
  const texInfo = await page.evaluate(() => {
    const ow = window.__soren.scene('Overworld');
    return { texture: ow.player.texture.key, frame: String(ow.player.frame.name) };
  });
  console.log('TEX:', JSON.stringify(texInfo));
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(120);
  await page.screenshot({ path: 'design-spike/ingame/ingame_walk.png', clip: canvas });
  await page.keyboard.up('ArrowDown');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
