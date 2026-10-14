/**
 * Test Suite: AoE Skills & Spells and Percentage HP Costs
 */

const assert = require('assert');
const Combatant = require('./combatant');
const { SKILLS } = require('./skills');
const { createEnemy } = require('./enemies');

console.log("=== RUNNING AOE & HP PERCENTAGE SKILL TESTS ===\n");

// TEST 1: targetType metadata presence
console.log("Test 1: targetType metadata presence across all skills");
for (const [id, skill] of Object.entries(SKILLS)) {
  assert(skill.targetType, `Skill ${id} must have targetType`);
  assert(['single', 'all_enemies', 'self'].includes(skill.targetType), `Skill ${id} has invalid targetType: ${skill.targetType}`);
}
console.log("  ✓ All skills define a valid targetType ('single', 'all_enemies', 'self')\n");

// TEST 2: Percentage-based HP deduction on martial skills
console.log("Test 2: Percentage HP costs on physical martial skills");
const hero = new Combatant("TestHero", 200, 50, 20, 10, 10, 10, 15, 10, false);
const targetGoblin = createEnemy('goblin');

// Heavy Slash: 10% of 200 = 20 HP
const hpBeforeSlash = hero.actualHp;
const slashLog = SKILLS.heavySlash.execute(hero, targetGoblin);
assert.strictEqual(hero.actualHp, hpBeforeSlash - 20, "Heavy Slash must deduct exactly 10% Max HP (20 HP)");
console.log("  ✓ Heavy Slash deducted 10% Max HP (20 HP) correctly:", slashLog);

// Quick Strike: 5% of 200 = 10 HP
const hpBeforeQuick = hero.actualHp;
SKILLS.quickStrike.execute(hero, targetGoblin);
assert.strictEqual(hero.actualHp, hpBeforeQuick - 10, "Quick Strike must deduct exactly 5% Max HP (10 HP)");
console.log("  ✓ Quick Strike deducted 5% Max HP (10 HP) correctly\n");

// TEST 3: Insufficient HP check prevents self-destruction
console.log("Test 3: Insufficient HP check prevents suicide");
hero.actualHp = 15; // At 200 Max HP, Whirlwind requires 14% (28 HP)
const whirlwindSuicideCheck = SKILLS.whirlwind.execute(hero, [targetGoblin]);
assert(whirlwindSuicideCheck.includes("lacks sufficient vitality"), "Should block skill when HP <= required cost");
assert.strictEqual(hero.actualHp, 15, "HP should not be deducted if skill execution fails vitality check");
console.log("  ✓ Vitality check safely blocked execution without deducting HP\n");

// TEST 4: Physical AoE Whirlwind hits entire party
console.log("Test 4: Physical AoE Whirlwind striking all enemies");
hero.actualHp = 200; // Reset HP
const goblin1 = createEnemy('goblin');
const wolf1 = createEnemy('wolf');
const golem1 = createEnemy('golem');
const party = [goblin1, wolf1, golem1];

const initialHp = party.map(e => e.actualHp);
const whirlwindLog = SKILLS.whirlwind.execute(hero, party);

// Whirlwind cost: 14% of 200 = 28 HP
assert.strictEqual(hero.actualHp, 200 - 28, "Whirlwind must deduct 14% Max HP (28 HP)");
assert(goblin1.actualHp < initialHp[0], "Goblin must take damage from Whirlwind");
assert(wolf1.actualHp < initialHp[1], "Wolf must take damage from Whirlwind");
assert(golem1.actualHp < initialHp[2], "Golem must take damage from Whirlwind (halved by physical resist)");
console.log("  ✓ Whirlwind successfully struck all 3 enemies with individual resistances:\n", whirlwindLog, "\n");

// TEST 5: Elemental Magic AoE Spells (Firestorm, Thunderstorm, Blizzard)
console.log("Test 5: Elemental AoE Magic Spells striking party");
hero.actualMp = 100;
const e1 = createEnemy('goblin');
const e2 = createEnemy('wolf'); // Weak to Fire (1.5x)
const e3 = createEnemy('golem'); // Resists/Absorbs Thunder (-1.0x)

// Firestorm
const wolfHpBefore = e2.actualHp;
const fireLog = SKILLS.firestorm1.execute(hero, [e1, e2, e3]);
assert(fireLog.includes("WEAKNESS!"), "Wolf must trigger WEAKNESS tag on Firestorm");
console.log("  ✓ Firestorm hit entire party with weakness trigger on Wolf:\n", fireLog, "\n");

// Thunderstorm against Golem (absorbs thunder)
const golemHpBefore = e3.actualHp;
const thunderLog = SKILLS.thunderstorm1.execute(hero, [e1, e2, e3]);
assert(thunderLog.includes("ABSORBED"), "Golem must absorb Thunderstorm voltage and recover HP");
assert(e3.actualHp >= golemHpBefore, "Golem HP must increase or remain max from thunder absorption");
console.log("  ✓ Thunderstorm correctly triggered absorption on Iron Golem:\n", thunderLog, "\n");

console.log("=== ALL AOE & HP PERCENTAGE TESTS PASSED! ===");
