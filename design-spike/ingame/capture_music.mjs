
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
await page.goto('http://localhost:5176/?test=1&skipIntro=1');
await page.waitForSelector('canvas', { timeout: 15000 });
await page.waitForFunction(() => window.__soren && window.__soren.activeSceneKey() === 'Title', { timeout: 15000 });
// user gesture to unlock audio
await page.keyboard.press('z'); await page.waitForTimeout(600);
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
await page.waitForFunction(() => window.__soren.activeSceneKey() === 'Overworld', { timeout: 15000 });
await page.waitForTimeout(800);
// check music state
const music = await page.evaluate(() => {
  const mm = window.game.scene.getScene('MusicManager');
  return mm ? { active: mm.scene.isActive(), currentKey: mm.currentKey, hasAudio: !!mm.audio, paused: mm.audio?.paused, src: mm.audio?.src?.split('/').pop() } : 'NOT STARTED';
});
console.log('MUSIC:', JSON.stringify(music));
// audio elements playing?
const playing = await page.evaluate(() => {
  const auds = [...document.querySelectorAll('audio')].map(a => ({ src: a.src.split('/').pop(), paused: a.paused, loop: a.loop, vol: a.volume }));
  return auds;
});
console.log('AUDIO ELEMENTS:', JSON.stringify(playing));
const canvas = await page.locator('canvas').boundingBox();
await page.screenshot({ path: 'design-spike/ingame/overworld_music.png', clip: canvas });
await browser.close();
