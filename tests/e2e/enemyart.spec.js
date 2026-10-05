import { test, expect } from 'playwright/test';
import { boot, expectScene, evalIn } from './helpers.js';

// ─── Every EnemyData key gets real art: camelCase→snake_case + alias fallback ───
// Regression for: ENEMIES keys are camelCase (caveSpider) but art files are
// snake_case (cave_spider) — 17 enemies silently rendered as placeholder rectangles.

test('camelCase enemy keys render real sprites, not rectangles', async ({ page }) => {
  const errors = await boot(page, { newGame: true });
  await expectScene(page, 'Overworld');

  const r = await evalIn(page, async () => {
    const out = {};
    for (const t of ['caveSpider', 'ruinsZombie', 'wolfPack', 'goblinShaman', 'mistLurker']) {
      const s = window.__soren.scene('Overworld');
      s.transitioning = false;
      s.scene.launch('Battle', { returnScene: 'Overworld', enemies: [t] });
      await new Promise(r2 => setTimeout(r2, 1500));
      const b = window.__soren.scene('Battle');
      out[t] = b.enemySprites[0]._isSprite === true;
      b.scene.stop('Battle');
      window.__soren.scene('Overworld').scene.resume();
      await new Promise(r2 => setTimeout(r2, 400));
    }
    return out;
  });
  for (const [k, ok] of Object.entries(r)) expect(ok, `${k} should use a real sprite`).toBe(true);
  expect(errors).toEqual([]);
});