/**
 * JobData — job definitions, stats, growth curves, and abilities.
 * FF3-style: change jobs freely in town, keep learned abilities.
 */

export const JOBS = {
  // --- Starting jobs ---
  Warrior: {
    name: 'Warrior',
    description: 'A sturdy fighter with high HP and ATK.',
    baseStats: { hp: 30, mp: 5, atk: 12, def: 10, mag: 3, mdef: 4, agi: 8, luck: 5 },
    growth:   { hp: 8,  mp: 1, atk: 3,  def: 2, mag: 1, mdef: 1, agi: 1, luck: 1 },
    abilities: [
      { name: 'Power Strike', mpCost: 3, level: 1, type: 'physical', power: 1.5, description: 'A powerful melee strike.' },
      { name: 'Guard', mpCost: 2, level: 3, type: 'buff', description: 'Raise defense for 3 turns.' },
    ],
  },
  Mage: {
    name: 'Mage',
    description: 'A spellcaster with high MAG but low HP.',
    baseStats: { hp: 18, mp: 15, atk: 5, def: 4, mag: 12, mdef: 8, agi: 7, luck: 6 },
    growth:   { hp: 4,  mp: 4, atk: 1,  def: 1, mag: 3, mdef: 2, agi: 1, luck: 1 },
    abilities: [
      { name: 'Fire', mpCost: 4, level: 1, type: 'magic', power: 1.4, element: 'fire', description: 'Fire damage to one enemy.' },
      { name: 'Ice', mpCost: 4, level: 1, type: 'magic', power: 1.4, element: 'ice', description: 'Ice damage to one enemy.' },
      { name: 'Thunder', mpCost: 6, level: 5, type: 'magic', power: 1.8, element: 'thunder', description: 'Thunder damage to one enemy.' },
    ],
  },
  Ranger: {
    name: 'Ranger',
    description: 'A swift hunter with high AGI and LUCK.',
    baseStats: { hp: 22, mp: 8, atk: 9, def: 6, mag: 5, mdef: 5, agi: 12, luck: 10 },
    growth:   { hp: 5,  mp: 2, atk: 2,  def: 1, mag: 1, mdef: 1, agi: 3, luck: 2 },
    abilities: [
      { name: 'Quick Shot', mpCost: 3, level: 1, type: 'physical', power: 1.3, description: 'A fast arrow strike.' },
      { name: 'Aim', mpCost: 2, level: 4, type: 'buff', description: 'Raise crit rate for 3 turns.' },
    ],
  },
  Monk: {
    name: 'Monk',
    description: 'A martial artist who can heal and fight.',
    baseStats: { hp: 26, mp: 10, atk: 10, def: 7, mag: 7, mdef: 6, agi: 9, luck: 5 },
    growth:   { hp: 6,  mp: 2, atk: 2,  def: 2, mag: 2, mdef: 1, agi: 2, luck: 1 },
    abilities: [
      { name: 'Heal', mpCost: 5, level: 1, type: 'heal', power: 1.5, description: 'Restore HP to one ally.' },
      { name: 'Palm Strike', mpCost: 3, level: 3, type: 'physical', power: 1.3, description: 'A focused melee strike.' },
    ],
  },

  // --- Unlockable jobs (gained through story) ---
  Thief: {
    name: 'Thief',
    description: 'A nimble rogue who can steal items.',
    baseStats: { hp: 20, mp: 8, atk: 8, def: 5, mag: 4, mdef: 4, agi: 14, luck: 12 },
    growth:   { hp: 5,  mp: 2, atk: 2,  def: 1, mag: 1, mdef: 1, agi: 3, luck: 3 },
    abilities: [
      { name: 'Steal', mpCost: 0, level: 1, type: 'steal', description: 'Steal an item from an enemy.' },
      { name: 'Flee', mpCost: 0, level: 1, type: 'flee', description: 'Higher flee success rate.' },
    ],
  },
  Knight: {
    name: 'Knight',
    description: 'A heavy armor warrior with high DEF.',
    baseStats: { hp: 35, mp: 6, atk: 13, def: 13, mag: 3, mdef: 5, agi: 7, luck: 4 },
    growth:   { hp: 9,  mp: 1, atk: 3,  def: 3, mag: 1, mdef: 1, agi: 1, luck: 1 },
    abilities: [
      { name: 'Cover', mpCost: 3, level: 1, type: 'buff', description: 'Protect an ally from physical attacks.' },
      { name: 'Slash', mpCost: 4, level: 3, type: 'physical', power: 1.5, description: 'A heavy sword slash.' },
    ],
  },
  Priest: {
    name: 'Priest',
    description: 'A dedicated healer with high MDEF.',
    baseStats: { hp: 20, mp: 18, atk: 4, def: 5, mag: 11, mdef: 10, agi: 7, luck: 6 },
    growth:   { hp: 5,  mp: 5, atk: 1,  def: 1, mag: 2, mdef: 2, agi: 1, luck: 1 },
    abilities: [
      { name: 'Heal', mpCost: 4, level: 1, type: 'heal', power: 1.8, description: 'Restore HP to one ally.' },
      { name: 'Cure', mpCost: 6, level: 3, type: 'heal', power: 1.2, description: 'Cure status effects.' },
    ],
  },
  Berserker: {
    name: 'Berserker',
    description: 'A wild fighter with massive ATK but low defense.',
    baseStats: { hp: 32, mp: 3, atk: 16, def: 6, mag: 2, mdef: 3, agi: 9, luck: 5 },
    growth:   { hp: 8,  mp: 0, atk: 4,  def: 1, mag: 0, mdef: 1, agi: 2, luck: 1 },
    abilities: [
      { name: 'Rage', mpCost: 0, level: 1, type: 'buff', description: 'Double ATK for 3 turns, lose control.' },
      { name: 'Crush', mpCost: 3, level: 5, type: 'physical', power: 2.0, description: 'A devastating blow.' },
    ],
  },
  Sage: {
    name: 'Sage',
    description: 'A master of both white and black magic.',
    baseStats: { hp: 22, mp: 25, atk: 5, def: 5, mag: 14, mdef: 9, agi: 7, luck: 6 },
    growth:   { hp: 5,  mp: 6, atk: 1,  def: 1, mag: 3, mdef: 2, agi: 1, luck: 1 },
    abilities: [
      { name: 'Fire', mpCost: 4, level: 1, type: 'magic', power: 1.4, element: 'fire', description: 'Fire damage to one enemy.' },
      { name: 'Heal', mpCost: 4, level: 1, type: 'heal', power: 1.8, description: 'Restore HP to one ally.' },
      { name: 'Blizzard', mpCost: 8, level: 5, type: 'magic', power: 2.0, element: 'ice', description: 'Ice damage to all enemies.' },
    ],
  },
  Paladin: {
    name: 'Paladin',
    description: 'A holy knight who can fight and heal.',
    baseStats: { hp: 30, mp: 12, atk: 12, def: 10, mag: 8, mdef: 8, agi: 8, luck: 5 },
    growth:   { hp: 7,  mp: 3, atk: 2,  def: 2, mag: 2, mdef: 2, agi: 1, luck: 1 },
    abilities: [
      { name: 'Holy Strike', mpCost: 5, level: 1, type: 'physical', power: 1.5, element: 'holy', description: 'A holy-imbued strike.' },
      { name: 'Heal', mpCost: 5, level: 3, type: 'heal', power: 1.5, description: 'Restore HP to one ally.' },
    ],
  },
  DarkKnight: {
    name: 'Dark Knight',
    description: 'A fallen knight who drains life from enemies.',
    baseStats: { hp: 28, mp: 10, atk: 14, def: 8, mag: 6, mdef: 5, agi: 8, luck: 4 },
    growth:   { hp: 7,  mp: 2, atk: 3,  def: 2, mag: 1, mdef: 1, agi: 2, luck: 1 },
    abilities: [
      { name: 'Dark Drain', mpCost: 6, level: 1, type: 'drain', power: 1.3, description: 'Damage enemy and heal self.' },
      { name: 'Shadow Slash', mpCost: 5, level: 5, type: 'physical', power: 1.8, element: 'dark', description: 'A dark-imbued slash.' },
    ],
  },
  Ninja: {
    name: 'Ninja',
    description: 'A master of speed and stealth.',
    baseStats: { hp: 24, mp: 10, atk: 13, def: 6, mag: 5, mdef: 5, agi: 16, luck: 10 },
    growth:   { hp: 6,  mp: 2, atk: 3,  def: 1, mag: 1, mdef: 1, agi: 4, luck: 2 },
    abilities: [
      { name: 'Throw', mpCost: 3, level: 1, type: 'physical', power: 1.5, description: 'Throw a weapon for damage.' },
      { name: 'Shadow Clone', mpCost: 8, level: 5, type: 'buff', description: 'Create a decoy that absorbs one hit.' },
    ],
  },
};

// Starting jobs available at game start
export const STARTING_JOBS = ['Warrior', 'Mage', 'Ranger', 'Monk'];

// Jobs unlocked through story progression
export const UNLOCKABLE_JOBS = ['Thief', 'Knight', 'Priest', 'Berserker', 'Sage', 'Paladin', 'DarkKnight', 'Ninja'];

/**
 * Get stats for a character at a given level with a given job.
 * baseStats from job + growth * (level - 1)
 */
export function getStatsForLevel(jobName, level) {
  const job = JOBS[jobName];
  if (!job) return null;
  const stats = {};
  for (const key of Object.keys(job.baseStats)) {
    stats[key] = Math.floor(job.baseStats[key] + job.growth[key] * (level - 1));
  }
  return stats;
}

/**
 * Get abilities available for a job at a given job level.
 */
export function getAbilitiesForJobLevel(jobName, jobLevel) {
  const job = JOBS[jobName];
  if (!job) return [];
  return job.abilities.filter(a => a.level <= jobLevel);
}