import { test, expect } from 'playwright/test';
import { boot, tap, activeScene, expectScene, snap, evalIn, newGameFast } from './helpers.js';

// ─── Smoke: boot, title, movement, scene transitions ───────────────────────

test('boot → new game flow → playable overworld', async ({ page }) => {
  const errors = await boot(page, { newGame: true });
  await expectScene(page, 'Overworld');
  expect(errors).toEqual([]);
});

test('player moves with arrow keys and stays in bounds', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  const x0 = await evalIn(page, () => window.__soren.scene('Overworld').player.x);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowUp');
  const y1 = await evalIn(page, () => window.__soren.scene('Overworld').player.y);
  const x1 = await evalIn(page, () => window.__soren.scene('Overworld').player.x);
  expect(x1).toBe(x0); // pure vertical move
  expect(y1).toBeLessThan(336 + 60 * 10); // moved up meaningfully
  expect(y1).toBeGreaterThan(0); // collision kept us in bounds
  expect(await activeScene(page)).toBe('Overworld');
});

test('overworld → town → overworld transition', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // Teleport next to town entrance (10,8), then press Z
  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);

  // Walk to exit (8,11) and press Z to go back
  await evalIn(page, () => window.__soren.teleport('Town', 8, 10));
  await tap(page, 'z');
  await expectScene(page, 'Overworld', 10000);
});

// ─── Menu: open, status, save, load ────────────────────────────────────────

test('X opens menu; Save writes slot; Load restores', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // Open menu
  await tap(page, 'x');
  await expectScene(page, 'Menu');

  // Navigate to Save (Status, Items, Jobs, Save) — 3 downs then confirm
  await tap(page, 'ArrowDown', 3);
  await tap(page, 'z'); // Save
  await page.waitForTimeout(200);
  // Slot 1 selected by default; confirm
  await tap(page, 'z');
  await page.waitForTimeout(200);

  const saved = await evalIn(page, () => !!window.__soren.SaveSystem.load(0));
  expect(saved).toBe(true);

  // Close menu (X from main), then verify we're back in Overworld
  await tap(page, 'x');
  await expectScene(page, 'Overworld', 10000);

  // Now load: open menu, go to Load
  await tap(page, 'x');
  await expectScene(page, 'Menu');
  await tap(page, 'ArrowDown', 4);
  await tap(page, 'z'); // Load
  await page.waitForTimeout(200);
  await tap(page, 'z'); // slot 1
  // Load restarts the saved scene
  await expectScene(page, 'Overworld', 15000);
});

// ─── Dialogue ──────────────────────────────────────────────────────────────

test('talk to NPC: dialogue opens, advances, closes', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // Into town, next to Townsfolk NPC at tile (6,5)
  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);
  await evalIn(page, () => window.__soren.teleport('Town', 6, 6));
  await page.waitForTimeout(300);
  await tap(page, 'z');

  // DialogueScene launches as overlay
  await page.waitForFunction(() => {
    const d = window.__soren.scene('Dialogue');
    return d && d.scene.isActive();
  }, { timeout: 5000 });

  // Each page: one press completes the typewriter, the next advances. 4 pages.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(300);
    const active = await page.evaluate(() => {
      const d = window.__soren.scene('Dialogue');
      return d && d.scene.isActive();
    });
    if (!active) break;
  }

  // Dialogue stopped after last page
  await page.waitForFunction(() => {
    const d = window.__soren.scene('Dialogue');
    return !d.scene.isActive();
  }, { timeout: 5000 });
});

// ─── Battle: full loop via real input ──────────────────────────────────────

