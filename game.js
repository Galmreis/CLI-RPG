/**
 * Game Manager & Scene Loop for CLI RPG
 * Coordinates Main Menu, Hero Customization, AP Stat Allocation, Inn Rest, and Combat Encounters.
 */

const readline = require('readline/promises');
const Combatant = require('./combatant');
const { createEnemy, MONSTERS } = require('./enemies');
const { runBattle } = require('./battle');
const { PASSIVES } = require('./passives');
const storage = require('./storage');
const { ITEMS, useItem, addItem, getItemCount, ITEM_CAP } = require('./items');
const { EQUIPMENT, EQUIPMENT_SLOTS, equipItem, unequipItem } = require('./equipment');
const { selectMenu, allocateStatsMenu, enterAlternateScreen, exitAlternateScreen, showCursor, hideCursor, clearScreenHome } = require('./menu');




/**
 * Checks and resolves level up progression with interactive Attribute Points (AP).
 * @param {Combatant} player - The player combatant
 * @param {readline.Interface} rl - The active readline interface
 */
async function checkLevelUp(player, rl) {
  let leveledUp = false;

  while (player.exp >= player.nextLevelExp) {
    player.level += 1;
    player.exp -= player.nextLevelExp;
    // Additive scaling curve: preserves reasonable EXP requirements up to Level 99
    player.nextLevelExp += player.level * 35;
    leveledUp = true;

    // 1. Natural Random Stat Growth
    const hpGain = Math.floor(Math.random() * 8) + 8; // +8 to +15 HP
    const mpGain = Math.floor(Math.random() * 5) + 3; // +3 to +7 MP
    player.maxHp = Math.min(9999, player.maxHp + hpGain);
    player.maxMp = Math.min(9999, player.maxMp + mpGain);

    const coreStats = [
      { key: 'atk', name: 'Attack' },
      { key: 'def', name: 'Defense' },
      { key: 'mAtk', name: 'Magic ATK' },
      { key: 'mDef', name: 'Magic DEF' },
      { key: 'spd', name: 'Speed' },
      { key: 'lck', name: 'Luck' },
    ];
    const shuffled = [...coreStats].sort(() => Math.random() - 0.5);
    const chosenStats = shuffled.slice(0, Math.floor(Math.random() * 2) + 2); // 2 or 3 stats
    const naturalLogs = [`+${hpGain} Max HP`, `+${mpGain} Max MP`];

    chosenStats.forEach((stat) => {
      const amount = Math.random() < 0.25 ? 2 : 1;
      player[stat.key] = Math.min(999, (player[stat.key] || 5) + amount);
      naturalLogs.push(`+${amount} ${stat.name}`);
    });

    await allocateStatsMenu({
      player,
      ap: 5,
      naturalLogs,
      rl,
    });

    // Fully replenish HP and MP to the new maximums after allocation
    player.actualHp = player.totalMaxHp || player.maxHp;
    player.actualMp = player.totalMaxMp || player.maxMp;
    console.log("\n  All AP distributed! Health and Mana fully restored.");
    console.log("==================================================================");
    showCursor();
    await rl.question("  Press Enter to continue...");
    hideCursor();
  }

  return leveledUp;
}

/**
 * Interactive menu to save game to one of 5 slots.
 * @param {Combatant} player
 * @param {readline.Interface} rl
 */
async function showSaveMenu(player, rl) {
  const slots = await storage.listSlots();
  const slotLabels = slots.map((s) => `Slot ${s.slot}: ${s.summary}`);

  const res = await selectMenu({
    header: "\n=================== SAVE GAME (5 SLOTS) ===================",
    items: slotLabels,
    allowCancel: true,
    cancelLabel: "Cancel (Return to Town)",
    clearScreen: true,
    rl,
  });

  if (res.cancelled || res.index === -1) {
    console.log("  Save cancelled.");
    return;
  }

  const slotNum = res.index + 1;
  const existing = slots[res.index];
  if (existing.exists) {
    showCursor();
    const confirm = (await rl.question(`  Slot ${slotNum} already has data (${existing.data.name}). Overwrite? (y/n): `)).trim().toLowerCase();
    hideCursor();
    if (confirm !== 'y' && confirm !== 'yes') {
      console.log("  Save cancelled.");
      return;
    }
  }
  await storage.saveSlot(slotNum, player);
  console.log(`\n  >>> Game successfully saved to Slot ${slotNum}! <<<`);
  showCursor();
  await rl.question("  Press Enter to return...");
  hideCursor();
}

