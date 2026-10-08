// Verify all 3 fixes: (1) cast descent restore, (2) idle breathing moves
// sprites over time, (3) menu shows portrait canvases not initial boxes.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  page.on('pageerror', e => console.log('[ERR]', e.message.slice(0,200)));
  await page.goto('http://localhost:5176/?test=1&skipIntro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 15000 });
  await page.keyboard.press('z'); await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.__soren.scene('NewGameFlow'); if (s && s.nameInput) s.nameInput.focus(); });
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => window.__soren.activeSceneKey() === 'Overworld')) break; }
  await page.waitForTimeout(500);

  // (2) idle breathing: enter battle, sample sprite positions over 700ms
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime', 'bat']));
  await page.waitForTimeout(1000);
  const breathe = await page.evaluate(async () => {
    const b = window.__soren.scene('Battle');
    const s = b.enemySprites[0];
    const y1 = s.y, sy1 = s.scaleY;
    await new Promise(r => setTimeout(r, 450));
    return { y1, y2: s.y, sy1, sy2: s.scaleY, moved: Math.abs(s.y - y1) > 0.2 || Math.abs(s.scaleY - sy1) > 0.005, homeY: s._homeY };
  });
  console.log('BREATHE:', JSON.stringify(breathe));

  // (1) cast descent: give Aria MP, cast Heal on self, check y returns to homeY
  const cast = await page.evaluate(async () => {
    const b = window.__soren.scene('Battle');
    const aria = b.playerSprites[1];
    const homeY = aria._homeY;
    // run the gesture directly: rises then settles back
    b.castGesture(aria, aria, () => {});
    await new Promise(r => setTimeout(r, 400)); // mid-charge
    const midY = aria.y;
    await new Promise(r => setTimeout(r, 400)); // after settle
    return { homeY, midY, endY: aria.y, midRose: homeY - midY > 2, restored: Math.abs(aria.y - homeY) < 0.5 };
  });
  console.log('CAST:', JSON.stringify(cast));

  // (3) menu portraits: open menu, count canvas avatars
  await page.evaluate(() => { const b = window.__soren.scene('Battle'); b.scene.stop(); window.__soren.scene('Overworld').scene.resume(); });
  await page.waitForTimeout(400);
  await page.keyboard.press('x');
  await page.waitForTimeout(600);
  let menuState = await page.evaluate(() => { const m = window.__soren.scene('Menu'); return m && m.menuState; });
  if (!menuState) { await page.keyboard.press('Enter'); await page.waitForTimeout(500); menuState = await page.evaluate(() => { const m = window.__soren.scene('Menu'); return m && m.menuState; }); }
  const avatars = await page.evaluate(() => {
    const m = window.__soren.scene('Menu');
    const canvases = m.menuDiv ? m.menuDiv.querySelectorAll('canvas').length : 0;
    return { canvases, state: m.menuState, html: m.menuDiv && m.menuDiv.innerHTML.slice(0, 80) };
  });
  console.log('MENU:', JSON.stringify(avatars));
  await page.screenshot({ path: '/tmp/fixes_menu.png' });
  await browser.close();
})();
