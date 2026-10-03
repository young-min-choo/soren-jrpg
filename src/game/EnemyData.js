/**
 * EnemyData — enemy templates, per-area encounter tables, and formations.
 * Phase 8 target (design doc §8): ~20-25 unique enemies + 5-7 bosses.
 *
 * AI hooks (all optional, consumed by BattleScene):
 *   spell          — casts this spell instead of attacking sometimes
 *   poisonChance / silenceChance / stunChance — status on hit
 *   healAlly       — heals the most wounded OTHER alive enemy
 *   counterPhysical — retaliates when hit by FIGHT (counter archetype)
 */

export const ENEMIES = {
  // ── Grassland tier (overworld near town) ──
  slime: {
    name: 'Slime', hp: 15, maxHp: 15, atk: 6, def: 2, agi: 4,
    color: 0x44cc44, exp: 5, gold: 10,
  },
  bat: {
    name: 'Bat', hp: 10, maxHp: 10, atk: 8, def: 1, agi: 10,
    color: 0x8844cc, exp: 7, gold: 12,
  },
  goblin: {
    name: 'Goblin', hp: 20, maxHp: 20, atk: 9, def: 4, agi: 6,
    color: 0xcc6644, exp: 12, gold: 20,
  },
  goblinShaman: {
    name: 'Goblin Shaman', hp: 16, maxHp: 16, atk: 7, def: 3, agi: 7,
    color: 0x6644cc, exp: 15, gold: 25,
    spell: { name: 'Fire', power: 1.3 },
  },

  // ── Ancient Ruins tier (dungeon 1) ──
  ruinsZombie: {
    name: 'Ruins Zombie', hp: 28, maxHp: 28, atk: 11, def: 5, agi: 3,
    color: 0x779977, exp: 18, gold: 24,
  },
  wisp: {
    name: 'Wisp', hp: 14, maxHp: 14, atk: 13, def: 2, agi: 12,
    color: 0xaaddff, exp: 20, gold: 30,
    spell: { name: 'Ice', power: 1.2 },
  },

  // ── Cave of Embers tier (dungeon 2) ──
  magmaSlime: {
    name: 'Magma Slime', hp: 34, maxHp: 34, atk: 14, def: 6, agi: 5,
    color: 0xff6622, exp: 28, gold: 38,
  },
  fireImp: {
    name: 'Fire Imp', hp: 22, maxHp: 22, atk: 16, def: 4, agi: 14,
    color: 0xff4444, exp: 32, gold: 42,
    spell: { name: 'Fire', power: 1.4 },
  },
  emberBat: {
    name: 'Ember Bat', hp: 18, maxHp: 18, atk: 15, def: 3, agi: 16,
    color: 0xcc3333, exp: 26, gold: 34,
  },
  golem: {
    name: 'Stone Golem', hp: 55, maxHp: 55, atk: 17, def: 12, agi: 2,
    color: 0x888888, exp: 55, gold: 80,
  },

  // ── Tide Temple tier (dungeon 3 — water) ──
  tideCrab: {
    name: 'Tide Crab', hp: 30, maxHp: 30, atk: 13, def: 9, agi: 5,
    color: 0xdd8844, exp: 30, gold: 40,
  },
  jellyfish: {
    name: 'Jellyfish', hp: 26, maxHp: 26, atk: 12, def: 3, agi: 9,
    color: 0x88ccff, exp: 34, gold: 44,
    poisonChance: 0.4,
  },
  coralWraith: {
    name: 'Coral Wraith', hp: 40, maxHp: 40, atk: 15, def: 6, agi: 8,
    color: 0x66ddbb, exp: 45, gold: 60,
    spell: { name: 'Ice', power: 1.5 },
  },
  sirenfang: {
    name: 'Sirenfang', hp: 33, maxHp: 33, atk: 18, def: 5, agi: 12,
    color: 0x4499dd, exp: 42, gold: 55,
  },

  // ── The Hollow Deep tier (dungeon 4 — earth) ──
  rootHorror: {
    name: 'Root Horror', hp: 48, maxHp: 48, atk: 17, def: 8, agi: 5,
    color: 0x557733, exp: 50, gold: 62,
  },
  caveSpider: {
    name: 'Cave Spider', hp: 36, maxHp: 36, atk: 16, def: 4, agi: 13,
    color: 0x442266, exp: 48, gold: 58,
    poisonChance: 0.35,
  },
  tombWarden: {
    name: 'Tomb Warden', hp: 60, maxHp: 60, atk: 19, def: 13, agi: 4,
    color: 0x778899, exp: 65, gold: 85,
  },
  cryptPriest: {
    name: 'Crypt Priest', hp: 42, maxHp: 42, atk: 14, def: 6, agi: 8,
    color: 0x997799, exp: 58, gold: 75,
    spell: { name: 'Dark', power: 1.6 },
    healAlly: true,
  },

  // ── The Storm Spire tier (dungeon 5 — storm) ──
  stormHawk: {
    name: 'Storm Hawk', hp: 45, maxHp: 45, atk: 20, def: 6, agi: 17,
    color: 0x88bbdd, exp: 68, gold: 82,
  },
  voltSprite: {
    name: 'Volt Sprite', hp: 38, maxHp: 38, atk: 17, def: 5, agi: 15,
    color: 0xddeeff, exp: 64, gold: 78,
    spell: { name: 'Thunder', power: 1.5 },
  },
  thunderOgre: {
    name: 'Thunder Ogre', hp: 85, maxHp: 85, atk: 24, def: 10, agi: 6,
    color: 0x556677, exp: 90, gold: 110,
  },
  mistLurker: {
    name: 'Mist Lurker', hp: 52, maxHp: 52, atk: 21, def: 7, agi: 11,
    color: 0xaabbbb, exp: 72, gold: 88,
    spell: { name: 'Thunder', power: 1.4 },
    silenceChance: 0.3,
  },

  // ── Overworld: later regions ──
  wolfPack: {
    name: 'Dire Wolf', hp: 26, maxHp: 26, atk: 14, def: 4, agi: 14,
    color: 0x777788, exp: 22, gold: 26,
  },
  bandit: {
    name: 'Bandit', hp: 34, maxHp: 34, atk: 15, def: 6, agi: 12,
    color: 0x995555, exp: 30, gold: 45,
  },
  armoredKnight: {
    name: 'Armored Knight', hp: 70, maxHp: 70, atk: 21, def: 16, agi: 8,
    color: 0x8899bb, exp: 75, gold: 120,
    counterPhysical: true,
  },

  // ── Bosses (7 — one per relic dungeon + disgraced knight + final 2 phases) ──
  boss_goblin: {
    name: 'Goblin Warlord', hp: 80, maxHp: 80, atk: 15, def: 8, agi: 7,
    color: 0xdd2222, exp: 100, gold: 200, boss: true,
  },
  boss_magma: {
    name: 'Emberlord Ignis', hp: 150, maxHp: 150, atk: 20, def: 10, agi: 9,
    color: 0xff5500, exp: 260, gold: 500, boss: true,
    spell: { name: 'Fire', power: 1.6 },
  },
  boss_tide: {
    name: 'Leviathan Priest', hp: 220, maxHp: 220, atk: 22, def: 12, agi: 10,
    color: 0x2266cc, exp: 400, gold: 800, boss: true,
    spell: { name: 'Ice', power: 1.7 },
    healAlly: true,
    silenceChance: 0.35,
  },
  boss_hollow: {
    name: 'The Hollow King', hp: 300, maxHp: 300, atk: 26, def: 14, agi: 9,
    color: 0x553311, exp: 600, gold: 1200, boss: true,
    poisonChance: 0.4,
    counterPhysical: true,
  },
  boss_storm: {
    name: 'Storm Sovereign', hp: 380, maxHp: 380, atk: 30, def: 15, agi: 14,
    color: 0xccddff, exp: 900, gold: 2000, boss: true,
    spell: { name: 'Thunder', power: 1.8 },
    stunChance: 0.3,
  },
  boss_disgraced: {
    name: 'Sir Gareth the Disgraced', hp: 450, maxHp: 450, atk: 32, def: 16, agi: 12,
    color: 0x8b0000, exp: 1200, gold: 0, boss: true,
    counterPhysical: true,
    spell: { name: 'Dark', power: 1.7 },
  },
  boss_aldric_p1: {
    name: 'Aldric, the Party Knight', hp: 420, maxHp: 420, atk: 30, def: 16, agi: 13,
    color: 0xc0c0d0, exp: 0, gold: 0, boss: true,
    spell: { name: 'Holy', power: 1.7 },
  },
  boss_aldric_p2: {
    name: 'Aldric, Hollowed by Grief', hp: 500, maxHp: 500, atk: 36, def: 17, agi: 14,
    color: 0x331133, exp: 0, gold: 0, boss: true,
    spell: { name: 'Dark', power: 1.9 },
    stunChance: 0.25,
  },
};

