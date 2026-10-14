/**
 * Battle Engine for CLI RPG
 * Manages speed-based turn order, async player input, multi-enemy party combat,
 * target selection cursor, dynamic minion summoning, and round loops.
 */

const readline = require('readline/promises');
const Combatant = require('./combatant');
const { renderBattleScreen } = require('./ui');
const { SKILLS } = require('./skills');
const { ITEMS, useItem, addItem } = require('./items');
const { createEnemy } = require('./enemies');
const { selectMenu } = require('./menu');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ACTION_GAUGE_MAX = 10000;

/**
 * Enemy AI decision logic:
 * - If HP <= 25% of maxHp, 1-in-3 (33%) chance to Defend.
 * - Otherwise, attacks the hero.
 */
function chooseEnemyAction(enemy) {
  if (enemy.actualHp <= enemy.maxHp * 0.25) {
    if (Math.random() < 1 / 3) {
      return 'defend';
    }
  }
  return 'attack';
}

/**
 * Interactively prompts the player to select a target enemy among alive enemies.
 * If only 1 enemy is alive, auto-selects that enemy without prompting.
 * Displays cursor indicator [►] next to the selected target.
 */
async function selectTarget(rl, aliveEnemies, player, enemyParty, turnOrder, logMessage) {
  if (aliveEnemies.length === 1) {
    return aliveEnemies[0];
  }

  const targetLabels = aliveEnemies.map(
    (e) => `${e.name.padEnd(16)} HP: ${e.actualHp}/${e.totalMaxHp || e.maxHp}`
  );

  const res = await selectMenu({
    header: "\n  ================ SELECT TARGET ================",
    items: targetLabels,
    renderCustom: (idx) => {
      renderBattleScreen(player, enemyParty, turnOrder, logMessage, idx);
    },
    clearScreen: false,
    rl,
  });

  const chosenIdx = res.index >= 0 ? res.index : 0;
  return aliveEnemies[chosenIdx] || aliveEnemies[0];
}

/**
 * Runs a modular turn-based battle supporting single or multiple enemies.
 * @param {Combatant} player - The player combatant
 * @param {Combatant|Array<Combatant>} enemiesInput - Single enemy or enemy party array
 * @param {readline.Interface} [existingRl] - Optional shared readline interface
 * @returns {Promise<{ outcome: 'victory' | 'defeat', expGained: number, goldGained: number, looted: string[] }>}
 */
