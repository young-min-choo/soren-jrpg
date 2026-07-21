/**
 * GameState — persistent player state across scenes and battles.
 * Now supports a full party of characters with jobs.
 */
import { JOBS, getStatsForLevel } from './JobData.js';
import { getStartingInventory } from './ItemData.js';

function createCharacter(name, jobName, level = 1) {
  const stats = getStatsForLevel(jobName, level);
  return {
    name,
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
  };
}

let state = {
  party: [
    createCharacter('Soren', 'Warrior', 1),
    createCharacter('Aria', 'Monk', 1),
    createCharacter('Kael', 'Ranger', 1),
  ],
  gold: 0,
  inventory: getStartingInventory(),
  storyFlags: {},
  unlockedJobs: ['Warrior', 'Mage', 'Ranger', 'Monk'],
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

  /**
   * Add a new party member.
   */
  addMember(name, jobName, level = 1) {
    const char = createCharacter(name, jobName, level);
    state.party.push(char);
    if (!state.unlockedJobs.includes(jobName)) {
      state.unlockedJobs.push(jobName);
    }
    return char;
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
    char.hp = Math.floor(char.maxHp * hpRatio);
    char.mp = Math.floor(char.maxMp * mpRatio);
    // Add new job's level-1 abilities if not already learned
    if (!char.learnedAbilities[newJobName]) {
      char.learnedAbilities[newJobName] = JOBS[newJobName].abilities
        .filter(a => a.level <= 1).map(a => a.name);
    }
    // Unlock job if new
    if (!state.unlockedJobs.includes(newJobName)) {
      state.unlockedJobs.push(newJobName);
    }
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
          // Level up check (every 100 exp)
          while (char.exp >= char.level * 100) {
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
      // Full heal on game over (classic FF behavior)
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

  reset() {
    state = {
      party: [createCharacter('Soren', 'Warrior', 1)],
      gold: 0,
      inventory: getStartingInventory(),
      storyFlags: {},
      unlockedJobs: ['Warrior', 'Mage', 'Ranger', 'Monk'],
      scene: 'Overworld',
      x: 336,
      y: 336,
    };
  },
};

export default GameState;