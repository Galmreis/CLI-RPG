/**
 * Bestiary / Monster Catalog for CLI RPG
 * Defines monster presets, ASCII art, base combat stats, additive growth coefficients, and EXP rewards.
 */

const Combatant = require('./combatant');

const MONSTERS = {
  goblin: {
    name: "Goblin",
    maxHp: 50,
    maxMp: 0,
    atk: 8,
    def: 4,
    mAtk: 3,
    mDef: 3,
    spd: 6,
    lck: 5,
    growth: {
      hp: 10,
      mp: 0,
      atk: 1.5,
      def: 0.8,
      mAtk: 0.5,
      mDef: 0.5,
      spd: 0.6,
      lck: 0.5,
      exp: 8,
      gold: 3,
    },
    passives: ['focused'], // Increases critical hit rate by +10%
    resistances: { physical: 1.0, fire: 1.0, ice: 1.0, thunder: 1.0 },
    exp: 15,
    gold: 5,
    drops: [
      { itemId: 'potion', chance: 0.50 },
      { itemId: 'ether', chance: 0.15 },
    ],
    description: "A scrappy cave-dweller with balanced stats and keen focus.",
    art: [
      "      (o)_(o)     ",
      "     /  (_)  \\    ",
      "    |  /   \\  |   ",
      "    \\_________/   ",
      "     [ Goblin ]   ",
    ],
  },
  wolf: {
    name: "Forest Wolf",
    maxHp: 40,
    maxMp: 0,
    atk: 11,
    def: 3,
    mAtk: 2,
    mDef: 2,
    spd: 12,
    lck: 15, // High luck -> frequent crits and dodges!
    growth: {
      hp: 8,
      mp: 0,
      atk: 2.0,
      def: 0.5,
      mAtk: 0.3,
      mDef: 0.3,
      spd: 1.5,
      lck: 1.2,
      exp: 12,
      gold: 6,
    },
    resistances: { physical: 1.0, fire: 1.5, ice: 0.8, thunder: 1.0 }, // Weak to Fire!
    exp: 25,
    gold: 15,
    drops: [
      { itemId: 'remedy', chance: 0.40 },
      { itemId: 'potion', chance: 0.25 },
    ],
    description: "A swift predator weak to Fire (1.5x) with high crit chance and rapid speed scaling.",
    art: [
      "      /\\     /\\   ",
      "     {  `---'  }  ",
      "     {  O   O  }  ",
      "     ~~>  V  <~~  ",
      "    [ Forest Wolf ]",
    ],
  },
  golem: {
    name: "Iron Golem",
    maxHp: 85,
    maxMp: 0,
    atk: 14,
    def: 10, // High defense -> tests 1-damage minimum floor
    mAtk: 1,
    mDef: 6,
    spd: 3,
    lck: 2,
    growth: {
      hp: 18,
      mp: 0,
      atk: 1.4,
      def: 1.8,
      mAtk: 0.2,
      mDef: 1.0,
      spd: 0.3,
      lck: 0.2,
      exp: 18,
      gold: 10,
    },
    // Resists Physical (0.5x), Weak to Ice (1.5x), Absorbs Thunder (-1.0x heals!)
    resistances: { physical: 0.5, fire: 1.0, ice: 1.5, thunder: -1.0 },
    exp: 45,
    gold: 35,
    drops: [
      { itemId: 'ether', chance: 0.60 },
      { itemId: 'remedy', chance: 0.35 },
    ],
    description: "A hulking construct with heavy HP/DEF growth that resists Physical, weak to Ice, and absorbs Thunder.",
    art: [
      "      +-------+   ",
      "      |[#] [#]|   ",
      "     /| ===== |\\  ",
      "    [=]-------[=] ",
      "     [Iron Golem] ",
    ],
  },
  smallGoblin: {
    name: "Small Goblin",
    maxHp: 25,
    maxMp: 0,
    atk: 5,
    def: 2,
    mAtk: 2,
    mDef: 2,
    spd: 4,
    lck: 4,
    growth: {
      hp: 6,
      mp: 0,
      atk: 0.8,
      def: 0.5,
      mAtk: 0.3,
      mDef: 0.3,
      spd: 0.5,
      lck: 0.4,
      exp: 4,
      gold: 2,
    },
    passives: [],
    resistances: { physical: 1.0, fire: 1.0, ice: 1.0, thunder: 1.0 },
    exp: 10,
    gold: 3,
    drops: [
      { itemId: 'potion', chance: 0.30 },
    ],
    description: "A small, nimble minion summoned by the Goblin King.",
    art: [
      "       .---.      ",
      "      ( o.o )     ",
      "       > ^ <      ",
      "    [Small Goblin]",
    ],
  },
  goblinKing: {
    name: "Goblin King",
    maxHp: 150,
    maxMp: 0,
    atk: 13,
    def: 7,
    mAtk: 4,
    mDef: 5,
    spd: 7,
    lck: 10,
    growth: {
      hp: 18,
      mp: 0,
      atk: 2.2,
      def: 1.2,
      mAtk: 0.8,
      mDef: 0.8,
      spd: 0.9,
      lck: 0.8,
      exp: 30,
      gold: 25,
    },
    passives: ['royalFocus'], // Royal Focus: +50% crit, summons Small Goblin every 3 crits
    resistances: { physical: 1.0, fire: 0.8, ice: 1.0, thunder: 1.0 },
    exp: 100,
    gold: 75,
    drops: [
      { itemId: 'potion', chance: 1.0 },
      { itemId: 'ether', chance: 0.80 },
      { itemId: 'remedy', chance: 0.50 },
    ],
    description: "The imposing monarch of the goblin cavern. Strikes with critical precision and rallies loyal minions.",
    art: [
      "       _wWWw_     ",
      "      (o)_(o)     ",
      "     /  (_)  \\    ",
      "    |  /   \\  |   ",
      "    \\_________/   ",
      "    [Goblin King] ",
    ],
  },
  // --- DEVELOPER TESTING SANDBOX DUMMIES ---
  ironColossus: {
    name: "Iron Colossus (Dummy)",
    maxHp: 300,
    maxMp: 0,
    atk: 1,
    def: 999, // Extreme DEF -> tests 1-damage floor and Armor Break debuffs
    mAtk: 1,
    mDef: 5,
    spd: 5,
    lck: 0,
    growth: { hp: 0, mp: 0, atk: 0, def: 0, mAtk: 0, mDef: 0, spd: 0, lck: 0, exp: 0, gold: 0 },
    passives: [],
    resistances: { physical: 1.0, fire: 1.0, ice: 1.0, thunder: 1.0 },
    exp: 0,
    gold: 0,
    drops: [],
    description: "Testing dummy with 999 DEF. Used to verify the 1-damage floor and Armor Break debuffs.",
    art: [
      "      .-------.   ",
      "     |[# # # #]|  ",
      "     |[=======]|  ",
      "     | [999DEF]|  ",
      "    [Iron Colossus]",
    ],
  },
  shadowMirage: {
    name: "Shadow Mirage (Dummy)",
    maxHp: 100,
    maxMp: 0,
    atk: 1,
    def: 10,
    mAtk: 1,
    mDef: 10,
    spd: 25,
    lck: 999, // Extreme Luck -> tests near-guaranteed dodge and evasion whoosh FX
    growth: { hp: 0, mp: 0, atk: 0, def: 0, mAtk: 0, mDef: 0, spd: 0, lck: 0, exp: 0, gold: 0 },
    passives: [],
    resistances: { physical: 1.0, fire: 1.0, ice: 1.0, thunder: 1.0 },
    exp: 0,
    gold: 0,
    drops: [],
    description: "Testing dummy with 999 LCK. Used to test evasion animations and dodge whoosh mechanics.",
    art: [
      "       . - ~ - .  ",
      "     /  ( ? ? )  \\",
      "    :   ~ ~ ~ ~   :",
      "     \\   _ _ _   /",
      "    [Shadow Mirage]",
    ],
  },
  elementalPrism: {
    name: "Elemental Prism (Dummy)",
    maxHp: 350,
    maxMp: 100,
    atk: 5,
    def: 12,
    mAtk: 15,
    mDef: 12,
    spd: 8,
    lck: 5,
    growth: { hp: 0, mp: 0, atk: 0, def: 0, mAtk: 0, mDef: 0, spd: 0, lck: 0, exp: 0, gold: 0 },
    passives: [],
    // Weak to Fire (1.5x), Immune to Ice (0.0x), Absorbs Thunder (-1.0x)
    resistances: { physical: 1.0, fire: 1.5, ice: 0.0, thunder: -1.0 },
    exp: 0,
    gold: 0,
    drops: [],
    description: "Testing dummy weak to Fire (1.5x), immune to Ice (0.0x), and absorbing Thunder (-1.0x).",
    art: [
      "        /\\  /\\    ",
      "       /  \\/  \\   ",
      "      <  PRISM >  ",
      "       \\  /\\  /   ",
      "    [ElementalPrism]",
    ],
  },
};