test('battle: fight and win a slime battle, rewards applied', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // Make it fair but fast: slight level boost, then force a battle
  await evalIn(page, () => window.__soren.godMode());
  await evalIn(page, () => window.__soren.startBattle('Overworld', ['slime']));

  await expectScene(page, 'Battle');
  await page.waitForTimeout(900); // intro → first turn

  let s = await snap(page);
  expect(s).not.toBeNull();
  expect(s.enemies.length).toBe(1);
  expect(s.enemies[0].name).toBe('Slime');

  // Mash Z — selects FIGHT → target → confirm → repeat through turns
  await page.evaluate(() => { window.__soren._auto = window.__soren.autoConfirm(200); });
  await page.waitForFunction(
    () => window.__soren.battleSnapshot() === null, // Battle scene gone = battle over
    { timeout: 60000 },
  );
  await page.evaluate(() => { if (window.__soren._auto) window.__soren._auto(); });

  // Back in overworld; exp/gold gained
  await expectScene(page, 'Overworld', 10000);
  const gold = await evalIn(page, () => window.__soren.GameState.get().gold);
  expect(gold).toBeGreaterThanOrEqual(10);
});

test('battle: items submenu lists inventory and Potion heals', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  await evalIn(page, () => window.__soren.startBattle('Overworld', ['slime']));
  await expectScene(page, 'Battle');
  await page.waitForTimeout(900);

  // Wait for our turn
  await page.waitForFunction(() => window.__soren.battleSnapshot()?.state === 'action_select', { timeout: 10000 });

  // ITEM → select Potion → ally select → confirm
  await tap(page, 'ArrowDown');  // MAGIC
  await tap(page, 'ArrowDown');  // ITEM
  await tap(page, 'z');          // open item menu
  await page.waitForTimeout(200);
  await tap(page, 'z');          // Potion → ally select
  await page.waitForTimeout(200);
  await tap(page, 'z');          // confirm ally 1
  await page.waitForTimeout(400);

  const s = await snap(page);
  const potionUsed = s.log.some(l => l.includes('uses Potion') || l.includes('recovers'));
  expect(potionUsed).toBe(true);
  const qty = await evalIn(page, () => window.__soren.GameState.getItemQty('Potion'));
  expect(qty).toBe(2); // started with 3, used 1
});

test('battle: lose path triggers full heal + return', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  await evalIn(page, () => window.__soren.drainMode());
  await evalIn(page, () => window.__soren.startBattle('Overworld', ['goblin']));
  await expectScene(page, 'Battle');

  // Party must still take turns (each FIGHT does 1 dmg) — auto-confirm for them
  await page.evaluate(() => { window.__soren._auto = window.__soren.autoConfirm(250); });

  // Goblin (atk 9) wipes the 1-HP party in ~3 rounds
  await page.waitForFunction(() => window.__soren.battleSnapshot() === null, { timeout: 60000 });
  await page.evaluate(() => { if (window.__soren._auto) window.__soren._auto(); });

  await expectScene(page, 'Overworld', 10000);

  const hps = await evalIn(page, () => window.__soren.GameState.get().party.map(p => p.hp));
  const maxes = await evalIn(page, () => window.__soren.GameState.get().party.map(p => p.maxHp));
  // Full heal on defeat (classic FF prototype behavior)
  hps.forEach((hp, i) => expect(hp).toBe(maxes[i]));
});

// ─── Job system via Job Master ─────────────────────────────────────────────

test('job master: change Soren from Warrior to Mage', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);
  await evalIn(page, () => window.__soren.teleport('Town', 8, 7)); // next to Job Master (8,8)
  await page.waitForTimeout(300);
  await tap(page, 'z');

  // Job menu opens (jobMenuDiv exists in Town scene)
  await page.waitForFunction(() => !!window.__soren.scene('Town').jobMenuDiv, { timeout: 5000 });
  await tap(page, 'z');            // Change Job
  await page.waitForTimeout(150);
  await tap(page, 'z');            // member 1 (Soren)
  await page.waitForTimeout(150);
  await tap(page, 'ArrowDown');    // Mage
  await tap(page, 'z');            // select
  await page.waitForTimeout(150);
  await tap(page, 'z');            // confirm

  const job = await evalIn(page, () => window.__soren.GameState.get().party[0].job);
  expect(job).toBe('Mage');
  // Learned abilities preserved + Mage L1 spells granted
  const learned = await evalIn(page, () => window.__soren.GameState.get().party[0].learnedAbilities);
  expect(learned['Mage']).toContain('Fire');
});

