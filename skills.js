/**
 * Skills Catalog for CLI RPG
 * Defines magic spells, physical martial skills (costing % Max HP), and defensive buffs.
 * Supports targetType metadata: 'single', 'all_enemies', 'self'.
 */

const SKILLS = {
  // --- SINGLE-TARGET ELEMENTAL MAGIC (Cost MP) ---
  fire1: {
    id: 'fire1',
    name: 'Fire I',
    mpCost: 8,
    hpCost: 0,
    hpCostPercent: 0,
    type: 'magic',
    damageType: 'fire',
    targetType: 'single',
    description: 'Deals 20 base + M.ATK Fire damage. 25% chance to Burn.',
    execute: (user, target) => {
      const mAtk = user.totalMAtk || user.mAtk;
      const mDef = target.totalMDef || target.mDef;
      const rawDamage = Math.max(1, (20 + mAtk) - mDef);
      const dealt = target.takeDamage(rawDamage, true, 'fire');

      if (dealt.isImmune) {
        return `${user.name} casts Fire I, but ${target.name} is [IMMUNE] to Fire! (0 dmg)`;
      }
      if (dealt.isAbsorbed) {
        return `${user.name} casts Fire I, but ${target.name} [ABSORBED] the flames and recovered ${Math.abs(dealt.damage)} HP!`;
      }

      let statusMsg = "";
      if (target.currentStatus !== 'defend' && !target.isDefending) {
        if (Math.random() < 0.25) {
          target.currentStatus = 'burn';
          statusMsg = ` [BURNING inflicted!]`;
        }
      }

      let resTag = dealt.isWeakness ? " [WEAKNESS HIT!]" : (dealt.isResisted ? " [RESISTED]" : "");
      return `${user.name} casts Fire I dealing ${dealt.damage} fire damage to ${target.name}!${resTag}${statusMsg}`;
    },
  },

  thunder1: {
    id: 'thunder1',
    name: 'Thunder I',
    mpCost: 10,
    hpCost: 0,
    hpCostPercent: 0,
    type: 'magic',
    damageType: 'thunder',
    targetType: 'single',
    description: 'Deals 15 base + M.ATK Thunder damage. 5% chance to Stun.',
    execute: (user, target) => {
      const mAtk = user.totalMAtk || user.mAtk;
      const mDef = target.totalMDef || target.mDef;
      const rawDamage = Math.max(1, (15 + mAtk) - mDef);
      const dealt = target.takeDamage(rawDamage, true, 'thunder');

      if (dealt.isImmune) {
        return `${user.name} casts Thunder I, but ${target.name} is [IMMUNE] to Lightning! (0 dmg)`;
      }
      if (dealt.isAbsorbed) {
        return `${user.name} casts Thunder I, but ${target.name} [ABSORBED] the voltage and recovered ${Math.abs(dealt.damage)} HP!`;
      }

      let statusMsg = "";
      if (target.currentStatus !== 'defend' && !target.isDefending) {
        if (Math.random() < 0.05) {
          target.currentStatus = 'stun';
          statusMsg = ` [STUNNED!]`;
        }
      }

      let resTag = dealt.isWeakness ? " [WEAKNESS HIT!]" : (dealt.isResisted ? " [RESISTED]" : "");
      return `${user.name} casts Thunder I shocking ${target.name} for ${dealt.damage} thunder damage!${resTag}${statusMsg}`;
    },
  },

  ice1: {
    id: 'ice1',
    name: 'Ice I',
    mpCost: 10,
    hpCost: 0,
    hpCostPercent: 0,
    type: 'magic',
    damageType: 'ice',
    targetType: 'single',
    description: 'Deals 15 base + M.ATK Ice damage. 5% chance to Freeze.',
    execute: (user, target) => {
      const mAtk = user.totalMAtk || user.mAtk;
      const mDef = target.totalMDef || target.mDef;
      const rawDamage = Math.max(1, (15 + mAtk) - mDef);
      const dealt = target.takeDamage(rawDamage, true, 'ice');

      if (dealt.isImmune) {
        return `${user.name} casts Ice I, but ${target.name} is [IMMUNE] to Ice! (0 dmg)`;
      }
      if (dealt.isAbsorbed) {
        return `${user.name} casts Ice I, but ${target.name} [ABSORBED] the frost and recovered ${Math.abs(dealt.damage)} HP!`;
      }

      let statusMsg = "";
      if (target.currentStatus !== 'defend' && !target.isDefending) {
        if (target.currentStatus !== 'freeze' && Math.random() < 0.05) {
          target.currentStatus = 'freeze';
          statusMsg = ` [FROZEN solid!]`;
        }
      }

      let resTag = dealt.isWeakness ? " [WEAKNESS HIT!]" : (dealt.isResisted ? " [RESISTED]" : "");
      return `${user.name} casts Ice I freezing ${target.name} for ${dealt.damage} ice damage!${resTag}${statusMsg}`;
    },
  },

  // --- AREA OF EFFECT (AoE) ELEMENTAL MAGIC (Cost MP) ---
  firestorm1: {
    id: 'firestorm1',
    name: 'Firestorm I',
    mpCost: 16,
    hpCost: 0,
    hpCostPercent: 0,
    type: 'magic',
    damageType: 'fire',
    targetType: 'all_enemies',
    description: 'Deals 14 base + M.ATK Fire damage to all foes. 20% chance to Burn.',
    execute: (user, targets) => {
      const mAtk = user.totalMAtk || user.mAtk;
      const targetList = Array.isArray(targets) ? targets : [targets];
      const results = [];

      for (const target of targetList) {
        if (!target.isAlive()) continue;
        const mDef = target.totalMDef || target.mDef;
        const rawDamage = Math.max(1, (14 + mAtk) - mDef);
        const dealt = target.takeDamage(rawDamage, true, 'fire');

        if (dealt.isImmune) {
          results.push(`[IMMUNE] ${target.name} is immune to Fire! (0 dmg)`);
          continue;
        }
        if (dealt.isAbsorbed) {
          results.push(`[ABSORBED] ${target.name} absorbed the flames (+${Math.abs(dealt.damage)} HP)!`);
          continue;
        }

        let statusMsg = "";
        if (target.currentStatus !== 'defend' && !target.isDefending) {
          if (Math.random() < 0.20) {
            target.currentStatus = 'burn';
            statusMsg = " [BURNING!]";
          }
        }
        let resTag = dealt.isWeakness ? " [WEAKNESS!]" : (dealt.isResisted ? " [RESISTED]" : "");
        results.push(`${target.name} takes ${dealt.damage} fire dmg!${resTag}${statusMsg}`);
      }

      return `${user.name} conjures Firestorm I scorching all enemies!\n  -> ${results.join('\n  -> ')}`;
    },
  },

  thunderstorm1: {
    id: 'thunderstorm1',
    name: 'Thunderstorm I',
    mpCost: 18,
    hpCost: 0,
    hpCostPercent: 0,
    type: 'magic',
    damageType: 'thunder',
    targetType: 'all_enemies',
    description: 'Deals 12 base + M.ATK Thunder damage to all foes. 5% chance to Stun.',
    execute: (user, targets) => {
      const mAtk = user.totalMAtk || user.mAtk;
      const targetList = Array.isArray(targets) ? targets : [targets];
      const results = [];

      for (const target of targetList) {
        if (!target.isAlive()) continue;
        const mDef = target.totalMDef || target.mDef;
        const rawDamage = Math.max(1, (12 + mAtk) - mDef);
        const dealt = target.takeDamage(rawDamage, true, 'thunder');

        if (dealt.isImmune) {
          results.push(`[IMMUNE] ${target.name} is immune to Thunder! (0 dmg)`);
          continue;
        }
        if (dealt.isAbsorbed) {
          results.push(`[ABSORBED] ${target.name} absorbed the voltage (+${Math.abs(dealt.damage)} HP)!`);
          continue;
        }

        let statusMsg = "";
        if (target.currentStatus !== 'defend' && !target.isDefending) {
          if (Math.random() < 0.05) {
            target.currentStatus = 'stun';
            statusMsg = " [STUNNED!]";
          }
        }
        let resTag = dealt.isWeakness ? " [WEAKNESS!]" : (dealt.isResisted ? " [RESISTED]" : "");
        results.push(`${target.name} takes ${dealt.damage} thunder dmg!${resTag}${statusMsg}`);
      }

      return `${user.name} summons Thunderstorm I shocking all enemies!\n  -> ${results.join('\n  -> ')}`;
    },
  },

  blizzard1: {
    id: 'blizzard1',
    name: 'Blizzard I',
    mpCost: 18,
    hpCost: 0,
    hpCostPercent: 0,
    type: 'magic',
    damageType: 'ice',
    targetType: 'all_enemies',
    description: 'Deals 12 base + M.ATK Ice damage to all foes. 5% chance to Freeze.',
    execute: (user, targets) => {
      const mAtk = user.totalMAtk || user.mAtk;
      const targetList = Array.isArray(targets) ? targets : [targets];
      const results = [];

      for (const target of targetList) {
        if (!target.isAlive()) continue;
        const mDef = target.totalMDef || target.mDef;
        const rawDamage = Math.max(1, (12 + mAtk) - mDef);
        const dealt = target.takeDamage(rawDamage, true, 'ice');

        if (dealt.isImmune) {
          results.push(`[IMMUNE] ${target.name} is immune to Ice! (0 dmg)`);
          continue;
        }
        if (dealt.isAbsorbed) {
          results.push(`[ABSORBED] ${target.name} absorbed the frost (+${Math.abs(dealt.damage)} HP)!`);
          continue;
        }

        let statusMsg = "";
        if (target.currentStatus !== 'defend' && !target.isDefending) {
          if (target.currentStatus !== 'freeze' && Math.random() < 0.05) {
            target.currentStatus = 'freeze';
            statusMsg = " [FROZEN!]";
          }
        }
        let resTag = dealt.isWeakness ? " [WEAKNESS!]" : (dealt.isResisted ? " [RESISTED]" : "");
        results.push(`${target.name} takes ${dealt.damage} ice dmg!${resTag}${statusMsg}`);
      }

      return `${user.name} unleashes Blizzard I engulfing all enemies in frost!\n  -> ${results.join('\n  -> ')}`;
    },
  },

  // --- PHYSICAL MARTIAL SKILLS (Cost % Max HP) ---
  heavySlash: {
    id: 'heavySlash',
    name: 'Heavy Slash',
    hpCostPercent: 0.10, // 10% Max HP
    hpCost: 0,
    mpCost: 0,
    type: 'physical',
    damageType: 'physical',
    targetType: 'single',
    description: 'Sacrifices 10% Max HP to strike hard (1.8x ATK - DEF).',
    execute: (user, target) => {
      const hpCost = Math.max(1, Math.floor((user.totalMaxHp || user.maxHp) * 0.10));
      if (user.actualHp <= hpCost) {
        return `${user.name} lacks sufficient vitality (${hpCost} HP required) to perform Heavy Slash!`;
      }
      user.actualHp -= hpCost;
      const rawDamage = Math.max(1, Math.floor(user.totalAtk * 1.8) - target.totalDef);
      const res = target.takeDamage(rawDamage, false, 'physical');

      if (res.isImmune) {
        return `${user.name} sacrificed ${hpCost} HP for Heavy Slash, but ${target.name} is [IMMUNE] to physical damage!`;
      }
      if (res.isAbsorbed) {
        return `${user.name} sacrificed ${hpCost} HP for Heavy Slash, but ${target.name} [ABSORBED] the kinetic force and recovered ${Math.abs(res.damage)} HP!`;
      }

      let tag = res.isWeakness ? " [WEAKNESS HIT!]" : (res.isResisted ? " [RESISTED]" : "");
      return `${user.name} sacrificed ${hpCost} HP and unleashed Heavy Slash dealing ${res.damage} damage to ${target.name}!${tag}`;
    },
  },

  armorBreak: {
    id: 'armorBreak',
    name: 'Armor Break',
    hpCostPercent: 0.08, // 8% Max HP
    hpCost: 0,
    mpCost: 0,
    type: 'physical',
    damageType: 'physical',
    targetType: 'single',
    description: 'Sacrifices 8% Max HP to strike (1.2x ATK - DEF) and shatter DEF for 3 turns.',
    execute: (user, target) => {
      const hpCost = Math.max(1, Math.floor((user.totalMaxHp || user.maxHp) * 0.08));
      if (user.actualHp <= hpCost) {
        return `${user.name} lacks sufficient vitality (${hpCost} HP required) to perform Armor Break!`;
      }
      user.actualHp -= hpCost;
      const rawDamage = Math.max(1, Math.floor(user.totalAtk * 1.2) - target.totalDef);
      const res = target.takeDamage(rawDamage, false, 'physical');
      target.armorBreakTurns = 3;

      if (res.isImmune) {
        return `${user.name} sacrificed ${hpCost} HP for Armor Break, but ${target.name} is [IMMUNE]! [DEF shattered for 3 turns!]`;
      }
      if (res.isAbsorbed) {
        return `${user.name} sacrificed ${hpCost} HP for Armor Break, but ${target.name} [ABSORBED] the impact (+${Math.abs(res.damage)} HP)! [DEF shattered for 3 turns!]`;
      }

      let tag = res.isWeakness ? " [WEAKNESS HIT!]" : (res.isResisted ? " [RESISTED]" : "");
      return `${user.name} sacrificed ${hpCost} HP and struck with Armor Break dealing ${res.damage} damage!${tag} [${target.name}'s DEF shattered for 3 turns!]`;
    },
  },

  quickStrike: {
    id: 'quickStrike',
    name: 'Quick Strike',
    hpCostPercent: 0.05, // 5% Max HP
    hpCost: 0,
    mpCost: 0,
    type: 'physical',
    damageType: 'physical',
    targetType: 'single',
    description: 'Sacrifices 5% Max HP for a swift strike (ATK + 0.8x SPD - DEF).',
    execute: (user, target) => {
      const hpCost = Math.max(1, Math.floor((user.totalMaxHp || user.maxHp) * 0.05));
      if (user.actualHp <= hpCost) {
        return `${user.name} lacks sufficient vitality (${hpCost} HP required) to perform Quick Strike!`;
      }
      user.actualHp -= hpCost;
      const rawDamage = Math.max(1, (user.totalAtk + Math.floor(user.totalSpd * 0.8)) - target.totalDef);
      const res = target.takeDamage(rawDamage, false, 'physical');

      if (res.isImmune) {
        return `${user.name} sacrificed ${hpCost} HP for Quick Strike, but ${target.name} is [IMMUNE]! (0 dmg)`;
      }
      if (res.isAbsorbed) {
        return `${user.name} sacrificed ${hpCost} HP for Quick Strike, but ${target.name} [ABSORBED] the thrust (+${Math.abs(res.damage)} HP)!`;
      }

      let tag = res.isWeakness ? " [WEAKNESS HIT!]" : (res.isResisted ? " [RESISTED]" : "");
      return `${user.name} sacrificed ${hpCost} HP and executed Quick Strike dealing ${res.damage} damage to ${target.name}!${tag}`;
    },
  },

  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind',
    hpCostPercent: 0.14, // 14% Max HP (2x baseline martial cost)
    hpCost: 0,
    mpCost: 0,
    type: 'physical',
    damageType: 'physical',
    targetType: 'all_enemies',
    description: 'Sacrifices 14% Max HP to strike all foes (0.9x ATK - DEF).',
    execute: (user, targets) => {
      const hpCost = Math.max(1, Math.floor((user.totalMaxHp || user.maxHp) * 0.14));
      if (user.actualHp <= hpCost) {
        return `${user.name} lacks sufficient vitality (${hpCost} HP required) to perform Whirlwind!`;
      }
      user.actualHp -= hpCost;

      const targetList = Array.isArray(targets) ? targets : [targets];
      const results = [];

      for (const target of targetList) {
        if (!target.isAlive()) continue;
        const rawDamage = Math.max(1, Math.floor(user.totalAtk * 0.9) - target.totalDef);
        const res = target.takeDamage(rawDamage, false, 'physical');

        if (res.isImmune) {
          results.push(`[IMMUNE] ${target.name} is immune to physical damage!`);
        } else if (res.isAbsorbed) {
          results.push(`[ABSORBED] ${target.name} absorbed kinetic force (+${Math.abs(res.damage)} HP)!`);
        } else {
          let tag = res.isWeakness ? " [WEAKNESS!]" : (res.isResisted ? " [RESISTED]" : "");
          results.push(`${target.name} takes ${res.damage} damage!${tag}`);
        }
      }

      return `${user.name} sacrificed ${hpCost} HP (14%) and unleashes a spinning Whirlwind!\n  -> ${results.join('\n  -> ')}`;
    },
  },

  // --- RECOVERY & BUFF SPELLS (Cost MP) ---
  heal1: {
    id: 'heal1',
    name: 'Heal I',
    mpCost: 6,
    hpCost: 0,
    hpCostPercent: 0,
    type: 'heal',
    targetType: 'self',
    description: 'Restores 25 + (M.ATK * 2) HP to the caster.',
    execute: (user) => {
      const mAtk = user.totalMAtk || user.mAtk;
      const healAmount = 25 + (mAtk * 2);
      const prevHp = user.actualHp;
      user.actualHp = Math.min(user.totalMaxHp || user.maxHp, user.actualHp + healAmount);
      const healed = user.actualHp - prevHp;
      return `${user.name} casts Heal I and recovers ${healed} HP! (${user.actualHp}/${user.totalMaxHp || user.maxHp})`;
    },
  },

  protect1: {
    id: 'protect1',
    name: 'Protect I',
    mpCost: 8,
    hpCost: 0,
    hpCostPercent: 0,
    type: 'buff',
    targetType: 'self',
    description: 'Grants a 3-turn buff reducing physical damage taken by 25%.',
    execute: (user) => {
      user.protectTurns = 3;
      return `${user.name} casts Protect I! A shimmering barrier reduces physical damage by 25% for 3 turns.`;
    },
  },

  powerup1: {
    id: 'powerup1',
    name: 'Power Up I',
    mpCost: 8,
    hpCost: 0,
    hpCostPercent: 0,
    type: 'buff',
    targetType: 'self',
    description: 'Focuses power, boosting the NEXT normal attack by +150% (2.5x).',
    execute: (user) => {
      user.hasPowerUp = true;
      return `${user.name} gathers intense energy! Next normal attack will deal 250% damage!`;
    },
  },
};

