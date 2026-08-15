import type { Card, TeamEvaluation } from "../types";

export type SpecialOrderMetrics = {
  tier: number;
  skillRate: number;
  conditionalSkillRate: boolean;
  duration: number;
  scoreSupport: number;
  supportPotential: number;
};

export type SpecialOrderEntry = SpecialOrderMetrics & {
  card: Card;
  originalIndex: number;
};

/**
 * Experimental ordering signal for Special Skills.
 *
 * Confirmed game behavior: each Special Skill activates once and activation order
 * follows the five-member formation order. Exact trigger timing and the official
 * score formula are not public, so this deliberately stays a transparent heuristic:
 *
 * 1) unconditional Skill Rate UP first (may help later skill opportunities),
 * 2) conditional Skill Rate UP next,
 * 3) then larger Score Support × duration potential.
 *
 * This helper does NOT change PR or SC.
 */
export function specialOrderMetrics(card: Card): SpecialOrderMetrics {
  const skillRate = Math.max(0, card.special.skillRate || 0);
  const duration = Math.max(0, card.special.duration || 0);
  const scoreSupport = Math.max(0, card.special.scoreSupport || 0);
  const conditionalSkillRate = skillRate > 0 && !!card.special.skillRateCondition;
  const tier = skillRate > 0 ? (conditionalSkillRate ? 1 : 2) : 0;
  return {
    tier,
    skillRate,
    conditionalSkillRate,
    duration,
    scoreSupport,
    supportPotential: duration * scoreSupport,
  };
}

export function recommendSpecialOrder(cards: Card[]): SpecialOrderEntry[] {
  return cards
    .map((card, originalIndex) => ({
      card,
      originalIndex,
      ...specialOrderMetrics(card),
    }))
    .sort((a, b) => {
      if (b.tier !== a.tier) return b.tier - a.tier;
      if (b.skillRate !== a.skillRate) return b.skillRate - a.skillRate;
      if (b.supportPotential !== a.supportPotential) return b.supportPotential - a.supportPotential;
      if (b.scoreSupport !== a.scoreSupport) return b.scoreSupport - a.scoreSupport;
      if (b.duration !== a.duration) return b.duration - a.duration;
      return a.originalIndex - b.originalIndex;
    });
}

/** Reorder all index-aligned team fields while leaving calculated totals untouched. */
export function applyRecommendedSpecialOrder(team: TeamEvaluation): TeamEvaluation {
  if (team.cards.length !== 5) return team;
  const order = recommendSpecialOrder(team.cards).map((entry) => entry.originalIndex);
  const unchanged = order.every((oldIndex, newIndex) => oldIndex === newIndex);
  if (unchanged) return team;

  const leaderIndex = team.leaderIndex < 0 ? -1 : order.indexOf(team.leaderIndex);
  return {
    ...team,
    cards: order.map((index) => team.cards[index]),
    leaderIndex,
    passiveDetails: order.map((index) => team.passiveDetails[index]),
    memberEffectiveStats: order.map((index) => team.memberEffectiveStats[index]),
  };
}
