import type { Card, CardStats, PassiveSkill } from "../types";
import bloomTable from "../data/star5-bloom.json";

export const MAX_BLOOM = 5;
/** Roster default: Bloom 0. gameData stores the current max modeled state. */
export const DEFAULT_BLOOM = 0;

export type Star5BloomEntry = {
  activeLow: number | null;
  activeHigh: number | null;
  activeBonusLow: number | null;
  activeBonusHigh: number | null;
  /** Optional timing changes introduced by Bloom 1. */
  activeIntervalLow?: number | null;
  activeIntervalHigh?: number | null;
  activeDurationLow?: number | null;
  activeDurationHigh?: number | null;
  specialLow: number | null;
  specialHigh: number | null;
  specialSkillRateLow: number | null;
  specialSkillRateHigh: number | null;
  /** Kept for future cards whose Special duration itself changes. */
  specialDurationLow?: number | null;
  specialDurationHigh?: number | null;
  passiveLow: PassiveSkill["effects"];
  passiveHigh: PassiveSkill["effects"];
};

const table = bloomTable as Record<string, Star5BloomEntry>;

/** Match gameData card ids even when source title punctuation differs. */
function canonicalTitleKey(title: string): string {
  return String(title ?? "")
    .normalize("NFKC")
    .replace(/！/g, "!")
    .replace(/％/g, "%")
    .replace(/\s+/g, "")
    .replace(/[''\u2018\u2019‛`´]/g, "")
    .replace(/探求心/g, "探究心")
    .replace(/lion.?s/gi, "lions")
    .toLowerCase();
}

function bloomLookupKey(cardId: string): string {
  const sep = "_5_";
  const i = cardId.indexOf(sep);
  if (i < 0) return cardId;
  return `${cardId.slice(0, i)}${sep}${canonicalTitleKey(cardId.slice(i + sep.length))}`;
}

const tableByLookupKey = new Map<string, Star5BloomEntry>();
for (const [id, entry] of Object.entries(table)) {
  tableByLookupKey.set(bloomLookupKey(id), entry);
}

function scorePassive(effects: PassiveSkill["effects"]): number {
  let s = 0;
  for (const e of effects) {
    if (e.kind === "paramUp") {
      s += e.value * (e.param === "全パラメータ" ? 3 : 1) * (e.target === "self" ? 0.4 : 1);
    }
    if (e.kind === "scoreSupportPassive") s += e.value * 2.5;
  }
  return s;
}

function scaleStats(stats: CardStats, factor: number): CardStats {
  const performance = Math.round(stats.performance * factor);
  const technique = Math.round(stats.technique * factor);
  const sense = Math.round(stats.sense * factor);
  return {
    performance,
    technique,
    sense,
    total: performance + technique + sense,
  };
}

export function getStar5BloomEntry(cardId: string): Star5BloomEntry | null {
  return table[cardId] ?? tableByLookupKey.get(bloomLookupKey(cardId)) ?? null;
}

/**
 * Apply current ★5 Bloom 0–5 progression to a max-modeled gameData card.
 * Community/HolodoriDB progression currently behaves as:
 * 0 base skills → 1 Active upgrade → 2 +10% all stats → 3 Special upgrade
 * → 4 Passive upgrade → 5 Connect/Board upgrade.
 *
 * Connect/Board is not modeled yet, so Bloom 4 and 5 can intentionally score
 * the same in D4C. Stage 5 still returns the committed max-modeled card.
 */
export function applyBloomToCard(card: Card, bloom: number): Card {
  if (card.rarity !== 5) return card;
  const stage = Math.max(0, Math.min(MAX_BLOOM, Math.floor(bloom)));
  if (stage >= MAX_BLOOM) return card;

  const entry = getStar5BloomEntry(card.id);
  if (!entry) return card;

  // gameData stores the post-Bloom-2 stat state. Bloom 0–1 lack the +10% all-stat bonus.
  const stats = card.stats && stage < 2 ? scaleStats(card.stats, 1 / 1.1) : card.stats;

  const activeScoreUp =
    stage >= 1
      ? (entry.activeHigh ?? card.active.scoreUp)
      : (entry.activeLow ?? card.active.scoreUp);
  const activeInterval =
    stage >= 1
      ? (entry.activeIntervalHigh ?? entry.activeIntervalLow ?? card.active.interval)
      : (entry.activeIntervalLow ?? card.active.interval);
  const activeDuration =
    stage >= 1
      ? (entry.activeDurationHigh ?? entry.activeDurationLow ?? card.active.duration)
      : (entry.activeDurationLow ?? card.active.duration);

  let active = {
    ...card.active,
    interval: activeInterval,
    duration: activeDuration,
    scoreUp: activeScoreUp,
  };
  if (card.active.bonus && (entry.activeBonusLow != null || entry.activeBonusHigh != null)) {
    const bonusScoreUp =
      stage >= 1
        ? (entry.activeBonusHigh ?? entry.activeBonusLow ?? card.active.bonus.scoreUp)
        : (entry.activeBonusLow ?? card.active.bonus.scoreUp);
    active = {
      ...active,
      bonus: { ...card.active.bonus, scoreUp: bonusScoreUp ?? active.scoreUp },
    };
  }

  const specialSupport =
    stage >= 3
      ? (entry.specialHigh ?? card.special.scoreSupport)
      : (entry.specialLow ?? card.special.scoreSupport);
  const specialDuration =
    stage >= 3
      ? (entry.specialDurationHigh ?? entry.specialDurationLow ?? card.special.duration)
      : (entry.specialDurationLow ?? card.special.duration);

  let special = { ...card.special, duration: specialDuration, scoreSupport: specialSupport };
  if (entry.specialSkillRateLow != null || entry.specialSkillRateHigh != null) {
    const skillRate =
      stage >= 3
        ? (entry.specialSkillRateHigh ?? entry.specialSkillRateLow ?? card.special.skillRate)
        : (entry.specialSkillRateLow ?? card.special.skillRate);
    special = { ...special, skillRate };
  }

  const passiveEffects =
    stage >= 4
      ? entry.passiveHigh.length
        ? entry.passiveHigh
        : card.passive.effects
      : entry.passiveLow.length
        ? entry.passiveLow
        : card.passive.effects;

  const passive: PassiveSkill = {
    ...card.passive,
    effects: passiveEffects,
    score: scorePassive(passiveEffects),
  };

  return {
    ...card,
    stats,
    active,
    special,
    passive,
  };
}

export function applyBloomMap(cards: Card[], bloomByCardId?: Record<string, number>): Card[] {
  if (!bloomByCardId || !Object.keys(bloomByCardId).length) return cards;
  return cards.map((c) => {
    const bloom = bloomByCardId[c.id];
    if (bloom == null || bloom >= MAX_BLOOM) return c;
    return applyBloomToCard(c, bloom);
  });
}

export function normalizeBloomStage(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_BLOOM;
  return Math.max(0, Math.min(MAX_BLOOM, Math.floor(n)));
}
