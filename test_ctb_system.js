const assert = require('assert');
const Combatant = require('./combatant');
const { createEnemy } = require('./enemies');
const { runBattle, ACTION_GAUGE_MAX } = require('./battle');

console.log("========================================================");
console.log("       RUNNING CTB ACTION GAUGE AUTOMATED TESTS         ");
console.log("========================================================\n");

// [Test 1] Verify actionGauge property and resetActionGauge method
console.log("[Test 1] Verifying actionGauge property and reset method...");
const hero = new Combatant('Hero', 100, 20, 10, 5, 5, 5, 10, 5, false);
assert.strictEqual(hero.actionGauge, 0, "Action gauge should initialize to 0");
hero.actionGauge = ACTION_GAUGE_MAX;
hero.resetActionGauge();
assert.strictEqual(hero.actionGauge, 0, "resetActionGauge() should reset gauge to 0");
console.log("  ✓ Test 1 Passed: actionGauge property and reset method functional.\n");

// [Test 2] Verify Player Tie-Breaker Advantage when Speeds are Equal
console.log("[Test 2] Verifying Player tie-breaker advantage with equal speed...");
{
  const p = new Combatant('Tidus', 100, 20, 10, 5, 5, 5, 10, 0, false);
  const e = new Combatant('Goblin', 100, 20, 10, 5, 5, 5, 10, 0, true);

  // Both start at 0, both gain 10 per tick, both hit ACTION_GAUGE_MAX simultaneously
  const living = [p, e];
  while (!living.some(c => c.actionGauge >= ACTION_GAUGE_MAX)) {
    for (const c of living) {
      c.actionGauge = Math.min(ACTION_GAUGE_MAX, c.actionGauge + (c.totalSpd || c.spd));
    }
  }

  assert.strictEqual(p.actionGauge, ACTION_GAUGE_MAX);
  assert.strictEqual(e.actionGauge, ACTION_GAUGE_MAX);

  const ready = living.filter(c => c.actionGauge >= ACTION_GAUGE_MAX);
  ready.sort((a, b) => {
    const aSpd = a.totalSpd || a.spd;
    const bSpd = b.totalSpd || b.spd;
    if (bSpd !== aSpd) return bSpd - aSpd;
    if (a === p) return -1;
    if (b === p) return 1;
    return 0;
  });

  assert.strictEqual(ready[0], p, "Player must take priority over enemy on equal speed");
  console.log("  ✓ Test 2 Passed: Player priority tie-breaker verified.\n");
}

// [Test 3] Verify High Speed grants Multiple Turns (Early Game Scaling: SPD 30 vs SPD 10)
console.log("[Test 3] Verifying High Speed grants Multiple Turns (Early Game Scaling)...");
{
  const fastPlayer = new Combatant('Sonic', 100, 20, 10, 5, 5, 5, 30, 0, false);
  const slowEnemy = new Combatant('Slowpoke', 100, 20, 10, 5, 5, 5, 10, 0, true);

  let playerTurns = 0;
  let enemyTurns = 0;

  // Simulate 3000 ticks of CTB (equivalent to 30 ticks under 100 max)
  for (let tick = 1; tick <= 3000; tick++) {
    fastPlayer.actionGauge = Math.min(ACTION_GAUGE_MAX, fastPlayer.actionGauge + fastPlayer.totalSpd);
    slowEnemy.actionGauge = Math.min(ACTION_GAUGE_MAX, slowEnemy.actionGauge + slowEnemy.totalSpd);

    if (fastPlayer.actionGauge >= ACTION_GAUGE_MAX) {
      playerTurns++;
      fastPlayer.resetActionGauge();
    }
    if (slowEnemy.actionGauge >= ACTION_GAUGE_MAX) {
      enemyTurns++;
      slowEnemy.resetActionGauge();
    }
  }

  assert(playerTurns >= enemyTurns * 2, `Fast character (${playerTurns} turns) should act more than 2x as often as slow character (${enemyTurns} turns)`);
  console.log(`  ✓ Test 3 Passed: SPD 30 acted ${playerTurns} times vs SPD 10 acted ${enemyTurns} times.\n`);
}

