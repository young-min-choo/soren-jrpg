/**
 * WorldData — towns, overworld geography, and progression gates (Phase 8).
 * Single source of truth for the connected world. Scene classes stay thin;
 * layout + NPCs + gating live here.
 *
 * Overworld map is 40×32 tiles. The top-left 20×16 region is the ORIGINAL
 * map (village, ruins, embers cave) kept byte-compatible so existing save
 * positions, tests, and muscle memory still work.
 *
 * Progression gates (design doc §7: early story-gated, late ability-gated):
 *   embers   : relicWind   (existing)
 *   tide     : relicFire   (elder's next omen points to the coast)
 *   hollow   : relicWater
 *   spire    : airship     (unreachable peaks — granted after relicEarth)
 *   conduit  : betrayed    (the way opens only after Aldric's fall)
 */

export const OW_COLS = 40;
export const OW_ROWS = 32;

// Overworld entrance markers: { key, x, y, color, label, gate, sceneKey }
// gate = story flag required to ENTER the dungeon (towns are ungated).
export const OW_MARKERS = [
  { key: 'town',    x: 10, y: 8,  color: '#ffff00', label: 'Village',   sceneKey: 'Town',        gate: null },
  { key: 'ruins',   x: 16, y: 4,  color: '#ff4444', label: 'Ancient Ruins', sceneKey: 'Dungeon',  gate: null },
  { key: 'embers',  x: 3,  y: 2,  color: '#ffaa44', label: 'Cave of Embers', sceneKey: 'Embers', gate: 'relicWind' },
  { key: 'port',    x: 27, y: 10, color: '#ffff00', label: 'Port Meridian', sceneKey: 'PortMeridian', gate: null },
  { key: 'tide',    x: 33, y: 15, color: '#44aaff', label: 'Tide Temple',   sceneKey: 'TideTemple',  gate: 'relicFire' },
  { key: 'stonewatch', x: 10, y: 19, color: '#ffff00', label: 'Stonewatch', sceneKey: 'Stonewatch', gate: null },
  { key: 'hollow',  x: 5,  y: 25, color: '#aa6644', label: 'The Hollow Deep', sceneKey: 'HollowDeep', gate: 'relicWater' },
  { key: 'skyhold', x: 29, y: 7,  color: '#ffff00', label: 'Skyhold',        sceneKey: 'Skyhold',  gate: null },
  { key: 'spire',   x: 34, y: 2,  color: '#ddaa44', label: 'The Storm Spire', sceneKey: 'StormSpire', gate: 'airship' },
  { key: 'capital', x: 22, y: 3,  color: '#ffff00', label: 'Aurelia',        sceneKey: 'Aurelia',   gate: null },
  { key: 'conduit', x: 37, y: 22, color: '#aa44ff', label: 'The Conduit Gate', sceneKey: 'ConduitGate', gate: 'betrayed' },
];

// Airship docks (one near each town) — fast travel after the 'airship' flag.
export const OW_DOCKS = [
  { x: 11, y: 10 },  // Village
  { x: 28, y: 12 },  // Port Meridian
  { x: 11, y: 21 },  // Stonewatch
  { x: 30, y: 9 },   // Skyhold
  { x: 23, y: 5 },   // Aurelia
];

// ─── Towns ─────────────────────────────────────────────────────────────────
// NPC roles: 'elder' | 'townsfolk' | 'jobMaster' | 'shopkeeper' | 'innkeeper'
// npcKey routes dialogue through story.js npcDialogue(key); towns get their
// own dialogue keys so every settlement has its own voice.

