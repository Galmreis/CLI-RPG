/**
 * UI Renderer for CLI RPG
 * Handles ASCII art, turn order timeline, combatant status, and menus.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
 * @param {object} [options={}] - Visual effects options (horizontalOffset, flashBorder, overlayEffect)
 */
function renderBattleScreen(
  player,
  enemies,
  turnOrder,
  logMessage = "",
  selectedTargetIndex = 0,
  options = {}
) {
  const { horizontalOffset = 0, flashBorder = false, overlayEffect = null } = options;
  const enemyList = Array.isArray(enemies) ? enemies : [enemies];
  const aliveEnemies = enemyList.filter((e) => e.isAlive());
  const focusedEnemy = aliveEnemies[selectedTargetIndex] || aliveEnemies[0] || enemyList[0];

  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[H\x1b[J');
  } else {
    console.clear();
  }

  const prefix = horizontalOffset > 0 ? " ".repeat(horizontalOffset) : "";
  const borderChar = flashBorder ? "*" : "=";
  const border = prefix + borderChar.repeat(66);
  const divider = prefix + "-".repeat(66);

  console.log(border);
  if (flashBorder) {
    console.log(prefix + "             *** ! ! ! IMPACT / WEAKNESS ! ! ! ***                ");
  } else {
    console.log(prefix + "                     BATTLE SIMULATOR (CLI)                       ");
  }
  console.log(border);

  // Upper section: Enemy ASCII Art on left, Turn Timeline on right
  const leftHeader = enemyList.length > 1 ? "  TARGET ENEMY" : "  ENEMY";
  console.log(prefix + `${leftHeader.padEnd(33, " ")}TURN TIMELINE (ACTION GAUGE)`);
  console.log(prefix + "  -----------------------------  ---------------------------------");

  let art = (focusedEnemy && focusedEnemy.art) || GOBLIN_ART;
  if (overlayEffect === 'dodge') {
    art = [
      "   \\ \\ \\ \\ \\ \\ \\ \\ \\ \\   ",
      "  =>> * WHOOSH! * =>>     ",
      "   / / / / / / / / / /   ",
      "    [ EVADED ATTACK! ]    ",
      "                          ",
    ];
  } else if (overlayEffect === 'crit') {
    art = [
      "       \\  |  /           ",
      "     -- CRITICAL! --     ",
      "       /  |  \\           ",
      "      [ HEAVY HIT! ]      ",
      "                          ",
    ];
  }

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

    console.log(prefix + `  ${paddedLeft} |${rightText}`);
  }

  // Enemy Vitals line(s)
  if (enemyList.length === 1) {
    const single = enemyList[0];
    const enemyStatus = formatStatus(single);
    console.log(prefix + `  HP: ${single.actualHp}/${single.totalMaxHp || single.maxHp}  MP: ${single.actualMp}/${single.totalMaxMp || single.maxMp}${enemyStatus}`);
  } else {
    enemyList.forEach((en, idx) => {
      const isTarget = aliveEnemies[selectedTargetIndex] === en;
      const cursor = isTarget ? "[►] " : "    ";
      const enStatus = formatStatus(en);
      const koTag = !en.isAlive() ? " (K.O.)" : "";
      console.log(prefix + `  ${cursor}${idx + 1}. ${en.name.padEnd(14)} HP: ${en.actualHp}/${en.totalMaxHp || en.maxHp}  MP: ${en.actualMp}/${en.totalMaxMp || en.maxMp}${enStatus}${koTag}`);
    });
  }
  console.log(divider);

  // Lower section: Player stats on left, Command Menu on right
  const playerStatus = formatStatus(player);
  console.log(prefix + `  PLAYER: ${player.name}${playerStatus}`);
  console.log(prefix + `  HP: ${player.actualHp}/${player.totalMaxHp || player.maxHp}    |  [1] Attack    [2] Defend    [3] Skills`);
  console.log(prefix + `  MP: ${player.actualMp}/${player.totalMaxMp || player.maxMp}      |  [4] Item      [5] Skip Turn`);
  console.log(border);

  if (logMessage) {
    console.log(prefix + `> ${logMessage}`);
    console.log(divider);
  }
}

/**
 * Plays a full-screen horizontal screen-shake animation.
 * Offsets lines left and right over 8-15 frames.
 */