/**
 * Interactive menu to load game from one of 5 slots.
 * @param {readline.Interface} rl
 * @returns {Promise<Combatant|null>}
 */
async function showLoadMenu(rl) {
  const slots = await storage.listSlots();
  const slotLabels = slots.map((s) => `Slot ${s.slot}: ${s.summary}`);

  const res = await selectMenu({
    header: "\n=================== LOAD GAME (5 SLOTS) ===================",
    items: slotLabels,
    allowCancel: true,
    cancelLabel: "Cancel (Return)",
    clearScreen: true,
    rl,
  });

  if (res.cancelled || res.index === -1) {
    return null;
  }

  const slotNum = res.index + 1;
  const selected = slots[res.index];
  if (!selected.exists) {
    console.log(`\n  Slot ${slotNum} is empty!`);
    showCursor();
    await rl.question("  Press Enter to continue...");
    hideCursor();
    return null;
  }
  const loadedPlayer = await storage.loadSlot(slotNum);
  console.log(`\n  >>> Successfully loaded ${loadedPlayer.name} (Lv. ${loadedPlayer.level}) from Slot ${slotNum}! <<<`);
  showCursor();
  await rl.question("  Press Enter to continue...");
  hideCursor();
  return loadedPlayer;
}

/**
 * Interactive menu to use items from the player inventory while in Town.
 * @param {Combatant} player
 * @param {readline.Interface} rl
 */
async function showTownItemMenu(player, rl) {
  let viewingBag = true;
  while (viewingBag) {
    const currentConsumables = (player.inventory || []).filter((entry) => ITEMS[entry.id] && entry.quantity > 0);
    if (currentConsumables.length === 0) {
      console.log("\n  You have no consumable items in your bag! Defeat monsters to acquire loot drops.");
      await rl.question("  Press Enter to return...");
      break;
    }

    const itemLabels = currentConsumables.map((entry) => {
      const it = ITEMS[entry.id];
      return `${it.name.padEnd(10)} (Qty: ${entry.quantity}) - ${it.description}`;
    });

    const res = await selectMenu({
      header: `\n=================== INVENTORY BAG (MAX 99) ===================\n  Current Vitals: HP ${player.actualHp}/${player.totalMaxHp || player.maxHp} | MP ${player.actualMp}/${player.totalMaxMp || player.maxMp}\n--------------------------------------------------------------`,
      items: itemLabels,
      allowCancel: true,
      cancelLabel: "Close Bag (Return)",
      clearScreen: true,
      rl,
    });

    if (res.cancelled || res.index === -1) {
      viewingBag = false;
      break;
    }

    const selectedId = currentConsumables[res.index].id;
    const resMsg = useItem(player.inventory, selectedId, player);
    console.log(`\n  >> ${resMsg} <<`);
    showCursor();
    await rl.question("  Press Enter to continue...");
    hideCursor();
  }
}

/**
 * Interactive menu to inspect, equip, and unequip gear while in Town.
 * @param {Combatant} player
 * @param {readline.Interface} rl
 */
