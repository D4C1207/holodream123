import { isConditionMet } from "./conditions";
import type { Card, TeamEvaluation } from "../types";

type TeamConditionContext = Pick<TeamEvaluation, "typeCounts" | "unitCounts">;

export type SpecialOrderMetrics = {
  tier: number;
  skillRate: number;
  conditionalSkillRate: boolean;
  duration: number;
  scoreSupport: number;
  supportPotential: number;
  activeProbability: number;
  activeScoreUp: number;
  activeImpact: number;
  activeSynergy: number;
  priorityScore: number;
};

export type SpecialOrderEntry = SpecialOrderMetrics & {
  card: Card;
  originalIndex: number;
};

function effectiveActiveScoreUp(card: Card, context?: TeamConditionContext): number {
  let scoreUp = Math.max(0, card.active.scoreUp || 0);
  if (
    card.active.bonus &&
    context &&
    isConditionMet(card.active.bonus.condition, context.typeCounts, context.unitCounts)
  ) {
    scoreUp = Math.max(scoreUp, card.active.bonus.scoreUp || 0);
  }
  return scoreUp;
}

/**
 * Approximate expected Active Score UP contribution before overlap handling.
 * Uses interval, duration, probability and the team-satisfied bonus value.
 */
function activeImpact(card: Card, context?: TeamConditionContext): number {
  const interval = Math.max(0, card.active.interval || 0);
  if (interval <= 0) return 0;
  const probability = Math.min(1, Math.max(0, card.active.probability || 0));
  const duration = Math.max(0, card.active.duration || 0);
  return effectiveActiveScoreUp(card, context) * probability * (duration / interval);
}

function teamActiveImpact(cards: Card[], context?: TeamConditionContext): number {
  return cards.reduce((sum, card) => sum + activeImpact(card, context), 0);
}

/**
 * Estimate the extra Active opportunity created while a Skill Rate UP Special is live.
 * We conservatively model “+R% activation rate” as a relative probability uplift,
 * capped at 100%. This is explicitly heuristic because the official probability
 * application rule has not been published.
 */
function skillRateActiveGain(
  cards: Card[],
  skillRate: number,
  specialDuration: number,
  context?: TeamConditionContext,
): number {
  if (skillRate <= 0 || specialDuration <= 0) return 0;
  const rate = skillRate / 100;
  let gain = 0;
  for (const card of cards) {
    const interval = Math.max(0, card.active.interval || 0);
    if (interval <= 0) continue;
    const p0 = Math.min(1, Math.max(0, card.active.probability || 0));
    const p1 = Math.min(1, p0 * (1 + rate));
    const scoreUp = effectiveActiveScoreUp(card, context);
    const activeDuration = Math.max(0, card.active.duration || 0);
    gain += scoreUp * (p1 - p0) * (activeDuration / interval);
  }
  return gain * specialDuration;
}

/**
 * Estimate how much a Score Support Special can amplify the team’s expected Active
 * Score UP activity during its window. This is a comparison signal, not game score.
 */
function scoreSupportActiveGain(
  cards: Card[],
  scoreSupport: number,
  specialDuration: number,
  context?: TeamConditionContext,
): number {
  if (scoreSupport <= 0 || specialDuration <= 0) return 0;
  return teamActiveImpact(cards, context) * (scoreSupport / 100) * specialDuration;
}

/**
 * Experimental #1→#5 ordering signal.
 *
 * Confirmed behavior: each Special Skill activates once and activation order follows
 * formation order. The exact trigger timing and official score formula are not public.
 *
 * Unlike the first version, this model is Active-aware. It uses each Active skill’s
 * interval, probability, duration, Score UP and satisfied bonus condition to estimate
 * how strongly each Special could interact with the team’s Active package.
 *
 * PR and SC are intentionally unchanged by this heuristic.
 */
export function specialOrderMetrics(
  card: Card,
  teamCards: Card[] = [card],
  context?: TeamConditionContext,
): SpecialOrderMetrics {
  const skillRate = Math.max(0, card.special.skillRate || 0);
  const duration = Math.max(0, card.special.duration || 0);
  const scoreSupport = Math.max(0, card.special.scoreSupport || 0);
  const conditionalSkillRate = skillRate > 0 && !!card.special.skillRateCondition;
  const tier = skillRate > 0 ? (conditionalSkillRate ? 1 : 2) : 0;
  const ownActiveImpact = activeImpact(card, context);
  const supportGain = scoreSupportActiveGain(teamCards, scoreSupport, duration, context);
  const rateGain = skillRateActiveGain(teamCards, skillRate, duration, context);
  const conditionalFactor = conditionalSkillRate ? 0.9 : 1;
  const activeSynergy = (supportGain + rateGain) * conditionalFactor;

  // Active synergy drives the recommendation. Own Active value is only a small
  // tie-break signal so two nearly identical Specials do not appear arbitrarily ordered.
  const priorityScore = activeSynergy + ownActiveImpact * 0.1;

  return {
    tier,
    skillRate,
    conditionalSkillRate,
    duration,
    scoreSupport,
    supportPotential: duration * scoreSupport,
    activeProbability: Math.min(1, Math.max(0, card.active.probability || 0)),
    activeScoreUp: effectiveActiveScoreUp(card, context),
    activeImpact: ownActiveImpact,
    activeSynergy,
    priorityScore,
  };
}

export function recommendSpecialOrder(
  cards: Card[],
  context?: TeamConditionContext,
): SpecialOrderEntry[] {
  return cards
    .map((card, originalIndex) => ({
      card,
      originalIndex,
      ...specialOrderMetrics(card, cards, context),
    }))
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      if (b.tier !== a.tier) return b.tier - a.tier;
      if (b.skillRate !== a.skillRate) return b.skillRate - a.skillRate;
      if (b.supportPotential !== a.supportPotential) return b.supportPotential - a.supportPotential;
      if (b.activeImpact !== a.activeImpact) return b.activeImpact - a.activeImpact;
      return a.originalIndex - b.originalIndex;
    });
}

/** Reorder all index-aligned team fields while leaving calculated totals untouched. */
export function applyRecommendedSpecialOrder(team: TeamEvaluation): TeamEvaluation {
  if (team.cards.length !== 5) return team;
  const context: TeamConditionContext = {
    typeCounts: team.typeCounts,
    unitCounts: team.unitCounts,
  };
  const order = recommendSpecialOrder(team.cards, context).map((entry) => entry.originalIndex);
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
