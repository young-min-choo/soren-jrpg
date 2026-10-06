
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({viewport:{width:1280,height:820}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:4173/?test=1');
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.__soren.teleport('Town', 12, 10));
  await p.waitForTimeout(900);
  await p.keyboard.press('z'); await p.waitForTimeout(500);
  await p.keyboard.press('ArrowUp'); await p.waitForTimeout(350);
  await p.keyboard.press('z'); await p.waitForTimeout(800);
  await p.screenshot({path: '/tmp/soren_shots/dialogue_portrait.png'});
  const txt = await p.evaluate(() => {
    const el = [...document.querySelectorAll('#game-container div')].find(d => d.textContent && d.textContent.length > 40);
    return el ? el.textContent.slice(0, 100) : '(none)';
  });
  console.log('text:', txt, '| pageerrors:', errs.length);
  await b.close();
})();