export const TOWNS = {
  village: {
    key: 'village',
    sceneKey: 'Town',
    name: 'Village of Verdan',
    statusText: 'Village of Verdan — Walk to the ▲ marker and press Z to exit',
    shopKey: 'villageShop',
    innCost: 30,
    exitX: 8, exitY: 11,
    // Layout mirrors the original TownScene map exactly (tests depend on it):
    // 16×12, buildings at the same rects.
    cols: 16, rows: 12,
    buildings: [
      [2, 2, 3, 2], [10, 2, 4, 2], [2, 6, 3, 3], [10, 6, 4, 3],
    ],
    paths: [
      { dir: 'v', x: 8, from: 3, to: 11 },   // main street to exit
      { dir: 'h', y: 5, from: 2, to: 13 },   // cross street
    ],
    woods: [[5, 2], [9, 2], [5, 3], [9, 3]],
    npcs: [
      { x: 6,  y: 5,  tint: null,     role: 'townsfolk', name: 'Townsfolk', npcKey: 'townsfolk', wander: true },
      { x: 11, y: 5,  tint: 0x888888, role: 'elder',     name: 'Elder',     npcKey: 'elder' },
      { x: 8,  y: 8,  tint: 0x44ff44, role: 'jobMaster',  name: 'Job Master' },
      { x: 3,  y: 10, tint: 0xffdd44, role: 'shopkeeper', name: 'Shopkeeper' },
      { x: 12, y: 10, tint: 0x66aaff, role: 'innkeeper',  name: 'Innkeeper' },
    ],
  },

  port: {
    key: 'port',
    sceneKey: 'PortMeridian',
    name: 'Port Meridian',
    statusText: 'Port Meridian — Salt in the air. ▲ to exit',
    shopKey: 'portShop',
    innCost: 50,
    exitX: 8, exitY: 11,
    cols: 16, rows: 12,
    buildings: [
      [2, 2, 4, 2], [10, 2, 4, 2], [2, 6, 4, 3], [10, 6, 4, 3],
    ],
    paths: [
      { dir: 'v', x: 8, from: 3, to: 11 },
      { dir: 'h', y: 5, from: 2, to: 13 },
      { dir: 'h', y: 9, from: 2, to: 13 },   // harbor boardwalk
    ],
    woods: [[6, 2], [9, 2], [6, 3], [9, 3], [6, 9], [9, 9]],
    npcs: [
      { x: 4,  y: 5,  tint: null,     role: 'townsfolk', name: 'Dockhand',   npcKey: 'dockhand', wander: true },
      { x: 12, y: 5,  tint: 0x888888, role: 'elder',     name: 'Harbormaster', npcKey: 'harbormaster' },
      { x: 7,  y: 9,  tint: 0x44ff44, role: 'jobMaster', name: 'Job Master' },
      { x: 3,  y: 10, tint: 0xffdd44, role: 'shopkeeper', name: 'Shopkeeper' },
      { x: 12, y: 10, tint: 0x66aaff, role: 'innkeeper', name: 'Innkeeper' },
      { x: 5,  y: 9,  tint: 0xcc88aa, role: 'townsfolk', name: 'Neve',       npcKey: 'neve' }, // Kael's sister
    ],
  },

  stonewatch: {
    key: 'stonewatch',
    sceneKey: 'Stonewatch',
    name: 'Stonewatch',
    statusText: 'Stonewatch — Built on bones of the earth. ▲ to exit',
    shopKey: 'stonewatchShop',
    innCost: 80,
    exitX: 8, exitY: 11,
    cols: 16, rows: 12,
    buildings: [
      [2, 2, 3, 2], [11, 2, 3, 2], [2, 6, 3, 3], [11, 6, 3, 3],
    ],
    paths: [
      { dir: 'v', x: 8, from: 3, to: 11 },
      { dir: 'h', y: 5, from: 2, to: 13 },
    ],
    woods: [[6, 2], [10, 2], [6, 3], [10, 3], [6, 7], [10, 7]],
    npcs: [
      { x: 4,  y: 5,  tint: null,     role: 'townsfolk', name: 'Quarry Chief', npcKey: 'quarryChief' },
      { x: 11, y: 5,  tint: 0x888888, role: 'elder',     name: 'Warden',       npcKey: 'warden' },
      { x: 8,  y: 8,  tint: 0x44ff44, role: 'jobMaster', name: 'Job Master' },
      { x: 3,  y: 10, tint: 0xffdd44, role: 'shopkeeper', name: 'Shopkeeper' },
      { x: 12, y: 10, tint: 0x66aaff, role: 'innkeeper', name: 'Innkeeper' },
      { x: 6,  y: 10, tint: null,     role: 'villager',  name: 'Villager',     npcKey: 'villager', wander: true },
    ],
  },

  skyhold: {
    key: 'skyhold',
    sceneKey: 'Skyhold',
    name: 'Skyhold',
    statusText: 'Skyhold — Where the mountain monks keep the wind. ▲ to exit',
    shopKey: 'skyholdShop',
    innCost: 120,
    exitX: 8, exitY: 11,
    cols: 16, rows: 12,
    buildings: [
      [3, 2, 3, 2], [10, 2, 3, 2], [3, 6, 3, 3], [10, 6, 3, 3],
      [7, 2, 2, 2], // monastery hall, center
    ],
    paths: [
      { dir: 'v', x: 8, from: 4, to: 11 },
      { dir: 'h', y: 5, from: 2, to: 13 },
    ],
    woods: [[6, 3], [9, 3], [6, 7], [9, 7]],
    npcs: [
      { x: 4,  y: 5,  tint: null,     role: 'townsfolk', name: 'Windreader', npcKey: 'windreader' },
      { x: 11, y: 5,  tint: 0x888888, role: 'elder',     name: 'Abbot',       npcKey: 'abbot' }, // Aria reveal
      { x: 8,  y: 8,  tint: 0x44ff44, role: 'jobMaster', name: 'Job Master' },
      { x: 3,  y: 10, tint: 0xffdd44, role: 'shopkeeper', name: 'Shopkeeper' },
      { x: 12, y: 10, tint: 0x66aaff, role: 'innkeeper', name: 'Innkeeper' },
      { x: 9,  y: 10, tint: null,     role: 'villager',  name: 'Monk',        npcKey: 'villager', wander: true },
    ],
  },

  capital: {
    key: 'capital',
    sceneKey: 'Aurelia',
    name: 'Aurelia, the Capital',
    statusText: 'Aurelia — White spires, old debts. ▲ to exit',
    shopKey: 'capitalShop',
    innCost: 200,
    exitX: 8, exitY: 11,
    cols: 16, rows: 12,
    buildings: [
      [2, 2, 4, 2], [10, 2, 4, 2], [2, 6, 4, 3], [10, 6, 4, 3],
    ],
    paths: [
      { dir: 'v', x: 8, from: 3, to: 11 },
      { dir: 'h', y: 4, from: 2, to: 13 },
      { dir: 'h', y: 5, from: 2, to: 13 },
      { dir: 'h', y: 9, from: 2, to: 13 },
    ],
    woods: [[7, 2], [8, 2], [7, 3], [8, 3]],
    npcs: [
      { x: 4,  y: 5,  tint: null,     role: 'townsfolk', name: 'Chronicler', npcKey: 'chronicler' },
      { x: 12, y: 5,  tint: 0x888888, role: 'elder',     name: 'High Scholar', npcKey: 'highScholar' },
      { x: 7,  y: 8,  tint: 0x44ff44, role: 'jobMaster', name: 'Job Master' },
      { x: 3,  y: 10, tint: 0xffdd44, role: 'shopkeeper', name: 'Shopkeeper' },
      { x: 12, y: 10, tint: 0x66aaff, role: 'innkeeper', name: 'Innkeeper' },
      { x: 10, y: 10, tint: null,     role: 'villager',  name: 'Courtier',    npcKey: 'villager', wander: true },
    ],
  },
};

export function getTown(key) {
  return TOWNS[key] || null;
}

// ─── Relic order (story spine) ─────────────────────────────────────────────
export const RELIC_ORDER = ['relicWind', 'relicFire', 'relicWater', 'relicEarth', 'relicStorm'];

export function relicCount() {
  // Imported lazily elsewhere to avoid circular deps; WorldData stays pure data.
  return RELIC_ORDER;
}