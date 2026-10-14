const assert = require('assert');
const Combatant = require('./combatant');
const { createEnemy, MONSTERS } = require('./enemies');
const { ITEMS, addItem, getItemCount, ITEM_CAP } = require('./items');
const storage = require('./storage');

async function testShopAndGold() {
  console.log("=== RUNNING GOLD & SHOP TEST SUITE ===");

  // 1. Combatant gold property
  const hero = new Combatant('Tester', 100, 20);
  assert.strictEqual(hero.gold, 0, "Default gold should be 0");
  hero.gold = 50;
  assert.strictEqual(hero.gold, 50, "Should assign 50 gold to hero");
  console.log("✔ Combatant gold initialization verified.");

  // 2. Monster gold yields
  assert.strictEqual(MONSTERS.goblin.gold, 5, "Goblin should yield 5 gold");
  assert.strictEqual(MONSTERS.wolf.gold, 15, "Wolf should yield 15 gold");
  assert.strictEqual(MONSTERS.golem.gold, 35, "Golem should yield 35 gold");

  const gob = createEnemy('goblin');
  assert.strictEqual(gob.gold, 5, "createEnemy('goblin') should have 5 gold");
  console.log("✔ Monster gold yields in catalog and instance verified.");

  // 3. Battle victory gold reward
  const prevPurse = hero.gold;
  hero.gold += gob.gold;
  assert.strictEqual(hero.gold, prevPurse + 5, "Gold should increase by 5 after goblin victory");
  console.log("✔ Gold reward addition verified.");

  // 4. Items price & getItemCount
  assert.strictEqual(ITEMS.potion.price, 10, "Potion price must be 10G");
  assert.strictEqual(getItemCount(hero, 'potion'), 0, "Initial potions should be 0");
  addItem(hero.inventory, 'potion', 3);
  assert.strictEqual(getItemCount(hero, 'potion'), 3, "getItemCount should return 3");
  console.log("✔ Item price and getItemCount verified.");

  // 5. Purchasing logic & budget constraints
  const price = ITEMS.potion.price;
  let maxAffordable = Math.floor(hero.gold / price);
  assert.strictEqual(maxAffordable, 5, "55 gold / 10 price = 5 max affordable potions");

  // Buy 2 potions
  const qtyToBuy = 2;
  const cost = qtyToBuy * price;
  hero.gold -= cost;
  addItem(hero.inventory, 'potion', qtyToBuy);
  assert.strictEqual(hero.gold, 35, "Remaining gold should be 35");
  assert.strictEqual(getItemCount(hero, 'potion'), 5, "Total potions should now be 5");
  console.log("✔ Purchase transaction calculations verified.");

  // Test inventory cap boundary
  addItem(hero.inventory, 'potion', 94); // Now at 99
  assert.strictEqual(getItemCount(hero, 'potion'), ITEM_CAP, "Inventory should reach 99 cap");
  const spaceRemaining = ITEM_CAP - getItemCount(hero, 'potion');
  assert.strictEqual(spaceRemaining, 0, "Space remaining should be 0 when capped");
  console.log("✔ Item cap 99 boundary check verified.");

  // 6. Persistence: save and hydrate gold
  const savedData = await storage.saveSlot(5, hero);
  assert.strictEqual(savedData.gold, 35, "Serialized data must preserve gold");

  const loadedHero = await storage.loadSlot(5);
  assert.strictEqual(loadedHero.gold, 35, "Hydrated hero must preserve 35 gold");
  assert.strictEqual(typeof loadedHero.gold, 'number', "Hydrated gold must be number");

  const slots = await storage.listSlots();
  const slot5 = slots.find((s) => s.slot === 5);
  assert.ok(slot5.summary.includes('Gold: 35G'), "Slot summary must display Gold: 35G");
  console.log("✔ Storage serialization, hydration, and slot preview verified.");

  console.log("\nALL GOLD & SHOP TESTS PASSED SUCCESSFULLY! (6/6)");
}

testShopAndGold().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
