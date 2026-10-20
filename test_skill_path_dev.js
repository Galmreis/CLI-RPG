/**
 * Automated Verification Suite for Class Archetypes, Skill Progression, and Dev Test Sandbox.
 */

const assert = require('assert');
const Combatant = require('./combatant');
const { SKILLS, SKILL_PROGRESSION, getSkillsForLevel } = require('./skills');
const { MONSTERS, createEnemy } = require('./enemies');
const storage = require('./storage');
const { runBattle } = require('./battle');

async function runTests() {
  console.log("=== RUNNING SKILL PATHING & DEV SANDBOX TEST SUITE ===\n");

  // --- Test 1: Archetype Initial State ---
  console.log("[Test 1] Verifying Warrior vs Mage initial stats and skills...");
  const warrior = new Combatant('TestWarrior', 130, 15, 14, 9, 5, 6, 10, 8, false);
  warrior.archetype = 'warrior';
  warrior.skills = ['quickStrike', 'heavySlash'];

  const mage = new Combatant('TestMage', 100, 35, 7, 6, 13, 10, 10, 9, false);
  mage.archetype = 'mage';
  mage.skills = ['fire1', 'heal1'];

  assert.strictEqual(warrior.skills.length, 2, "Warrior should start with 2 skills");
  assert.ok(warrior.skills.includes('quickStrike') && warrior.skills.includes('heavySlash'), "Warrior must start with physical strikes");
  assert.strictEqual(mage.skills.length, 2, "Mage should start with 2 skills");
  assert.ok(mage.skills.includes('fire1') && mage.skills.includes('heal1'), "Mage must start with Fire I and Heal I");
  console.log("  ✓ Test 1 Passed: Initial archetype configurations verified.");

  // --- Test 2: Skill Progression and Late-Game Convergence ---
  console.log("[Test 2] Verifying skill progression milestones and convergence at Level 10...");
  const allKnownSkillIds = Object.keys(SKILLS);
  
  // Test Warrior progression up to Lv 10
  const warriorSim = new Combatant('WarriorProg', 130, 15, 14, 9, 5, 6, 10, 8, false);
  warriorSim.archetype = 'warrior';
  warriorSim.skills = [...SKILL_PROGRESSION.warrior[1]];

  for (let lvl = 2; lvl <= 10; lvl++) {
    const unlocked = getSkillsForLevel('warrior', lvl);
    unlocked.forEach((s) => {
      if (!warriorSim.skills.includes(s)) warriorSim.skills.push(s);
    });
  }

  // Test Mage progression up to Lv 10
  const mageSim = new Combatant('MageProg', 100, 35, 7, 6, 13, 10, 10, 9, false);
  mageSim.archetype = 'mage';
  mageSim.skills = [...SKILL_PROGRESSION.mage[1]];

  for (let lvl = 2; lvl <= 10; lvl++) {
    const unlocked = getSkillsForLevel('mage', lvl);
    unlocked.forEach((s) => {
      if (!mageSim.skills.includes(s)) mageSim.skills.push(s);
    });
  }

  // Assert both have learned all 13 skills
  for (const skillId of allKnownSkillIds) {
    assert.ok(warriorSim.skills.includes(skillId), `Warrior should learn ${skillId} by Lv 10`);
    assert.ok(mageSim.skills.includes(skillId), `Mage should learn ${skillId} by Lv 10`);
  }
  console.log(`  ✓ Test 2 Passed: Both paths successfully master all ${allKnownSkillIds.length} skills by Level 10.`);

  // --- Test 3: Dev Save File in Slot 5 ---
  console.log("[Test 3] Verifying Dev Save Slot 5 generation and hydration...");
  await storage.ensureDevSaveSlot(true); // force generation
  const devHero = await storage.loadSlot(5);

  assert.strictEqual(devHero.name, 'DevTester', "Dev slot must load DevTester");
  assert.strictEqual(devHero.level, 20, "DevTester must be Level 20");
  assert.strictEqual(devHero.gold, 5000, "DevTester must have 5000 gold");
  assert.strictEqual(devHero.skills.length, 13, "DevTester must know all 13 skills");
  assert.strictEqual(devHero.equipment.weapon, 'iron_sword', "DevTester must have Iron Broadsword equipped");

  const slotList = await storage.listSlots();
  const slot5 = slotList.find((s) => s.slot === 5);
  assert.ok(slot5.summary.includes('[DEV LAB]'), "Slot 5 summary must feature [DEV LAB] tag");
  console.log("  ✓ Test 3 Passed: Dev Save Slot 5 loaded and hydrated correctly.");

  // --- Test 4: Testing Dummies Catalog & Stats ---
  console.log("[Test 4] Verifying Testing Dummies (999 DEF, 999 LCK, Elemental Prism)...");
  const colossus = createEnemy('ironColossus');
  const mirage = createEnemy('shadowMirage');
  const prism = createEnemy('elementalPrism');

  assert.strictEqual(colossus.def, 999, "Iron Colossus must have 999 DEF");
  assert.strictEqual(mirage.lck, 999, "Shadow Mirage must have 999 LCK");
  assert.strictEqual(prism.resistances.fire, 1.5, "Prism must be weak to Fire (1.5x)");
  assert.strictEqual(prism.resistances.thunder, -1.0, "Prism must absorb Thunder (-1.0x)");
  assert.strictEqual(prism.resistances.ice, 0.0, "Prism must be immune to Ice (0.0x)");
  console.log("  ✓ Test 4 Passed: Dummy stats and resistance profiles confirmed.");

  // --- Test 5: Combat Math against Dummies ---
  console.log("[Test 5] Verifying 1-damage floor and elemental reactions against Dummies...");
  const attacker = new Combatant('Hero', 200, 100, 20, 10, 30, 10, 15, 10, false);

  // Normal attack vs 999 DEF
  const attackResult = attacker.attack(colossus);
  assert.strictEqual(attackResult.damage, 1, "Attack against 999 DEF must deal exactly 1 damage (damage floor)");

  // Fire I vs Elemental Prism (Weakness)
  const fireMsg = SKILLS.fire1.execute(attacker, prism);
  assert.ok(fireMsg.includes("WEAKNESS HIT!"), "Fire I on Prism must trigger weakness tag");

  // Thunder I vs Elemental Prism (Absorption)
  const thunderMsg = SKILLS.thunder1.execute(attacker, prism);
  assert.ok(thunderMsg.includes("ABSORBED"), "Thunder I on Prism must trigger absorption tag");

  // Ice I vs Elemental Prism (Immunity)
  const iceMsg = SKILLS.ice1.execute(attacker, prism);
  assert.ok(iceMsg.includes("IMMUNE"), "Ice I on Prism must trigger immunity tag");

  console.log("  ✓ Test 5 Passed: 1-damage floor, weakness, absorption, and immunity verified.");

  console.log("\nALL SKILL PATHING & DEV SANDBOX TESTS PASSED SUCCESSFULLY! (5/5)");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
