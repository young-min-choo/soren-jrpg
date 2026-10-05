// Probe: load deployed site, capture ALL console + page errors, report boot state.
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'https://soren-jrpg.vercel.app/?test=1';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`));
  page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(12000);
  const state = await page.evaluate(() => {
    const g = window.game;
    if (!g) return { game: false };
    const boot = g.scene.getScene('Boot');
    return {
      game: true,
      bootStatus: boot.scene.settings.status,
      loadProgress: boot.load.progress,
      totalToLoad: boot.load.totalToLoad,
      activeScenes: g.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key),
      pending: [...(boot.load.list || []), ...(boot.load.inflight || [])]
        .filter(f => !/COMPLETE/.test(String(f.state)))
        .map(f => f.key),
    };
  });
  console.log('=== STATE ===');
  console.log(JSON.stringify(state, null, 1));
  console.log('=== CONSOLE (errors only) ===');
  logs.filter(l => /error|Error|failed|Failed|warn/.test(l)).forEach(l => console.log(l));
  await browser.close();
})();