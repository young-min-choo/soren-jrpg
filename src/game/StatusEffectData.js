/**
 * StatusEffectData — status effect definitions for combat.
 */

export const STATUS_EFFECTS = {
  poison: {
    name: 'Poison',
    description: 'Takes damage at start of each turn.',
    type: 'debuff',
    tickDamage: 3, // flat damage per turn
    color: '#dd44dd', // purple
    icon: 'PSN',
    duration: 3, // turns
    cureItems: ['Antidote'],
  },
  blind: {
    name: 'Blind',
    description: 'Reduced accuracy and damage.',
    type: 'debuff',
    damageMultiplier: 0.5,
    color: '#888888',
    icon: 'BLD',
    duration: 3,
    cureItems: ['Eyedrop'],
  },
  defend: {
    name: 'Defending',
    description: 'Damage taken is halved.',
    type: 'buff',
    damageMultiplier: 0.5, // applied to incoming damage
    color: '#44dd44',
    icon: 'DEF',
    duration: 1, // wears off after 1 turn (next time unit acts)
  },
  sleep: {
    name: 'Sleep',
    description: 'Cannot act. Wakes up on taking damage.',
    type: 'debuff',
    skipTurn: true,
    color: '#aaaaff',
    icon: 'SLP',
    duration: 2,
    cureItems: [],
    wakeOnDamage: true,
  },
};

/**
 * Create a status effect instance on a unit.
 */
export function applyStatus(unit, statusName) {
  const def = STATUS_EFFECTS[statusName];
  if (!def) return;
  if (!unit.statusEffects) unit.statusEffects = {};
  unit.statusEffects[statusName] = {
    name: statusName,
    turnsRemaining: def.duration,
  };
}

/**
 * Remove a status effect from a unit.
 */
export function removeStatus(unit, statusName) {
  if (!unit.statusEffects) return;
  delete unit.statusEffects[statusName];
}

/**
 * Check if a unit has a status effect.
 */
export function hasStatus(unit, statusName) {
  return unit.statusEffects && unit.statusEffects[statusName];
}

/**
 * Process status effects at the start of a unit's turn.
 * Returns { skipped: bool, messages: [] } — skipped means the unit can't act.
 */
export function processStatusTick(unit, logFn) {
  const messages = [];
  let skipped = false;

  if (!unit.statusEffects) return { skipped, messages };

  for (const [statusName, effect] of Object.entries(unit.statusEffects)) {
    const def = STATUS_EFFECTS[statusName];
    if (!def) continue;

    // Tick damage (poison)
    if (def.tickDamage) {
      unit.hp -= def.tickDamage;
      messages.push(`${unit.name} takes ${def.tickDamage} damage from ${def.name}!`);
      if (unit.hp <= 0) {
        unit.hp = 0;
        unit.alive = false;
        messages.push(`${unit.name} has fallen!`);
      }
    }

    // Skip turn (sleep)
    if (def.skipTurn) {
      skipped = true;
      messages.push(`${unit.name} is asleep and cannot act!`);
    }

    // Decrement duration
    effect.turnsRemaining--;
    if (effect.turnsRemaining <= 0) {
      delete unit.statusEffects[statusName];
      messages.push(`${unit.name}'s ${def.name} wore off.`);
    }
  }

  if (logFn && messages.length > 0) {
    messages.forEach(m => logFn(m));
  }

  return { skipped, messages };
}

/**
 * Get all active status effect names for a unit (for display).
 */
export function getActiveStatuses(unit) {
  if (!unit.statusEffects) return [];
  return Object.keys(unit.statusEffects);
}