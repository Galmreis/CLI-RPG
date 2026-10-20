/**
 * Automated Verification Suite for Goblin King Boss & Multi-Enemy Engine Overhaul
 */

const assert = require('assert');
const Combatant = require('./combatant');
const { createEnemy, MONSTERS } = require('./enemies');
const { PASSIVES } = require('./passives');
const { runBattle, selectTarget } = require('./battle');

async function runTests() {
  console.log("=== STARTING GOBLIN KING & MULTI-ENEMY VERIFICATION ===");

  // Test 1: Verify Goblin King & Small Goblin bestiary entries
  console.log("\n[Test 1] Verifying Goblin King & Small Goblin bestiary stats...");
  const boss = createEnemy('goblinKing');
  assert.strictEqual(boss.name, "Goblin King", "Boss name should be Goblin King");
  assert.strictEqual(boss.actualHp, 150, "Boss HP should be 150");
  assert.strictEqual(boss.atk, 13, "Boss ATK should be 13");
  assert.strictEqual(boss.def, 7, "Boss DEF should be 7");
  assert.strictEqual(boss.spd, 7, "Boss SPD should be 7");
  assert.strictEqual(boss.expReward, 100, "Boss EXP reward should be 100");
  assert.strictEqual(boss.gold, 75, "Boss Gold drop should be 75");
  assert(boss.passives.includes('royalFocus'), "Boss should have royalFocus passive");

  const minion = createEnemy('smallGoblin');
  assert.strictEqual(minion.name, "Small Goblin", "Minion name should be Small Goblin");
  assert.strictEqual(minion.actualHp, 25, "Minion HP should be 25");
  assert.strictEqual(minion.atk, 5, "Minion ATK should be 5");
  assert.strictEqual(minion.def, 2, "Minion DEF should be 2");
  assert.strictEqual(minion.spd, 4, "Minion SPD should be 4");
  console.log("  ✓ Test 1 Passed: Boss and minion stats correctly configured.");

  // Test 2: Verify Royal Focus passive mechanics
  console.log("\n[Test 2] Verifying Royal Focus passive (+50% crit, summon on 3 crits)...");
  const rf = PASSIVES.royalFocus;
  assert(rf, "royalFocus should exist in PASSIVES");
  const boostedCrit = rf.onCalculateCrit(boss, 0.10);
  assert.strictEqual(boostedCrit, 0.60, "Royal Focus should add +50% (+0.50) crit chance");

  // Simulate 3 crits triggering summon
  boss.royalFocusCrits = 0;
  const crit1 = rf.onCrit(boss);
  assert.strictEqual(boss.royalFocusCrits, 1, "First crit increments counter to 1");
  assert.strictEqual(crit1.summon, undefined, "First crit should not summon");

  const crit2 = rf.onCrit(boss);
  assert.strictEqual(boss.royalFocusCrits, 2, "Second crit increments counter to 2");
  assert.strictEqual(crit2.summon, undefined, "Second crit should not summon");

  const crit3 = rf.onCrit(boss);
  assert.strictEqual(boss.royalFocusCrits, 0, "Third crit resets counter to 0");
  assert.strictEqual(crit3.summon, 'smallGoblin', "Third crit summons smallGoblin");
  console.log("  ✓ Test 2 Passed: Royal Focus correctly tracks crits and triggers summon on 3rd hit.");

  // Test 3: Verify Multi-Enemy Combat Runner & Party Wipeout Win Condition
  console.log("\n[Test 3] Verifying Multi-Enemy combat runner party wipeout win condition...");
  const hero = new Combatant('TestHero', 500, 100, 50, 20, 20, 20, 30, 20, false);
  const enemy1 = new Combatant('Enemy A', 10, 0, 5, 2, 2, 2, 5, 5, true);
  const enemy2 = new Combatant('Enemy B', 10, 0, 5, 2, 2, 2, 3, 5, true);
  const enemyParty = [enemy1, enemy2];

  // Mock readline returning '1' for attack, '1' for target 1
  const mockInputs = ['1', '1', '1', '1'];
  let inputIdx = 0;
  const mockRl = {
    question: async () => mockInputs[inputIdx++] || '1',
    close: () => {},
  };

  const battleResult = await runBattle(hero, enemyParty, mockRl);
  assert.strictEqual(battleResult.outcome, 'victory', "Battle should conclude in victory");
  assert(!enemy1.isAlive(), "Enemy A should be defeated");
  assert(!enemy2.isAlive(), "Enemy B should be defeated");
  assert(hero.isAlive(), "Hero should survive");
  console.log("  ✓ Test 3 Passed: Multi-enemy battle completes with all enemies wiped out.");

  // Test 4: Verify Target Selection Cursor
  console.log("\n[Test 4] Verifying Target Selection auto-selects single target and handles choice...");
  const singleAlive = [enemy1];
  const autoTarget = await selectTarget(null, singleAlive, hero, [enemy1], [hero, enemy1], "");
  assert.strictEqual(autoTarget, enemy1, "selectTarget should immediately return single alive enemy");

  // With 2 targets
  const targetInputs = ['2'];
  let tIdx = 0;
  const mockTargetRl = {
    question: async () => targetInputs[tIdx++],
  };
  const chosenTarget = await selectTarget(mockTargetRl, [enemy1, enemy2], hero, enemyParty, [hero, ...enemyParty], "");
  assert.strictEqual(chosenTarget, enemy2, "selectTarget should return chosen enemy index");
  console.log("  ✓ Test 4 Passed: Target selection handles single and multiple enemies accurately.");

  // Test 5: Verify Combat Animations safe execution in headless mode
  console.log("\n[Test 5] Verifying Combat FX animations (Shake, Flash, Dodge)...");
  const { animateScreenShake, animateWeaknessFlash, animateDodge } = require('./ui');
  assert.strictEqual(typeof animateScreenShake, 'function', "animateScreenShake should be a function");
  assert.strictEqual(typeof animateWeaknessFlash, 'function', "animateWeaknessFlash should be a function");
  assert.strictEqual(typeof animateDodge, 'function', "animateDodge should be a function");

  // Call them directly with headless: true
  await animateScreenShake(hero, enemyParty, [hero], "Test shake", 0, { headless: true });
  await animateWeaknessFlash(hero, enemyParty, [hero], "Test flash", 0, { headless: true });
  await animateDodge(hero, enemyParty, [hero], "Test dodge", 0, { headless: true });
  console.log("  ✓ Test 5 Passed: Combat FX animations execute safely in headless mode.");

  console.log("\n========================================================");
  console.log("  >>> ALL GOBLIN KING & MULTI-ENEMY TESTS PASSED! <<<");
  console.log("========================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
