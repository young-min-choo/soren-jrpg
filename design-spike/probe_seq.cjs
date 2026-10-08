// 6-frame attack sequence: capture frames at each phase + verify sequence playback
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  await page.goto('http://localhost:5176/?test=1&skipIntro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 15000 });
  await page.keyboard.press('z'); await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.__soren.scene('NewGameFlow'); if (s && s.nameInput) s.nameInput.focus(); });
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => window.__soren.activeSceneKey() === 'Overworld')) break; }
  await page.evaluate(() => window.__soren.startBattle('Overworld', ['slime']));
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    const b = window.__soren.scene('Battle');
    const s = b.playerSprites[0];
    const out = { startFrame: s.frame.name, homeY: s._homeY };
    b.strikeGesture(s, 1, () => {});
    await new Promise(r2 => setTimeout(r2, 60));
    out.stance = [s.frame.name, Math.round(s.x)];
    await new Promise(r2 => setTimeout(r2, 100));
    out.dash = [s.frame.name, Math.round(s.x)];
    await new Promise(r2 => setTimeout(r2, 100));
    out.contact = [s.frame.name, Math.round(s.x)];
    await new Promise(r2 => setTimeout(r2, 130));
    out.follow = [s.frame.name, Math.round(s.x)];
    await new Promise(r2 => setTimeout(r2, 250));
    out.ret = [s.frame.name, Math.round(s.x)];
    await new Promise(r2 => setTimeout(r2, 200));
    out.final = [s.frame.name, Math.round(s.x), s.y];
    return out;
  });
  console.log('SEQ:', JSON.stringify(r));
  await page.screenshot({ path: '/tmp/seq_final.png' });
  await browser.close();
})();