async function runBattle(player, enemiesInput, existingRl) {
  const ownsRl = !existingRl;
  const rl = existingRl || readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Fallback defaults for standalone running
  if (!player) player = new Combatant('Tidus', 120, 25, 12, 8, 8, 6, 11, 10, false);
  
  // Normalize enemies into an array
  const enemyParty = Array.isArray(enemiesInput)
    ? [...enemiesInput]
    : [enemiesInput || new Combatant('Goblin', 50, 0, 8, 4, 3, 3, 6, 5, true)];

  // Equip skills & passives if not yet present
  if (!player.skills || player.skills.length === 0) {
    player.skills = ['fire1', 'thunder1', 'ice1', 'heal1', 'protect1', 'powerup1', 'heavySlash', 'armorBreak', 'quickStrike'];
  }
  if (!player.passives || player.passives.length === 0) {
    player.passives = ['vigor'];
  }
  if (!player.inventory) {
    player.inventory = [];
  }

  const initialNames = enemyParty.map((e) => e.name).join(', ');
  let logMessage = enemyParty.length > 1
    ? `Hostile enemies (${initialNames}) appear! The battle begins.`
    : `A wild ${enemyParty[0].name} appears! The battle begins.`;

  // Initialize action gauges
  player.actionGauge = player.actionGauge || 0;
  enemyParty.forEach((e) => {
    e.actionGauge = e.actionGauge || 0;
  });

  let turnCount = 1;

  try {
    while (player.isAlive() && enemyParty.some((e) => e.isAlive())) {
      const livingCombatants = [player, ...enemyParty.filter((e) => e.isAlive())];
      if (livingCombatants.length === 0) break;

      // 1. Advance CTB time until at least one living combatant reaches ACTION_GAUGE_MAX
      while (!livingCombatants.some((c) => (c.actionGauge || 0) >= ACTION_GAUGE_MAX)) {
        for (const c of livingCombatants) {
          const spd = Math.max(1, c.totalSpd || c.spd || 1);
          c.actionGauge = Math.min(ACTION_GAUGE_MAX, (c.actionGauge || 0) + spd);
        }
      }

      // 2. Select next ready combatant (gauge >= ACTION_GAUGE_MAX)
      // Primary sort: Speed descending
      // Tie-breaker: If equal speed, player has advantage
      const readyCandidates = livingCombatants.filter((c) => (c.actionGauge || 0) >= ACTION_GAUGE_MAX);
      readyCandidates.sort((a, b) => {
        const aSpd = a.totalSpd || a.spd || 1;
        const bSpd = b.totalSpd || b.spd || 1;
        if (bSpd !== aSpd) {
          return bSpd - aSpd;
        }
        if (a === player) return -1;
        if (b === player) return 1;
        return 0;
      });

      const combatant = readyCandidates[0];

      // Reset acting combatant's action gauge
      combatant.resetActionGauge();

      if (!combatant.isAlive()) continue;

      // Build sorted timeline for UI display (highest gauge first, then SPD, player advantage on tie)
      const currentTurnOrder = [player, ...enemyParty.filter((e) => e.isAlive())];
      currentTurnOrder.sort((a, b) => {
        const aGauge = a.actionGauge || 0;
        const bGauge = b.actionGauge || 0;
        if (bGauge !== aGauge) return bGauge - aGauge;
        const aSpd = a.totalSpd || a.spd || 1;
        const bSpd = b.totalSpd || b.spd || 1;
        if (bSpd !== aSpd) return bSpd - aSpd;
        if (a === player) return -1;
        if (b === player) return 1;
        return 0;
      });

      logMessage = `--- TURN ${turnCount} (${combatant.name}) --- | ${logMessage}`;
      turnCount++;

      // Clear previous defend stance as this character's action begins
      combatant.clearDefend();

      // Decrement Protect buff turns if active
      if (combatant.protectTurns > 0) {
        combatant.protectTurns--;
        if (combatant.protectTurns === 0) {
          logMessage = `${combatant.name}'s Protect barrier has faded! | ${logMessage}`;
        }
      }

      // Decrement Armor Break debuff turns if active
      if (combatant.armorBreakTurns > 0) {
        combatant.armorBreakTurns--;
        if (combatant.armorBreakTurns === 0) {
          logMessage = `${combatant.name}'s shattered defense has stabilized! | ${logMessage}`;
        }
      }

        // --- TURN-START AILMENT CHECKS ---
        // 1. Burn tick (3% maxHp damage)
        if (combatant.currentStatus === 'burn') {
          const burnDmg = Math.max(1, Math.floor(combatant.maxHp * 0.03));
          combatant.actualHp = Math.max(0, combatant.actualHp - burnDmg);
          logMessage = `[BURN] ${combatant.name} suffers ${burnDmg} fire damage! | ${logMessage}`;
          if (!combatant.isAlive()) {
            renderBattleScreen(player, enemyParty, currentTurnOrder, logMessage);
            continue;
          }
        }

        // 2. Stun check (skips turn, clears after)
        if (combatant.currentStatus === 'stun') {
          combatant.currentStatus = 'neutral';
          logMessage = `[STUNNED!] ${combatant.name} is paralyzed and cannot act this turn!`;
          renderBattleScreen(player, enemyParty, currentTurnOrder, logMessage);
          await sleep(900);
          continue;
        }

        // 3. Freeze check (skips turn, clears after)
        if (combatant.currentStatus === 'freeze') {
          combatant.currentStatus = 'neutral';
          logMessage = `[FROZEN!] ${combatant.name} thaws out and misses this turn!`;
          renderBattleScreen(player, enemyParty, currentTurnOrder, logMessage);
          await sleep(900);
          continue;
        }

        if (!combatant.isEnemy) {
          // --- PLAYER TURN ---
          let actionTaken = false;

          while (!actionTaken) {
            const aliveEnemies = enemyParty.filter((e) => e.isAlive());
            if (aliveEnemies.length === 0) break;

            const actionOptions = [
              "Attack (Physical strike on target)",
              "Defend (Halve damage until next turn)",
              "Skills (Magic spells & martial techniques)",
              "Item (Use consumable from inventory)",
              "Skip Turn (Conserve action)",
            ];

            const actRes = await selectMenu({
              header: "\n  ==================== COMMANDS ====================",
              items: actionOptions,
              renderCustom: () => {
                renderBattleScreen(player, enemyParty, currentTurnOrder, logMessage);
              },
              clearScreen: false,
              rl,
            });

            if (actRes.index === 0) {
              // Physical Attack with Target Selection
              const target = await selectTarget(rl, aliveEnemies, player, enemyParty, currentTurnOrder, logMessage);
              const res = player.attack(target);
              let powerUpNote = res.powerUpUsed ? " [POWER UP RELEASED!]" : "";
              if (res.isDodged) {
                logMessage = `[DODGED!] ${target.name} swiftly evaded ${player.name}'s attack! (0 dmg)`;
              } else if (res.isAbsorbed) {
                logMessage = `[ABSORBED!] ${target.name} absorbed the physical blow and recovered ${Math.abs(res.damage)} HP!${powerUpNote}`;
              } else if (res.isImmune) {
                logMessage = `[IMMUNE!] ${target.name} is completely immune to physical attacks!`;
              } else if (res.isCrit) {
                logMessage = `[CRITICAL HIT!] ${player.name} strikes fiercely for ${res.damage} damage to ${target.name}!${powerUpNote}`;
              } else {
                let resTag = res.isWeakness ? " [WEAKNESS HIT!]" : (res.isResisted ? " [RESISTED]" : "");
                logMessage = `${player.name} attacks ${target.name} for ${res.damage} damage!${powerUpNote}${resTag}`;
              }
              if (!target.isAlive()) {
                logMessage = `${target.name} was defeated! | ${logMessage}`;
              }
              actionTaken = true;
            } else if (actRes.index === 1) {
              // Defend
              player.defend();
              logMessage = `${player.name} braces for impact and assumes a DEFENSIVE stance!`;
              actionTaken = true;
            } else if (actRes.index === 2) {
              // Skills Sub-Menu (Physical & Magic)
              let skillSelected = false;
              while (!skillSelected) {
                const skillLabels = player.skills.map((skKey) => {
                  const s = SKILLS[skKey];
                  if (!s) return null;
                  let costStr = '';
                  if (s.hpCostPercent > 0) {
                    const calcHp = Math.max(1, Math.floor((player.totalMaxHp || player.maxHp) * s.hpCostPercent));
                    costStr = `${calcHp} HP (${Math.round(s.hpCostPercent * 100)}%)`;
                  } else if (s.hpCost > 0) {
                    costStr = `${s.hpCost} HP`;
                  } else {
                    costStr = `${s.mpCost} MP`;
                  }
                  const scopeTag = s.targetType === 'all_enemies' ? '[ALL] ' : '';
                  return `${s.name.padEnd(14)} (${costStr.padEnd(11)}) - ${scopeTag}${s.description}`;
                }).filter(Boolean);

                const skRes = await selectMenu({
                  header: "\n  ==================== SKILLS & TECHNIQUES ====================",
                  items: skillLabels,
                  allowCancel: true,
                  cancelLabel: "Cancel (Return to Actions)",
                  renderCustom: () => {
                    renderBattleScreen(player, enemyParty, currentTurnOrder, logMessage);
                  },
                  clearScreen: false,
                  rl,
                });

                if (skRes.cancelled || skRes.index === -1) {
                  break; // Return to main action menu
                }

                const skIdx = skRes.index;
                if (skIdx >= 0 && skIdx < player.skills.length) {
                  const s = SKILLS[player.skills[skIdx]];
                  if (!s) {
                    console.log("  Invalid selection!");
                    continue;
                  }

                  if (s.mpCost > 0 && player.actualMp < s.mpCost) {
                    console.log(`\n  >> Not enough MP! (Need ${s.mpCost} MP, you have ${player.actualMp} MP) <<`);
                    await sleep(900);
                    continue;
                  }

                  const hpCost = s.hpCostPercent > 0
                    ? Math.max(1, Math.floor((player.totalMaxHp || player.maxHp) * s.hpCostPercent))
                    : (s.hpCost || 0);

                  if (hpCost > 0 && player.actualHp <= hpCost) {
                    console.log(`\n  >> Insufficient HP! Cannot sacrifice health below 1 HP (Need ${hpCost} HP, you have ${player.actualHp} HP) <<`);
                    await sleep(900);
                    continue;
                  }

                  // Determine target: self skills vs AoE vs single-target cursor
                  let target = null;
                  if (s.targetType === 'self') {
                    target = player;
                  } else if (s.targetType === 'all_enemies') {
                    target = aliveEnemies;
                  } else {
                    // 'single'
                    target = await selectTarget(rl, aliveEnemies, player, enemyParty, currentTurnOrder, logMessage);
                  }

                  if (s.mpCost > 0) player.actualMp -= s.mpCost;
                  const skillResult = s.execute(player, target);
                  logMessage = skillResult;

                  if (s.targetType === 'all_enemies') {
                    const defeatedList = aliveEnemies.filter((e) => !e.isAlive());
                    if (defeatedList.length > 0) {
                      const defeatedNames = defeatedList.map((e) => e.name).join(', ');
                      logMessage = `${logMessage}\n[DEFEATED] ${defeatedNames}!`;
                    }
                  } else if (s.targetType === 'single' && target && !target.isAlive()) {
                    logMessage = `${target.name} was defeated! | ${logMessage}`;
                  }

                  actionTaken = true;
                  skillSelected = true;
                } else {
                  console.log("  Invalid selection!");
                }
              }
            } else if (actRes.index === 3) {
              // Item Sub-Menu (Only consumable items)
              const consumables = (player.inventory || []).filter((entry) => ITEMS[entry.id]);
              if (consumables.length === 0) {
                logMessage = "You have no consumable items in your inventory!";
                continue;
              }

              let itemSelected = false;
              while (!itemSelected) {
                const itemLabels = consumables.map((entry) => {
                  const it = ITEMS[entry.id];
                  return `${it.name.padEnd(10)} (Qty: ${entry.quantity}) - ${it.description}`;
                });

                const itRes = await selectMenu({
                  header: "\n  ================ INVENTORY ================",
                  items: itemLabels,
                  allowCancel: true,
                  cancelLabel: "Cancel (Return to Actions)",
                  renderCustom: () => {
                    renderBattleScreen(player, enemyParty, currentTurnOrder, logMessage);
                  },
                  clearScreen: false,
                  rl,
                });

                if (itRes.cancelled || itRes.index === -1) {
                  break;
                }

                const itIdx = itRes.index;
                if (itIdx >= 0 && itIdx < consumables.length) {
                  const selectedId = consumables[itIdx].id;
                  const resMsg = useItem(player.inventory, selectedId, player);
                  logMessage = resMsg || `${player.name} used an item.`;
                  actionTaken = true;
                  itemSelected = true;
                } else {
                  console.log("  Invalid selection!");
                }
              }
            } else if (actRes.index === 4) {
              // Skip Turn
              logMessage = `${player.name} stands guard and skips this turn.`;
              actionTaken = true;
            }
          }
        } else {
          // --- ENEMY TURN ---
          renderBattleScreen(player, enemyParty, currentTurnOrder, logMessage);
          await sleep(900); // Brief pause so player can follow events

          const action = chooseEnemyAction(combatant);
          if (action === 'defend') {
            combatant.defend();
            logMessage = `${combatant.name} assumes a DEFENSIVE stance!`;
          } else {
            const res = combatant.attack(player);
            if (res.isDodged) {
              logMessage = `[DODGED!] ${player.name} gracefully evaded ${combatant.name}'s attack!`;
            } else if (res.isAbsorbed) {
              logMessage = `[ABSORBED!] ${player.name} absorbed the physical blow and recovered ${Math.abs(res.damage)} HP!`;
            } else if (res.isImmune) {
              logMessage = `[IMMUNE!] ${player.name} is completely immune to physical attacks!`;
            } else if (res.isCrit) {
              logMessage = `[CRITICAL HIT!] ${combatant.name} lands a crushing blow for ${res.damage} damage!`;
            } else {
              let resTag = res.isWeakness ? " [WEAKNESS HIT!]" : (res.isResisted ? " [RESISTED]" : "");
              logMessage = `${combatant.name} attacks ${player.name} for ${res.damage} damage!${resTag}`;
            }

            // Check if attack triggered a passive minion summon (e.g. Royal Focus)
            if (res.summonEvent && res.summonEvent.summon === 'smallGoblin') {
              const minion = createEnemy('smallGoblin');
              minion.actionGauge = 0;
              enemyParty.push(minion);
              logMessage = `${res.summonEvent.message} | ${logMessage}`;
            } else if (res.summonEvent && res.summonEvent.message) {
              logMessage = `${res.summonEvent.message} | ${logMessage}`;
            }
          }

          renderBattleScreen(player, enemyParty, currentTurnOrder, logMessage);
          await sleep(900);
        }
      }

    // 3. Battle Conclusion
    const finalTurnOrder = [player, ...enemyParty.filter((e) => e.isAlive())];
    renderBattleScreen(player, enemyParty, finalTurnOrder, logMessage);
    console.log();
    const isWin = player.isAlive();
    if (isWin) {
      const expReward = enemyParty.reduce((sum, e) => sum + (e.expReward || 0), 0);
      const goldReward = enemyParty.reduce((sum, e) => sum + (e.gold || 0), 0);
      player.gold = (player.gold || 0) + goldReward;

      const defeatedNames = enemyParty.map((e) => e.name).join(', ');
      console.log(`  >>> VICTORY! All enemies defeated (${defeatedNames})! <<<`);
      console.log(`  >>> Rewards: +${expReward} EXP, +${goldReward} Gold <<<`);

      // Roll for enemy loot drops for all enemies in the party
      const looted = [];
      for (const en of enemyParty) {
        if (en.drops && en.drops.length > 0) {
          for (const drop of en.drops) {
            if (Math.random() < drop.chance) {
              addItem(player.inventory, drop.itemId, 1);
              const def = ITEMS[drop.itemId];
              looted.push(def ? def.name : drop.itemId);
            }
          }
        }
      }

      if (looted.length > 0) {
        console.log(`  >>> LOOT DROPS: Obtained ${looted.map((n) => `1x ${n}`).join(', ')}! <<<`);
      }
      console.log("==================================================================\n");
      await sleep(1200);
      return { outcome: 'victory', expGained: expReward, goldGained: goldReward, looted };
    } else {
      console.log("  >>> DEFEAT... You were knocked out! <<<");
      console.log("==================================================================\n");
      await sleep(1200);
      return { outcome: 'defeat', expGained: 0, goldGained: 0, looted: [] };
    }
  } finally {
    if (ownsRl) {
      rl.close();
    }
  }
}

if (require.main === module) {
  runBattle();
}

module.exports = {
  runBattle,
  chooseEnemyAction,
  selectTarget,
  ACTION_GAUGE_MAX,
};
