import type { ActiveSkill } from "../types";

/**
 * Community-researched Active activation estimates used by current Holodori
 * optimizer models (reviewed 2026-08-19). These intentionally override the
 * older provisional numeric values embedded in legacy gameData.
 */
export const ACTIVE_PROBABILITY_ESTIMATE: Record<string, number> = {
  高確率: 0.55,
  中確率: 0.46,
  低確率: 0.37,
};

export function activeBaseProbability(active: ActiveSkill): number {
  return ACTIVE_PROBABILITY_ESTIMATE[active.probabilityLabel]
    ?? Math.min(1, Math.max(0, active.probability || 0));
}

/**
 * Skill Rate UP is multiplicative after boosts are added together:
 * base × (1 + totalRateUp/100), capped at 100%.
 * Use only when the relevant Special window/condition is known.
 */
export function activeProbabilityWithSkillRate(
  active: ActiveSkill,
  totalRateUpPct = 0,
): number {
  return Math.min(1, activeBaseProbability(active) * (1 + Math.max(0, totalRateUpPct) / 100));
}
