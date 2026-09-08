import { test, expect } from 'playwright/test';
import { boot, tap, expectScene, evalIn, newGameFast } from './helpers.js';

// ─── Phase 8: shop, inn, Cave of Embers, Fire Relic ────────────────────────

test('shop: buy item, gold deducted, inventory updated', async ({ page }) => {
  await boot(page, { newGame: true });

  // Into town, to the Shopkeeper at tile (3,10)
  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);
  await evalIn(page, () => window.__soren.teleport('Town', 3, 9));
  await page.waitForTimeout(250);
  await tap(page, 'z');

  // Shop modal open
  await page.waitForFunction(() => !!window.__soren.scene('Town').shopDiv, { timeout: 5000 });

  const before = await evalIn(page, () => ({
    gold: window.__soren.GameState.get().gold,
    potions: window.__soren.GameState.getItemQty('Potion'),
  }));

  // Potion is first item (50G). Starting gold is 0 — give some, then buy.
  await evalIn(page, () => { window.__soren.GameState.get().gold = 500; });
  await tap(page, 'z'); // buy Potion

  const after = await evalIn(page, () => ({
    gold: window.__soren.GameState.get().gold,
    potions: window.__soren.GameState.getItemQty('Potion'),
  }));
  expect(after.gold).toBe(500 - 50);
  expect(after.potions).toBe(before.potions + 1);

  // Leave shop
  await tap(page, 'x');
  await page.waitForFunction(() => !window.__soren.scene('Town').shopDiv, { timeout: 5000 });
});

test('shop: cannot buy without gold', async ({ page }) => {
  await boot(page, { newGame: true });
  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);
  await evalIn(page, () => window.__soren.teleport('Town', 3, 9));
  await page.waitForTimeout(250);
  await tap(page, 'z');
  await page.waitForFunction(() => !!window.__soren.scene('Town').shopDiv, { timeout: 5000 });

  await evalIn(page, () => { window.__soren.GameState.get().gold = 10; }); // less than 50
  const goldBefore = await evalIn(page, () => window.__soren.GameState.get().gold);
  const qtyBefore = await evalIn(page, () => window.__soren.GameState.getItemQty('Potion'));
  await tap(page, 'z'); // try to buy — rejection is instant

  const state = await evalIn(page, () => ({
    gold: window.__soren.GameState.get().gold,
    qty: window.__soren.GameState.getItemQty('Potion'),
  }));
  // Purchase rejected: no gold deducted, no item added. (The on-screen flash
  // expires in 1.5s — too racy to assert from a slow runner.)
  expect(state.gold).toBe(goldBefore);
  expect(state.qty).toBe(qtyBefore);
});

test('inn: rest costs 30G and fully heals', async ({ page }) => {
  await boot(page, { newGame: true });

  // Damage the party first
  await evalIn(page, () => {
    const p = window.__soren.GameState.get().party;
    p.forEach(c => { c.hp = 1; c.mp = 0; });
  });

  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);
  await evalIn(page, () => window.__soren.teleport('Town', 12, 9));
  await page.waitForTimeout(250);
  await tap(page, 'z');
  await page.waitForFunction(() => !!window.__soren.scene('Town').innDiv, { timeout: 5000 });

  await evalIn(page, () => { window.__soren.GameState.get().gold = 100; });
  await tap(page, 'z'); // Rest

  const state = await evalIn(page, () => ({
    gold: window.__soren.GameState.get().gold,
    hp: window.__soren.GameState.get().party.map(c => c.hp),
    max: window.__soren.GameState.get().party.map(c => c.maxHp),
    scene: window.__soren.activeSceneKey(),
  }));
  expect(state.gold).toBe(70);
  state.hp.forEach((hp, i) => expect(hp).toBe(state.max[i]));
  expect(state.scene).toBe('Town');
});

test('cave of embers: locked until Wind Relic, opens after', async ({ page }) => {
  await boot(page, { newGame: true });

  // Before relic: entrance interaction shows the gate message, stays Overworld
  await evalIn(page, () => window.__soren.teleport('Overworld', 3, 3)); // adjacent to (3,2)
  await page.waitForTimeout(250);
  await tap(page, 'z');
  await page.waitForTimeout(600);
  expect(await evalIn(page, () => window.__soren.activeSceneKey())).toBe('Overworld');

  // Grant the relic — now it opens
  await evalIn(page, () => window.__soren.GameState.setFlag('relicWind'));
  await page.waitForTimeout(200);
  await evalIn(page, () => window.__soren.teleport('Overworld', 3, 3));
  await page.waitForTimeout(250);
  await tap(page, 'z');
  await expectScene(page, 'Embers', 10000);
});

