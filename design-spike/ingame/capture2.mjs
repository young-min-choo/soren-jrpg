
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
await page.goto('http://localhost:5176/?test=1&skipIntro=1');
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForFunction(() => window.__soren && window.game?.scene, { timeout: 15000 });
await page.keyboard.press('z'); await page.waitForTimeout(400);
await page.keyboard.press('Enter'); await page.waitForTimeout(250);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__soren.activeSceneKey() === 'Overworld', { timeout: 15000 });
await page.waitForTimeout(600);
// teleport to the desert region to verify new tiles render (indices 7-9)
await page.evaluate(() => window.__soren.teleport('Overworld', 8, 20));
await page.waitForTimeout(400);
const canvas = await page.locator('canvas').boundingBox();
await page.screenshot({ path: 'design-spike/ingame/ingame_desert.png', clip: canvas });
// back to grasslands
await page.evaluate(() => window.__soren.teleport('Overworld', 10, 10));
await page.waitForTimeout(400);
await page.screenshot({ path: 'design-spike/ingame/ingame_grass.png', clip: canvas });
// tile check: what texture does the ground layer use?
const info = await page.evaluate(() => {
  const ow = window.__soren.scene('Overworld');
  return { texture: ow.groundLayer.tileset ? ow.groundLayer.tileset[0]?.key : 'n/a' };
});
console.log('LAYER:', JSON.stringify(info));
await browser.close();
