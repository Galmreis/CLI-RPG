/**
 * Equipment Controller & Catalog for CLI RPG
 * Manages equippable gear, slot assignments, stat bonus calculations,
 * and equip/unequip movements between inventory and equipment slots.
 * 
 * Usable by both Player and Enemies (Combatant instances).
 */

const EQUIPMENT_SLOTS = ['weapon', 'chest', 'shoes', 'accessory'];

/**
 * Equipment Catalog
 * Defines gear pieces, their designated slot, and flat stat modifiers.
 */
const EQUIPMENT = {
  leather_shiv: {
    id: 'leather_shiv',
    name: 'Leather-Wrapped Shiv',
    slot: 'weapon',
    atk: 3,
    description: 'A sharp blade wrapped in a hardened leather grip (+3 ATK).',
  },

  leather_chest: {
    id: 'leather_chest',
    name: 'Leather Tunic',
    slot: 'chest',
    def: 3,
    description: 'Cured animal hide providing reliable physical protection (+3 DEF).',
  },

  leather_boots: {
    id: 'leather_boots',
    name: 'Leather Boots',
    slot: 'shoes',
    spd: 2,
    def: 1,
    description: 'Lightweight supple boots that aid quick maneuvers (+2 SPD, +1 DEF).',
  },

  leather_wristband: {
    id: 'leather_wristband',
    name: 'Leather Wristband',
    slot: 'accessory',
    maxHp: 10,
    lck: 1,
    description: 'A braided leather band boosting stamina and fortune (+10 Max HP, +1 LCK).',
  },

  // Tier 2 Equipment (Found in Deeper Dungeon Floors)
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Broadsword',
    slot: 'weapon',
    atk: 7,
    description: 'A heavy forged iron blade that cleaves with formidable power (+7 ATK).',
  },

  bronze_plate: {
    id: 'bronze_plate',
    name: 'Bronze Breastplate',
    slot: 'chest',
    def: 6,
    maxHp: 25,
    description: 'Hammered bronze armor deflecting fatal blows (+6 DEF, +25 Max HP).',
  },

  swift_treads: {
    id: 'swift_treads',
    name: 'Swift Treads',
    slot: 'shoes',
    spd: 5,
    def: 2,
    description: 'Reinforced light boots granting swift agility (+5 SPD, +2 DEF).',
  },

  silver_amulet: {
    id: 'silver_amulet',
    name: 'Silver Amulet',
    slot: 'accessory',
    mDef: 5,
    maxMp: 20,
    lck: 3,
    description: 'A polished silver talisman humming with mystic warding (+5 M.DEF, +20 Max MP, +3 LCK).',
  },
};

/**
 * Calculates the total bonus for a given stat across all equipped items on a combatant.
 * @param {Combatant} combatant
 * @param {string} statKey - 'atk', 'def', 'mAtk', 'mDef', 'spd', 'lck', 'maxHp', 'maxMp'
 * @returns {number}
 */
function getEquipmentStatBonus(combatant, statKey) {
  if (!combatant || !combatant.equipment) return 0;
  let totalBonus = 0;

  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = combatant.equipment[slot];
    if (itemId && EQUIPMENT[itemId]) {
      const itemDef = EQUIPMENT[itemId];
      if (typeof itemDef[statKey] === 'number') {
        totalBonus += itemDef[statKey];
      }
    }
  }

  return totalBonus;
}

/**
 * Calculates equipment resistance modifier for a given damage type.
 * @param {Combatant} combatant
 * @param {string} damageType - 'physical', 'fire', 'ice', 'thunder'
 * @returns {number}
 */
function getEquipmentResistanceBonus(combatant, damageType) {
  if (!combatant || !combatant.equipment) return 0;
  let totalBonus = 0;

  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = combatant.equipment[slot];
    if (itemId && EQUIPMENT[itemId]) {
      const itemDef = EQUIPMENT[itemId];
      if (itemDef.resistances && typeof itemDef.resistances[damageType] === 'number') {
        totalBonus += itemDef.resistances[damageType];
      }
    }
  }

  return totalBonus;
}

/**
 * Adds an equipment item to the inventory array.
 * @param {Array<{ id: string, quantity: number, type?: string }>} inventory
 * @param {string} itemId
 * @param {number} [quantity=1]
 */
function addEquipment(inventoryOrCombatant, itemId, quantity = 1) {
  if (!EQUIPMENT[itemId]) {
    throw new Error(`Unknown equipment ID: ${itemId}`);
  }

  let inventory = Array.isArray(inventoryOrCombatant)
    ? inventoryOrCombatant
    : (inventoryOrCombatant.inventory = inventoryOrCombatant.inventory || []);

  let slot = inventory.find((entry) => entry.id === itemId);
  if (!slot) {
    slot = { id: itemId, quantity: 0, type: 'equipment' };
    inventory.push(slot);
  }

  slot.quantity += quantity;
  return slot.quantity;
}

