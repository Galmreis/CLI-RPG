/**
 * Reusable Interactive Cursor Menu Module for CLI RPG
 * Provides live cursor navigation [►] using arrow keys and WASD,
 * Enter/Space selection, Esc/Backspace/B cancellation,
 * and seamless fallback for automated headless test suites.
 */

const readline = require('readline');

/**
 * Determines whether the menu should execute in headless/fallback mode.
 * @param {readline.Interface|object} rl - Readline interface or mock
 * @param {boolean} headlessOption - Explicit headless flag
 * @returns {boolean}
 */
function isHeadlessMode(rl, headlessOption) {
  if (headlessOption === true) return true;
  if (process.env.NODE_ENV === 'test' || process.env.RPG_HEADLESS === '1') return true;
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') return true;
  // If rl is provided as a test mock (lacks standard readline terminal properties)
  if (rl && typeof rl.question === 'function' && (!rl.terminal || !rl.history)) return true;
  return false;
}

let isAltScreenActive = false;
let exitHooksInstalled = false;

/**
 * Enters the terminal's alternate screen buffer and hides the blinking cursor.
 */
function enterAlternateScreen() {
  if (process.stdout.isTTY && !isAltScreenActive) {
    installExitHooks();
    process.stdout.write('\x1b[?1049h\x1b[H\x1b[?25l');
    isAltScreenActive = true;
  }
}

/**
 * Exits the terminal's alternate screen buffer and restores the cursor.
 */
function exitAlternateScreen() {
  if (process.stdout.isTTY && isAltScreenActive) {
    process.stdout.write('\x1b[?25h\x1b[?1049l');
    isAltScreenActive = false;
  }
}

/**
 * Hides the terminal's blinking cursor.
 */
function hideCursor() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?25l');
  }
}

/**
 * Shows the terminal's blinking cursor.
 */
function showCursor() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?25h');
  }
}

/**
 * Clears the screen and positions cursor at row 1, col 1 in place.
 */
