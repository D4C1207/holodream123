import cacheFile from "../data/prBaselines.json";

export type PrBaselineEntry = {
  costumeId: string;
  leaderIndex: number;
  cardIds: string[];
  effectiveStatTotal: number;
  coverage: number;
  avgScoreUp: number;
};

export type PrBaselineFile = {
  version: number;
  songLength: number;
  poolCardCount: number;
  generatedAt: string | null;
  baselines: Record<string, PrBaselineEntry>;
};

const cache = cacheFile as PrBaselineFile;

/** ★5 + event cards in the optimizer pool (must match cardsForOptimizer). */
export function countOptimizerPoolCards(
  cards: Array<{ rarity: number; event?: string }>,
): number {
  return cards.filter((c) => c.rarity === 5 || !!c.event).length;
}

export function isPrBaselineCacheValid(songLength: number, poolCardCount: number): boolean {
  return (
    cache.version === 1 &&
    cache.songLength === songLength &&
    cache.poolCardCount === poolCardCount &&
    Object.keys(cache.baselines).length > 0
  );
}

export function getPrBaselineEntry(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): PrBaselineEntry | null {
  if (!isPrBaselineCacheValid(songLength, poolCardCount)) return null;
  return cache.baselines[costumeId] ?? null;
}

export function prBaselineCacheStats(): { count: number; generatedAt: string | null } {
  return {
    count: Object.keys(cache.baselines).length,
    generatedAt: cache.generatedAt,
  };
}
