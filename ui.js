/**
 * UI Renderer for CLI RPG
 * Handles ASCII art, turn order timeline, combatant status, and menus.
 */

const GOBLIN_ART = [
  "      (o)_(o)     ",
  "     /  (_)  \\    ",
  "    |  /   \\  |   ",
  "    \\_________/   ",
  "     [ Goblin ]   ",
];

/**
 * Formats a single status badge (suppressing 'neutral')
 */
function formatStatus(combatant) {
  if (!combatant.currentStatus || combatant.currentStatus === 'neutral') {
    return "";
  }
  return ` [${combatant.currentStatus.toUpperCase()}]`;
}

/**
 * Renders the full battle screen to the terminal.
 * @param {Combatant} player - The player combatant
 * @param {Combatant|Array<Combatant>} enemies - The enemy combatant or array of enemies
 * @param {Array<Combatant>} turnOrder - Current round's sorted turn order
 * @param {string} logMessage - Message from previous action
 * @param {number} [selectedTargetIndex=0] - Index of focused target among alive enemies
 */
function renderBattleScreen(player, enemies, turnOrder, logMessage = "", selectedTargetIndex = 0) {
  const enemyList = Array.isArray(enemies) ? enemies : [enemies];
  const aliveEnemies = enemyList.filter((e) => e.isAlive());
  const focusedEnemy = aliveEnemies[selectedTargetIndex] || aliveEnemies[0] || enemyList[0];

  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[H\x1b[J');
  } else {
    console.clear();
  }
  console.log("==================================================================");
  console.log("                     BATTLE SIMULATOR (CLI)                       ");
  console.log("==================================================================");

  // Upper section: Enemy ASCII Art on left, Turn Timeline on right
  const leftHeader = enemyList.length > 1 ? "  TARGET ENEMY" : "  ENEMY";
  console.log(`${leftHeader.padEnd(33, " ")}TURN TIMELINE (ACTION GAUGE)`);
  console.log("  -----------------------------  ---------------------------------");

  const art = (focusedEnemy && focusedEnemy.art) || GOBLIN_ART;
  const maxLines = Math.max(art.length, turnOrder.length + 1);

  for (let i = 0; i < maxLines; i++) {
    const leftText = art[i] || " ".repeat(18);
    const paddedLeft = leftText.padEnd(30, " ");

    let rightText = "";
    if (i < turnOrder.length) {
      const c = turnOrder[i];
      const gaugePercent = Math.min(100, Math.floor(((c.actionGauge || 0) / 10000) * 100));
      const indicator = c.actualHp <= 0 ? "K.O." : `${gaugePercent}%`;
      const marker = c.isEnemy ? "[Enemy]" : "[Hero] ";
      rightText = `  ${i + 1}. ${marker} ${c.name} (${indicator})`;
    }

    console.log(`  ${paddedLeft} |${rightText}`);
  }

  // Enemy Vitals line(s)
  if (enemyList.length === 1) {
    const single = enemyList[0];
    const enemyStatus = formatStatus(single);
    console.log(`  HP: ${single.actualHp}/${single.totalMaxHp || single.maxHp}  MP: ${single.actualMp}/${single.totalMaxMp || single.maxMp}${enemyStatus}`);
  } else {
    enemyList.forEach((en, idx) => {
      const isTarget = aliveEnemies[selectedTargetIndex] === en;
      const cursor = isTarget ? "[►] " : "    ";
      const enStatus = formatStatus(en);
      const koTag = !en.isAlive() ? " (K.O.)" : "";
      console.log(`  ${cursor}${idx + 1}. ${en.name.padEnd(14)} HP: ${en.actualHp}/${en.totalMaxHp || en.maxHp}  MP: ${en.actualMp}/${en.totalMaxMp || en.maxMp}${enStatus}${koTag}`);
    });
  }
  console.log("------------------------------------------------------------------");

  // Lower section: Player stats on left, Command Menu on right
  const playerStatus = formatStatus(player);
  console.log(`  PLAYER: ${player.name}${playerStatus}`);
  console.log(`  HP: ${player.actualHp}/${player.totalMaxHp || player.maxHp}    |  [1] Attack    [2] Defend    [3] Skills`);
  console.log(`  MP: ${player.actualMp}/${player.totalMaxMp || player.maxMp}      |  [4] Item      [5] Skip Turn`);
  console.log("==================================================================");


  if (logMessage) {
    console.log(`> ${logMessage}`);
    console.log("------------------------------------------------------------------");
  }
}

module.exports = {
  renderBattleScreen,
  formatStatus,
};
