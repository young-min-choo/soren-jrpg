
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
await page.evaluate(() => window.__soren.teleport('Overworld', 10, 9));
await page.waitForTimeout(400);
await page.keyboard.press('z');
await page.waitForFunction(() => window.__soren.activeSceneKey() === 'Town', { timeout: 10000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.__soren.teleport('Town', 6, 6));
await page.waitForTimeout(300);
await page.keyboard.press('z');
// wait for dialogue to open
try {
  await page.waitForFunction(() => window.__soren.activeSceneKey() === 'Dialogue', { timeout: 5000 });
  console.log('DIALOGUE OPEN');
} catch (e) { console.log('no dialogue:', await page.evaluate(() => window.__soren.activeSceneKey())); }
// typewriter renders — wait a bit for text
await page.waitForTimeout(1200);
const canvas = await page.locator('canvas').boundingBox();
await page.screenshot({ path: 'design-spike/ingame/dialogue_font.png', clip: canvas });
await browser.close();