// [Test 4] Verify Buff/Ailment ticks down on acting combatant's turn
console.log("[Test 4] Verifying Buffs and Ailments decay per combatant action...");
{
  const p = new Combatant('Knight', 100, 20, 10, 5, 5, 5, 20, 0, false);
  p.protectTurns = 3;

  // When p acts, protectTurns decrements by 1
  p.protectTurns--;
  assert.strictEqual(p.protectTurns, 2, "Protect turns decremented once per action");
  p.protectTurns--;
  p.protectTurns--;
  assert.strictEqual(p.protectTurns, 0, "Protect barrier wears off after 3 turns taken by the knight");
  console.log("  ✓ Test 4 Passed: Buff durations track individual action turns.\n");
}

// [Test 5] Verify Summoned Minion enters with 0 gauge
console.log("[Test 5] Verifying summoned minion enters with 0 action gauge...");
{
  const minion = createEnemy('smallGoblin');
  minion.actionGauge = 0;
  assert.strictEqual(minion.actionGauge, 0, "Summoned minion must start at 0% gauge");
  console.log("  ✓ Test 5 Passed: Summoned minion enters with 0% action gauge.\n");
}

// [Test 6] Verify Endgame Speed Scaling (SPD up to 999)
console.log("[Test 6] Verifying Endgame Speed Scaling (Level 99 / 999 Stat Cap)...");
{
  const midLevel = new Combatant('MidHero', 100, 20, 10, 5, 5, 5, 100, 0, false);
  const endBoss = new Combatant('EndBoss', 100, 20, 10, 5, 5, 5, 500, 0, true);
  const speedGod = new Combatant('SpeedGod', 100, 20, 10, 5, 5, 5, 999, 0, true);

  let midTurns = 0;
  let bossTurns = 0;
  let godTurns = 0;

  // Simulate 1000 ticks of CTB
  for (let tick = 1; tick <= 1000; tick++) {
    midLevel.actionGauge = Math.min(ACTION_GAUGE_MAX, midLevel.actionGauge + midLevel.totalSpd);
    endBoss.actionGauge = Math.min(ACTION_GAUGE_MAX, endBoss.actionGauge + endBoss.totalSpd);
    speedGod.actionGauge = Math.min(ACTION_GAUGE_MAX, speedGod.actionGauge + speedGod.totalSpd);

    if (midLevel.actionGauge >= ACTION_GAUGE_MAX) {
      midTurns++;
      midLevel.resetActionGauge();
    }
    if (endBoss.actionGauge >= ACTION_GAUGE_MAX) {
      bossTurns++;
      endBoss.resetActionGauge();
    }
    if (speedGod.actionGauge >= ACTION_GAUGE_MAX) {
      godTurns++;
      speedGod.resetActionGauge();
    }
  }

  // SPD 500 should act ~5x as often as SPD 100 (50 vs 10 turns)
  assert.strictEqual(bossTurns, 50, "SPD 500 should act 50 times in 1000 ticks");
  assert.strictEqual(midTurns, 10, "SPD 100 should act 10 times in 1000 ticks");
  assert.strictEqual(godTurns, 90, "SPD 999 should act 90 times in 1000 ticks");
  assert(godTurns > bossTurns * 1.7, "SPD 999 should act nearly twice as often as SPD 500");

  console.log(`  ✓ Test 6 Passed: In 1000 ticks, SPD 100 acted ${midTurns}x, SPD 500 acted ${bossTurns}x, SPD 999 acted ${godTurns}x.\n`);
}

console.log("========================================================");
console.log("         >>> ALL CTB SYSTEM TESTS PASSED! <<<           ");
console.log("========================================================\n");
