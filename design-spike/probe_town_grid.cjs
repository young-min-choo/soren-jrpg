
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:820,height:720}});
  await p.goto('http://localhost:4173/?test=1', {waitUntil:'load'});
  await p.waitForFunction(() => window.game && window.__soren, {timeout:20000});
  await p.waitForFunction(() => window.game.scene.getScene('Title').scene.isActive(), {timeout:15000});
  await p.keyboard.press('z'); await p.waitForTimeout(700);
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.game.scene.getScene('Overworld').scene.isActive(), {timeout:15000});
  for (let i = 0; i < 50; i++) {
    const d = await p.evaluate(() => { const dd = window.__soren.scene('Dialogue'); return !!(dd && dd.scene.isActive()); });
    if (!d) break;
    await p.keyboard.press('z'); await p.waitForTimeout(240);
  }
  await p.evaluate(() => window.__soren.teleport('Overworld', 10, 9));
  await p.keyboard.press('z');
  await p.waitForFunction(() => window.game.scene.getScene('Town').scene.isActive(), {timeout:10000});
  const grid = await p.evaluate(() => {
    const t = window.game.scene.getScene('Town');
    const map = t.generateMapData();
    return map.map(r => r.map(v => String(v).padStart(2)).join('')).join('\n');
  });
  console.log(grid);
  await b.close();
})();