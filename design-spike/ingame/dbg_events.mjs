
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5176/?test=1');
await page.waitForFunction(() => window.game?.scene, { timeout: 10000 });
const info = await page.evaluate(() => {
  // Phaser isn't global; access via a live scene's constructor chain
  const s = window.game.scene.getScene('Title') || window.game.scene.getScene('Boot');
  const mgr = window.game.scene;
  const eventNames = [];
  try {
    for (const k of Object.keys(mgr.events ? mgr.events._events || {} : {})) eventNames.push(k);
  } catch (e) { eventNames.push('err:' + e.message); }
  // try importing via dynamic import from the dev server
  return { mgrEventNames: eventNames.slice(0, 40), sceneCount: mgr.keys ? Object.keys(mgr.keys).length : -1 };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
