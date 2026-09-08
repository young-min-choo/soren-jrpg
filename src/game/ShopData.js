/**
 * ShopData — shop inventory for town shops.
 * Prices come from ItemData.price; equipment comes later (Phase 8b).
 * Keep the starting-town shop tier-1: consumables the early dungeon expects.
 */

import { ITEMS } from './ItemData.js';

export const SHOPS = {
  startingTown: {
    name: 'Village Shop',
    stock: [
      { name: 'Potion', price: ITEMS.Potion.price },          // 50
      { name: 'Ether', price: ITEMS.Ether.price },            // 150
      { name: 'Antidote', price: ITEMS.Antidote.price },      // 40
      { name: 'Eyedrop', price: ITEMS.Eyedrop.price },        // 30
      { name: 'PhoenixDown', price: ITEMS.PhoenixDown.price },// 300
    ],
  },
};

export const INN_COST = 30;

export function getShop(shopKey) {
  return SHOPS[shopKey] || null;
}