async function showEquipmentMenu(player, rl) {
  let eqRunning = true;
  while (eqRunning) {
    const headerContent = () => {
      console.log("\n=================== EQUIPMENT MANAGEMENT ===================");
      console.log("  Currently Equipped Gear:");
      EQUIPMENT_SLOTS.forEach((slot) => {
        const itemId = player.equipment ? player.equipment[slot] : null;
        const itemDef = itemId ? EQUIPMENT[itemId] : null;
        const nameStr = itemDef ? itemDef.name : '(Empty)';
        const descStr = itemDef ? ` - ${itemDef.description}` : '';
        console.log(`    [${slot.toUpperCase().padEnd(9)}] ${nameStr}${descStr}`);
      });
      console.log("  ----------------------------------------------------------");
      console.log("  Combat Stats with Gear:");
      console.log(`    ATK: ${player.totalAtk} (Base: ${player.atk}) | DEF: ${player.totalDef} (Base: ${player.def})`);
      console.log(`    M.ATK: ${player.totalMAtk} (Base: ${player.mAtk}) | M.DEF: ${player.totalMDef} (Base: ${player.mDef})`);
      console.log(`    SPD: ${player.totalSpd} (Base: ${player.spd}) | LCK: ${player.totalLck} (Base: ${player.lck})`);
      console.log("  ----------------------------------------------------------");
    };

    const eqOptions = [
      "Equip Gear from Inventory",
      "Unequip Gear to Inventory",
      "Return to Town",
    ];

    const res = await selectMenu({
      header: headerContent,
      items: eqOptions,
      allowCancel: true,
      cancelLabel: "Return to Town",
      clearScreen: true,
      rl,
    });

    if (res.cancelled || res.index === 2 || res.index === -1) {
      eqRunning = false;
      break;
    }

    if (res.index === 0) {
      // Filter inventory for equippable items
      const gearInBag = (player.inventory || []).filter((e) => EQUIPMENT[e.id] && e.quantity > 0);
      if (gearInBag.length === 0) {
        console.log("\n  No equippable gear found in your inventory!");
        showCursor();
        await rl.question("  Press Enter to continue...");
        hideCursor();
        continue;
      }

      const gearLabels = gearInBag.map((entry) => {
        const def = EQUIPMENT[entry.id];
        return `${def.name} (${def.slot.toUpperCase()}) - ${def.description}`;
      });

      const pickRes = await selectMenu({
        header: "\n  --- Select an Item to Equip ---",
        items: gearLabels,
        allowCancel: true,
        cancelLabel: "Cancel",
        clearScreen: true,
        rl,
      });

      if (pickRes.cancelled || pickRes.index === -1) continue;

      const selectedItem = gearInBag[pickRes.index];
      const equipRes = equipItem(player, selectedItem.id);
      console.log(`\n  >>> ${equipRes.message} <<<`);
      showCursor();
      await rl.question("  Press Enter to continue...");
      hideCursor();
    } else if (res.index === 1) {
      // Find currently equipped slots
      const equippedSlots = EQUIPMENT_SLOTS.filter((slot) => player.equipment && player.equipment[slot]);
      if (equippedSlots.length === 0) {
        console.log("\n  You have no equipment currently worn!");
        showCursor();
        await rl.question("  Press Enter to continue...");
        hideCursor();
        continue;
      }

      const slotLabels = equippedSlots.map((slot) => {
        const itemId = player.equipment[slot];
        const def = EQUIPMENT[itemId];
        return `${slot.toUpperCase()}: ${def ? def.name : itemId}`;
      });

      const pickRes = await selectMenu({
        header: "\n  --- Select a Slot to Unequip ---",
        items: slotLabels,
        allowCancel: true,
        cancelLabel: "Cancel",
        clearScreen: true,
        rl,
      });

      if (pickRes.cancelled || pickRes.index === -1) continue;

      const selectedSlot = equippedSlots[pickRes.index];
      const unequipRes = unequipItem(player, selectedSlot);
      console.log(`\n  >>> ${unequipRes.message} <<<`);
      showCursor();
      await rl.question("  Press Enter to continue...");
      hideCursor();
    }
  }
}

/**
 * Interactive menu to buy items at the Town Shop.
 * @param {Combatant} player
 * @param {readline.Interface} rl
 */
