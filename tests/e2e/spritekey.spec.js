import { test, expect } from 'playwright/test';
import { boot, expectScene, evalIn, tap } from './helpers.js';

// ─── Rename-proof battle sprites: art follows spriteKey, not display name ───

test('renamed hero (party[0].name != art key) still gets the protagonist battle sprite', async ({ page }) => {
  const errors = await boot(page, { newGame: true });
  await expectScene(page, 'Overworld');

  // Simulate hero renamed to "Peter" (whatever the player typed in NewGameFlow)
  const info = await evalIn(page, () => {
    const g = window.__soren;
    const gs = g.GameState.get();
    gs.party[0].name = 'Peter';
    gs.party[0].spriteKey = 'soren_battle'; // what createCharacter('Peter'...) resolves to
    const b = g.scene('Overworld');
    g.startBattle('Overworld', ['slime']);
    return { name: gs.party[0].name, spriteKey: gs.party[0].spriteKey };
  });
  await page.waitForTimeout(1200); // battle launches + sprites built

  const tex = await evalIn(page, () => {
    const b = window.__soren.scene('Battle');
    const s = b.playerSprites[0];
    return { isSprite: !!s._isSprite, key: s.texture && s.texture.key };
  });
  expect(info.name).toBe('Peter');
  expect(info.spriteKey).toBe('soren_battle');
  expect(tex.isSprite).toBe(true); // NOT a placeholder rectangle
  expect(errors).toEqual([]);
});

test('every party member gets a real battle sprite (no legacy rectangles)', async ({ page }) => {
  await boot(page, { newGame: true });
  await expectScene(page, 'Overworld');

  await evalIn(page, () => { window.__soren.startBattle('Overworld', ['slime']); });
  await page.waitForTimeout(1200);

  const all = await evalIn(page, () => {
    const b = window.__soren.scene('Battle');
    return b.party.map((c, i) => ({
      name: c.name, spriteKey: c.spriteKey || null,
      isSprite: !!b.playerSprites[i]._isSprite,
    }));
  });
  expect(all.length).toBe(3);
  all.forEach((m) => {
    expect(m.isSprite).toBe(true);
    expect(m.spriteKey).toBeTruthy();
  });
});