function clearScreenHome() {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[H\x1b[J');
  } else {
    console.clear();
  }
}

/**
 * Installs safety process exit listeners to prevent leaving terminal in a broken state.
 */
function installExitHooks() {
  if (exitHooksInstalled) return;
  exitHooksInstalled = true;

  const restore = () => {
    if (isAltScreenActive) {
      exitAlternateScreen();
    } else {
      showCursor();
    }
  };

  process.on('exit', restore);
  process.on('SIGINT', () => {
    restore();
    process.exit(0);
  });
  process.on('uncaughtException', (err) => {
    restore();
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

/**
 * Interactive menu selector with live cursor [►].
 * 
 * Controls:
 * - Up Arrow / W: Move cursor up (wraps around to bottom)
 * - Down Arrow / S: Move cursor down (wraps around to top)
 * - 1-9: Direct option jump
 * - Enter / Space: Select highlighted option
 * - Escape / Backspace / B: Cancel (if allowCancel is true)
 * 
 * @param {object} options
 * @param {string|Function} [options.header=""] - Menu title or header render callback
 * @param {Array<string|object>} [options.items=[]] - Menu options list
 * @param {number} [options.initialIndex=0] - Initial cursor index
 * @param {boolean} [options.allowCancel=false] - Whether menu allows cancellation
 * @param {string} [options.cancelLabel="Cancel"] - Label for visible cancel option
 * @param {readline.Interface} [options.rl=null] - Active readline interface to pause/resume
 * @param {Function} [options.renderCustom=null] - Custom callback invoked before item list
 * @param {boolean} [options.clearScreen=true] - Whether to clear console on each redraw
 * @param {boolean} [options.headless=false] - Force headless/mock fallback mode
 * @returns {Promise<{ index: number, value: any, cancelled: boolean }>}
 */
async function selectMenu({
  header = '',
  items = [],
  initialIndex = 0,
  allowCancel = false,
  cancelLabel = 'Cancel',
  rl = null,
  renderCustom = null,
  clearScreen = true,
  headless = false,
}) {
  const displayItems = [...items];
  let cancelAppended = false;

  // Append visible cancel option if allowed and not already present
  if (allowCancel && cancelLabel) {
    const hasCancel = items.some((it) => {
      const lbl = typeof it === 'object' ? it.label : String(it);
      return /cancel|return|back/i.test(lbl);
    });
    if (!hasCancel) {
      displayItems.push(cancelLabel);
      cancelAppended = true;
    }
  }

  // --- HEADLESS / TEST FALLBACK ---
  if (isHeadlessMode(rl, headless)) {
    if (typeof header === 'function') {
      header(initialIndex);
    } else if (header) {
      console.log(header);
    }

    displayItems.forEach((it, i) => {
      const lbl = typeof it === 'object' ? it.label : String(it);
      console.log(`  [${i + 1}] ${lbl}`);
    });

    if (rl && typeof rl.question === 'function') {
      const ans = (await rl.question(`  Choose (1-${displayItems.length}): `)).trim();
      const num = parseInt(ans, 10);
      if (ans === '0' || /^b(ack)?$/i.test(ans) || /^cancel$/i.test(ans)) {
        return { index: -1, value: null, cancelled: true };
      }
      if (!isNaN(num) && num >= 1 && num <= displayItems.length) {
        const chosenIdx = num - 1;
        if (cancelAppended && chosenIdx === displayItems.length - 1) {
          return { index: -1, value: null, cancelled: true };
        }
        return {
          index: chosenIdx,
          value: items[chosenIdx],
          cancelled: false,
        };
      }
    }
    return {
      index: initialIndex,
      value: items[initialIndex],
      cancelled: false,
    };
  }

  // --- INTERACTIVE TTY CURSOR MODE ---
  installExitHooks();
  hideCursor();

  let currentIndex = Math.max(0, Math.min(initialIndex, displayItems.length - 1));

  function draw() {
    if (clearScreen) {
      clearScreenHome();
    }
    if (typeof renderCustom === 'function') {
      renderCustom(currentIndex);
    }
    if (typeof header === 'function') {
      header(currentIndex);
    } else if (header) {
      console.log(header);
    }

    displayItems.forEach((item, idx) => {
      const isSelected = idx === currentIndex;
      const cursor = isSelected ? '[►]' : '   ';
      const label = typeof item === 'object' ? item.label : String(item);
      console.log(`  ${cursor} ${label}`);
    });

    const cancelHint = allowCancel ? '  [Esc/Backspace/B: Cancel]' : '';
    console.log(`\n  [↑/↓ or W/S: Move]  [Enter/Space: Select]${cancelHint}`);
  }

  return new Promise((resolve) => {
    // Pause shared readline interface while in raw keypress mode
    if (rl && typeof rl.pause === 'function') {
      rl.pause();
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    draw();

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      if (typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false);
      }
      if (!isAltScreenActive) {
        showCursor();
      }
      if (rl && typeof rl.resume === 'function') {
        rl.resume();
      } else {
        process.stdin.pause();
      }
    }

    function onKeypress(str, key) {
      // Emergency exit on Ctrl+C
      if ((key && key.ctrl && key.name === 'c') || str === '\u0003') {
        cleanup();
        exitAlternateScreen();
        process.exit(0);
      }

      // Move Up (Arrow Up or W)
      if ((key && key.name === 'up') || str === 'w' || str === 'W') {
        currentIndex = (currentIndex - 1 + displayItems.length) % displayItems.length;
        draw();
        return;
      }

      // Move Down (Arrow Down or S)
      if ((key && key.name === 'down') || str === 's' || str === 'S') {
        currentIndex = (currentIndex + 1) % displayItems.length;
        draw();
        return;
      }

      // Quick Numeric Jump (1-9)
      if (/^[1-9]$/.test(str)) {
        const numIdx = parseInt(str, 10) - 1;
        if (numIdx < displayItems.length) {
          currentIndex = numIdx;
          draw();
          return;
        }
      }

      // Select (Enter or Space)
      if (
        (key && (key.name === 'return' || key.name === 'enter' || key.name === 'space')) ||
        str === '\r' ||
        str === '\n' ||
        str === ' '
      ) {
        cleanup();
        if (cancelAppended && currentIndex === displayItems.length - 1) {
          resolve({ index: -1, value: null, cancelled: true });
        } else {
          resolve({
            index: currentIndex,
            value: items[currentIndex],
            cancelled: false,
          });
        }
        return;
      }

      // Cancel (Escape, Backspace, or B)
      if (
        allowCancel &&
        ((key && (key.name === 'escape' || key.name === 'backspace')) ||
          str === '\u001b' ||
          str === '\x08' ||
          str === '\x7f' ||
          str === 'b' ||
          str === 'B')
      ) {
        cleanup();
        resolve({ index: -1, value: null, cancelled: true });
        return;
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
}

const STAT_DEFINITIONS = [
  { key: 'maxHp', name: 'Max HP', bonusPerPoint: 10, cap: 9999 },
  { key: 'maxMp', name: 'Max MP', bonusPerPoint: 5, cap: 9999 },
  { key: 'atk', name: 'Attack', bonusPerPoint: 1, cap: 999 },
  { key: 'def', name: 'Defense', bonusPerPoint: 1, cap: 999 },
  { key: 'mAtk', name: 'Magic ATK', bonusPerPoint: 1, cap: 999 },
  { key: 'mDef', name: 'Magic DEF', bonusPerPoint: 1, cap: 999 },
  { key: 'spd', name: 'Speed', bonusPerPoint: 1, cap: 999 },
  { key: 'lck', name: 'Luck', bonusPerPoint: 1, cap: 999 },
];

/**
 * Interactive stat allocation menu for Level-Up screen.
 * Allows navigating stats with Up/Down (W/S), staging points with Left/Right (A/D or +/-),
 * and confirming with Enter on [Confirm Allocation].
 *
 * @param {object} options
 * @param {Combatant} options.player - Player combatant instance
 * @param {number} [options.ap=5] - Total attribute points to allocate
 * @param {Array<string>} [options.naturalLogs=[]] - Natural growth log strings
 * @param {readline.Interface} [options.rl=null] - Readline interface
 * @param {boolean} [options.headless=false] - Headless mode flag
 * @param {object} [options.presetAllocation=null] - Optional preset allocation for testing
 * @returns {Promise<{ staged: object, totalApSpent: number }>}
 */
async function allocateStatsMenu({
  player,
  ap = 5,
  naturalLogs = [],
  rl = null,
  headless = false,
  presetAllocation = null,
}) {
  const staged = {
    maxHp: 0,
    maxMp: 0,
    atk: 0,
    def: 0,
    mAtk: 0,
    mDef: 0,
    spd: 0,
    lck: 0,
  };

  const getSpentAp = () => Object.values(staged).reduce((sum, n) => sum + n, 0);
  const getRemainingAp = () => ap - getSpentAp();

  // Headless / non-interactive test fallback
  if (isHeadlessMode(rl, headless)) {
    if (presetAllocation && typeof presetAllocation === 'object') {
      Object.keys(presetAllocation).forEach((key) => {
        if (typeof staged[key] === 'number') {
          staged[key] = presetAllocation[key];
        }
      });
    } else {
      let rem = ap;
      let i = 0;
      while (rem > 0) {
        const def = STAT_DEFINITIONS[i % STAT_DEFINITIONS.length];
        staged[def.key]++;
        rem--;
        i++;
      }
    }

    STAT_DEFINITIONS.forEach((def) => {
      const added = (staged[def.key] || 0) * def.bonusPerPoint;
      player[def.key] = Math.min(def.cap, (player[def.key] || 0) + added);
    });

    return { staged, totalApSpent: getSpentAp() };
  }

  const totalRows = STAT_DEFINITIONS.length + 1; // 8 stats + 1 Confirm row
  let currentIndex = 0;
  let statusMessage = '';

  function draw() {
    clearScreenHome();
    console.log("\n==================================================================");
    console.log(`  *** LEVEL UP! ${player.name} reached Level ${player.level}! ***`);
    if (naturalLogs.length > 0) {
      console.log(`  Natural Growth: ${naturalLogs.join(', ')}`);
    }
    console.log(`  You gained ${ap} Attribute Points (AP) to distribute!`);
    console.log(`  [Remaining AP: ${getRemainingAp()} / ${ap}]`);
    console.log("==================================================================");

    STAT_DEFINITIONS.forEach((def, idx) => {
      const isSelected = idx === currentIndex;
      const cursor = isSelected ? '[►]' : '   ';
      const currentVal = player[def.key] || 0;
      const stagedPoints = staged[def.key];
      const stagedBonus = stagedPoints * def.bonusPerPoint;
      const nextVal = currentVal + stagedBonus;

      let valueDisplay = '';
      if (stagedPoints > 0) {
        valueDisplay = `${currentVal} -> ${nextVal} (+${stagedBonus})`;
      } else {
        valueDisplay = `${currentVal}/${def.cap}`;
      }

      const label = `${def.name} (+${def.bonusPerPoint})`.padEnd(18);
      console.log(`  ${cursor} ${label} Current: ${valueDisplay}`);
    });

    const isDoneSelected = currentIndex === STAT_DEFINITIONS.length;
    const doneCursor = isDoneSelected ? '[►]' : '   ';
    const doneNote = getRemainingAp() === 0 ? ' [Ready to Confirm!]' : ` (${getRemainingAp()} AP remaining)`;
    console.log(`\n  ${doneCursor} [Confirm Allocation]${doneNote}`);

    console.log("\n  [↑/↓ or W/S: Move]  [←/→ or A/D: Adjust (+/-)]  [Enter: Confirm]");
    if (statusMessage) {
      console.log(`  ${statusMessage}`);
    }
  }

  return new Promise((resolve) => {
    if (rl && typeof rl.pause === 'function') {
      rl.pause();
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    draw();

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      if (typeof process.stdin.setRawMode === 'function') {
        process.stdin.setRawMode(false);
      }
      if (!isAltScreenActive) {
        showCursor();
      }
      if (rl && typeof rl.resume === 'function') {
        rl.resume();
      } else {
        process.stdin.pause();
      }
    }

    function onKeypress(str, key) {
      // Emergency exit on Ctrl+C
      if ((key && key.ctrl && key.name === 'c') || str === '\u0003') {
        cleanup();
        exitAlternateScreen();
        process.exit(0);
      }

      statusMessage = '';

      // Move Up (Arrow Up or W)
      if ((key && key.name === 'up') || str === 'w' || str === 'W') {
        currentIndex = (currentIndex - 1 + totalRows) % totalRows;
        draw();
        return;
      }

      // Move Down (Arrow Down or S)
      if ((key && key.name === 'down') || str === 's' || str === 'S') {
        currentIndex = (currentIndex + 1) % totalRows;
        draw();
        return;
      }

      // Direct Numeric Jump (1-8 to stat, 9 or 0 to confirm)
      if (/^[1-8]$/.test(str)) {
        currentIndex = parseInt(str, 10) - 1;
        draw();
        return;
      } else if (str === '9' || str === '0') {
        currentIndex = STAT_DEFINITIONS.length;
        draw();
        return;
      }

      // Allocate / Increase (+): Right, D, +, =
      if (
        (key && key.name === 'right') ||
        str === 'd' ||
        str === 'D' ||
        str === '+' ||
        str === '='
      ) {
        if (currentIndex < STAT_DEFINITIONS.length) {
          const def = STAT_DEFINITIONS[currentIndex];
          if (getRemainingAp() <= 0) {
            statusMessage = ">> No AP remaining! Remove points with [←/A] or confirm below.";
          } else {
            const currentVal = player[def.key] || 0;
            const nextVal = currentVal + (staged[def.key] + 1) * def.bonusPerPoint;
            if (nextVal > def.cap) {
              statusMessage = `>> Cannot exceed stat cap of ${def.cap}!`;
            } else {
              staged[def.key]++;
              // If that was the last AP, auto-advance cursor to Confirm row
              if (getRemainingAp() === 0) {
                currentIndex = STAT_DEFINITIONS.length;
              }
            }
          }
        }
        draw();
        return;
      }

      // Deallocate / Decrease (-): Left, A, -, _
      if (
        (key && key.name === 'left') ||
        str === 'a' ||
        str === 'A' ||
        str === '-' ||
        str === '_'
      ) {
        if (currentIndex < STAT_DEFINITIONS.length) {
          const def = STAT_DEFINITIONS[currentIndex];
          if (staged[def.key] > 0) {
            staged[def.key]--;
          } else {
            statusMessage = `>> No staged points allocated to ${def.name}.`;
          }
        }
        draw();
        return;
      }

      // Enter / Space
      if (
        (key && (key.name === 'return' || key.name === 'enter' || key.name === 'space')) ||
        str === '\r' ||
        str === '\n' ||
        str === ' '
      ) {
        // If on Confirm row
        if (currentIndex === STAT_DEFINITIONS.length) {
          if (getRemainingAp() > 0) {
            statusMessage = `>> Please allocate all AP before confirming (${getRemainingAp()} remaining)!`;
            draw();
            return;
          }

          // Apply staged stats to player
          STAT_DEFINITIONS.forEach((def) => {
            const added = staged[def.key] * def.bonusPerPoint;
            player[def.key] = Math.min(def.cap, (player[def.key] || 0) + added);
          });

          cleanup();
          resolve({ staged, totalApSpent: getSpentAp() });
          return;
        }

        // If on a stat row: pressing Enter also adds 1 point (convenient shortcut!)
        const def = STAT_DEFINITIONS[currentIndex];
        if (getRemainingAp() <= 0) {
          statusMessage = ">> No AP remaining! Move down to [Confirm Allocation] to finish.";
          currentIndex = STAT_DEFINITIONS.length;
        } else {
          const currentVal = player[def.key] || 0;
          const nextVal = currentVal + (staged[def.key] + 1) * def.bonusPerPoint;
          if (nextVal > def.cap) {
            statusMessage = `>> Cannot exceed stat cap of ${def.cap}!`;
          } else {
            staged[def.key]++;
            if (getRemainingAp() === 0) {
              currentIndex = STAT_DEFINITIONS.length;
            }
          }
        }
        draw();
        return;
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
}

module.exports = {
  selectMenu,
  allocateStatsMenu,
  STAT_DEFINITIONS,
  isHeadlessMode,
  enterAlternateScreen,
  exitAlternateScreen,
  hideCursor,
  showCursor,
  clearScreenHome,
};