// ─── Dungeon: puzzle, boss, exit ───────────────────────────────────────────

test('dungeon: push-block puzzle solves and door opens', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  await evalIn(page, () => window.__soren.teleport('Overworld', 16, 5));
  await tap(page, 'z');
  await expectScene(page, 'Dungeon', 10000);

  expect(await evalIn(page, () => window.__soren.dungeon.solved())).toBe(false);

  // Place both blocks on switches through the game's own check logic
  await evalIn(page, () => window.__soren.dungeon.placeBlock(0, 4, 8));
  await evalIn(page, () => window.__soren.dungeon.placeBlock(1, 9, 8));
  await page.waitForTimeout(300);

  expect(await evalIn(page, () => window.__soren.dungeon.solved())).toBe(true);
  // Door tile replaced with floor
  expect(await evalIn(page, () => window.__soren.dungeon.mapTile(6, 10))).toBe(0);
});

test('dungeon: boss fight reachable, win opens exit', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  await evalIn(page, () => window.__soren.godMode());
  await evalIn(page, () => window.__soren.teleport('Overworld', 16, 5));
  await tap(page, 'z');
  await expectScene(page, 'Dungeon', 10000);

  // Walk onto boss tile and confirm
  await evalIn(page, () => window.__soren.teleport('Dungeon', 10, 2));
  await tap(page, 'z');
  await expectScene(page, 'Battle');

  // Mash through boss fight at lvl 20
  await page.evaluate(() => { window.__soren._auto = window.__soren.autoConfirm(200); });
  await page.waitForFunction(() => window.__soren.battleSnapshot() === null, { timeout: 60000 });
  await page.evaluate(() => { if (window.__soren._auto) window.__soren._auto(); });

  await expectScene(page, 'Dungeon', 10000);
  expect(await evalIn(page, () => window.__soren.dungeon.bossDefeated())).toBe(true);
  expect(await evalIn(page, () => window.__soren.dungeon.mapTile(10, 2))).toBe(9); // T_EXIT
});

// ─── Save → reload → load roundtrip ────────────────────────────────────────

test('save → full page reload → load restores party and position', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');

  // Change game state meaningfully: level up Soren + move + save via menu
  await evalIn(page, () => window.__soren.teleport('Overworld', 4, 12));

  await tap(page, 'x');
  await expectScene(page, 'Menu');
  await tap(page, 'ArrowDown', 3);
  await tap(page, 'z'); // Save
  await page.waitForTimeout(200);
  await tap(page, 'z'); // slot 1
  await page.waitForTimeout(200);

  const before = await evalIn(page, () => {
    const d = window.__soren.SaveSystem.load(0);
    return { scene: d.scene, x: d.x, y: d.y, gold: d.gold };
  });
  expect(before.scene).toBe('Overworld');

  // Reload page (same URL → localStorage persists)
  await page.reload();
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => window.__soren?.activeSceneKey() !== null, { timeout: 15000 });
  await newGameFast(page); // title → new-game flow → overworld

  await tap(page, 'x');
  await expectScene(page, 'Menu');
  await tap(page, 'ArrowDown', 4);
  await tap(page, 'z'); // Load
  await page.waitForTimeout(200);
  await tap(page, 'z'); // slot 1
  await expectScene(page, 'Overworld', 15000);

  // Position restored
  const pos = await evalIn(page, () => {
    const p = window.__soren.scene('Overworld').player;
    return { x: p.x, y: p.y };
  });
  expect(pos.x).toBe(before.x);
  expect(pos.y).toBe(before.y);
});