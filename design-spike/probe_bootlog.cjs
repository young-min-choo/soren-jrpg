const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  page.on('console', m => { const t = m.text(); if (t.includes('fesheet') || t.includes('error') || t.includes('failed') || t.includes('404')) console.log('[console]', t.slice(0,160)); });
  page.on('requestfailed', r => console.log('[REQFAIL]', r.url().slice(-60), r.failure() && r.failure().errorText));
  page.on('response', r => { if (r.url().includes('fe_soren') && r.status() !== 200) console.log('[HTTP]', r.status(), r.url().slice(-50)); });
  await page.goto('http://localhost:5176/?test=1&skipIntro=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__soren, { timeout: 15000 });
  await page.waitForTimeout(1000);
  const t = await page.evaluate(() => {
    const b = window.__soren.scene('Boot');
    const tex = b.textures.get('fesheet_soren_battle');
    return tex ? { key: tex.key, frames: tex.frameTotal, w: tex.source[0].width, f0w: tex.frames[0].width, f1w: tex.frames[1] ? tex.frames[1].width : null } : 'missing';
  });
  console.log('TEX:', JSON.stringify(t));
  await browser.close();
})();
