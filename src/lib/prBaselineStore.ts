import cacheFile from "../data/prBaselines.json";
import type { TeamEvaluation } from "../types";

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

const bundled = cacheFile as PrBaselineFile;
const LOCAL_STORAGE_KEY = "holodream-pr-baselines";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** ★5 + event cards in the optimizer pool (must match cardsForOptimizer). */
export function countOptimizerPoolCards(
  cards: Array<{ rarity: number; event?: string }>,
): number {
  return cards.filter((c) => c.rarity === 5 || !!c.event).length;
}

export function prBaselineCacheKey(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): string {
  return `${songLength}\u001f${poolCardCount}\u001f${costumeId}`;
}

export function sharedPrBaselineEnabled(): boolean {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function emptyLocalCache(songLength: number, poolCardCount: number): PrBaselineFile {
  return {
    version: 1,
    songLength,
    poolCardCount,
    generatedAt: null,
    baselines: {},
  };
}

function readLocalCache(songLength: number, poolCardCount: number): PrBaselineFile {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return emptyLocalCache(songLength, poolCardCount);
    const parsed = JSON.parse(raw) as PrBaselineFile;
    if (
      parsed.version === 1 &&
      parsed.songLength === songLength &&
      parsed.poolCardCount === poolCardCount &&
      parsed.baselines
    ) {
      return parsed;
    }
  } catch {
    /* ignore corrupt local cache */
  }
  return emptyLocalCache(songLength, poolCardCount);
}

export function entryFromTeam(team: TeamEvaluation): PrBaselineEntry {
  return {
    costumeId: team.costume.id,
    leaderIndex: team.leaderIndex,
    cardIds: team.cards.map((c) => c.id),
    effectiveStatTotal: team.effectiveStatTotal,
    coverage: team.coverage,
    avgScoreUp: team.avgScoreUp,
  };
}

export function setLocalPrBaselineEntry(
  entry: PrBaselineEntry,
  songLength: number,
  poolCardCount: number,
): void {
  const local = readLocalCache(songLength, poolCardCount);
  local.baselines[entry.costumeId] = entry;
  local.generatedAt = new Date().toISOString();
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
}

function isBundledCacheValid(songLength: number, poolCardCount: number): boolean {
  return (
    bundled.version === 1 &&
    bundled.songLength === songLength &&
    bundled.poolCardCount === poolCardCount &&
    Object.keys(bundled.baselines).length > 0
  );
}

export function getPrBaselineEntry(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): PrBaselineEntry | null {
  if (isBundledCacheValid(songLength, poolCardCount)) {
    const hit = bundled.baselines[costumeId];
    if (hit) return hit;
  }
  return readLocalCache(songLength, poolCardCount).baselines[costumeId] ?? null;
}

export function prBaselineCacheStats(): { count: number; generatedAt: string | null } {
  const bundledCount = isBundledCacheValid(bundled.songLength, bundled.poolCardCount)
    ? Object.keys(bundled.baselines).length
    : 0;
  return {
    count: bundledCount,
    generatedAt: bundled.generatedAt,
  };
}

function remoteHeaders(): HeadersInit | null {
  if (!sharedPrBaselineEnabled()) return null;
  return {
    apikey: SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
    "Content-Type": "application/json",
  };
}

function rowToEntry(row: Record<string, unknown>): PrBaselineEntry | null {
  const cardIds = row.card_ids;
  if (!Array.isArray(cardIds) || cardIds.length !== 5) return null;
  if (typeof row.costume_id !== "string") return null;
  return {
    costumeId: row.costume_id,
    leaderIndex: Number(row.leader_index),
    cardIds: cardIds.map(String),
    effectiveStatTotal: Number(row.effective_stat_total),
    coverage: Number(row.coverage),
    avgScoreUp: Number(row.avg_score_up),
  };
}

/** Pull a shared baseline into localStorage before optimizing. */
export async function syncSharedPrBaseline(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): Promise<boolean> {
  if (getPrBaselineEntry(costumeId, songLength, poolCardCount)) return true;
  const headers = remoteHeaders();
  if (!headers) return false;

  const cacheKey = prBaselineCacheKey(costumeId, songLength, poolCardCount);
  const url = `${SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/pr_baselines?cache_key=eq.${encodeURIComponent(cacheKey)}&select=costume_id,leader_index,card_ids,effective_stat_total,coverage,avg_score_up&limit=1`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return false;
    const rows = (await res.json()) as Record<string, unknown>[];
    const entry = rows.length ? rowToEntry(rows[0]) : null;
    if (!entry || entry.costumeId !== costumeId) return false;
    setLocalPrBaselineEntry(entry, songLength, poolCardCount);
    return true;
  } catch {
    return false;
  }
}

/** Save a freshly computed baseline locally and share it for other visitors. */
export async function persistSharedPrBaseline(
  team: TeamEvaluation,
  songLength: number,
  poolCardCount: number,
): Promise<void> {
  const entry = entryFromTeam(team);
  setLocalPrBaselineEntry(entry, songLength, poolCardCount);

  const headers = remoteHeaders();
  if (!headers) return;

  const cacheKey = prBaselineCacheKey(entry.costumeId, songLength, poolCardCount);
  const url = `${SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/pr_baselines?on_conflict=cache_key`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        cache_key: cacheKey,
        costume_id: entry.costumeId,
        song_length: songLength,
        pool_card_count: poolCardCount,
        leader_index: entry.leaderIndex,
        card_ids: entry.cardIds,
        effective_stat_total: entry.effectiveStatTotal,
        coverage: entry.coverage,
        avg_score_up: entry.avgScoreUp,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    /* sharing is best-effort */
  }
}