async function showTownShop(player, rl) {
  let shopRunning = true;
  while (shopRunning) {
    const potionDef = ITEMS.potion;
    const currentPotions = getItemCount(player, 'potion');

    const shopOptions = [
      `${potionDef.name} (${potionDef.price}G) - ${potionDef.description} (In Bag: ${currentPotions}/${ITEM_CAP})`,
      "Leave Shop (Return to Town)",
    ];

    const res = await selectMenu({
      header: () => {
        console.log("\n=================== TOWN BAZAAR & SHOP ===================");
        console.log("  The merchant nods: 'Welcome traveler! Stock up on supplies.'");
        console.log(`  Your Purse: 💰 ${player.gold || 0} Gold`);
        console.log("  --------------------------------------------------------");
      },
      items: shopOptions,
      allowCancel: true,
      cancelLabel: "Leave Shop (Return to Town)",
      clearScreen: true,
      rl,
    });

    if (res.cancelled || res.index === 1 || res.index === -1) {
      shopRunning = false;
      break;
    }

    if (res.index === 0) {
      const price = potionDef.price || 10;
      if ((player.gold || 0) < price) {
        console.log(`\n  >> You don't have enough gold! You need ${price}G, but only have ${player.gold || 0}G. <<`);
        showCursor();
        await rl.question("  Press Enter to continue...");
        hideCursor();
        continue;
      }

      const maxAffordable = Math.floor((player.gold || 0) / price);
      const spaceRemaining = ITEM_CAP - currentPotions;

      if (spaceRemaining <= 0) {
        console.log(`\n  >> Your bag cannot carry any more ${potionDef.name}s! (Cap is ${ITEM_CAP}) <<`);
        showCursor();
        await rl.question("  Press Enter to continue...");
        hideCursor();
        continue;
      }

      const maxCanBuy = Math.min(maxAffordable, spaceRemaining);
      showCursor();
      const qtyInput = (await rl.question(`  How many to buy? (1 - ${maxCanBuy}, 0 to cancel): `)).trim();
      hideCursor();

      if (qtyInput === '0') continue;

      const qty = parseInt(qtyInput, 10);
      if (isNaN(qty) || qty <= 0 || qty > maxCanBuy) {
        console.log(`  Invalid quantity! Please enter a number between 1 and ${maxCanBuy}.`);
        showCursor();
        await rl.question("  Press Enter to continue...");
        hideCursor();
        continue;
      }

      const totalCost = qty * price;
      player.gold -= totalCost;
      addItem(player.inventory, 'potion', qty);
      console.log(`\n  >>> Purchased ${qty}x ${potionDef.name} for ${totalCost} Gold! Remaining purse: ${player.gold}G <<<`);
      showCursor();
      await rl.question("  Press Enter to continue...");
      hideCursor();
    }
  }
}

/**
 * Handles the narrative entry into the Goblin King's lair.
 * Gateway for Step 3 boss encounter.
 * @param {Combatant} hero
 * @param {readline.Interface} rl
 */
async function enterBossLair(hero, rl) {
  console.log("\n=================== GOBLIN KING'S THRONE ROOM ===================");
  console.log("  You push open the massive spiked doors into a torchlit cavern.");
  console.log("  Bones and stolen treasures litter the path before a crude stone throne.");
  console.log("  High above sits the hulking GOBLIN KING, crowned in rusted iron!");
  console.log("  He snarls with a vicious grin, raising his spiked royal scepter!");
  console.log("=================================================================\n");
  await rl.question("  The King's royal aura bears down on you... Press Enter to begin!");

  const boss = createEnemy('goblinKing');
  const battleResult = await runBattle(hero, boss, rl);

  if (battleResult.outcome === 'victory') {
    hero.exp += battleResult.expGained;
    console.log(`\n  Earned ${battleResult.expGained} EXP! (Total: ${hero.exp}/${hero.nextLevelExp})`);
    await checkLevelUp(hero, rl);
    hero.bossDefeated = true;
    console.log("\n  *****************************************************************");
    console.log("  >>> THE GOBLIN KING HAS FALLEN!                               <<<");
    console.log("  >>> The realm is saved from the goblin menace!                <<<");
    console.log("  >>> You emerge victorious laden with royal spoils!            <<<");
    console.log("  *****************************************************************\n");
    await rl.question("  Press Enter to return triumphant to Town...");
  }
}

/**
 * Resolves player defeat inside the dungeon by reloading their most recent save.
 * @param {Combatant} hero
 * @param {readline.Interface} rl
 * @returns {Promise<Combatant>} The restored player combatant
 */
