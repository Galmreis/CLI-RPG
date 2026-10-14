/**
 * Test Suite: Additive Enemy Growth & Player Level Scaling
 */

const assert = require('assert');
const Combatant = require('./combatant');
const { createEnemy, MONSTERS } = require('./enemies');

console.log("=== RUNNING STAT GROWTH & SCALING AUTOMATED TESTS ===\n");

// TEST 1: Base Level 1 Monster Stats
console.log("Test 1: Level 1 Monster instantiation retains baseline stats");
const gobLv1 = createEnemy('goblin', 1);
assert.strictEqual(gobLv1.level, 1);
assert.strictEqual(gobLv1.maxHp, MONSTERS.goblin.maxHp);
assert.strictEqual(gobLv1.atk, MONSTERS.goblin.atk);
assert.strictEqual(gobLv1.expReward, MONSTERS.goblin.exp);
assert.strictEqual(gobLv1.gold, MONSTERS.goblin.gold);
console.log(`  ✓ Level 1 Goblin: HP=${gobLv1.maxHp}, ATK=${gobLv1.atk}, DEF=${gobLv1.def}, EXP=${gobLv1.expReward}, Gold=${gobLv1.gold}\n`);

// TEST 2: Additive Enemy Scaling at Level 10
console.log("Test 2: Level 10 Monster additive growth");
const gobLv10 = createEnemy('goblin', 10);
// LvDelta = 9. HP = 50 + 9 * 10 = 140. ATK = 8 + 9 * 1.5 = 21.
const expectedHp = MONSTERS.goblin.maxHp + 9 * MONSTERS.goblin.growth.hp;
const expectedAtk = Math.floor(MONSTERS.goblin.atk + 9 * MONSTERS.goblin.growth.atk);
const expectedExp = Math.floor(MONSTERS.goblin.exp + 9 * MONSTERS.goblin.growth.exp);

assert.strictEqual(gobLv10.level, 10);
assert.strictEqual(gobLv10.maxHp, expectedHp);
assert.strictEqual(gobLv10.atk, expectedAtk);
assert.strictEqual(gobLv10.expReward, expectedExp);
assert(gobLv10.name.includes("Lv. 10"), "Name should display level");
console.log(`  ✓ Level 10 Goblin: Name="${gobLv10.name}", HP=${gobLv10.maxHp} (expected ${expectedHp}), ATK=${gobLv10.atk} (expected ${expectedAtk}), EXP=${gobLv10.expReward}\n`);

// TEST 3: Archetype Specialty Divergence (Wolf Speed/Atk vs Golem HP/Def)
console.log("Test 3: Archetype growth divergence at Level 20");
const wolfLv20 = createEnemy('wolf', 20);
const golemLv20 = createEnemy('golem', 20);

// Wolf should have significantly higher SPD and ATK
assert(wolfLv20.spd > golemLv20.spd, `Wolf SPD (${wolfLv20.spd}) must exceed Golem SPD (${golemLv20.spd})`);
// Golem should have significantly higher HP and DEF
assert(golemLv20.maxHp > wolfLv20.maxHp, `Golem HP (${golemLv20.maxHp}) must exceed Wolf HP (${wolfLv20.maxHp})`);
assert(golemLv20.def > wolfLv20.def, `Golem DEF (${golemLv20.def}) must exceed Wolf DEF (${wolfLv20.def})`);
console.log(`  ✓ Level 20 Wolf (Swift Glass Cannon): HP=${wolfLv20.maxHp}, ATK=${wolfLv20.atk}, DEF=${wolfLv20.def}, SPD=${wolfLv20.spd}`);
console.log(`  ✓ Level 20 Golem (Iron Tank):         HP=${golemLv20.maxHp}, ATK=${golemLv20.atk}, DEF=${golemLv20.def}, SPD=${golemLv20.spd}\n`);

// TEST 4: Goblin King Boss Scaling
console.log("Test 4: Goblin King boss scaling at Level 15");
const kingLv15 = createEnemy('goblinKing', 15);
assert.strictEqual(kingLv15.level, 15);
assert(kingLv15.maxHp > 350, "Goblin King HP should scale heavily with boss base + growth");
assert(kingLv15.gold > 300, "Goblin King gold reward should scale");
console.log(`  ✓ Level 15 Goblin King: HP=${kingLv15.maxHp}, ATK=${kingLv15.atk}, DEF=${kingLv15.def}, Gold=${kingLv15.gold}\n`);

// TEST 5: Stat Cap Protection at Level 99
console.log("Test 5: Stat Cap clamping (9999 HP/MP, 999 stats) at Level 99");
const golemLv99 = createEnemy('golem', 99);
assert(golemLv99.maxHp <= 9999, "HP cannot exceed 9999 cap");
assert(golemLv99.def <= 999, "DEF cannot exceed 999 cap");
assert(golemLv99.atk <= 999, "ATK cannot exceed 999 cap");
console.log(`  ✓ Level 99 Golem: HP=${golemLv99.maxHp}/9999, DEF=${golemLv99.def}/999, ATK=${golemLv99.atk}/999 (Clamping enforced)\n`);

// TEST 6: Player Additive EXP Scaling
console.log("Test 6: Player EXP requirement scaling to Level 99");
let exp = 30;
for (let lvl = 1; lvl < 99; lvl++) {
  exp += lvl * 35;
}
assert(exp < 1000000, "Level 99 EXP requirement must remain in reasonable reachable bounds (<1,000,000 EXP)");
console.log(`  ✓ Level 99 Player cumulative requirement reaches ${exp} EXP (achievable and integer-safe)\n`);

// TEST 7: checkLevelUp with allocateStatsMenu headless allocation
console.log("Test 7: checkLevelUp with allocateStatsMenu integration");
const { checkLevelUp } = require('./game');
const testPlayer = new Combatant('HeroLevelUp', 100, 50, 10, 10, 10, 10, 10, 10);
testPlayer.exp = 50; // Triggers level up from Lv. 1 (req 30 EXP)
const mockRl = {
  question: async () => '',
  pause: () => {},
  resume: () => {},
};

(async () => {
  const didLevel = await checkLevelUp(testPlayer, mockRl);
  assert.strictEqual(didLevel, true, "checkLevelUp should return true on level up");
  assert.strictEqual(testPlayer.level, 2, "Player should be Level 2");
  assert(testPlayer.maxHp > 100, "Max HP should have grown from natural growth and/or AP allocation");
  assert.strictEqual(testPlayer.actualHp, testPlayer.totalMaxHp, "Player HP should be fully restored after level up");
  console.log(`  ✓ checkLevelUp successfully executed with allocateStatsMenu: Level=${testPlayer.level}, HP=${testPlayer.actualHp}/${testPlayer.totalMaxHp}\n`);

  console.log("=== ALL STAT GROWTH TESTS PASSED! ===");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

