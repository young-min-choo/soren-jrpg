/**
 * DungeonInstances — the three Phase 8 relic dungeons, built from
 * RelicDungeonScene configs, plus the two finale areas (ConduitGate,
 * Conduit). Story content lives in story.js; these are scene wiring.
 */
import { makeRelicDungeon } from './RelicDungeonScene.js';
import { playRelicTideScene, playRelicHollowScene, playRelicSpireScene } from '../game/story.js';

// ── Tide Temple (Water Relic) — plates puzzle, 2 plates ──
export const TideTempleScene = makeRelicDungeon({
  sceneKey: 'TideTemple',
  theme: 'dgn_tide',
  area: 'tide',
  bossType: 'boss_tide',
  bossName: 'the Leviathan Priest',
  bossColor: 0x2266cc,
  relicFlag: 'relicWater',
  playRelicScene: playRelicTideScene,
  puzzle: 'plates',
  plateCount: 2,
  bg: '#04121f',
  hint: 'Tide Temple — Step on both moon-plates to part the water gate',
  solvedMsg: 'The water recedes — the path to the Leviathan Priest opens!',
});

// ── Hollow Deep (Earth Relic) — blocks puzzle, 3 switches ──
export const HollowDeepScene = makeRelicDungeon({
  sceneKey: 'HollowDeep',
  theme: 'dgn_hollow',
  area: 'hollow',
  bossType: 'boss_hollow',
  bossName: 'the Hollow King',
  bossColor: 0x553311,
  relicFlag: 'relicEarth',
  playRelicScene: playRelicHollowScene,
  puzzle: 'blocks',
  plateCount: 3,
  bg: '#0f0a05',
  hint: 'The Hollow Deep — Push the gravestones onto the old altars',
  solvedMsg: 'The altars accept their due — the crypt door grinds open!',
});

// ── Storm Spire (Storm Relic) — plates puzzle, 3 plates ──
export const StormSpireScene = makeRelicDungeon({
  sceneKey: 'StormSpire',
  theme: 'dgn_spire',
  area: 'spire',
  bossType: 'boss_storm',
  bossName: 'the Storm Sovereign',
  bossColor: 0xccddff,
  relicFlag: 'relicStorm',
  playRelicScene: playRelicSpireScene,
  puzzle: 'plates',
  plateCount: 3,
  bg: '#0a0f1f',
  hint: 'The Storm Spire — Ground the storm: step on all three lightning rods',
  solvedMsg: 'The storm grounds itself — the Sovereign\'s sanctum opens!',
});