async function handleDungeonDefeat(hero, rl) {
  console.log("\n==========================================================");
  console.log("  >>> YOU HAVE FALLEN IN THE DUNGEON... <<<");
  console.log("  Darkness engulfs your vision as your strength fades away.");
  console.log("==========================================================");

  if (hero.lastSaveSlot) {
    console.log(`\n  Reloading your most recent save file from Slot ${hero.lastSaveSlot}...`);
    try {
      const reloaded = await storage.loadSlot(hero.lastSaveSlot);
      console.log(`  >>> Restored ${reloaded.name} (Lv. ${reloaded.level}) at Town Sanctuary! <<<`);
      return reloaded;
    } catch {
      console.log("  Error reloading save file.");
    }
  }

  const hasSaves = await storage.hasAnySaves();
  if (hasSaves) {
    console.log("\n  No active save recorded. Please select a save slot to restore:");
    const reloaded = await showLoadMenu(rl);
    if (reloaded) return reloaded;
  }

  console.log("\n  No previous saves found! A wandering cleric revives you at Town with 1 HP.");
  hero.actualHp = 1;
  return hero;
}

/**
 * Interactive Dungeon Exploration loop with persistent vitals and 5-kill boss threshold.
 * @param {Combatant} hero
 * @param {readline.Interface} rl
 * @returns {Promise<Combatant>}
 */
async function exploreDungeon(hero, rl) {
  let dungeonKills = 0;
  let inDungeon = true;

  console.log("\n  You descend the stone staircase into the damp Dungeon of Trials...");

  while (inDungeon) {
    if (!hero.isAlive()) {
      return await handleDungeonDefeat(hero, rl);
    }

    const bossUnlocked = dungeonKills >= 5;
    const dungeonOptions = [
      "Push deeper into the dungeon",
      "Use item from bag",
      `Challenge the Goblin King ${bossUnlocked ? '[UNLOCKED]' : '[LOCKED - Defeat 5 monsters]'}`,
      "Retreat to town",
    ];

    const res = await selectMenu({
      header: () => {
        console.log("\n=================== DUNGEON OF TRIALS ===================");
        console.log(`Explorer: ${hero.name} (Lv. ${hero.level}) | HP: ${hero.actualHp}/${hero.totalMaxHp} | MP: ${hero.actualMp}/${hero.totalMaxMp} | Gold: ${hero.gold || 0}G`);
        console.log(`Monsters Vanquished: ${dungeonKills} / 5 ${bossUnlocked ? '★ [BOSS CHAMBER UNSEALED!]' : ''}`);
        console.log("---------------------------------------------------------");
      },
      items: dungeonOptions,
      allowCancel: true,
      cancelLabel: "Retreat to town",
      clearScreen: true,
      rl,
    });

    if (res.cancelled || res.index === 3 || res.index === -1) {
      console.log("\n  You cautiously retrace your steps through the winding halls and return to Town.");
      inDungeon = false;
      break;
    }

    if (res.index === 0) {
      // Encounter random monster from bestiary
      const monsterKeys = ['goblin', 'wolf', 'golem'];
      const randomKey = monsterKeys[Math.floor(Math.random() * monsterKeys.length)];
      const enemy = createEnemy(randomKey);

      console.log(`\n  Footsteps echo in the dark corridor... An aggressive ${enemy.name} emerges!`);
      const battleResult = await runBattle(hero, enemy, rl);

      if (battleResult.outcome === 'victory') {
        hero.exp += battleResult.expGained;
        console.log(`\n  Earned ${battleResult.expGained} EXP! (Total: ${hero.exp}/${hero.nextLevelExp})`);
        await checkLevelUp(hero, rl);
        dungeonKills++;

        if (dungeonKills === 5) {
          console.log("\n  *****************************************************************");
          console.log("  >>> A loud rumble shakes the stone walls!                       <<<");
          console.log("  >>> The heavy gate leading to the Goblin King's lair unlocks!   <<<");
          console.log("  *****************************************************************");

          showCursor();
          const promptBoss = (await rl.question("  Do you wish to challenge the Goblin King now? (y/n): ")).trim().toLowerCase();
          hideCursor();
          if (promptBoss === 'y' || promptBoss === 'yes') {
            await enterBossLair(hero, rl);
            if (!hero.isAlive()) {
              return await handleDungeonDefeat(hero, rl);
            }
            if (hero.bossDefeated) {
              inDungeon = false;
              break;
            }
          } else {
            console.log("  You step back into the corridor to prepare yourself.");
          }
        }
      } else {
        // Player defeated in dungeon battle
        return await handleDungeonDefeat(hero, rl);
      }
    } else if (res.index === 1) {
      await showTownItemMenu(hero, rl);
    } else if (res.index === 2) {
      if (dungeonKills < 5) {
        console.log("\n  The boss chamber is sealed by enchanted goblin wards! Defeat at least 5 monsters to unseal it.");
      } else {
        await enterBossLair(hero, rl);
        if (!hero.isAlive()) {
          return await handleDungeonDefeat(hero, rl);
        }
        if (hero.bossDefeated) {
          inDungeon = false;
          break;
        }
      }
    }
  }

  return hero;
}

