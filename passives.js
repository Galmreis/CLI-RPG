/**
 * Passives Catalog for CLI RPG
 * 
 * ============================================================================
 * HOW PASSIVES WORK (EVENT HOOKS / LIFECYCLE TRIGGERS)
 * ============================================================================
 * Passives are traits that trigger automatically in response to combat events.
 * Unlike active skills (which a combatant chooses from a menu on their turn),
 * passives run in the background whenever specific events occur.
 * 
 * ============================================================================
 * HOW TO CREATE A NEW PASSIVE
 * ============================================================================
 * 1. Add a new entry to the PASSIVES dictionary below.
 * 2. Define the basic metadata:
 *    - id: Unique string identifier matching the key (e.g., 'stoneSkin')
 *    - name: Readable display name (e.g., 'Stone Skin')
 *    - description: Clear explanation of what the passive does
 * 3. Add one or more lifecycle hook functions:
 * 
 *    - onTakeDamage(combatant, incomingDamage, isMagical):
 *        Triggers when the combatant is being hit.
 *        Returns: { damage: number, triggered: boolean, message?: string }
 * 
 *    - onCalculateCrit(combatant, baseCritChance):
 *        Triggers when the combatant rolls an attack.
 *        Returns: number (the updated crit chance, e.g. base + 0.10)
 * 
 *    - onTurnStart(combatant):
 *        Triggers at the start of combatant's turn before ailments tick.
 *        Returns: string | null (optional log message if an effect triggered)
 * 
 * EXAMPLE TEMPLATE:
 * ----------------------------------------------------------------------------
 * myPassiveKey: {
 *   id: 'myPassiveKey',
 *   name: 'Passive Display Name',
 *   description: 'Description of the passive effect for player inspection.',
 *   onTakeDamage: (combatant, damage, isMagical) => {
 *     // Modify damage or check probabilities here
 *     return { damage, triggered: false };
 *   },
 * },
 * ============================================================================
 */

const PASSIVES = {
  /**
   * VIGOR (Hero Starting Passive)
   * Heroic resilience that provides a chance to endure heavy blows.
   */
  vigor: {
    id: 'vigor',
    name: 'Vigor',
    description: 'Heroic resilience: 20% chance to reduce incoming damage by 50%.',
    /**
     * Hook: Triggers when the combatant takes damage.
     * @param {Object} combatant - The combatant receiving damage
     * @param {number} damage - The incoming damage amount
     * @param {boolean} isMagical - Whether the incoming damage is magic
     * @returns {{ damage: number, triggered: boolean, message: string }}
     */
    onTakeDamage: (combatant, damage, isMagical) => {
      if (Math.random() < 0.20) {
        const reduced = Math.floor(damage * 0.5);
        return {
          damage: reduced,
          triggered: true,
          message: `${combatant.name}'s Vigor activated, halving the incoming damage!`,
        };
      }
      return { damage, triggered: false, message: '' };
    },
  },

  /**
   * FOCUSED (Goblin Trait)
   * Sharp hunter reflexes that heighten critical strike accuracy.
   */
  focused: {
    id: 'focused',
    name: 'Focused',
    description: 'Keen predatory focus: Increases critical strike chance by +10%.',
    /**
     * Hook: Triggers when calculating critical hit probability.
     * @param {Object} combatant - The combatant attacking
     * @param {number} critChance - The base critical chance (from LCK)
     * @returns {number} The modified critical chance
     */
    onCalculateCrit: (combatant, critChance) => {
      return critChance + 0.10;
    },
  },

  /**
   * STONE SKIN (Example Tank Trait - Ready for future monsters/gear)
   * Hardened exterior that absorbs flat damage from every attack.
   */
  stoneSkin: {
    id: 'stoneSkin',
    name: 'Stone Skin',
    description: 'Impenetrable body: Reduces all incoming damage by 3 flat points.',
    onTakeDamage: (combatant, damage, isMagical) => {
      const reduced = Math.max(1, damage - 3);
      return {
        damage: reduced,
        triggered: true,
        message: `${combatant.name}'s Stone Skin absorbed 3 damage!`,
      };
    },
  },

  /**
   * ROYAL FOCUS (Goblin King Boss Passive)
   * Monarch authority: +50% critical strike chance and summons a Small Goblin minion every 3 critical hits.
   */
  royalFocus: {
    id: 'royalFocus',
    name: 'Royal Focus',
    description: 'Monarch authority: Increases critical strike chance by +50% and summons a Small Goblin minion every 3 critical hits.',
    onCalculateCrit: (combatant, critChance) => {
      return critChance + 0.50;
    },
    onCrit: (combatant) => {
      combatant.royalFocusCrits = (combatant.royalFocusCrits || 0) + 1;
      if (combatant.royalFocusCrits >= 3) {
        combatant.royalFocusCrits = 0;
        return {
          summon: 'smallGoblin',
          message: `👑 The Goblin King rallies his subjects! A Small Goblin rushes into battle!`,
        };
      }
      return {
        message: `👑 Royal Focus resonates! (${combatant.royalFocusCrits}/3 critical hits towards minion summon)`,
      };
    },
  },
};

module.exports = {
  PASSIVES,
};