async function animateScreenShake(
  player,
  enemies,
  turnOrder,
  logMessage,
  selectedTargetIndex = 0,
  { frames = 10, intensity = 3, delayMs = 25, headless = false } = {}
) {
  if (headless || process.env.NODE_ENV === 'test' || process.env.RPG_HEADLESS === '1' || !process.stdout.isTTY) {
    renderBattleScreen(player, enemies, turnOrder, logMessage, selectedTargetIndex);
    return;
  }

  const pattern = [intensity, 0, intensity + 1, 1, intensity, 0, 2, 0, 1, 0];
  const totalFrames = Math.min(frames, pattern.length);

  for (let f = 0; f < totalFrames; f++) {
    renderBattleScreen(player, enemies, turnOrder, logMessage, selectedTargetIndex, {
      horizontalOffset: pattern[f],
      overlayEffect: f < 4 ? 'crit' : null,
    });
    await sleep(delayMs);
  }

  // Restore cleanly at offset 0
  renderBattleScreen(player, enemies, turnOrder, logMessage, selectedTargetIndex);
}

/**
 * Plays a high-contrast weakness flash animation across the battle screen borders.
 */
async function animateWeaknessFlash(
  player,
  enemies,
  turnOrder,
  logMessage,
  selectedTargetIndex = 0,
  { frames = 4, delayMs = 60, headless = false } = {}
) {
  if (headless || process.env.NODE_ENV === 'test' || process.env.RPG_HEADLESS === '1' || !process.stdout.isTTY) {
    renderBattleScreen(player, enemies, turnOrder, logMessage, selectedTargetIndex);
    return;
  }

  for (let f = 0; f < frames; f++) {
    renderBattleScreen(player, enemies, turnOrder, logMessage, selectedTargetIndex, {
      flashBorder: f % 2 === 0,
    });
    await sleep(delayMs);
  }

  renderBattleScreen(player, enemies, turnOrder, logMessage, selectedTargetIndex);
}

/**
 * Plays a center-screen dodge animation replacing enemy art with speed-lines and WHOOSH cue.
 */
async function animateDodge(
  player,
  enemies,
  turnOrder,
  logMessage,
  selectedTargetIndex = 0,
  { delayMs = 260, headless = false } = {}
) {
  if (headless || process.env.NODE_ENV === 'test' || process.env.RPG_HEADLESS === '1' || !process.stdout.isTTY) {
    renderBattleScreen(player, enemies, turnOrder, logMessage, selectedTargetIndex);
    return;
  }

  renderBattleScreen(player, enemies, turnOrder, logMessage, selectedTargetIndex, {
    overlayEffect: 'dodge',
    horizontalOffset: 2,
  });
  await sleep(delayMs);

  renderBattleScreen(player, enemies, turnOrder, logMessage, selectedTargetIndex);
}

const DUNGEON_SCENES = {
  corridor: [
    "+------------------------------------+",
    "| \\                                / |",
    "|   \\                            /   |",
    "|     +------------------------+     |",
    "|     |   [ Cobblestone Hall ] |     |",
    "|     |                        |     |",
    "|     +------------------------+     |",
    "|   /                            \\   |",
    "| /                                \\ |",
    "+------------------------------------+",
  ],
  corridor_step1: [
    "+------------------------------------+",
    "| \\                                / |",
    "|   +----------------------------+   |",
    "|   |                            |   |",
    "|   |    [ Moving Deeper... ]    |   |",
    "|   |                            |   |",
    "|   +----------------------------+   |",
    "|   /                            \\   |",
    "| /                                \\ |",
    "+------------------------------------+",
  ],
  corridor_step2: [
    "+------------------------------------+",
    "|                                    |",
    "|   +----------------------------+   |",
    "|   |                            |   |",
    "|   |    [ Passing Forward... ]  |   |",
    "|   |                            |   |",
    "|   +----------------------------+   |",
    "|                                    |",
    "+------------------------------------+",
  ],
  chest: [
    "+------------------------------------+",
    "| \\                                / |",
    "|   \\        .------------.      /   |",
    "|     \\     | [!] CHEST   |    /     |",
    "|       \\   |____________|   /       |",
    "|     +------------------------+     |",
    "|   /                            \\   |",
    "| /                                \\ |",
    "+------------------------------------+",
  ],
  spring: [
    "+------------------------------------+",
    "| \\             (~~~)              / |",
    "|   \\          (~~~~~)           /   |",
    "|     \\     .============.     /     |",
    "|       \\   | SACRED FOUNT |  /      |",
    "|     +------------------------+     |",
    "|   /                            \\   |",
    "| /                                \\ |",
    "+------------------------------------+",
  ],
  stairs: [
    "+------------------------------------+",
    "| \\                                / |",
    "|   \\       ___                  /   |",
    "|     \\    |   |___            /     |",
    "|       \\  |       |___ STAIRS/      |",
    "|     +------------------------+     |",
    "|   /                            \\   |",
    "| /                                \\ |",
    "+------------------------------------+",
  ],
  boss_gate: [
    "+------------------------------------+",
    "| \\        |  BOSS CHAMBER |       / |",
    "|   \\      |  [!] WARNED   |     /   |",
    "|     \\    |   GOBLIN      |   /     |",
    "|       \\  |    KING       | /       |",
    "|     +------------------------+     |",
    "|   /                            \\   |",
    "| /                                \\ |",
    "+------------------------------------+",
  ],
};

