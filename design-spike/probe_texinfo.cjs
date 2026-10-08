const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  page.on('pageerror', e => console.log('[ERR]', e.message.slice(0,150)));
  await page.goto('http://localhost:5176/?test=1&skipIntro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 15000 });
  const t = await page.evaluate(() => {
    const b = window.__soren.scene('Boot');
    if (!b || !b.textures) return 'no Boot scene texture access';
    const tex = b.textures.get('fesheet_soren_battle');
    if (!tex) return 'texture not found';
    return { key: tex.key, frames: tex.frameTotal, names: Object.keys(tex.frames).slice(0, 10),
             w: tex.frames[0] ? tex.frames[0].width : null,
             h: tex.frames[0] ? tex.frames[0].height : null };
  });
  console.log(JSON.stringify(t));
  await browser.close();
})();