/**
 * Creates and returns a new Combatant instance for the requested enemy key and level.
 * Applies additive stat growth: stat = baseStat + (level - 1) * growthRate
 * Clamps stats to game caps (9999 HP/MP, 999 attributes).
 * @param {string} key - 'goblin', 'wolf', 'golem', 'smallGoblin', 'goblinKing'
 * @param {number} level - Enemy level (default 1)
 */
function createEnemy(key, level = 1) {
  const data = MONSTERS[key];
  if (!data) {
    throw new Error(`Unknown monster key: ${key}`);
  }

  const lvlDelta = Math.max(0, level - 1);
  const growth = data.growth || {};

  const scaledMaxHp = Math.min(9999, Math.floor(data.maxHp + lvlDelta * (growth.hp || 0)));
  const scaledMaxMp = Math.min(9999, Math.floor(data.maxMp + lvlDelta * (growth.mp || 0)));
  const scaledAtk = Math.min(999, Math.floor(data.atk + lvlDelta * (growth.atk || 0)));
  const scaledDef = Math.min(999, Math.floor(data.def + lvlDelta * (growth.def || 0)));
  const scaledMAtk = Math.min(999, Math.floor(data.mAtk + lvlDelta * (growth.mAtk || 0)));
  const scaledMDef = Math.min(999, Math.floor(data.mDef + lvlDelta * (growth.mDef || 0)));
  const scaledSpd = Math.min(999, Math.floor(data.spd + lvlDelta * (growth.spd || 0)));
  const scaledLck = Math.min(999, Math.floor(data.lck + lvlDelta * (growth.lck || 0)));

  const enemyName = level > 1 ? `${data.name} (Lv. ${level})` : data.name;

  const enemy = new Combatant(
    enemyName,
    scaledMaxHp,
    scaledMaxMp,
    scaledAtk,
    scaledDef,
    scaledMAtk,
    scaledMDef,
    scaledSpd,
    scaledLck,
    true // isEnemy
  );

  enemy.level = level;
  enemy.art = data.art;
  enemy.expReward = Math.floor(data.exp + lvlDelta * (growth.exp || 0));
  enemy.gold = Math.floor((data.gold || 0) + lvlDelta * (growth.gold || 0));
  enemy.passives = data.passives ? [...data.passives] : [];
  enemy.drops = data.drops ? [...data.drops] : [];
  enemy.resistances = data.resistances ? { ...data.resistances } : { physical: 1.0, fire: 1.0, ice: 1.0, thunder: 1.0 };
  return enemy;
}

module.exports = {
  MONSTERS,
  createEnemy,
};