/**
 * Renders the SMT-style first-person dungeon exploration screen.
 * @param {Combatant} hero
 * @param {object} dungeonState - { floor, depth, maxDepth }
 * @param {string} [sceneKey='corridor']
 * @param {string} [message='']
 */
function renderDungeonScreen(hero, dungeonState, sceneKey = 'corridor', message = '') {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[H\x1b[J');
  } else {
    console.clear();
  }

  console.log("==================================================================");
  console.log("               DUNGEON OF TRIALS - 1ST PERSON (CLI)               ");
  console.log("==================================================================");

  const sceneLines = DUNGEON_SCENES[sceneKey] || DUNGEON_SCENES.corridor;

  // Sidebar info
  const floorName = `B${dungeonState.floor || 1}F`;
  const depthText = `Step ${dungeonState.depth || 0} / ${dungeonState.maxDepth || 6}`;
  const dangerRating = dungeonState.floor === 5 ? "LETHAL (Boss)" : (dungeonState.floor >= 3 ? "High" : "Moderate");
  const bagCount = (hero.inventory || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

  const rightLines = [
    `  [ DUNGEON DEPTH ]`,
    `  Floor: ${floorName}`,
    `  Depth: ${depthText}`,
    `  Danger: ${dangerRating}`,
    `  -----------------------------`,
    `  HERO: ${hero.name} (Lv. ${hero.level || 1})`,
    `  HP: ${hero.actualHp}/${hero.totalMaxHp || hero.maxHp}`,
    `  MP: ${hero.actualMp}/${hero.totalMaxMp || hero.maxMp}`,
    `  Gold: ${hero.gold || 0} G`,
    `  Bag: ${bagCount} items`,
  ];

  const maxRows = Math.max(sceneLines.length, rightLines.length);
  for (let r = 0; r < maxRows; r++) {
    const leftText = (sceneLines[r] || " ".repeat(38)).padEnd(38, " ");
    const rightText = rightLines[r] || "";
    console.log(`${leftText} |${rightText}`);
  }

  console.log("==================================================================");
  if (message) {
    console.log(`> ${message}`);
    console.log("------------------------------------------------------------------");
  }
}

/**
 * Plays a 3-frame perspective zoom step animation forward into the corridor.
 */
async function animateDungeonStep(hero, dungeonState, { delayMs = 70, headless = false } = {}) {
  if (headless || process.env.NODE_ENV === 'test' || process.env.RPG_HEADLESS === '1' || !process.stdout.isTTY) {
    renderDungeonScreen(hero, dungeonState, 'corridor');
    return;
  }

  renderDungeonScreen(hero, dungeonState, 'corridor_step1', 'Advancing forward into the dark corridor...');
  await sleep(delayMs);

  renderDungeonScreen(hero, dungeonState, 'corridor_step2', 'Advancing forward into the dark corridor...');
  await sleep(delayMs);

  renderDungeonScreen(hero, dungeonState, 'corridor', 'You arrive at the next section of the hall.');
}

module.exports = {
  renderBattleScreen,
  formatStatus,
  animateScreenShake,
  animateWeaknessFlash,
  animateDodge,
  renderDungeonScreen,
  animateDungeonStep,
  DUNGEON_SCENES,
  sleep,
};
