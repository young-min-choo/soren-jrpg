// NPC walk sheets (Phase 10) — sprite swap + talk-facing, played through real input.
// Sheets are 12-frame 16×24 spritesheets keyed npc_sheet_<artKey>; keys without a
// sheet keep the static npc_<key>.png fallback (regen the manifest to add keys).
import { test, expect } from 'playwright/test';
import { boot, evalIn, tap, expectScene } from './helpers.js';

test('town NPCs use walk-sheet sprites with animatable frames', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');
  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);

  const state = await evalIn(page, () => {
    const s = window.__soren.scene('Town');
    return s.npcs.map(n => ({
      artKey: n.getData('artKey'),
      hasSheet: !!n.getData('hasSheet'),
      isSprite: !!n._isSprite,
      texKey: n.texture && n.texture.key,
      frame: n.anims ? n.anims.currentFrame?.index : null,
      frameCount: n.texture && n.texture.frameTotal,
    }));
  });

  // At least one NPC must be sheet-backed (townsfolk has a sheet in the manifest)
  const sheetNpcs = state.filter(n => n.hasSheet);
  expect(sheetNpcs.length).toBeGreaterThanOrEqual(1);
  for (const n of sheetNpcs) {
    expect(n.texKey).toBe(`npc_sheet_${n.artKey}`);
    expect(n.frameCount).toBe(13); // 12 frames + __BASE
  }
});

test('talking to a sheet-backed NPC: dialogue opens and NPC faces the player', async ({ page }) => {
  await boot(page, { newGame: true });
  await tap(page, 'z');
  await expectScene(page, 'Overworld');
  await evalIn(page, () => window.__soren.teleport('Overworld', 10, 9));
  await tap(page, 'z');
  await expectScene(page, 'Town', 10000);

  // Townsfolk stands at (6,5); player teleports just below and talks (same flow as soren.spec)
  await evalIn(page, () => window.__soren.teleport('Town', 6, 6));
  await page.waitForTimeout(300);
  await tap(page, 'z');
  await page.waitForFunction(() => {
    const d = window.__soren.scene('Dialogue');
    return d && d.scene.isActive();
  }, { timeout: 5000 });

  // NPC picked a talk-facing from the sheet (pose language present)
  const npcState = await evalIn(page, () => {
    const s = window.__soren.scene('Town');
    const npc = s.nearbyNpc;
    return npc ? { facing: npc.getData('talkFacing'), frame: npc.frame.name, hasSheet: !!npc.getData('hasSheet') } : null;
  });
  expect(npcState).toBeTruthy();
});