async function main() {

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    enterAlternateScreen();
    let hero = null;

    // Startup Title Screen: New Game, Load Game, or Exit
    while (!hero) {
      const hasSaves = await storage.hasAnySaves();
      const titleOptions = [
        "New Game (Create Hero)",
        hasSaves ? "Load Game (Select Save Slot)" : "Load Game (No save files found)",
        "Exit Game",
      ];

      const titleRes = await selectMenu({
        header: () => {
          console.log("==================================================================");
          console.log("               WELCOME TO CLI RPG BATTLE SIMULATOR                ");
          console.log("==================================================================");
          console.log("\n--- TITLE MENU ---");
        },
        items: titleOptions,
        clearScreen: true,
        rl,
      });

      if (titleRes.index === 0) {
        showCursor();
        const inputName = (await rl.question("\n  Enter your hero's name (press Enter for 'Hero'): ")).trim();
        hideCursor();
        const heroName = inputName || 'Hero';

        hero = new Combatant(heroName, 120, 25, 12, 8, 8, 6, 11, 10, false);
        hero.skills = [
          'fire1', 'thunder1', 'ice1', 'heal1', 'protect1', 'powerup1',
          'heavySlash', 'armorBreak', 'quickStrike',
          'firestorm1', 'thunderstorm1', 'blizzard1', 'whirlwind',
        ];
        hero.passives = ['vigor'];
        hero.level = 1;
        hero.exp = 0;
        hero.nextLevelExp = 30;
        hero.gold = 50;
        hero.inventory = [
          { id: 'potion', quantity: 2 },
        ];
        hero.equipment = {
          weapon: 'leather_shiv',
          chest: 'leather_chest',
          shoes: 'leather_boots',
          accessory: 'leather_wristband',
        };
        // Initial health & mana adjusted for equipment bonuses
        hero.actualHp = hero.totalMaxHp;
        hero.actualMp = hero.totalMaxMp;

        console.log(`\n  Greetings, ${hero.name}! Your adventure begins.`);
        showCursor();
        await rl.question("  Press Enter to enter Town...");
        hideCursor();
      } else if (titleRes.index === 1) {
        const loaded = await showLoadMenu(rl);
        if (loaded) {
          hero = loaded;
          console.log(`\n  Welcome back, ${hero.name}!`);
        }
      } else if (titleRes.index === 2 || titleRes.cancelled || titleRes.index === -1) {
        console.log("\n  Farewell, adventurer!\n");
        return;
      }
    }

    let running = true;
    while (running) {
      const townOptions = [
        "Explore Dungeon of Trials",
        "Enter Battle Arena (Single Duel)",
        "View Hero Character Sheet",
        "Use Item from Bag",
        "Manage Equipment (Equip / Unequip)",
        "Visit Town Shop",
        "Rest at Inn (Full Heal)",
        "Save Game",
        "Load Game",
        "Exit Game",
      ];

      const townRes = await selectMenu({
        header: () => {
          console.log("==================================================================");
          console.log("                        TOWN & SANCTUARY                          ");
          console.log(`  Hero: ${hero.name} (Lv. ${hero.level}) | HP: ${hero.actualHp}/${hero.totalMaxHp} | MP: ${hero.actualMp}/${hero.totalMaxMp} | Gold: ${hero.gold || 0}G`);
          console.log("==================================================================");
        },
        items: townOptions,
        clearScreen: true,
        rl,
      });

      if (townRes.cancelled || townRes.index === 9 || townRes.index === -1) {
        console.log("\n  Thank you for playing Chronicles of Anima! Safe travels, hero.\n");
        running = false;
        break;
      }

      if (townRes.index === 0) {
        // EXPLORE DUNGEON
        if (hero.actualHp <= 0) {
          console.log("\n  You are too injured to enter the dungeon! Rest at the Inn first.");
          showCursor();
          await rl.question("  Press Enter to continue...");
          hideCursor();
          continue;
        }
        hero = await exploreDungeon(hero, rl);
      } else if (townRes.index === 1) {
        // ENCOUNTER SELECTION (ARENA)
        if (hero.actualHp <= 0) {
          console.log("\n  You are too injured to fight! Rest at the Inn first.");
          showCursor();
          await rl.question("  Press Enter to continue...");
          hideCursor();
          continue;
        }

        const arenaOptions = [
          `Goblin      - ${MONSTERS.goblin.description} (+${MONSTERS.goblin.exp} EXP)`,
          `Forest Wolf - ${MONSTERS.wolf.description} (+${MONSTERS.wolf.exp} EXP)`,
          `Iron Golem  - ${MONSTERS.golem.description} (+${MONSTERS.golem.exp} EXP)`,
          "Return to Town",
        ];

        const arenaRes = await selectMenu({
          header: "\n--- SELECT AN OPPONENT ---",
          items: arenaOptions,
          allowCancel: true,
          cancelLabel: "Return to Town",
          clearScreen: true,
          rl,
        });

        if (arenaRes.cancelled || arenaRes.index === 3 || arenaRes.index === -1) {
          continue;
        }

        const foeKeys = ['goblin', 'wolf', 'golem'];
        const foeKey = foeKeys[arenaRes.index];
        if (foeKey) {
          const enemy = createEnemy(foeKey);
          const battleResult = await runBattle(hero, enemy, rl);

          if (battleResult.outcome === 'victory') {
            hero.exp += battleResult.expGained;
            console.log(`\n  Earned ${battleResult.expGained} EXP! (Total: ${hero.exp}/${hero.nextLevelExp})`);
            await checkLevelUp(hero, rl);
            showCursor();
            await rl.question("  Press Enter to return to Town...");
            hideCursor();
          } else {
            console.log("\n  You were defeated in battle! A local cleric drags you back to town.");
            hero.actualHp = 1; // Revive with 1 HP
            showCursor();
            await rl.question("  Press Enter to return to Town...");
            hideCursor();
          }
        }
      } else if (townRes.index === 2) {
        // HERO STATUS SHEET
        clearScreenHome();
        console.log("==================================================================");
        console.log(`                  HERO PROFILE: ${hero.name.toUpperCase()}                 `);
        console.log("==================================================================");
        console.log(`  Level:       ${hero.level}`);
        console.log(`  Experience:  ${hero.exp} / ${hero.nextLevelExp} EXP`);
        console.log(`  Health (HP): ${hero.actualHp} / ${hero.totalMaxHp} (Base: ${hero.maxHp})`);
        console.log(`  Mana (MP):   ${hero.actualMp} / ${hero.totalMaxMp} (Base: ${hero.maxMp})`);
        console.log(`  Gold Purse:  ${hero.gold || 0} Gold (G)`);
        console.log("  ----------------------------------------------------------------");
        console.log(`  Attack (ATK):       ${hero.totalAtk.toString().padEnd(3)} (Base: ${hero.atk}, Gear: +${hero.totalAtk - hero.atk})`);
        console.log(`  Defense (DEF):      ${hero.totalDef.toString().padEnd(3)} (Base: ${hero.def}, Gear: +${hero.totalDef - hero.def})`);
        console.log(`  Magic ATK (M.ATK):  ${hero.totalMAtk.toString().padEnd(3)} (Base: ${hero.mAtk}, Gear: +${hero.totalMAtk - hero.mAtk})`);
        console.log(`  Magic DEF (M.DEF):  ${hero.totalMDef.toString().padEnd(3)} (Base: ${hero.mDef}, Gear: +${hero.totalMDef - hero.mDef})`);
        console.log(`  Speed (SPD):        ${hero.totalSpd.toString().padEnd(3)} (Base: ${hero.spd}, Gear: +${hero.totalSpd - hero.spd})`);
        console.log(`  Luck (LCK):         ${hero.totalLck.toString().padEnd(3)} (Base: ${hero.lck}, Gear: +${hero.totalLck - hero.lck})`);
        console.log("  ----------------------------------------------------------------");
        console.log("  Equipped Gear:");
        EQUIPMENT_SLOTS.forEach((slot) => {
          const itemId = hero.equipment ? hero.equipment[slot] : null;
          const itemDef = itemId ? EQUIPMENT[itemId] : null;
          const nameStr = itemDef ? itemDef.name : '(Empty)';
          const descStr = itemDef ? ` - ${itemDef.description}` : '';
          console.log(`    [${slot.toUpperCase().padEnd(9)}] ${nameStr}${descStr}`);
        });
        console.log("  ----------------------------------------------------------------");
        console.log("  Elemental & Physical Resistances:");
        console.log(`    Physical: ${((hero.getResistance('physical')) * 100).toFixed(0)}%    | Fire:    ${((hero.getResistance('fire')) * 100).toFixed(0)}%`);
        console.log(`    Ice:      ${((hero.getResistance('ice')) * 100).toFixed(0)}%    | Thunder: ${((hero.getResistance('thunder')) * 100).toFixed(0)}%`);
        console.log("  ----------------------------------------------------------------");
        console.log("  Passives:");
        if (hero.passives.length === 0) {
          console.log("    (None)");
        } else {
          hero.passives.forEach((pId) => {
            const p = PASSIVES[pId];
            if (p) {
              console.log(`    * [${p.name}] - ${p.description}`);
            } else {
              console.log(`    * [${pId}]`);
            }
          });
        }
        console.log(`  Skills:      ${hero.skills.join(', ')}`);
        console.log("  ----------------------------------------------------------------");
        console.log("  Inventory Items (Max 99):");
        if (!hero.inventory || hero.inventory.length === 0) {
          console.log("    (Bag is empty)");
        } else {
          hero.inventory.forEach((entry) => {
            const it = ITEMS[entry.id];
            const eq = EQUIPMENT[entry.id];
            if (it) {
              console.log(`    * [Item] ${it.name} x${entry.quantity} - ${it.description}`);
            } else if (eq) {
              console.log(`    * [Gear] ${eq.name} x${entry.quantity} (${eq.slot.toUpperCase()}) - ${eq.description}`);
            } else {
              console.log(`    * [Other] ${entry.id} x${entry.quantity}`);
            }
          });
        }
        console.log("==================================================================");

        showCursor();
        await rl.question("Press Enter to return to menu...");
        hideCursor();
      } else if (townRes.index === 3) {
        // USE ITEM FROM BAG
        await showTownItemMenu(hero, rl);
      } else if (townRes.index === 4) {
        // MANAGE EQUIPMENT
        await showEquipmentMenu(hero, rl);
      } else if (townRes.index === 5) {
        // TOWN SHOP
        await showTownShop(hero, rl);
      } else if (townRes.index === 6) {
        // REST AT INN
        hero.actualHp = hero.totalMaxHp;
        hero.actualMp = hero.totalMaxMp;
        console.log("\n  You slept soundly at the Inn.");
        console.log(`  HP and MP restored to maximum (${hero.actualHp}/${hero.totalMaxHp} HP | ${hero.actualMp}/${hero.totalMaxMp} MP)!`);
        showCursor();
        await rl.question("  Press Enter to continue...");
        hideCursor();
      } else if (townRes.index === 7) {
        // SAVE GAME
        await showSaveMenu(hero, rl);
      } else if (townRes.index === 8) {
        // LOAD GAME
        const loadedHero = await showLoadMenu(rl);
        if (loadedHero) {
          hero = loadedHero;
        }
      }
    }
  } finally {
    exitAlternateScreen();
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkLevelUp,
  showSaveMenu,
  showLoadMenu,
  showTownItemMenu,
  showTownShop,
  exploreDungeon,
  handleDungeonDefeat,
  enterBossLair,
};


