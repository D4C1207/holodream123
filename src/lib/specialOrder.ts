import { isConditionMet } from "./conditions";
import { activeBaseProbability, activeProbabilityWithSkillRate } from "./skillProbability";
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

/** Approximate expected Active contribution before overlap handling. */
function activeImpact(card: Card, context?: TeamConditionContext): number {
  const interval = Math.max(0, card.active.interval || 0);
  if (interval <= 0) return 0;
  const probability = activeBaseProbability(card.active);
  const duration = Math.max(0, card.active.duration || 0);
  return effectiveActiveScoreUp(card, context) * probability * (duration / interval);
}

function teamActiveImpact(cards: Card[], context?: TeamConditionContext): number {
  return cards.reduce((sum, card) => sum + activeImpact(card, context), 0);
}

/**
 * Estimate extra Active opportunity while a Skill Rate UP Special is active.
 * Current community research indicates rate boosts add first, then multiply the
 * base activation chance; this helper applies that rule and caps at 100%.
 */
function skillRateActiveGain(
  cards: Card[],
  skillRate: number,
  specialDuration: number,
  context?: TeamConditionContext,
): number {
  if (skillRate <= 0 || specialDuration <= 0) return 0;
  let gain = 0;
  for (const card of cards) {
    const interval = Math.max(0, card.active.interval || 0);
    if (interval <= 0) continue;
    const p0 = activeBaseProbability(card.active);
    const p1 = activeProbabilityWithSkillRate(card.active, skillRate);
    const scoreUp = effectiveActiveScoreUp(card, context);
    const activeDuration = Math.max(0, card.active.duration || 0);
    gain += scoreUp * (p1 - p0) * (activeDuration / interval);
  }
  return gain * specialDuration;
}

/** Comparison signal for Score Support × expected Active activity. */
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
 * Special Skills activate at five song-specific fixed positions in formation
 * order. Because this tool does not yet load each song's five trigger positions
 * and note-density curve, the exact ordering benefit cannot be simulated.
 * The recommendation therefore compares each Special's researched interaction
 * with the team's Active package: interval, activation probability, duration,
 * Score UP, satisfied bonus conditions, Score Support and Skill Rate UP.
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
  const priorityScore = activeSynergy + ownActiveImpact * 0.1;

  return {
    tier,
    skillRate,
    conditionalSkillRate,
    duration,
    scoreSupport,
    supportPotential: duration * scoreSupport,
    activeProbability: activeBaseProbability(card.active),
    activeScoreUp: effectiveActiveScoreUp(card, context),
    activeImpact: ownActiveImpact,
    activeSynergy,
    priorityScore,
  };
}

/** Team-level Special × Active comparison signal. Not an official score. */
export function teamSpecialSynergy(team: TeamEvaluation): number {
  const context: TeamConditionContext = {
    typeCounts: team.typeCounts,
    unitCounts: team.unitCounts,
  };
  return team.cards.reduce(
    (sum, card) => sum + specialOrderMetrics(card, team.cards, context).activeSynergy,
    0,
  );
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
