/**
 * EnemyData — enemy templates, per-area encounter tables, and formations.
 * Extracted from BattleScene (Phase 8): enemies are data, not scene code.
 *
 * Area contract (design doc §8): each area has its own encounter table
 * with weighted formations. BattleScene launches with enemy type names;
 * per-area stat scaling happens at spawn via `scale()`.
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

  // ── Bosses ──
  boss_goblin: {
    name: 'Goblin Warlord', hp: 80, maxHp: 80, atk: 15, def: 8, agi: 7,
    color: 0xdd2222, exp: 100, gold: 200, boss: true,
  },
  boss_magma: {
    name: 'Emberlord Ignis', hp: 150, maxHp: 150, atk: 20, def: 10, agi: 9,
    color: 0xff5500, exp: 260, gold: 500, boss: true,
    spell: { name: 'Fire', power: 1.6 },
  },
};

/** Area encounter tables — weighted formations. `enemies` = type names. */
export const AREAS = {
  overworld: {
    rateTiles: [8, 12], // encounter every 8-12 tiles
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
};

/** Pick a weighted-random formation for an area key. */
export function rollEncounter(areaKey) {
  const area = AREAS[areaKey];
  if (!area) return ['slime'];
  const total = area.formations.reduce((sum, f) => sum + f.weight, 0);
  let roll = Math.random() * total;
  for (const f of area.formations) {
    roll -= f.weight;
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