test('embers: vent puzzle opens boss door', async ({ page }) => {
  await boot(page, { newGame: true });
  await evalIn(page, () => window.__soren.GameState.setFlag('relicWind'));
  await evalIn(page, () => window.__soren.teleport('Overworld', 3, 3));
  await page.waitForTimeout(250);
  await tap(page, 'z');
  await expectScene(page, 'Embers', 10000);

  expect(await evalIn(page, () => window.__soren.embers.solved())).toBe(false);
  expect(await evalIn(page, () => window.__soren.embers.mapTile(10, 5))).toBe(4); // T_DOOR closed

  // Walk onto both vents (real movement — the switch logic is tile-based)
  await evalIn(page, () => window.__soren.teleport('Embers', 4, 7));
  await page.waitForTimeout(200);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(250); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(250); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(200);
  let sw = await evalIn(page, () => window.__soren.embers.switches());
  expect(sw[0]).toBe(true);

  await evalIn(page, () => window.__soren.teleport('Embers', 15, 7));
  await page.waitForTimeout(200);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(250); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(250); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(300);

  sw = await evalIn(page, () => window.__soren.embers.switches());
  expect(sw[1]).toBe(true);
  expect(await evalIn(page, () => window.__soren.embers.solved())).toBe(true);
  expect(await evalIn(page, () => window.__soren.embers.mapTile(10, 5))).toBe(0); // T_FLOOR, door open
});

test('embers: boss fight → Fire Relic cutscene → relicFire flag', async ({ page }) => {
  await boot(page, { newGame: true });
  await newGameFast; // noop reference guard

  // Pre-condition: wind relic held, puzzle pre-solved via flag path
  await evalIn(page, () => window.__soren.GameState.setFlag('relicWind'));
  await evalIn(page, () => window.__soren.godMode());
  await evalIn(page, () => window.__soren.teleport('Overworld', 3, 3));
  await page.waitForTimeout(250);
  await tap(page, 'z');
  await expectScene(page, 'Embers', 10000);

  // Solve puzzle quickly: step both vents via teleport wiggle
  await evalIn(page, () => window.__soren.teleport('Embers', 4, 7));
  await page.waitForTimeout(150);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(200); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(200); await page.keyboard.up('ArrowDown');
  await evalIn(page, () => window.__soren.teleport('Embers', 15, 7));
  await page.waitForTimeout(150);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(200); await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(200); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(300);
  expect(await evalIn(page, () => window.__soren.embers.solved())).toBe(true);

  // Boss fight
  await evalIn(page, () => window.__soren.teleport('Embers', 10, 2));
  await page.waitForTimeout(200);
  await tap(page, 'z');
  await expectScene(page, 'Battle');
  await page.evaluate(() => { window.__soren._auto = window.__soren.autoConfirm(200); });
  await page.waitForFunction(() => window.__soren.battleSnapshot() === null, { timeout: 90000 });
  await page.evaluate(() => { if (window.__soren._auto) window.__soren._auto(); });

  // Relic cutscene: wait for dialogue (panCamera + wait run first), then mash
  await expectScene(page, 'Embers', 10000);
  await page.waitForFunction(() => {
    const d = window.__soren.scene('Dialogue');
    try { return d && d.scene.isActive(); } catch { return false; }
  }, { timeout: 10000 });

  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(320);
    const active = await page.evaluate(() => {
      const d = window.__soren.scene('Dialogue');
      try { return d && d.scene.isActive(); } catch { return false; }
    });
    if (!active) break;
  }

  expect(await evalIn(page, () => window.__soren.GameState.hasFlag('relicFire'))).toBe(true);
  expect(await evalIn(page, () => window.__soren.embers.bossDefeated())).toBe(true);
  expect(await evalIn(page, () => window.__soren.embers.mapTile(10, 2))).toBe(9); // exit
});