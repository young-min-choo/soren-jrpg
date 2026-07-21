/**
 * GameState — persistent player state across scenes and battles.
 * Imported by any scene that needs to read/write player stats.
 * 
 * In a full game this would be saved/loaded. For now it's a singleton.
 */

const initialState = {
  name: 'Soren',
  job: 'Warrior',
  level: 1,
  exp: 0,
  expToNext: 20,
  hp: 30, maxHp: 30,
  mp: 10, maxMp: 10,
  atk: 10, def: 5,
  mag: 5, mdef: 5,
  agi: 8,
  luck: 5,
  gold: 0,
};

let state = { ...initialState };

export const GameState = {
  get() {
    return state;
  },

  /** Apply battle results: remaining HP/MP, EXP/gold gained */
  applyBattleResult(result, rewards) {
    if (result === 'flee') return;
    if (rewards) {
      state.exp += rewards.exp || 0;
      state.gold += rewards.gold || 0;
    }
    // Check level up
    while (state.exp >= state.expToNext) {
      state.exp -= state.expToNext;
      state.level++;
      state.expToNext = Math.floor(state.expToNext * 1.5);
      // Simple stat growth (Warrior curve)
      state.maxHp += 5;
      state.maxMp += 2;
      state.atk += 2;
      state.def += 1;
      state.hp = state.maxHp; // full heal on level up
      state.mp = state.maxMp;
    }
  },

  /** Heal to full (save points, inn, etc.) */
  fullHeal() {
    state.hp = state.maxHp;
    state.mp = state.maxMp;
  },

  /** Reset to initial state (new game) */
  reset() {
    state = { ...initialState };
  },
};

export default GameState;