/**
 * ShopData — shop inventory per town (Phase 8).
 * Prices come from ItemData.price / EquipmentData.price.
 * Tiered: village < port < stonewatch < skyhold < capital.
 */

import { ITEMS } from './ItemData.js';
import { EQUIPMENT } from './EquipmentData.js';

const stock = (names) => names.map(n => {
  const isEquip = !!EQUIPMENT[n];
  return { name: n, price: isEquip ? EQUIPMENT[n].price : ITEMS[n].price, kind: isEquip ? 'equip' : 'item' };
});

export const SHOPS = {
  villageShop: {
    name: 'Village Shop',
    stock: stock(['Potion', 'Ether', 'Antidote', 'Eyedrop', 'PhoenixDown', 'BronzeSword', 'LeatherVest', 'PowerRing']),
  },
  portShop: {
    name: 'Meridian Trader',
    stock: stock(['Potion', 'HiPotion', 'Ether', 'Antidote', 'Eyedrop', 'EchoHerb', 'PhoenixDown', 'CoralBlade', 'TideRod', 'ScaleMail', 'ShellRobe', 'SpeedBand', 'LuckCharm']),
  },
  stonewatchShop: {
    name: 'Deepforge Supply',
    stock: stock(['Potion', 'HiPotion', 'Ether', 'EchoHerb', 'PhoenixDown', 'IronSword', 'IronStaff', 'IronArmor', 'GuardRing', 'PhoenixCharm']),
  },
  skyholdShop: {
    name: 'Peak Bazaar',
    stock: stock(['HiPotion', 'Ether', 'EchoHerb', 'PhoenixDown', 'Bomb', 'StormEdge', 'SkyRod', 'StormPlate', 'SpiritAmulet', 'SpeedBand']),
  },
  capitalShop: {
    name: 'Aurelia Exchange',
    stock: stock(['HiPotion', 'Ether', 'EchoHerb', 'PhoenixDown', 'BigBomb', 'RuneBlade', 'SageStaff', 'RuneMail', 'PowerRing', 'GuardRing', 'SpiritAmulet', 'LuckCharm', 'PhoenixCharm']),
  },
};

// Inn costs by town — WorldData owns per-town values; this map is the legacy
// single-inn contract kept for backward compat (TownScene reads INN_COST).
export const INN_COST = 30;

export function getShop(shopKey) {
  return SHOPS[shopKey] || null;
}

/** Sell price = half buy price (rounds down). */
export function sellPrice(name) {
  const isEquip = !!EQUIPMENT[name];
  const base = isEquip ? EQUIPMENT[name].price : (ITEMS[name] ? ITEMS[name].price : 0);
  return Math.max(1, Math.floor(base / 2));
}