import GameState from './GameState.js';

/**
 * PortraitKeys — resolve a dialogue SPEAKER (display string) to a stable
 * portrait art key, or null if no art exists (DialogueScene shows the '?'
 * placeholder fallback).
 *
 * ART-BIBLE rule: never key art by user-editable strings. The hero's name
 * is user-entered at new-game, so the ONLY safe way to detect "the hero is
 * speaking" is comparing against GameState party[0].name at runtime.
 * All other speakers are hardcoded story constants, safe to map directly.
 *
 * Keys are snake_case art files: public/sprites/portraits/<key>.png
 * (preloaded by BootScene as `portrait_<key>`).
 */

// Display-name (story constant) → portrait art key (snake_case)
const SPEAKER_MAP = {
  'Elder': 'elder',
  'Townsfolk': 'townsfolk',
  'Dockhand': 'dockhand',
  'Harbormaster': 'harbormaster',
  'Neve': 'neve',
  'Quarry Chief': 'quarry_chief',
  'Warden': 'warden',
  'Abbot': 'abbot',
  'Windreader': 'windreader',
  'Chronicler': 'chronicler',
  'High Scholar': 'high_scholar',
  'Villager': 'villager',
  'Gareth': 'gareth',
  'Aria': 'aria',
  'Kael': 'kael',
  'Aldric': 'aldric',
};

export function resolvePortraitKey(speaker) {
  if (!speaker) return null;
  // Hero: user-renamable — resolve through live GameState, never the literal.
  const party = GameState.get().party;
  if (party && party[0] && party[0].name === speaker) return 'soren';
  return SPEAKER_MAP[speaker] || null;
}