const { PASSIVES } = require('./passives');
const { getEquipmentStatBonus, getEquipmentResistanceBonus } = require('./equipment');

/**
 * Combatant Blueprint for CLI RPG
 * Represents any active fighter (player or enemy) in the battle system.
 */
class Combatant {
  constructor(
    name,
    maxHp,
    maxMp,
    atk = 5,
    def = 5,
    mAtk = 5,
    mDef = 5,
    spd = 5,
    lck = 5,
    isEnemy = false
  ) {
    this.name = name;
    this.maxHp = maxHp;
    this.actualHp = maxHp; // Starts at full health
    this.maxMp = maxMp;
    this.actualMp = maxMp; // Starts at full mana

    // Core combat stats (defaults to base of 5 if not specified)
    this.atk = atk;
    this.def = def;
    this.mAtk = mAtk;
    this.mDef = mDef;
    this.spd = spd;
    this.lck = lck;

    // Team identification, status, buffs, and debuffs
    this.isEnemy = isEnemy;
    this.currentStatus = 'neutral';
    this.isDefending = false;
    this.protectTurns = 0;
    this.hasPowerUp = false;
    this.armorBreakTurns = 0;
    this.passives = [];
    this.skills = [];
    this.inventory = [];
    this.gold = 0;
    this.level = 1;
    this.exp = 0;
    this.nextLevelExp = 30;
    this.actionGauge = 0;

    // Base elemental & physical resistances (1.0 = neutral, >1.0 = weak, <1.0 = resist, 0.0 = immune, <0 = absorb)
    this.resistances = {
      physical: 1.0,
      fire: 1.0,
      ice: 1.0,
      thunder: 1.0,
    };

    // Equipment slots (weapon, chest, shoes, accessory)
    this.equipment = {
      weapon: null,
      chest: null,
      shoes: null,
      accessory: null,
    };
  }

  /**
   * Resets the combatant's CTB action gauge to 0 after taking a turn.
   */
  resetActionGauge() {
    this.actionGauge = 0;
  }

  /**
   * Dynamic stat getters that calculate base stat + equipment bonuses.
   */
  get totalMaxHp() {
    return this.maxHp + getEquipmentStatBonus(this, 'maxHp');
  }

  get totalMaxMp() {
    return this.maxMp + getEquipmentStatBonus(this, 'maxMp');
  }

  get totalAtk() {
    return this.atk + getEquipmentStatBonus(this, 'atk');
  }

  get totalDef() {
    let defVal = this.def + getEquipmentStatBonus(this, 'def');
    // Armor Break debuff reduces total DEF by 20%
    if (this.armorBreakTurns > 0) {
      defVal = Math.max(1, Math.floor(defVal * 0.8));
    }
    return defVal;
  }

  get totalMAtk() {
    return this.mAtk + getEquipmentStatBonus(this, 'mAtk');
  }

  get totalMDef() {
    return this.mDef + getEquipmentStatBonus(this, 'mDef');
  }

  get totalSpd() {
    return this.spd + getEquipmentStatBonus(this, 'spd');
  }

  get totalLck() {
    return this.lck + getEquipmentStatBonus(this, 'lck');
  }

  /**
   * Calculates the effective resistance multiplier for a damage type.
   * Combines base resistance with equipped gear modifiers.
   * @param {string} damageType - 'physical', 'fire', 'ice', 'thunder'
   * @returns {number}
   */
  getResistance(damageType) {
    let base = 1.0;
    if (this.resistances && typeof this.resistances[damageType] === 'number') {
      base = this.resistances[damageType];
    }
    const gearBonus = getEquipmentResistanceBonus ? getEquipmentResistanceBonus(this, damageType) : 0;
    return base + gearBonus;
  }

  /**
   * Checks if the combatant is alive.
   * If actualHp drops to 0 or below, the character is considered K.O.
   */
  isAlive() {
    return this.actualHp > 0;
  }

  /**
   * Sets defending stance.
   * Reduces incoming damage by 50% until next action.
   */
  defend() {
    this.currentStatus = 'defend';
    this.isDefending = true;
  }

  /**
   * Clears defending stance back to neutral when an action begins.
   */
  clearDefend() {
    if (this.currentStatus === 'defend') {
      this.currentStatus = 'neutral';
    }
    this.isDefending = false;
  }

