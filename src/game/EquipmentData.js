/**
 * EquipmentData — weapons, armor, accessories (Phase 8).
 * Universal equips (any character, any job) — placeholder simplicity;
 * per-job restrictions can come with the Phase 9 design pass.
 *
 * Slots: weapon, armor, accessory.
 * Stat bonuses are added on top of job stats via GameState.getEffectiveChar().
 */

export const EQUIPMENT = {
  // ── Weapons ──
  BronzeSword:  { name: 'Bronze Sword',  type: 'weapon', slot: 'weapon', atk: 4,  price: 120,  description: 'A simple bronze blade.' },
  CoralBlade:   { name: 'Coral Blade',   type: 'weapon', slot: 'weapon', atk: 7,  price: 320,  description: 'Carved from tide-coral, never dulls.' },
  TideRod:      { name: 'Tide Rod',      type: 'weapon', slot: 'weapon', mag: 5,  price: 300,  description: 'Hums with the sea\'s pull. Boosts MAG.' },
  IronSword:    { name: 'Iron Sword',    type: 'weapon', slot: 'weapon', atk: 11, price: 650,  description: 'Standard-issue forged iron.' },
  IronStaff:    { name: 'Iron Staff',    type: 'weapon', slot: 'weapon', mag: 9,  price: 600,  description: 'A cold iron focus rod. Boosts MAG.' },
  StormEdge:    { name: 'Storm Edge',    type: 'weapon', slot: 'weapon', atk: 15, price: 1300, description: 'Holds a crackle of thunder.' },
  SkyRod:       { name: 'Sky Rod',       type: 'weapon', slot: 'weapon', mag: 13, price: 1200, description: 'Channels the thin air of the peaks.' },
  RuneBlade:    { name: 'Rune Blade',    type: 'weapon', slot: 'weapon', atk: 19, price: 2200, description: 'Old runes wake when blood is near.' },
  SageStaff:    { name: 'Sage Staff',    type: 'weapon', slot: 'weapon', mag: 17, price: 2100, description: 'The relic-smiths\' last work.' },

  // ── Armor ──
  LeatherVest:  { name: 'Leather Vest',  type: 'armor', slot: 'armor', def: 3,  price: 100,  description: 'Better than nothing.' },
  ScaleMail:    { name: 'Scale Mail',    type: 'armor', slot: 'armor', def: 6,  price: 350,  description: 'Overlapping river-fish scales.' },
  ShellRobe:    { name: 'Shell Robe',    type: 'armor', slot: 'armor', mdef: 6, price: 380,  description: 'Woven of tempered shell-silk. Boosts MDEF.' },
  IronArmor:    { name: 'Iron Armor',    type: 'armor', slot: 'armor', def: 10, price: 700,  description: 'Heavy, honest protection.' },
  StormPlate:   { name: 'Storm Plate',   type: 'armor', slot: 'armor', def: 14, price: 1400, description: 'Forged on Skyhold\'s peak anvils.' },
  RuneMail:     { name: 'Rune Mail',     type: 'armor', slot: 'armor', def: 18, price: 2400, description: 'Relic-etched chain, light as cloth.' },

  // ── Accessories ──
  PowerRing:    { name: 'Power Ring',    type: 'accessory', slot: 'accessory', atk: 3,  price: 250,  description: 'A tight band that steels the arm.' },
  GuardRing:    { name: 'Guard Ring',    type: 'accessory', slot: 'accessory', def: 3,  price: 250,  description: 'A band that steadies the guard.' },
  SpiritAmulet: { name: 'Spirit Amulet', type: 'accessory', slot: 'accessory', mag: 3,  price: 250,  description: 'A charm that sharpens focus.' },
  SpeedBand:    { name: 'Speed Band',    type: 'accessory', slot: 'accessory', agi: 5,  price: 400,  description: 'Woven windgrass bracelet.' },
  LuckCharm:    { name: 'Luck Charm',    type: 'accessory', slot: 'accessory', luck: 5, price: 400,  description: 'A gambler\'s worn coin, bored and strung.' },
  PhoenixCharm: { name: 'Phoenix Charm', type: 'accessory', slot: 'accessory', mdef: 5, price: 600,  description: 'Warm to the touch, always.' },
};

/** Get equipment definition by key OR display name. */
export function getEquip(name) {
  if (EQUIPMENT[name]) return EQUIPMENT[name];
  // Inventory/equipment stores carry the display name — resolve it too
  return Object.values(EQUIPMENT).find(e => e.name === name) || null;
}

/** All stat bonus keys an equipment piece can carry. */
export const EQUIP_BONUS_KEYS = ['atk', 'def', 'mag', 'mdef', 'agi', 'luck'];