/**
 * Skill learning progression table mapped by class archetype and level milestones.
 * Both paths converge by Level 10 so high-level characters master the complete arsenal.
 */
const SKILL_PROGRESSION = {
  warrior: {
    1: ['quickStrike', 'heavySlash'],
    2: ['protect1'],
    3: ['armorBreak'],
    4: ['powerup1'],
    5: ['whirlwind'],
    6: ['ice1', 'thunder1'],
    7: ['heal1'],
    8: ['fire1'],
    9: ['firestorm1', 'blizzard1'],
    10: ['thunderstorm1'],
  },
  mage: {
    1: ['fire1', 'heal1'],
    2: ['ice1', 'protect1'],
    3: ['thunder1'],
    4: ['powerup1'],
    5: ['firestorm1'],
    6: ['blizzard1', 'thunderstorm1'],
    7: ['quickStrike', 'heavySlash'],
    8: ['armorBreak'],
    9: ['whirlwind'],
    10: ['whirlwind'], // All mastered
  },
};

/**
 * Returns an array of skill IDs unlocked at a specific level for the given archetype.
 * @param {string} archetype - 'warrior' or 'mage'
 * @param {number} level - Hero level
 * @returns {string[]}
 */
function getSkillsForLevel(archetype, level) {
  const table = SKILL_PROGRESSION[archetype] || SKILL_PROGRESSION.warrior;
  return table[level] || [];
}

module.exports = {
  SKILLS,
  SKILL_PROGRESSION,
  getSkillsForLevel,
};