/** Area encounter tables — weighted formations. `enemies` = type names. */
export const AREAS = {
  overworld: {
    rateTiles: [8, 12],
    formations: [
      { weight: 4, enemies: ['slime'] },
      { weight: 3, enemies: ['slime', 'slime'] },
      { weight: 2, enemies: ['bat'] },
      { weight: 2, enemies: ['goblin'] },
      { weight: 1, enemies: ['bat', 'slime'] },
      { weight: 1, enemies: ['goblin', 'slime'] },
      { weight: 1, enemies: ['goblinShaman'] },
    ],
  },
  ruins: {
    rateTiles: [6, 10],
    formations: [
      { weight: 3, enemies: ['slime', 'bat'] },
      { weight: 3, enemies: ['goblin', 'goblin'] },
      { weight: 2, enemies: ['ruinsZombie'] },
      { weight: 2, enemies: ['wisp'] },
      { weight: 1, enemies: ['ruinsZombie', 'goblin'] },
      { weight: 1, enemies: ['wisp', 'bat', 'bat'] },
    ],
  },
  embers: {
    rateTiles: [6, 9],
    formations: [
      { weight: 3, enemies: ['magmaSlime'] },
      { weight: 3, enemies: ['fireImp'] },
      { weight: 2, enemies: ['emberBat', 'emberBat'] },
      { weight: 2, enemies: ['magmaSlime', 'fireImp'] },
      { weight: 1, enemies: ['golem'] },
      { weight: 1, enemies: ['fireImp', 'emberBat', 'emberBat'] },
    ],
  },
  coast: {
    rateTiles: [7, 11],
    formations: [
      { weight: 3, enemies: ['wolfPack'] },
      { weight: 2, enemies: ['bandit'] },
      { weight: 2, enemies: ['bandit', 'wolfPack'] },
      { weight: 1, enemies: ['armoredKnight'] },
      { weight: 1, enemies: ['goblinShaman', 'bandit'] },
    ],
  },
  tide: {
    rateTiles: [6, 9],
    formations: [
      { weight: 3, enemies: ['tideCrab'] },
      { weight: 3, enemies: ['jellyfish'] },
      { weight: 2, enemies: ['sirenfang', 'tideCrab'] },
      { weight: 2, enemies: ['coralWraith'] },
      { weight: 1, enemies: ['jellyfish', 'jellyfish', 'tideCrab'] },
      { weight: 1, enemies: ['coralWraith', 'sirenfang'] },
    ],
  },
  hollow: {
    rateTiles: [6, 9],
    formations: [
      { weight: 3, enemies: ['rootHorror'] },
      { weight: 2, enemies: ['caveSpider', 'caveSpider'] },
      { weight: 2, enemies: ['tombWarden'] },
      { weight: 2, enemies: ['rootHorror', 'caveSpider'] },
      { weight: 1, enemies: ['cryptPriest', 'rootHorror'] },
      { weight: 1, enemies: ['tombWarden', 'caveSpider', 'caveSpider'] },
    ],
  },
  spire: {
    rateTiles: [6, 9],
    formations: [
      { weight: 3, enemies: ['stormHawk'] },
      { weight: 3, enemies: ['voltSprite'] },
      { weight: 2, enemies: ['mistLurker'] },
      { weight: 2, enemies: ['stormHawk', 'voltSprite'] },
      { weight: 1, enemies: ['thunderOgre'] },
      { weight: 1, enemies: ['voltSprite', 'voltSprite', 'stormHawk'] },
    ],
  },
  endgame: {
    rateTiles: [7, 11],
    formations: [
      { weight: 3, enemies: ['armoredKnight'] },
      { weight: 2, enemies: ['mistLurker', 'mistLurker'] },
      { weight: 2, enemies: ['thunderOgre'] },
      { weight: 1, enemies: ['cryptPriest', 'armoredKnight'] },
      { weight: 1, enemies: ['bandit', 'bandit', 'bandit'] },
    ],
  },
};

/** Pick a weighted-random formation for an area key. */
export function rollEncounter(areaKey) {
  const area = AREAS[areaKey];
  if (!area) return ['slime'];
  const total = area.formations.reduce((sum, f) => sum + (f.weight || 0), 0);
  let roll = Math.random() * total;
  for (const f of area.formations) {
    roll -= (f.weight || 0);
    if (roll < 0) return [...f.enemies];
  }
  return [...area.formations[0].enemies];
}

/** Resolve type names into spawn-ready enemy instances (deep copy). */
export function spawnEnemies(typeNames) {
  return typeNames.map((type, i) => {
    const tmpl = ENEMIES[type] || ENEMIES.slime;
    return { ...JSON.parse(JSON.stringify(tmpl)), type, index: i, defending: false, alive: true, side: 'enemy', id: 'enemy_' + i };
  });
}