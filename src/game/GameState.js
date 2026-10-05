/**
 * GameState — persistent player state across scenes and battles.
 * Full party (up to 4), equipment, story flags.
 */
import { JOBS, getStatsForLevel } from './JobData.js';
import { getStartingInventory } from './ItemData.js';
import { getEquip, EQUIP_BONUS_KEYS } from './EquipmentData.js';

// Battle-sprite art keys — stable per CHARACTER (not per display name).
// The hero can be renamed in the new-game flow; his art is always the
// protagonist sprite. Fixed cast map to their own art.
const SPRITE_KEYS = { Aria: 'aria_battle', Kael: 'kael_battle', Aldric: 'aldric_battle' };

function createCharacter(name, jobName, level = 1, playerName = null) {
  const stats = getStatsForLevel(jobName, level);
  return {
    name,
    // Stable art identity — battle sprite is picked by this key, NOT the
    // display name (player can rename the hero: name "Peter" must still
    // load the hero's sprite). Fixed cast members map to their art;
    // the renamed hero falls back to slot 0 (the protagonist).
    spriteKey: SPRITE_KEYS[name] || (name === playerName ? 'soren_battle' : undefined),
    job: jobName,
    level,
    jobLevel: 1,
    jobXp: 0,
    exp: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    mp: stats.mp,
    maxMp: stats.mp,
    atk: stats.atk,
    def: stats.def,
    mag: stats.mag,
    mdef: stats.mdef,
    agi: stats.agi,
    luck: stats.luck,
    alive: true,
    defending: false,
    // Abilities learned per job: { Warrior: ['Power Strike'], Mage: ['Fire'] }
    learnedAbilities: { [jobName]: JOBS[jobName].abilities.filter(a => a.level <= 1).map(a => a.name) },
    // JP (job points) for spending on abilities — per job
    jp: {},
    unlockedJobs: [jobName],
    // Phase 8: equipment { weapon: name|null, armor: name|null, accessory: name|null }
    equipment: { weapon: null, armor: null, accessory: null },
  };
}

function startingParty(playerName, playerJob) {
  // Design doc §3: hero + thief (Kael) + "white mage" (actually monk, Aria).
  // Kael arrives as a Thief — his sister subplot (Neve, Port Meridian) opens early.
  return [
    createCharacter(playerName, playerJob, 1, playerName),
    createCharacter('Aria', 'Monk', 1),
    createCharacter('Kael', 'Thief', 1),
  ];
}

const BASE_JOBS = ['Warrior', 'Mage', 'Ranger', 'Monk', 'Thief'];

let state = {
  party: startingParty('Soren', 'Warrior'),
  gold: 0,
  inventory: getStartingInventory(),
  equipment: {},       // owned equipment: { name: qty }
  storyFlags: {},
  unlockedJobs: [...BASE_JOBS],
  // Position tracking for save/load
  scene: 'Overworld',
  x: 336,
  y: 336,
};

