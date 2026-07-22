/**
 * SaveSystem — localStorage-based save/load.
 * 3 save slots + autosave. Saves all party state, position, flags.
 */

const SAVE_KEY_PREFIX = 'soren_save_';
const AUTOSAVE_KEY = 'soren_autosave';

export const SaveSystem = {
  getSaveSlots() {
    const slots = [];
    for (let i = 0; i < 3; i++) {
      const data = localStorage.getItem(SAVE_KEY_PREFIX + i);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          slots.push({
            empty: false,
            name: parsed.party[0]?.name || '???',
            level: parsed.party[0]?.level || 1,
            gold: parsed.gold || 0,
            scene: parsed.scene || 'Overworld',
            timestamp: parsed.timestamp || 0,
            timeText: parsed.timestamp ? new Date(parsed.timestamp).toLocaleString() : '',
          });
        } catch {
          slots.push({ empty: true });
        }
      } else {
        slots.push({ empty: true });
      }
    }
    return slots;
  },

  save(slotIndex, gameState) {
    const data = {
      ...gameState,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY_PREFIX + slotIndex, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      return false;
    }
  },

  load(slotIndex) {
    try {
      const data = localStorage.getItem(SAVE_KEY_PREFIX + slotIndex);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      console.error('Load failed:', e);
      return null;
    }
  },

  autosave(gameState) {
    try {
      const data = { ...gameState, timestamp: Date.now() };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },

  loadAutosave() {
    try {
      const data = localStorage.getItem(AUTOSAVE_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  hasAutosave() {
    return localStorage.getItem(AUTOSAVE_KEY) !== null;
  },

  deleteSave(slotIndex) {
    localStorage.removeItem(SAVE_KEY_PREFIX + slotIndex);
  },
};