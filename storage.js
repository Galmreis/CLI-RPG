/**
 * Storage & Persistence Module for CLI RPG
 * Manages saving and loading player progression across 5 dedicated save slots.
 */

const fs = require('fs/promises');
const path = require('path');
const Combatant = require('./combatant');

const SAVES_DIR = path.join(__dirname, 'saves');
const TOTAL_SLOTS = 5;

/**
 * Ensures the saves directory exists on disk.
 */
async function ensureSavesDir() {
  await fs.mkdir(SAVES_DIR, { recursive: true });
}

/**
 * Returns the absolute filepath for a given slot number (1-5).
 * @param {number} slotNumber
 */
function getSlotPath(slotNumber) {
  return path.join(SAVES_DIR, `slot_${slotNumber}.json`);
}

/**
 * Serializes a Combatant instance into a clean JSON-safe object.
 * @param {Combatant} player
 * @returns {object}
 */
function serializePlayer(player) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    name: player.name,
    level: player.level || 1,
    exp: player.exp || 0,
    nextLevelExp: player.nextLevelExp || 30,
    actualHp: player.actualHp,
    maxHp: player.maxHp,
    actualMp: player.actualMp,
    maxMp: player.maxMp,
    atk: player.atk,
    def: player.def,
    mAtk: player.mAtk,
    mDef: player.mDef,
    spd: player.spd,
    lck: player.lck,
    skills: player.skills ? [...player.skills] : [],
    passives: player.passives ? [...player.passives] : [],
    archetype: player.archetype || 'warrior',
    gold: player.gold || 0,
    lastSaveSlot: player.lastSaveSlot || null,
    // Future-ready slots for upcoming systems
    inventory: player.inventory ? [...player.inventory] : [],
    equipment: player.equipment ? { ...player.equipment } : {},
    resistances: player.resistances ? { ...player.resistances } : { physical: 1.0, fire: 1.0, ice: 1.0, thunder: 1.0 },
  };
}

/**
 * Reconstructs a full Combatant instance from raw serialized data.
 * @param {object} data
 * @returns {Combatant}
 */
function hydratePlayer(data) {
  const player = new Combatant(
    data.name,
    data.maxHp,
    data.maxMp,
    data.atk,
    data.def,
    data.mAtk,
    data.mDef,
    data.spd,
    data.lck,
    false // isEnemy
  );

  player.actualHp = data.actualHp;
  player.actualMp = data.actualMp;
  player.level = data.level;
  player.exp = data.exp;
  player.nextLevelExp = data.nextLevelExp;
  player.gold = typeof data.gold === 'number' ? data.gold : 0;
  player.lastSaveSlot = data.lastSaveSlot || null;
  player.archetype = data.archetype || 'warrior';
  player.skills = data.skills || [];
  player.passives = data.passives || [];
  player.inventory = data.inventory || [];
  player.equipment = Object.assign(
    { weapon: null, chest: null, shoes: null, accessory: null },
    data.equipment || {}
  );
  player.resistances = Object.assign(
    { physical: 1.0, fire: 1.0, ice: 1.0, thunder: 1.0 },
    data.resistances || {}
  );

  return player;
}

/**
 * Reads all 5 slots and returns summaries for menu rendering.
 * @returns {Promise<Array<{ slot: number, exists: boolean, summary: string, data: object|null }>>}
 */
async function listSlots() {
  await ensureSavesDir();
  const slots = [];

  for (let i = 1; i <= TOTAL_SLOTS; i++) {
    const filePath = getSlotPath(i);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      const dateStr = data.savedAt ? new Date(data.savedAt).toLocaleString() : 'Unknown date';
      const devTag = (data.name === 'DevTester' || data.isDevSlot) ? '[DEV LAB] ' : '';
      const summary = `${devTag}${data.name} (Lv. ${data.level}) | HP: ${data.actualHp}/${data.maxHp} | Gold: ${data.gold || 0}G | Saved: ${dateStr}`;
      slots.push({ slot: i, exists: true, summary, data });
    } catch {
      slots.push({ slot: i, exists: false, summary: '[Empty Slot]', data: null });
    }
  }

  return slots;
}

/**
 * Ensures a pre-configured developer testing save file exists in Slot 5 if empty.
 * Populates DevTester (Lv. 20, high stats, Tier 1 & 2 equipment, full consumables, 5000G, all skills).
 * @param {boolean} force - If true, overwrites Slot 5 even if it exists
 */
async function ensureDevSaveSlot(force = false) {
  await ensureSavesDir();
  const filePath = getSlotPath(5);
  if (!force) {
    try {
      await fs.access(filePath);
      return; // Already exists
    } catch {
      // File does not exist, proceed to generate
    }
  }

  const devHero = new Combatant('DevTester', 500, 200, 45, 35, 40, 35, 25, 20, false);
  devHero.level = 20;
  devHero.exp = 0;
  devHero.nextLevelExp = 2000;
  devHero.gold = 5000;
  devHero.archetype = 'warrior';
  devHero.skills = [
    'fire1', 'thunder1', 'ice1', 'heal1', 'protect1', 'powerup1',
    'heavySlash', 'armorBreak', 'quickStrike',
    'firestorm1', 'thunderstorm1', 'blizzard1', 'whirlwind'
  ];
  devHero.passives = ['vigor', 'focused'];
  devHero.inventory = [
    { id: 'potion', quantity: 15 },
    { id: 'ether', quantity: 15 },
    { id: 'remedy', quantity: 10 },
    { id: 'iron_sword', quantity: 1 },
    { id: 'bronze_plate', quantity: 1 },
    { id: 'swift_treads', quantity: 1 },
    { id: 'silver_amulet', quantity: 1 }
  ];
  devHero.equipment = {
    weapon: 'iron_sword',
    chest: 'bronze_plate',
    shoes: 'swift_treads',
    accessory: 'silver_amulet'
  };
  devHero.lastSaveSlot = 5;

  const data = serializePlayer(devHero);
  data.isDevSlot = true;
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Checks if at least one valid save slot exists.
 * @returns {Promise<boolean>}
 */
async function hasAnySaves() {
  const slots = await listSlots();
  return slots.some((s) => s.exists);
}

/**
 * Saves a player instance into the specified slot (1-5).
 * @param {number} slotNumber
 * @param {Combatant} player
 */
async function saveSlot(slotNumber, player) {
  if (slotNumber < 1 || slotNumber > TOTAL_SLOTS) {
    throw new Error(`Invalid slot number: ${slotNumber}. Must be between 1 and ${TOTAL_SLOTS}.`);
  }

  await ensureSavesDir();
  player.lastSaveSlot = slotNumber;
  const data = serializePlayer(player);
  const filePath = getSlotPath(slotNumber);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

/**
 * Loads a player from the specified slot (1-5).
 * @param {number} slotNumber
 * @returns {Promise<Combatant>}
 */
async function loadSlot(slotNumber) {
  if (slotNumber < 1 || slotNumber > TOTAL_SLOTS) {
    throw new Error(`Invalid slot number: ${slotNumber}. Must be between 1 and ${TOTAL_SLOTS}.`);
  }

  const filePath = getSlotPath(slotNumber);
  const content = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(content);
  const hydrated = hydratePlayer(data);
  hydrated.lastSaveSlot = slotNumber;
  return hydrated;
}

module.exports = {
  TOTAL_SLOTS,
  listSlots,
  hasAnySaves,
  saveSlot,
  loadSlot,
  serializePlayer,
  hydratePlayer,
  ensureDevSaveSlot,
};
