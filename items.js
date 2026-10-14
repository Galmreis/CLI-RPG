/**
 * Items Catalog & Inventory System for CLI RPG
 * Defines consumable items, effects, inventory stacking (max 99), and usage.
 */

const ITEM_CAP = 99;

/**
 * Item Catalog: Definitions and execution effects
 */
const ITEMS = {
  potion: {
    id: 'potion',
    name: 'Potion',
    price: 10,
    description: 'Restores up to 50 HP.',
    usableIn: 'both', // 'battle', 'field', or 'both'
    /**
     * Applies potion healing to target.
     * @param {Combatant} user
     * @returns {string} Combat log or result text
     */
    apply: (user) => {
      const maxHp = typeof user.totalMaxHp === 'number' ? user.totalMaxHp : user.maxHp;
      const prevHp = user.actualHp;
      user.actualHp = Math.min(maxHp, user.actualHp + 50);
      const healed = user.actualHp - prevHp;
      return `${user.name} used a Potion and recovered ${healed} HP! (${user.actualHp}/${maxHp} HP)`;
    },
  },

  ether: {
    id: 'ether',
    name: 'Ether',
    description: 'Restores up to 20 MP.',
    usableIn: 'both',
    /**
     * Applies ether mana restoration to target.
     * @param {Combatant} user
     * @returns {string} Combat log or result text
     */
    apply: (user) => {
      const prevMp = user.actualMp;
      user.actualMp = Math.min(user.maxMp, user.actualMp + 20);
      const restored = user.actualMp - prevMp;
      return `${user.name} used an Ether and restored ${restored} MP! (${user.actualMp}/${user.maxMp} MP)`;
    },
  },

  remedy: {
    id: 'remedy',
    name: 'Remedy',
    description: 'Cleanses all negative status ailments (Burn, Freeze, Stun).',
    usableIn: 'both',
    /**
     * Cleanses ailments back to neutral.
     * @param {Combatant} user
     * @returns {string} Combat log or result text
     */
    apply: (user) => {
      const oldStatus = user.currentStatus;
      if (oldStatus === 'neutral' || oldStatus === 'defend') {
        return `${user.name} drank a Remedy, but had no ailments to cleanse.`;
      }
      user.currentStatus = 'neutral';
      return `${user.name} used a Remedy! Cleansed [${oldStatus.toUpperCase()}] condition!`;
    },
  },
};

/**
 * Adds items to an inventory array, enforcing the 99 stack cap.
 * @param {Array<{ id: string, quantity: number }>} inventory
 * @param {string} itemId
 * @param {number} [quantity=1]
 * @returns {number} The new total quantity of that item
 */
function addItem(inventory, itemId, quantity = 1) {
  if (!ITEMS[itemId]) {
    throw new Error(`Unknown item ID: ${itemId}`);
  }

  let slot = inventory.find((entry) => entry.id === itemId);
  if (!slot) {
    slot = { id: itemId, quantity: 0 };
    inventory.push(slot);
  }

  slot.quantity = Math.min(ITEM_CAP, slot.quantity + quantity);
  return slot.quantity;
}

/**
 * Uses a single item from the inventory.
 * Decrements quantity, cleans up empty slots, and executes the item effect.
 * @param {Array<{ id: string, quantity: number }>} inventory
 * @param {string} itemId
 * @param {Combatant} user
 * @returns {string|null} The result log message, or null if item not in inventory
 */
function useItem(inventory, itemId, user) {
  const itemDef = ITEMS[itemId];
  if (!itemDef) return null;

  const slotIndex = inventory.findIndex((entry) => entry.id === itemId);
  if (slotIndex === -1 || inventory[slotIndex].quantity <= 0) {
    return null;
  }

  // Decrement quantity and remove slot if exhausted
  inventory[slotIndex].quantity -= 1;
  if (inventory[slotIndex].quantity <= 0) {
    inventory.splice(slotIndex, 1);
  }

  // Apply effect
  return itemDef.apply(user);
}

/**
 * Gets the current quantity of an item in the inventory.
 * @param {Array<{ id: string, quantity: number }>|Combatant} target - Inventory array or Combatant instance
 * @param {string} itemId
 * @returns {number}
 */
function getItemCount(target, itemId) {
  const inventory = Array.isArray(target) ? target : (target && target.inventory ? target.inventory : []);
  const slot = inventory.find((entry) => entry.id === itemId);
  return slot ? slot.quantity : 0;
}

module.exports = {
  ITEM_CAP,
  ITEMS,
  addItem,
  useItem,
  getItemCount,
};
