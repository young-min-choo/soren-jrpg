
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
await page.goto('http://localhost:5176/?test=1&skipIntro=1');
await page.waitForFunction(() => window.__soren && window.__soren.activeSceneKey() === 'Title', { timeout: 15000 });
await page.waitForTimeout(1200);
const t1 = await page.evaluate(() => window.game.scene.getScene('MusicManager')?.currentKey);
await page.keyboard.press('z'); await page.waitForTimeout(700);
await page.keyboard.press('Enter'); await page.waitForTimeout(700);
await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
const t2 = await page.evaluate(() => ({
  scene: window.__soren.activeSceneKey(),
  music: window.game.scene.getScene('MusicManager')?.currentKey,
}));
// battle switch
await page.evaluate(() => window.__soren.startBattle('Overworld', [{ type: 'goblin' }]));
await page.waitForTimeout(1500);
const t3 = await page.evaluate(() => ({
  scene: window.__soren.activeSceneKey(),
  music: window.game.scene.getScene('MusicManager')?.currentKey,
}));
// boss battle switch
console.log('title:', t1, '| overworld:', JSON.stringify(t2), '| battle:', JSON.stringify(t3));
await browser.close();
