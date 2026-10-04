import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
await page.goto('http://localhost:5176/?test=1');
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForFunction(() => window.__soren && window.__soren.activeSceneKey() === 'Title', { timeout: 15000 });
await page.waitForTimeout(800); // font load + swap

// font loaded check
const fontInfo = await page.evaluate(async () => {
  await document.fonts.ready;
  const loaded = [...document.fonts].map(f => f.family + ':' + f.status);
  return loaded;
});
console.log('FONTS:', JSON.stringify(fontInfo));

const canvas = await page.locator('canvas').boundingBox();
await page.screenshot({ path: 'design-spike/ingame/title_font.png', clip: canvas });
await browser.close();