  /**
   * Applies damage to this combatant, accounting for elemental/physical resistance, absorb, defend, and buffs.
   * - Resistance multiplier applied first:
   *     mult < 0: Absorb (restores HP instead of taking damage)
   *     mult === 0: Immune (0 damage)
   *     mult > 1.0: Weakness
   *     mult < 1.0: Resisted
   * - Defend stance cuts damage by 50%.
   * - Protect I (if physical) cuts damage by 25%.
   * - Executes onTakeDamage hooks for any equipped passives (e.g. Vigor).
   * Enforces 1 minimum damage and 9999 cap, stopping HP at 0.
   * Returns { damage, isAbsorbed, isImmune, isWeakness, isResisted }.
   */
  takeDamage(rawDamage, isMagical = false, damageType = 'physical') {
    const mult = this.getResistance(damageType);

    // 1. Immune check
    if (mult === 0) {
      return {
        damage: 0,
        isImmune: true,
        isAbsorbed: false,
        isWeakness: false,
        isResisted: false,
        valueOf() { return 0; },
      };
    }

    // 2. Absorb check (negative multiplier heals target)
    if (mult < 0) {
      const healAmount = Math.max(1, Math.floor(rawDamage * Math.abs(mult)));
      const prevHp = this.actualHp;
      this.actualHp = Math.min(this.totalMaxHp, this.actualHp + healAmount);
      const actualHealed = this.actualHp - prevHp;
      return {
        damage: -actualHealed,
        isAbsorbed: true,
        isImmune: false,
        isWeakness: false,
        isResisted: false,
        valueOf() { return -actualHealed; },
      };
    }

    // 3. Normal resistance scaling
    let damage = Math.floor(rawDamage * mult);

    // 4. Defend stance cuts incoming damage in half
    if (this.currentStatus === 'defend' || this.isDefending) {
      damage = Math.floor(damage * 0.5);
    }

    // 5. Protect I reduces physical damage by 25%
    if (!isMagical && this.protectTurns > 0) {
      damage = Math.floor(damage * 0.75);
    }

    // 6. Dynamic passive triggers (onTakeDamage)
    for (const passiveId of this.passives) {
      const passive = PASSIVES[passiveId];
      if (passive && typeof passive.onTakeDamage === 'function') {
        const result = passive.onTakeDamage(this, damage, isMagical);
        if (result && typeof result.damage === 'number') {
          damage = result.damage;
        }
      }
    }

    // 7. Minimum 1 damage floor and 9999 cap
    damage = Math.max(1, damage);
    damage = Math.min(9999, damage);

    // 8. Deduct from HP, clamped at 0
    this.actualHp = Math.max(0, this.actualHp - damage);

    return {
      damage: damage,
      isAbsorbed: false,
      isImmune: false,
      isWeakness: mult > 1.0,
      isResisted: mult < 1.0,
      valueOf() { return damage; },
    };
  }

  /**
   * Executes a physical attack against a target combatant.
   * - Dodge: Target has a (lck / 5) * 1% chance to dodge and negate damage.
   * - Power Up I: Boosts damage by +150% (2.5x), consumed on hit.
   * - Dynamic passives: Executes onCalculateCrit hooks for equipped passives (e.g. Focused).
   * - Burn ailment: Reduces damage dealt by 20%.
   * Returns { damage, isDodged, isCrit, powerUpUsed, isAbsorbed, isImmune, isWeakness, isResisted }.
   */
  attack(target) {
    // 1. Roll for target dodge (1% per 5 LCK)
    const dodgeChance = (target.totalLck / 5) * 0.01;
    if (Math.random() < dodgeChance) {
      return { damage: 0, isDodged: true, isCrit: false, powerUpUsed: false };
    }

    // 2. Base physical damage
    let rawDamage = Math.max(1, this.totalAtk - target.totalDef);

    // 3. Apply Power Up I (+150% damage -> 2.5x)
    let powerUpUsed = false;
    if (this.hasPowerUp) {
      rawDamage = Math.floor(rawDamage * 2.5);
      this.hasPowerUp = false;
      powerUpUsed = true;
    }

    // 4. Burn ailment reduces physical power by 20%
    if (this.currentStatus === 'burn') {
      rawDamage = Math.max(1, Math.floor(rawDamage * 0.8));
    }

    // 5. Roll for critical hit (base 1% per 1 LCK / 5% per 5 LCK + passives)
    let critChance = (this.totalLck / 5) * 0.05;
    for (const passiveId of this.passives) {
      const passive = PASSIVES[passiveId];
      if (passive && typeof passive.onCalculateCrit === 'function') {
        critChance = passive.onCalculateCrit(this, critChance);
      }
    }

    let summonEvent = null;
    const isCrit = Math.random() < critChance;
    if (isCrit) {
      rawDamage = rawDamage * 2;
      for (const passiveId of this.passives) {
        const passive = PASSIVES[passiveId];
        if (passive && typeof passive.onCrit === 'function') {
          const critRes = passive.onCrit(this);
          if (critRes) {
            summonEvent = critRes;
          }
        }
      }
    }

    // 6. Apply damage to target with physical damage type
    const dealtResult = target.takeDamage(rawDamage, false, 'physical');
    const damageNum = typeof dealtResult === 'object' ? dealtResult.damage : dealtResult;

    return {
      damage: damageNum,
      isDodged: false,
      isCrit: isCrit,
      powerUpUsed: powerUpUsed,
      summonEvent: summonEvent,
      isAbsorbed: dealtResult.isAbsorbed || false,
      isImmune: dealtResult.isImmune || false,
      isWeakness: dealtResult.isWeakness || false,
      isResisted: dealtResult.isResisted || false,
    };
  }
}

module.exports = Combatant;

