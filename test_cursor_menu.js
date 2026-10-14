/**
 * Test Suite: Reusable Interactive Cursor Menu Module (menu.js)
 */

const assert = require('assert');
const { selectMenu, isHeadlessMode } = require('./menu');

async function runTests() {
  console.log("=== RUNNING CURSOR MENU MODULE TEST SUITE ===\n");

  // TEST 1: isHeadlessMode detection
  console.log("Test 1: isHeadlessMode detection logic");
  assert.strictEqual(isHeadlessMode(null, true), true, "Explicit headless option must return true");
  
  const mockTestRl = { question: async () => '1' };
  assert.strictEqual(isHeadlessMode(mockTestRl, false), true, "Mock rl lacking terminal properties must trigger headless");
  console.log("  ✓ Headless mode accurately detects mock and explicit options\n");

  // TEST 2: Headless option selection via mock readline
  console.log("Test 2: Headless menu selection with simulated input");
  const options = ["Option Alpha", "Option Beta", "Option Gamma"];
  const mockRlPickBeta = {
    question: async () => '2',
    pause: () => {},
    resume: () => {},
  };

  const betaRes = await selectMenu({
    header: "Test Selection Header",
    items: options,
    rl: mockRlPickBeta,
  });

  assert.strictEqual(betaRes.index, 1, "Should select index 1 (Option Beta)");
  assert.strictEqual(betaRes.value, "Option Beta", "Selected value should be Option Beta");
  assert.strictEqual(betaRes.cancelled, false, "Selection must not be marked cancelled");
  console.log("  ✓ Successfully selected second option via mock readline\n");

  // TEST 3: Headless cancellation with '0'
  console.log("Test 3: Headless cancellation via '0'");
  const mockRlCancelZero = {
    question: async () => '0',
    pause: () => {},
    resume: () => {},
  };

  const cancelResZero = await selectMenu({
    header: "Test Cancel Header",
    items: ["Sword", "Shield"],
    allowCancel: true,
    cancelLabel: "Cancel (Return)",
    rl: mockRlCancelZero,
  });

  assert.strictEqual(cancelResZero.index, -1, "Cancel should return index -1");
  assert.strictEqual(cancelResZero.value, null, "Cancelled value should be null");
  assert.strictEqual(cancelResZero.cancelled, true, "Cancelled flag should be true");
  console.log("  ✓ '0' successfully triggers menu cancellation\n");

  // TEST 4: Headless cancellation with 'b' / 'cancel'
  console.log("Test 4: Headless cancellation via 'b' and 'cancel'");
  const mockRlCancelB = {
    question: async () => 'b',
    pause: () => {},
    resume: () => {},
  };

  const cancelResB = await selectMenu({
    header: "Test Cancel Header",
    items: ["Sword", "Shield"],
    allowCancel: true,
    rl: mockRlCancelB,
  });

  assert.strictEqual(cancelResB.index, -1, "Cancel 'b' should return index -1");
  assert.strictEqual(cancelResB.cancelled, true, "Cancelled flag should be true");
  console.log("  ✓ 'b' successfully triggers menu cancellation\n");

  // TEST 5: Default fallback when input is empty or invalid
  console.log("Test 5: Fallback to initialIndex when input is empty");
  const mockRlEmpty = {
    question: async () => '',
    pause: () => {},
    resume: () => {},
  };

  const defaultRes = await selectMenu({
    items: ["Apple", "Banana", "Cherry"],
    initialIndex: 2,
    rl: mockRlEmpty,
  });

  assert.strictEqual(defaultRes.index, 2, "Should default to initialIndex (2)");
  assert.strictEqual(defaultRes.value, "Cherry", "Should default to Cherry");
  console.log("  ✓ Fallback cleanly returns initialIndex without crashing\n");

  // TEST 6: Simulated Keypress in TTY Mode (Up, Down, Wrap, Enter, Esc)
  console.log("Test 6: Simulated keypress circular wrapping and selection");
  // Down from 0 -> 1, Enter
  setTimeout(() => {
    process.stdin.emit('keypress', '', { name: 'down' });
    setTimeout(() => {
      process.stdin.emit('keypress', '\r', { name: 'return' });
    }, 15);
  }, 15);

  const ttyRes1 = await selectMenu({
    items: ["First", "Second", "Third"],
    headless: false,
    clearScreen: false,
  });
  assert.strictEqual(ttyRes1.index, 1, "Down arrow should move cursor to index 1");

  // Up from 0 -> wraps to 2, Space
  setTimeout(() => {
    process.stdin.emit('keypress', '', { name: 'up' });
    setTimeout(() => {
      process.stdin.emit('keypress', ' ', { name: 'space' });
    }, 15);
  }, 15);

  const ttyRes2 = await selectMenu({
    items: ["First", "Second", "Third"],
    headless: false,
    clearScreen: false,
  });
  assert.strictEqual(ttyRes2.index, 2, "Up arrow from 0 should wrap to last index (2)");

  // Escape key cancellation
  setTimeout(() => {
    process.stdin.emit('keypress', '\u001b', { name: 'escape' });
  }, 15);

  const ttyRes3 = await selectMenu({
    items: ["One", "Two"],
    allowCancel: true,
    headless: false,
    clearScreen: false,
  });
  assert.strictEqual(ttyRes3.index, -1, "Escape key should cancel interactive menu");
  assert.strictEqual(ttyRes3.cancelled, true, "Cancelled flag must be true");

  console.log("  ✓ TTY keypress movement, wrapping, and cancellation verified!\n");

  // TEST 7: Alternate Screen Buffer & Cursor Helpers
  console.log("Test 7: Alternate Screen Buffer & Cursor control helpers");
  const { enterAlternateScreen, exitAlternateScreen, showCursor, hideCursor, clearScreenHome, allocateStatsMenu, STAT_DEFINITIONS } = require('./menu');
  assert.strictEqual(typeof enterAlternateScreen, 'function', "enterAlternateScreen should be a function");
  assert.strictEqual(typeof exitAlternateScreen, 'function', "exitAlternateScreen should be a function");
  assert.strictEqual(typeof showCursor, 'function', "showCursor should be a function");
  assert.strictEqual(typeof hideCursor, 'function', "hideCursor should be a function");
  assert.strictEqual(typeof clearScreenHome, 'function', "clearScreenHome should be a function");
  
  // Safe invocation check
  enterAlternateScreen();
  clearScreenHome();
  hideCursor();
  showCursor();
  exitAlternateScreen();
  console.log("  ✓ Alternate screen buffer and cursor helpers executed safely!\n");

  // TEST 8: Interactive Stat Allocation Menu
  console.log("Test 8: Interactive Stat Allocation Menu (allocateStatsMenu)");
  assert.strictEqual(typeof allocateStatsMenu, 'function', "allocateStatsMenu must be a function");
  assert.ok(Array.isArray(STAT_DEFINITIONS), "STAT_DEFINITIONS must be an array");
  assert.strictEqual(STAT_DEFINITIONS.length, 8, "STAT_DEFINITIONS must define 8 core stats");

  // 8A: Headless Auto-Allocation
  const Combatant = require('./combatant');
  const dummyPlayer = new Combatant('TestHero', 100, 50, 10, 10, 10, 10, 10, 10);
  const initialHp = dummyPlayer.maxHp;
  const initialAtk = dummyPlayer.atk;

  const resAuto = await allocateStatsMenu({
    player: dummyPlayer,
    ap: 5,
    headless: true,
  });
  assert.strictEqual(resAuto.totalApSpent, 5, "Should spend exactly 5 AP in auto-allocation");
  assert.ok(dummyPlayer.maxHp > initialHp, "Max HP should have increased from allocation");

  // 8B: Headless Preset Allocation
  const dummyPlayer2 = new Combatant('PresetHero', 100, 50, 10, 10, 10, 10, 10, 10);
  const resPreset = await allocateStatsMenu({
    player: dummyPlayer2,
    ap: 5,
    headless: true,
    presetAllocation: { atk: 3, def: 2 },
  });
  assert.strictEqual(dummyPlayer2.atk, 13, "Atk should increase by 3 (+3 points)");
  assert.strictEqual(dummyPlayer2.def, 12, "Def should increase by 2 (+2 points)");
  assert.strictEqual(resPreset.totalApSpent, 5, "Total spent AP should match preset");

  // 8C: Interactive TTY Staging & Adjustments (+ / - and Confirm)
  const dummyPlayer3 = new Combatant('InteractiveHero', 100, 50, 10, 10, 10, 10, 10, 10);
  // Sequence:
  // Down to Atk (idx 2)
  // Right (+1 Atk), Right (+1 Atk), Right (+1 Atk)
  // Left (-1 Atk) -> staged Atk = 2
  // Down to Def (idx 3)
  // Right (+1 Def), Right (+1 Def), Right (+1 Def) -> 2+3 = 5 AP spent -> auto-advances to Confirm!
  // Enter on Confirm -> resolves!
  setTimeout(() => {
    // Jump to stat 3 (atk is index 2)
    process.stdin.emit('keypress', '3', {});
    setTimeout(() => {
      // Allocate 3 points
      process.stdin.emit('keypress', 'd', { name: 'right' });
      process.stdin.emit('keypress', 'd', { name: 'right' });
      process.stdin.emit('keypress', 'd', { name: 'right' });
      // Deallocate 1 point
      process.stdin.emit('keypress', 'a', { name: 'left' });
      // Move to Def (stat 4, idx 3)
      process.stdin.emit('keypress', '4', {});
      // Allocate remaining 3 points (spending all 5 AP -> triggers auto-advance to Confirm)
      process.stdin.emit('keypress', 'd', { name: 'right' });
      process.stdin.emit('keypress', 'd', { name: 'right' });
      process.stdin.emit('keypress', 'd', { name: 'right' });
      // Confirm with Enter
      setTimeout(() => {
        process.stdin.emit('keypress', '\r', { name: 'return' });
      }, 20);
    }, 20);
  }, 20);

  const resInteractive = await allocateStatsMenu({
    player: dummyPlayer3,
    ap: 5,
    headless: false,
  });

  assert.strictEqual(resInteractive.totalApSpent, 5, "Interactive allocation should spend all 5 AP");
  assert.strictEqual(dummyPlayer3.atk, 12, "Atk should be 10 + 2 = 12 after staging and de-allocation");
  assert.strictEqual(dummyPlayer3.def, 13, "Def should be 10 + 3 = 13");
  console.log("  ✓ Interactive stat allocation staging, adjusting, and confirmation verified!\n");

  console.log("========================================================");
  console.log("   >>> ALL CURSOR MENU MODULE TESTS PASSED! <<<");
  console.log("========================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
