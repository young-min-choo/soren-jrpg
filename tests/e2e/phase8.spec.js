// Phase 8 content E2E — new towns, relic dungeons, equipment, airship,
// Game Over, job unlocks, boss behaviors. Uses the same __soren hooks.
import { test, expect } from 'playwright/test';
import { boot, tap, expectScene, evalIn } from './helpers.js';

// Overworld marker positions per town (WorldData OW_MARKERS)
const TOWN_MARKERS = {
  PortMeridian: [27, 10],
  Stonewatch: [10, 19],
  Skyhold: [29, 7],
  Aurelia: [22, 3],
};

// ─── New towns: config-driven TownScene instances ──────────────────────────

test('towns: all 4 new towns boot with config NPCs and can exit', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  for (const [key, pos] of Object.entries(TOWN_MARKERS)) {
    // Enter each town via its overworld marker (teleport adjacent, press Z)
    await evalIn(page, (p) => window.__soren.teleport('Overworld', p[0], p[1] + 1), pos);
    await page.waitForTimeout(300);
    await tap(page, 'z');
    await expectScene(page, key, 10000);

    // NPCs placed from config
    const npcCount = await evalIn(page, (k) => window.__soren.scene(k).npcs.length, key);
    expect(npcCount).toBeGreaterThanOrEqual(5);

    // Exit back to overworld (teleport to the exit tile, press Z)
    await evalIn(page, (k) => {
      const s = window.__soren.scene(k);
      const t = s._town();
      window.__soren.teleport(k, t.exitX, t.exitY - 1);
    }, key);
    await page.waitForTimeout(250);
    await tap(page, 'z');
    await expectScene(page, 'Overworld', 10000);
  }
});

// ─── Shop sell mode ─────────────────────────────────────────────────────────

test('shop: sell mode lists inventory and pays gold', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // Enter the village and open the shop via the shopkeeper NPC
  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);

  // Shopkeeper is at tile (3,10); stand adjacent (4,10) and talk
  await evalIn(page, () => window.__soren.teleport('Town', 4, 10));
  await page.waitForTimeout(250);
  await tap(page, 'z');
  await page.waitForTimeout(400);

  const mode = await evalIn(page, () => window.__soren.scene('Town').shopMode);
  expect(mode).toBe('buy');

  // Toggle to sell mode (Q)
  await tap(page, 'q');
  await page.waitForTimeout(200);
  const sellMode = await evalIn(page, () => window.__soren.scene('Town').shopMode);
  expect(sellMode).toBe('sell');

  // Starting inventory has Potion x3 + Ether x1 → sellables exist
  const sellableCount = await evalIn(page, () => window.__soren.scene('Town')._sellables.length);
  expect(sellableCount).toBeGreaterThan(0);

  const goldBefore = await evalIn(page, () => window.__soren.GameState.get().gold);
  await tap(page, 'z'); // sell first item
  await page.waitForTimeout(300);
  const goldAfter = await evalIn(page, () => window.__soren.GameState.get().gold);
  expect(goldAfter).toBeGreaterThan(goldBefore);

  // Leave shop
  await tap(page, 'x');
  await page.waitForTimeout(200);
});

// ─── Equipment: equip via menu boosts stats ─────────────────────────────────

test('equipment: menu Equip flow equips a weapon and boosts ATK', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // Give a Bronze Sword directly (isolates the equip flow)
  await evalIn(page, () => window.__soren.GameState.addEquipment('Bronze Sword', 1));

  const baseAtk = await evalIn(page, () => window.__soren.GameState.effectiveChar(0).atk);

  // Open menu → Equip
  await tap(page, 'x');
  await expectScene(page, 'Menu');
  await tap(page, 'ArrowDown', 2); // Status, Items → Equip
  await tap(page, 'z');            // member select
  await tap(page, 'z');            // member 0 → slot select
  await tap(page, 'z');            // weapon slot → item list
  await page.waitForTimeout(200);
  // Item list: no weapon equipped → [0] = Bronze Sword
  await tap(page, 'z');            // equip
  await page.waitForTimeout(300);

  const equipped = await evalIn(page, () => window.__soren.GameState.getParty()[0].equipment.weapon);
  expect(equipped).toBe('Bronze Sword');
  const atkAfter = await evalIn(page, () => window.__soren.GameState.effectiveChar(0).atk);
  expect(atkAfter).toBeGreaterThan(baseAtk);
});

// ─── Relic dungeons: gate + puzzle + boss + relic flag ─────────────────────

test('relic dungeon: Tide Temple gated until relicFire', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // Gate: without relicFire, the marker refuses entry
  await evalIn(page, () => window.__soren.teleport('Overworld', 33, 16));
  await tap(page, 'z');
  await page.waitForTimeout(600);
  expect(await evalIn(page, () => window.__soren.activeSceneKey())).toBe('Overworld');

  // With relicFire, entry opens
  await evalIn(page, () => window.__soren.GameState.setFlag('relicFire'));
  await tap(page, 'z');
  await expectScene(page, 'TideTemple', 10000);

  // The map + config exist on the scene
  const hasPuzzle = await evalIn(page, () => {
    const s = window.__soren.scene('TideTemple');
    return !!(s.mapData && s.cfg);
  });
  expect(hasPuzzle).toBe(true);
});

