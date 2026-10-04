
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
await page.goto('http://localhost:5176/?test=1&skipIntro=1');
await page.waitForFunction(() => window.__soren && window.__soren.activeSceneKey() === 'Title', { timeout: 15000 });
await page.keyboard.press('z'); await page.waitForTimeout(700);
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.keyboard.press('Enter'); await page.waitForTimeout(2000);
await page.waitForFunction(() => window.__soren.activeSceneKey() === 'Overworld', { timeout: 15000 });
await page.waitForTimeout(500);
const canvas = await page.locator('canvas').boundingBox();

// town with new tiles
await page.evaluate(() => window.__soren.teleport('Overworld', 10, 9));
await page.waitForTimeout(300);
await page.keyboard.press('z'); await page.waitForTimeout(1500);
await page.screenshot({ path: 'design-spike/ingame/town_new_tiles.png', clip: canvas });
console.log('scene:', await page.evaluate(() => window.__soren.activeSceneKey()));

// Ancient Ruins (dgn_ruins theme)
await page.evaluate(() => window.__soren.teleport('Overworld', 16, 5));
await page.waitForTimeout(300);
await page.keyboard.press('z'); await page.waitForTimeout(1500);
console.log('ruins scene:', await page.evaluate(() => window.__soren.activeSceneKey()));
await page.screenshot({ path: 'design-spike/ingame/ruins_theme.png', clip: canvas });
await browser.close();