const GameState = {
  get() { return state; },

  getParty() { return state.party; },

  getCharacter(index) { return state.party[index]; },

  // --- Inventory management ---
  getInventory() { return state.inventory; },

  getItemQty(name) {
    const entry = state.inventory.find(i => i.name === name);
    return entry ? entry.qty : 0;
  },

  addItem(name, qty = 1) {
    const entry = state.inventory.find(i => i.name === name);
    if (entry) {
      entry.qty += qty;
    } else {
      state.inventory.push({ name, qty });
    }
  },

  removeItem(name, qty = 1) {
    const entry = state.inventory.find(i => i.name === name);
    if (!entry || entry.qty < qty) return false;
    entry.qty -= qty;
    if (entry.qty <= 0) {
      state.inventory = state.inventory.filter(i => i.name !== name);
    }
    return true;
  },

  // --- Equipment (Phase 8) ---
  getOwnedEquipment() { return state.equipment; },

  getEquipQty(name) { return state.equipment[name] || 0; },

  addEquipment(name, qty = 1) {
    state.equipment[name] = (state.equipment[name] || 0) + qty;
  },

  removeEquipment(name, qty = 1) {
    if (!state.equipment[name] || state.equipment[name] < qty) return false;
    state.equipment[name] -= qty;
    if (state.equipment[name] <= 0) delete state.equipment[name];
    return true;
  },

  equip(charIndex, slot, equipName) {
    const char = state.party[charIndex];
    if (!char) return false;
    const def = getEquip(equipName);
    if (!def || def.slot !== slot) return false;
    // Must own it (or it's already equipped — no-op)
    if (!state.equipment[equipName]) return false;
    // Return previously equipped piece to inventory
    const prev = char.equipment[slot];
    if (prev) state.equipment[prev] = (state.equipment[prev] || 0) + 1;
    state.equipment[equipName] -= 1;
    if (state.equipment[equipName] <= 0) delete state.equipment[equipName];
    char.equipment[slot] = equipName;
    return true;
  },

  unequip(charIndex, slot) {
    const char = state.party[charIndex];
    if (!char || !char.equipment[slot]) return false;
    state.equipment[char.equipment[slot]] = (state.equipment[char.equipment[slot]] || 0) + 1;
    char.equipment[slot] = null;
    return true;
  },

  /** Character stats + equipment bonuses. Returns a NEW object (safe to mutate). */
  effectiveChar(charIndex) {
    const char = state.party[charIndex];
    if (!char) return null;
    const eff = { ...char };
    for (const slot of ['weapon', 'armor', 'accessory']) {
      const eqName = char.equipment && char.equipment[slot];
      if (!eqName) continue;
      const def = getEquip(eqName);
      if (!def) continue;
      for (const key of EQUIP_BONUS_KEYS) {
        if (def[key]) eff[key] = (eff[key] || 0) + def[key];
      }
    }
    return eff;
  },

  // --- Party roster (story arc) ---

  /**
   * Add a new party member (e.g. Aldric the Knight joins after the Wind Relic).
   */
  addMember(name, jobName, level = 1) {
    if (state.party.length >= 4) return null;          // design: party of 4 max
    if (state.party.some(p => p.name === name)) return null;
    const char = createCharacter(name, jobName, level);
    // Fixed cast always resolve their art key (e.g. Aldric joining later).
    if (!char.spriteKey) char.spriteKey = SPRITE_KEYS[name] || null;
    state.party.push(char);
    GameState.unlockJob(jobName);
    return char;
  },

  /**
   * Remove a party member by name (the betrayal: Aldric leaves with the relics).
   */
  removeMember(name) {
    const idx = state.party.findIndex(p => p.name === name);
    if (idx === -1) return false;
    state.party.splice(idx, 1);
    return true;
  },

  /**
   * Change a character's job. FF3-style: keep learned abilities.
   */
  changeJob(charIndex, newJobName) {
    const char = state.party[charIndex];
    if (!char) return;
    // Keep learned abilities from old job
    if (!char.learnedAbilities[char.job]) {
      char.learnedAbilities[char.job] = [];
    }
    // Switch job
    char.job = newJobName;
    char.jobLevel = 1;
    char.jobXp = 0;
    // Recalculate base stats for new job at current level
    const stats = getStatsForLevel(newJobName, char.level);
    // Preserve HP/MP ratio on job change
    const hpRatio = char.hp / char.maxHp;
    const mpRatio = char.mp / char.maxMp;
    char.maxHp = stats.hp;
    char.maxMp = stats.mp;
    char.atk = stats.atk;
    char.def = stats.def;
    char.mag = stats.mag;
    char.mdef = stats.mdef;
    char.agi = stats.agi;
    char.luck = stats.luck;
    char.hp = Math.max(1, Math.floor(char.maxHp * hpRatio));
    char.mp = Math.floor(char.maxMp * mpRatio);
    // Add new job's level-1 abilities if not already learned
    if (!char.learnedAbilities[newJobName]) {
      char.learnedAbilities[newJobName] = JOBS[newJobName].abilities
        .filter(a => a.level <= 1).map(a => a.name);
    }
    GameState.unlockJob(newJobName);
  },

  /** Unlock a job for the whole party (story progression). */
  unlockJob(jobName) {
    if (!JOBS[jobName]) return false;
    if (!state.unlockedJobs.includes(jobName)) {
      state.unlockedJobs.push(jobName);
    }
    return true;
  },

  /**
   * Apply battle result — EXP, gold, job XP to all alive party members.
   */
  applyBattleResult(result, rewards) {
    if (result === 'win' && rewards) {
      const expShare = Math.floor(rewards.exp / state.party.length);
      const jpEarned = Math.max(5, Math.floor(rewards.exp / 10)); // JP = 10% of total exp, min 5
      state.gold += rewards.gold;
      state.party.forEach(char => {
        if (char.alive) {
          char.exp += expShare;
          // Award JP to current job
          if (!char.jp) char.jp = {};
          char.jp[char.job] = (char.jp[char.job] || 0) + jpEarned;
          // Level up check (every 100 exp, level cap 50 — design doc §9)
          while (char.exp >= char.level * 100 && char.level < 50) {
            char.exp -= char.level * 100;
            char.level++;
            const stats = getStatsForLevel(char.job, char.level);
            char.maxHp = stats.hp;
            char.maxMp = stats.mp;
            char.atk = stats.atk;
            char.def = stats.def;
            char.mag = stats.mag;
            char.mdef = stats.mdef;
            char.agi = stats.agi;
            char.luck = stats.luck;
            char.hp = char.maxHp; // full heal on level up
            char.mp = char.maxMp;
          }
          // Job level up (every 50 job XP)
          while (char.jobXp >= char.jobLevel * 50) {
            char.jobXp -= char.jobLevel * 50;
            char.jobLevel++;
            // Learn new abilities at new job level
            const job = JOBS[char.job];
            job.abilities.forEach(ability => {
              if (ability.level <= char.jobLevel && !char.learnedAbilities[char.job].includes(ability.name)) {
                char.learnedAbilities[char.job].push(ability.name);
              }
            });
          }
        }
      });
    }
    if (result === 'lose') {
      // Full heal on game over (classic FF behavior — Game Over screen comes in Phase 9)
      state.party.forEach(char => {
        char.hp = char.maxHp;
        char.mp = char.maxMp;
        char.alive = true;
      });
    }
  },

  /**
   * Heal all party members to full.
   */
  fullHeal() {
    state.party.forEach(char => {
      char.hp = char.maxHp;
      char.mp = char.maxMp;
      char.alive = true;
    });
  },

  /**
   * Sync HP/MP from battle units back to party state.
   * Called at end of battle.
   */
  syncFromBattle(battleUnits) {
    battleUnits.forEach((unit, i) => {
      if (state.party[i]) {
        state.party[i].hp = Math.max(0, unit.hp);
        state.party[i].mp = Math.max(0, unit.mp);
        state.party[i].alive = unit.hp > 0;
      }
    });
  },

  /**
   * Get all abilities available to a character across all learned jobs.
   */
  getAllAbilities(charIndex) {
    const char = state.party[charIndex];
    if (!char) return [];
    const all = [];
    for (const [jobName, abilities] of Object.entries(char.learnedAbilities)) {
      abilities.forEach(abilityName => {
        const job = JOBS[jobName];
        if (job) {
          const ability = job.abilities.find(a => a.name === abilityName);
          if (ability) all.push({ ...ability, fromJob: jobName });
        }
      });
    }
    return all;
  },

  /**
   * Get abilities available to purchase for a character in their current job.
   * Returns abilities not yet learned, with their JP cost.
   */
  getPurchasableAbilities(charIndex) {
    const char = state.party[charIndex];
    if (!char) return [];
    const job = JOBS[char.job];
    if (!job) return [];
    const learned = char.learnedAbilities[char.job] || [];
    return job.abilities
      .filter(a => !learned.includes(a.name))
      .map(a => ({ ...a, affordable: (char.jp[char.job] || 0) >= (a.jpCost || 0) }));
  },

  /**
   * Purchase an ability for a character using JP.
   */
  buyAbility(charIndex, abilityName) {
    const char = state.party[charIndex];
    if (!char) return false;
    const job = JOBS[char.job];
    if (!job) return false;
    const ability = job.abilities.find(a => a.name === abilityName);
    if (!ability) return false;
    const learned = char.learnedAbilities[char.job] || [];
    if (learned.includes(abilityName)) return false; // already learned
    const cost = ability.jpCost || 0;
    const currentJp = char.jp[char.job] || 0;
    if (currentJp < cost) return false; // not enough JP
    // Deduct JP and learn ability
    char.jp[char.job] = currentJp - cost;
    if (!char.learnedAbilities[char.job]) char.learnedAbilities[char.job] = [];
    char.learnedAbilities[char.job].push(abilityName);
    return true;
  },

  setFlag(name, value = true) {
    state.storyFlags[name] = value;
  },

  getFlag(name) {
    return state.storyFlags[name];
  },

  hasFlag(name) {
    return !!state.storyFlags[name];
  },

  reset(playerName = 'Soren', playerJob = 'Warrior') {
    state = {
      party: startingParty(playerName, playerJob),
      gold: 0,
      inventory: getStartingInventory(),
      equipment: {},
      storyFlags: { startingJob: playerJob },
      unlockedJobs: [...BASE_JOBS],
      scene: 'Overworld',
      x: 336,
      y: 336,
    };
  },
};

export default GameState;