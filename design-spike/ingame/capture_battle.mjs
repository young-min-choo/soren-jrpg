import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
await page.goto('http://localhost:5176/?test=1&skipIntro=1');
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForFunction(() => window.__soren && window.__soren.activeSceneKey() === 'Title', { timeout: 15000 });
await page.keyboard.press('z'); await page.waitForTimeout(600);
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
await page.waitForFunction(() => window.__soren.activeSceneKey() === 'Overworld', { timeout: 15000 });
await page.waitForTimeout(600);

await page.evaluate(() => {
  window.__soren.startBattle('Overworld', [{ type: 'goblin' }, { type: 'slime' }, { type: 'wisp' }]);
});
await page.waitForFunction(() => window.__soren.activeSceneKey() === 'Battle', { timeout: 10000 });
await page.waitForTimeout(1000);
const canvas = await page.locator('canvas').boundingBox();
await page.screenshot({ path: 'design-spike/ingame/ingame_battle.png', clip: canvas });

const texInfo = await page.evaluate(() => {
  const b = window.__soren.scene('Battle');
  return {
    playerTex: b.playerSprites.map(s => s.texture.key),
    enemyTex: b.enemySprites.map(s => s.texture.key),
  };
});
console.log('TEX:', JSON.stringify(texInfo));
await browser.close();