/**
 * Equips an item from the combatant's inventory into the appropriate slot.
 * If the slot already has an item, the old item is unequipped back into inventory.
 * @param {Combatant} combatant
 * @param {string} itemId
 * @returns {{ success: boolean, message: string }}
 */
function equipItem(combatant, itemId) {
  const itemDef = EQUIPMENT[itemId];
  if (!itemDef) {
    return { success: false, message: `Unknown equipment ID: ${itemId}` };
  }

  if (!combatant.equipment) {
    combatant.equipment = { weapon: null, chest: null, shoes: null, accessory: null };
  }
  if (!combatant.inventory) {
    combatant.inventory = [];
  }

  const slot = itemDef.slot;
  if (!EQUIPMENT_SLOTS.includes(slot)) {
    return { success: false, message: `Invalid equipment slot: ${slot}` };
  }

  // Find the item in inventory
  const invIdx = combatant.inventory.findIndex((e) => e.id === itemId && e.quantity > 0);
  if (invIdx === -1) {
    return { success: false, message: `Item ${itemDef.name} is not in inventory!` };
  }

  // 1. If currently wearing something in that slot, unequip it back to inventory
  const oldItemId = combatant.equipment[slot];
  let unequipMsg = '';
  if (oldItemId && EQUIPMENT[oldItemId]) {
    addEquipment(combatant.inventory, oldItemId, 1);
    unequipMsg = ` (Unequipped ${EQUIPMENT[oldItemId].name})`;
  }

  // 2. Deduct the item from inventory
  combatant.inventory[invIdx].quantity -= 1;
  if (combatant.inventory[invIdx].quantity <= 0) {
    combatant.inventory.splice(invIdx, 1);
  }

  // 3. Place into equipment slot
  combatant.equipment[slot] = itemId;

  return {
    success: true,
    message: `Equipped [${itemDef.name}] into ${slot.toUpperCase()} slot!${unequipMsg}`,
  };
}

/**
 * Unequips an item from a specified slot and returns it to inventory.
 * @param {Combatant} combatant
 * @param {string} slot - 'weapon', 'chest', 'shoes', or 'accessory'
 * @returns {{ success: boolean, message: string }}
 */
function unequipItem(combatant, slot) {
  if (!combatant.equipment || !combatant.equipment[slot]) {
    return { success: false, message: `No item equipped in ${slot} slot.` };
  }

  const itemId = combatant.equipment[slot];
  const itemDef = EQUIPMENT[itemId];
  const itemName = itemDef ? itemDef.name : itemId;

  // Clear slot
  combatant.equipment[slot] = null;

  // Return to inventory
  addEquipment(combatant.inventory, itemId, 1);

  return {
    success: true,
    message: `Unequipped [${itemName}] from ${slot.toUpperCase()} slot and moved to bag.`,
  };
}

/**
 * Generates randomized chest loot based on dungeon floor depth.
 * Returns { type: 'gold' | 'item' | 'equipment', id?: string, name: string, quantity?: number, gold?: number }
 */
function generateRandomLoot(floor = 1) {
  const roll = Math.random();

  // 35% Chance: Gold Cache (scales with floor: e.g. 20-50 on F1, 100-250 on F5)
  if (roll < 0.35) {
    const gold = Math.floor(Math.random() * (25 * floor)) + (15 * floor);
    return { type: 'gold', gold, name: `${gold} Gold` };
  }

  // 35% Chance: Consumable Item (Potion, Ether, Remedy)
  if (roll < 0.70) {
    const items = ['potion', 'ether', 'remedy'];
    const chosen = items[Math.floor(Math.random() * items.length)];
    const qty = Math.random() < 0.3 ? 2 : 1;
    return { type: 'item', id: chosen, quantity: qty, name: `${qty}x ${chosen.toUpperCase()}` };
  }

  // 30% Chance: Equipment drop!
  const tier1 = ['leather_shiv', 'leather_chest', 'leather_boots', 'leather_wristband'];
  const tier2 = ['iron_sword', 'bronze_plate', 'swift_treads', 'silver_amulet'];

  let pool = tier1;
  if (floor >= 3) {
    pool = Math.random() < 0.75 ? tier2 : tier1;
  } else if (floor >= 2) {
    pool = Math.random() < 0.40 ? tier2 : tier1;
  }

  const chosenId = pool[Math.floor(Math.random() * pool.length)];
  const gear = EQUIPMENT[chosenId];
  return { type: 'equipment', id: chosenId, name: gear.name, slot: gear.slot };
}

module.exports = {
  EQUIPMENT_SLOTS,
  EQUIPMENT,
  getEquipmentStatBonus,
  getEquipmentResistanceBonus,
  addEquipment,
  equipItem,
  unequipItem,
  generateRandomLoot,
};
