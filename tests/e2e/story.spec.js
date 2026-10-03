import { test, expect } from 'playwright/test';
import { boot, tap, activeScene, expectScene, snap, evalIn, newGameFast, GAME_URL } from './helpers.js';

// ─── Phase 7: New game flow, intro cutscene, story flags, relic scene ──────

// Shared: new game through the full flow, then mash through the intro.
// Returns after the intro is done and introDone flag is set.
async function newGameThroughIntro(page, name = '') {
  await boot(page);
  await page.keyboard.press('z'); // Title → NewGameFlow
  await page.waitForTimeout(400);
  if (name) await page.keyboard.type(name);
  await page.keyboard.press('Enter'); // name → job
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter'); // default job → Overworld
  await expectScene(page, 'Overworld');
  await page.waitForTimeout(600); // intro cutscene starts

  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(320);
    const active = await page.evaluate(() => {
      const d = window.__soren.scene('Dialogue');
      return d && d.scene.isActive();
    });
    if (!active) break;
  }
  const introDone = await evalIn(page, () => window.__soren.GameState.hasFlag('introDone'));
  if (!introDone) throw new Error('intro cutscene did not complete');
  return introDone;
}

test('new game: name entry → job choice → customized party', async ({ page }) => {
  await boot(page);

  // Type a name, Enter, choose Mage (down once), Enter
  await page.keyboard.press('z'); // Title → NewGameFlow
  await page.waitForTimeout(400);
  await page.keyboard.type('HERO');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await tap(page, 'ArrowDown'); // Mage
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');

  await expectScene(page, 'Overworld');
  const party = await evalIn(page, () => window.__soren.GameState.get().party);
  expect(party[0].name).toBe('HERO');
  expect(party[0].job).toBe('Mage');
  expect(party.length).toBe(3); // full party from GameState.reset
  const flag = await evalIn(page, () => window.__soren.GameState.getFlag('startingJob'));
  expect(flag).toBe('Mage');
});

test('intro cutscene plays on first Overworld entry, sets flag', async ({ page }) => {
  await newGameThroughIntro(page, 'HERO');

  // Re-entering overworld (town → overworld) must NOT replay the cutscene
  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);
  await evalIn(page, () => window.__soren.teleport('Town', 8, 11));
  await tap(page, 'z');
  await expectScene(page, 'Overworld', 10000);
  const dialogueGone = await page.evaluate(() => {
    const d = window.__soren.scene('Dialogue');
    return !d.scene.isActive();
  });
  expect(dialogueGone).toBe(true);
});

test('NPC dialogue changes with story flags (before/after relic)', async ({ page }) => {
  await newGameThroughIntro(page);

  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);

  // Elder before relic: "The Ancient Ruins lie east..." — typewriter is
  // slow, so wait until the full first page is rendered before asserting.
  await evalIn(page, () => window.__soren.teleport('Town', 11, 6));
  await page.waitForTimeout(250);
  await page.keyboard.press('z'); // open dialogue
  await page.waitForFunction(() => {
    const d = window.__soren.scene('Dialogue');
    return d && d.scene.isActive() && !d.isTyping;
  }, { timeout: 6000 });
  const before = await page.evaluate(() => {
    const d = window.__soren.scene('Dialogue');
    return d.textDiv.textContent;
  });
  expect(before).toContain('Ancient Ruins');

  // Close dialogue
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(200);
    const active = await page.evaluate(() => {
      const d = window.__soren.scene('Dialogue');
      return d && d.scene.isActive();
    });
    if (!active) break;
  }

  // Grant the relic flag — elder dialogue must change
  await evalIn(page, () => window.__soren.GameState.setFlag('relicWind'));
  await page.waitForTimeout(200);
  // The previous dialogue may still be open; close it if so, then re-open
  await page.evaluate(() => {
    const d = window.__soren.scene('Dialogue');
    if (d && d.scene.isActive()) d.close();
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('z'); // re-open elder dialogue with new flag state
  await page.waitForFunction(() => {
    const d = window.__soren.scene('Dialogue');
    return d && d.scene.isActive() && !d.isTyping;
  }, { timeout: 6000 });
  const after = await page.evaluate(() => {
    const d = window.__soren.scene('Dialogue');
    return d.textDiv.textContent;
  });
  expect(after).toContain('Wind Relic');
});

test('relic cutscene plays after boss victory, once only', async ({ page }) => {
  await newGameThroughIntro(page);

  await evalIn(page, () => window.__soren.godMode());
  await evalIn(page, () => window.__soren.teleport('Overworld', 16, 5));
  await tap(page, 'z');
  await expectScene(page, 'Dungeon', 10000);

  // Boss fight
  await evalIn(page, () => window.__soren.teleport('Dungeon', 10, 2));
  await tap(page, 'z');
  await expectScene(page, 'Battle');
  await page.evaluate(() => { window.__soren._auto = window.__soren.autoConfirm(200); });
  await page.waitForFunction(() => window.__soren.battleSnapshot() === null, { timeout: 60000 });
  await page.evaluate(() => { if (window.__soren._auto) window.__soren._auto(); });

  // Relic cutscene should now be running in the Dungeon
  // (panCamera 900ms + wait 300ms run before the first dialogue — be patient)
  await expectScene(page, 'Dungeon', 10000);
  await page.waitForFunction(() => {
    const d = window.__soren.scene('Dialogue');
    return d && d.scene.isActive();
  }, { timeout: 8000 });

  // Mash through relic scene
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(320);
    const active = await page.evaluate(() => {
      const d = window.__soren.scene('Dialogue');
      try { return d && d.scene.isActive(); } catch { return false; }
    });
    if (!active) break;
  }

  const flag = await evalIn(page, () => window.__soren.GameState.hasFlag('relicWind'));
  expect(flag).toBe(true);
  expect(await evalIn(page, () => window.__soren.dungeon.bossDefeated())).toBe(true);
});

test('relic flag persists through save/reload (world state)', async ({ page }) => {
  await newGameThroughIntro(page);

  // Save via menu with relic flag set
  await evalIn(page, () => window.__soren.GameState.setFlag('relicWind'));
  await tap(page, 'x');
  await expectScene(page, 'Menu');
  await tap(page, 'ArrowDown', 4);
  await tap(page, 'z');
  await page.waitForTimeout(200);
  await tap(page, 'z');
  await page.waitForTimeout(200);

  // Reload page, load save, verify flag survived
  // (reload returns to Title; this URL variant has skipIntro so the fast
  // new-game flow re-enters the Overworld, where we can open the menu)
  await page.reload();
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => window.__soren?.activeSceneKey() !== null, { timeout: 15000 });
  await newGameFast(page); // title → new-game flow → overworld
  await tap(page, 'x');
  await expectScene(page, 'Menu');
  await tap(page, 'ArrowDown', 5);
  await tap(page, 'z');
  await page.waitForTimeout(200);
  await tap(page, 'z');
  await expectScene(page, 'Overworld', 15000);

  const flag = await evalIn(page, () => window.__soren.GameState.hasFlag('relicWind'));
  expect(flag).toBe(true);
});

test('cutscene locks gameplay: no movement or encounters during intro', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('z'); // Title → NewGameFlow
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter'); // name → job
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter'); // job → Overworld
  await expectScene(page, 'Overworld');
  await page.waitForTimeout(600); // intro starts

  // While cutscene is running, arrow keys must not move the player
  const x0 = await evalIn(page, () => window.__soren.scene('Overworld').player.x);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  const x1 = await evalIn(page, () => window.__soren.scene('Overworld').player.x);
  expect(x1).toBe(x0); // locked
});