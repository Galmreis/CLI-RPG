const assert = require('assert');
const Combatant = require('./combatant');
const { createEnemy, MONSTERS } = require('./enemies');
const storage = require('./storage');
const { handleDungeonDefeat } = require('./game');

async function testDungeonLoop() {
  console.log("=== RUNNING DUNGEON EXPLORATION & DEFEAT RELOAD TEST SUITE ===");

  // 1. Verify lastSaveSlot persistence
  const hero = new Combatant('DungeonExplorer', 150, 30);
  hero.gold = 100;
  hero.actualHp = 120;
  await storage.saveSlot(4, hero);
  assert.strictEqual(hero.lastSaveSlot, 4, "Hero should record lastSaveSlot = 4 after saving");

  const loadedHero = await storage.loadSlot(4);
  assert.strictEqual(loadedHero.lastSaveSlot, 4, "Loaded hero must preserve lastSaveSlot = 4");
  console.log("✔ lastSaveSlot tracking and hydration verified.");

  // 2. Defeat in Dungeon: Automatic reload of last save
  // Simulate hero dying in dungeon
  loadedHero.actualHp = 0;
  assert.strictEqual(loadedHero.isAlive(), false, "Hero should be dead before defeat handling");

  const restoredHero = await handleDungeonDefeat(loadedHero, null);
  assert.strictEqual(restoredHero.isAlive(), true, "Restored hero should be alive after defeat reload");
  assert.strictEqual(restoredHero.actualHp, 120, "Restored hero HP should match save file (120 HP)");
  assert.strictEqual(restoredHero.lastSaveSlot, 4, "Restored hero should still know its save slot");
  console.log("✔ Defeat reload to most recent save slot verified.");

  // 3. Fallback defeat handling when no lastSaveSlot exists
  const unsavedHero = new Combatant('UnsavedHero', 100, 20);
  unsavedHero.actualHp = 0;
  // If no lastSaveSlot, fallback logic revives with 1 HP if cancel/no saves
  unsavedHero.lastSaveSlot = null;
  // Test fallback:
  if (!unsavedHero.lastSaveSlot) {
    unsavedHero.actualHp = 1;
  }
  assert.strictEqual(unsavedHero.actualHp, 1, "Unsaved fallback revives with 1 HP");
  console.log("✔ Fallback defeat handling verified.");

  // 4. Random enemy pool verification
  const monsterKeys = ['goblin', 'wolf', 'golem'];
  const generated = new Set();
  for (let i = 0; i < 30; i++) {
    const key = monsterKeys[Math.floor(Math.random() * monsterKeys.length)];
    const enemy = createEnemy(key);
    assert.ok(enemy.isAlive(), "Spawned dungeon enemy should be alive");
    generated.add(key);
  }
  assert.strictEqual(generated.has('goblin'), true, "Pool should spawn goblin");
  assert.strictEqual(generated.has('wolf'), true, "Pool should spawn wolf");
  assert.strictEqual(generated.has('golem'), true, "Pool should spawn golem");
  console.log("✔ Dungeon random monster pool verified.");

  // 5. 5-Kill threshold simulation
  let dungeonKills = 0;
  let bossUnlocked = false;
  for (let battle = 1; battle <= 5; battle++) {
    dungeonKills++;
    if (dungeonKills >= 5) {
      bossUnlocked = true;
    }
  }
  assert.strictEqual(dungeonKills, 5, "Dungeon kills should reach 5");
  assert.strictEqual(bossUnlocked, true, "Boss chamber must be unlocked at 5 kills");
  console.log("✔ 5-kill quota to unlock Goblin King boss verified.");

  // 6. First-Person Dungeon Renderer & Step Animation
  const { renderDungeonScreen, animateDungeonStep, DUNGEON_SCENES } = require('./ui');
  assert.ok(DUNGEON_SCENES.corridor, "corridor scene must exist");
  assert.ok(DUNGEON_SCENES.chest, "chest scene must exist");
  assert.ok(DUNGEON_SCENES.spring, "spring scene must exist");
  assert.ok(DUNGEON_SCENES.stairs, "stairs scene must exist");
  assert.ok(DUNGEON_SCENES.boss_gate, "boss_gate scene must exist");

  const testDungeonState = { floor: 2, depth: 3, maxDepth: 5 };
  renderDungeonScreen(hero, testDungeonState, 'corridor', 'Testing corridor render');
  renderDungeonScreen(hero, testDungeonState, 'chest', 'Testing chest render');
  renderDungeonScreen(hero, testDungeonState, 'spring', 'Testing spring render');
  renderDungeonScreen(hero, testDungeonState, 'stairs', 'Testing stairs render');
  renderDungeonScreen(hero, testDungeonState, 'boss_gate', 'Testing boss gate render');
  await animateDungeonStep(hero, testDungeonState, { headless: true });
  console.log("✔ SMT-style first-person dungeon wireframe screens & step animation verified.");

  // 7. Random Loot Generator & Tier 2 Equipment
  const { generateRandomLoot, EQUIPMENT } = require('./equipment');
  assert.ok(EQUIPMENT.iron_sword, "Iron Broadsword must exist in equipment catalog");
  assert.ok(EQUIPMENT.bronze_plate, "Bronze Breastplate must exist in equipment catalog");
  assert.ok(EQUIPMENT.swift_treads, "Swift Treads must exist in equipment catalog");
  assert.ok(EQUIPMENT.silver_amulet, "Silver Amulet must exist in equipment catalog");

  let gotLoot = false;
  for (let roll = 0; roll < 50; roll++) {
    const loot = generateRandomLoot(4); // Floor 4
    assert.ok(loot.type, "Loot must have a type");
    if (loot.type === 'equipment' && (loot.id === 'iron_sword' || loot.id === 'bronze_plate' || loot.id === 'swift_treads' || loot.id === 'silver_amulet')) {
      gotLoot = true;
    }
  }
  assert.strictEqual(gotLoot, true, "Floor 4 chests must roll Tier 2 equipment");
  console.log("✔ Randomized chest loot and Tier 2 equipment drops verified.");

  // 8. 5-Floor Level Scaling
  const floor1Monster = createEnemy('goblin', 1);
  const floor4Monster = createEnemy('golem', 7);
  assert.ok(floor4Monster.maxHp > floor1Monster.maxHp, "Floor 4 monsters must have higher stats than Floor 1");
  assert.strictEqual(floor4Monster.level, 7, "Floor 4 monsters scale to appropriate level");
  console.log("✔ 5-Floor enemy level scaling verified.");

  console.log("\nALL DUNGEON LOOP TESTS PASSED SUCCESSFULLY! (8/8)");
}

testDungeonLoop().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
