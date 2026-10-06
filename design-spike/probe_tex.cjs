
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({viewport:{width:820,height:720}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:4173/?test=1', {waitUntil:'load'});
  await p.waitForFunction(() => window.game && window.__soren, {timeout:20000});
  await p.waitForFunction(() => window.game.scene.getScene('Title').scene.isActive(), {timeout:15000});
  const tex = await p.evaluate(() => {
    const t = window.game.textures.get('dgn_ruins');
    return {w: t.source[0].width, frames: t.frameTotal ?? Object.keys(t.frames).length, has10: t.has(10), has11: t.has(11)};
  });
  console.log('dgn_ruins tex:', JSON.stringify(tex));
  await b.close();
})();