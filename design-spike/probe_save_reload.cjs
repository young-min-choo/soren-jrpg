// Save→reload with renamed hero: does the battle sprite SURVIVE the load?
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  page.on('pageerror', e => console.log('[ERR]', e.message.slice(0,200)));
  await page.goto('http://localhost:5176/?test=1&skipIntro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 15000 });
  await page.keyboard.press('z'); await page.waitForTimeout(400);
  await page.evaluate(() => { const s = window.__soren.scene('NewGameFlow'); if (s && s.nameInput) s.nameInput.focus(); });
  await page.keyboard.type('Peter');
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => window.__soren.activeSceneKey() === 'Overworld')) break; }
  // save
  await page.evaluate(() => window.__soren.SaveSystem.save(1));
  await page.waitForTimeout(300);
  // reload page
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 15000 });
  await page.waitForTimeout(800);
  const loaded = await page.evaluate(() => {
    const GS = window.__soren.GameState;
    const p = GS.get().party.map(c => ({ name: c.name, spriteKey: c.spriteKey }));
    return p;
  });
  console.log('after reload:', JSON.stringify(loaded));
  await browser.close();
})();
