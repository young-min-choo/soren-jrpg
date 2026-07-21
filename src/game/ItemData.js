/**
 * ItemData — item definitions for the game.
 * Items can be used in battle or from the menu.
 */

export const ITEMS = {
  Potion: {
    name: 'Potion',
    description: 'Restores 50 HP to one ally.',
    type: 'heal',
    target: 'ally',
    power: 50,
    price: 50,
  },
  HiPotion: {
    name: 'Hi-Potion',
    description: 'Restores 200 HP to one ally.',
    type: 'heal',
    target: 'ally',
    power: 200,
    price: 200,
  },
  Ether: {
    name: 'Ether',
    description: 'Restores 20 MP to one ally.',
    type: 'mp_heal',
    target: 'ally',
    power: 20,
    price: 150,
  },
  PhoenixDown: {
    name: 'Phoenix Down',
    description: 'Revives a KO\'d ally with 1 HP.',
    type: 'revive',
    target: 'ally',
    power: 1,
    price: 300,
  },
  Antidote: {
    name: 'Antidote',
    description: 'Cures poison from one ally.',
    type: 'cure_status',
    target: 'ally',
    status: 'poison',
    price: 40,
  },
  Eyedrop: {
    name: 'Eyedrop',
    description: 'Cures blindness from one ally.',
    type: 'cure_status',
    target: 'ally',
    status: 'blind',
    price: 30,
  },
  Bomb: {
    name: 'Bomb',
    description: 'Deals 30 damage to one enemy.',
    type: 'damage',
    target: 'enemy',
    power: 30,
    price: 100,
  },
};

/**
 * Get item definition by name.
 */
export function getItem(name) {
  return ITEMS[name] || null;
}

/**
 * Get starting inventory for a new game.
 */
export function getStartingInventory() {
  return [
    { name: 'Potion', qty: 3 },
    { name: 'Ether', qty: 1 },
    { name: 'Antidote', qty: 1 },
  ];
}