// ─── Job unlocks via story beats ────────────────────────────────────────────

test('story: job unlocks registered on relic beats', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  const before = await evalIn(page, () => window.__soren.GameState.get().unlockedJobs);
  expect(before).toContain('Thief'); // Kael starts Thief

  // Simulate the tide relic cutscene's run step (Sage + Paladin unlock)
  await evalIn(page, () => {
    window.__soren.GameState.unlockJob('Sage');
    window.__soren.GameState.unlockJob('Paladin');
  });
  const after = await evalIn(page, () => window.__soren.GameState.get().unlockedJobs);
  expect(after).toContain('Sage');
  expect(after).toContain('Paladin');
});

// ─── Game Over: wipe → GameOver scene → Load ────────────────────────────────

test('game over: no free heal, Load restores from save', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // Save first so Load is meaningful
  await tap(page, 'x');
  await expectScene(page, 'Menu');
  await tap(page, 'ArrowDown', 4);
  await tap(page, 'z');
  await page.waitForTimeout(200);
  await tap(page, 'z');
  await page.waitForTimeout(200);
  await tap(page, 'x'); // close menu
  await expectScene(page, 'Overworld');

  // Get wiped
  await evalIn(page, () => window.__soren.drainMode());
  await evalIn(page, () => window.__soren.startBattle('Overworld', ['goblin']));
  await expectScene(page, 'Battle');
  await page.evaluate(() => { window.__soren._auto = window.__soren.autoConfirm(250); });
  await page.waitForFunction(() => window.__soren.battleSnapshot() === null, { timeout: 60000 });
  await page.evaluate(() => { if (window.__soren._auto) window.__soren._auto(); });
  await page.waitForTimeout(1500);

  await expectScene(page, 'GameOver', 10000);
  // Party stays wiped
  const hps = await evalIn(page, () => window.__soren.GameState.get().party.map(p => p.hp));
  hps.forEach((hp) => expect(hp).toBe(0));

  // Load the save → back to the saved Overworld, party restored
  await tap(page, 'z');
  await expectScene(page, 'Overworld', 15000);
  const hps2 = await evalIn(page, () => window.__soren.GameState.get().party.map(p => p.hp));
  hps2.forEach((hp) => expect(hp).toBeGreaterThan(0));
});

// ─── Airship fast travel ────────────────────────────────────────────────────

test('airship: docks appear with flag, fly to Port Meridian', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // No docks before the flag
  const before = await evalIn(page, () => window.__soren.scene('Overworld').dockDivs.length);
  expect(before).toBe(0);

  // Grant the airship (story: after relicEarth), then restart the scene so
  // create() builds the dock markers
  await evalIn(page, () => window.__soren.GameState.setFlag('airship'));
  await evalIn(page, () => window.game.scene.start('Overworld'));
  await expectScene(page, 'Overworld');
  const after = await evalIn(page, () => window.__soren.scene('Overworld').dockDivs.length);
  expect(after).toBe(5);

  // Open the airship menu at a dock (teleport adjacent to the village dock)
  await evalIn(page, () => window.__soren.teleport('Overworld', 11, 11));
  await page.waitForTimeout(250);
  await tap(page, 'z');
  await page.waitForTimeout(300);
  const menuUp = await evalIn(page, () => !!window.__soren.scene('Overworld').airshipDiv);
  expect(menuUp).toBe(true);

  // Select Port Meridian (index 1) and fly
  await tap(page, 'ArrowDown', 1);
  await tap(page, 'z');
  await page.waitForTimeout(900);
  const pos = await evalIn(page, () => {
    const p = window.__soren.scene('Overworld').player;
    return { x: Math.floor(p.x / 32), y: Math.floor(p.y / 32) };
  });
  // Should be at/near the Port Meridian dock (28,12) — arrival is (28,13)
  expect(Math.abs(pos.x - 28)).toBeLessThanOrEqual(1);
  expect(Math.abs(pos.y - 13)).toBeLessThanOrEqual(1);
});

// ─── Boss behaviors: flee-block ─────────────────────────────────────────────

test('bosses: flee is blocked in boss battles', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  await evalIn(page, () => window.__soren.godMode());
  await evalIn(page, () => window.__soren.startBattle('Overworld', ['boss_tide']));
  await expectScene(page, 'Battle');

  // Flee attempt: log should say escape is blocked
  await evalIn(page, () => {
    const b = window.__soren.scene('Battle');
    b.executeAction('FLEE');
  });
  await page.waitForTimeout(300);
  const log = await evalIn(page, () => window.__soren.battleSnapshot().log.join(' | '));
  expect(log).toContain('Cannot escape');
});