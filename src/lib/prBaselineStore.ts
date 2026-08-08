import cacheFile from "../data/prBaselines.json";
import type { TeamEvaluation } from "../types";

export const SHARED_TOP_N = 8;

export type PrTeamCacheEntry = {
  leaderIndex: number;
  cardIds: string[];
  effectiveStatTotal: number;
  coverage: number;
  avgScoreUp: number;
  powerRating?: number;
};

/** @deprecated Use PrTeamCacheEntry — kept for bundled JSON compat. */
export type PrBaselineEntry = PrTeamCacheEntry & { costumeId: string };

type PrCostumeCacheFile = {
  version: number;
  songLength: number;
  poolCardCount: number;
  generatedAt: string | null;
  /** costumeId → top-N team entries (PR order). */
  costumes: Record<string, PrTeamCacheEntry[]>;
};

const bundled = cacheFile as unknown as PrCostumeCacheFile & {
  baselines?: Record<string, PrBaselineEntry>;
};
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

function emptyLocalCache(songLength: number, poolCardCount: number): PrCostumeCacheFile {
  return {
    version: 2,
    songLength,
    poolCardCount,
    generatedAt: null,
    costumes: {},
  };
}

function normalizeBundledTeams(
  songLength: number,
  poolCardCount: number,
): Record<string, PrTeamCacheEntry[]> {
  if (
    bundled.version !== 1 &&
    bundled.version !== 2 &&
    !bundled.baselines &&
    !bundled.costumes
  ) {
    return {};
  }
  if (bundled.songLength !== songLength || bundled.poolCardCount !== poolCardCount) {
    return {};
  }
  if (bundled.costumes && Object.keys(bundled.costumes).length > 0) {
    return bundled.costumes;
  }
  const legacy = bundled.baselines ?? {};
  const out: Record<string, PrTeamCacheEntry[]> = {};
  for (const [costumeId, entry] of Object.entries(legacy)) {
    out[costumeId] = [
      {
        leaderIndex: entry.leaderIndex,
        cardIds: entry.cardIds,
        effectiveStatTotal: entry.effectiveStatTotal,
        coverage: entry.coverage,
        avgScoreUp: entry.avgScoreUp,
      },
    ];
  }
  return out;
}

function readLocalCache(songLength: number, poolCardCount: number): PrCostumeCacheFile {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return emptyLocalCache(songLength, poolCardCount);
    const parsed = JSON.parse(raw) as PrCostumeCacheFile & {
      baselines?: Record<string, PrBaselineEntry>;
    };
    if (parsed.songLength !== songLength || parsed.poolCardCount !== poolCardCount) {
      return emptyLocalCache(songLength, poolCardCount);
    }
    if (parsed.version === 2 && parsed.costumes) {
      return parsed;
    }
    if (parsed.version === 1 && parsed.baselines) {
      const costumes: Record<string, PrTeamCacheEntry[]> = {};
      for (const [id, entry] of Object.entries(parsed.baselines)) {
        costumes[id] = [
          {
            leaderIndex: entry.leaderIndex,
            cardIds: entry.cardIds,
            effectiveStatTotal: entry.effectiveStatTotal,
            coverage: entry.coverage,
            avgScoreUp: entry.avgScoreUp,
          },
        ];
      }
      return { ...parsed, version: 2, costumes };
    }
  } catch {
    /* ignore corrupt local cache */
  }
  return emptyLocalCache(songLength, poolCardCount);
}

export function entryFromTeam(team: TeamEvaluation): PrTeamCacheEntry {
  return {
    leaderIndex: team.leaderIndex,
    cardIds: team.cards.map((c) => c.id),
    effectiveStatTotal: team.effectiveStatTotal,
    coverage: team.coverage,
    avgScoreUp: team.avgScoreUp,
    powerRating: team.powerRating,
  };
}

export function setLocalPrCostumeTop8(
  costumeId: string,
  teams: PrTeamCacheEntry[],
  songLength: number,
  poolCardCount: number,
): void {
  const local = readLocalCache(songLength, poolCardCount);
  local.costumes[costumeId] = teams.slice(0, SHARED_TOP_N);
  local.generatedAt = new Date().toISOString();
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));
}

export function getPrCostumeTop8(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): PrTeamCacheEntry[] | null {
  const bundledTeams = normalizeBundledTeams(songLength, poolCardCount);
  if (bundledTeams[costumeId]?.length) {
    return bundledTeams[costumeId].slice(0, SHARED_TOP_N);
  }
  const local = readLocalCache(songLength, poolCardCount).costumes[costumeId];
  return local?.length ? local.slice(0, SHARED_TOP_N) : null;
}

export function hasPrCostumeCache(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): boolean {
  return (getPrCostumeTop8(costumeId, songLength, poolCardCount)?.length ?? 0) > 0;
}

export function isPrCostumeFullyCached(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): boolean {
  return (getPrCostumeTop8(costumeId, songLength, poolCardCount)?.length ?? 0) >= SHARED_TOP_N;
}

/** First team = PR9999 baseline reference for optimizer. */
export function getPrBaselineEntry(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): (PrTeamCacheEntry & { costumeId: string }) | null {
  const teams = getPrCostumeTop8(costumeId, songLength, poolCardCount);
  if (!teams?.length) return null;
  const unitMax = Math.max(...teams.map((team) => team.effectiveStatTotal));
  const avgMax = Math.max(...teams.map((team) => team.avgScoreUp));
  const coverageMax = Math.max(...teams.map((team) => team.coverage));
  const ratio = (value: number, reference: number) =>
    reference > 1e-9 ? Math.min(Math.max(value / reference, 0), 1) : 1;
  const score = (team: PrTeamCacheEntry) =>
    ratio(team.effectiveStatTotal, unitMax) * 0.50 +
    ratio(team.avgScoreUp, avgMax) * 0.30 +
    ratio(team.coverage, coverageMax) * 0.20;
  const best = [...teams].sort((a, b) => score(b) - score(a))[0];
  return { costumeId, ...best };
}

export function hasPrBaselineEntry(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): boolean {
  return hasPrCostumeCache(costumeId, songLength, poolCardCount);
}

export function prBaselineCacheStats(): { count: number; generatedAt: string | null } {
  const bundledTeams = normalizeBundledTeams(bundled.songLength, bundled.poolCardCount);
  return {
    count: Object.keys(bundledTeams).length,
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

function supabaseRestUrl(query: string): string {
  return `${SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/pr_baselines${query}`;
}

function isMissingTeamsColumn(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const row = err as Record<string, unknown>;
  const code = String(row.code ?? "");
  const message = String(row.message ?? "");
  return code === "42703" || (code === "PGRST204" && message.includes("teams"));
}

async function fetchSharedBaselineRow(
  cacheKey: string,
  headers: HeadersInit,
): Promise<Record<string, unknown> | null> {
  const base = `?cache_key=eq.${encodeURIComponent(cacheKey)}&limit=1`;
  const withTeams = `${base}&select=costume_id,teams,leader_index,card_ids,effective_stat_total,coverage,avg_score_up`;
  const legacy = `${base}&select=costume_id,leader_index,card_ids,effective_stat_total,coverage,avg_score_up`;

  let res = await fetch(supabaseRestUrl(withTeams), { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (!isMissingTeamsColumn(err)) return null;
    res = await fetch(supabaseRestUrl(legacy), { headers });
    if (!res.ok) return null;
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows[0] ?? null;
}

function parseTeamEntry(raw: unknown): PrTeamCacheEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const cardIds = row.card_ids ?? row.cardIds;
  if (!Array.isArray(cardIds) || cardIds.length !== 5) return null;
  return {
    leaderIndex: Number(row.leader_index ?? row.leaderIndex),
    cardIds: cardIds.map(String),
    effectiveStatTotal: Number(row.effective_stat_total ?? row.effectiveStatTotal),
    coverage: Number(row.coverage),
    avgScoreUp: Number(row.avg_score_up ?? row.avgScoreUp),
    powerRating:
      row.power_rating != null || row.powerRating != null
        ? Number(row.power_rating ?? row.powerRating)
        : undefined,
  };
}

function rowToTeams(row: Record<string, unknown>): PrTeamCacheEntry[] | null {
  if (Array.isArray(row.teams) && row.teams.length) {
    const teams = row.teams.map(parseTeamEntry).filter((t): t is PrTeamCacheEntry => !!t);
    return teams.length ? teams.slice(0, SHARED_TOP_N) : null;
  }
  const one = parseTeamEntry(row);
  return one ? [one] : null;
}

/** Pull shared top-8 into localStorage before optimizing. */
export async function syncSharedPrBaseline(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): Promise<boolean> {
  if (isPrCostumeFullyCached(costumeId, songLength, poolCardCount)) return true;
  const headers = remoteHeaders();
  if (!headers) return false;

  const cacheKey = prBaselineCacheKey(costumeId, songLength, poolCardCount);

  try {
    const row = await fetchSharedBaselineRow(cacheKey, headers);
    if (!row) return false;
    const teams = rowToTeams(row);
    if (!teams?.length || row.costume_id !== costumeId) return false;
    setLocalPrCostumeTop8(costumeId, teams, songLength, poolCardCount);
    return true;
  } catch {
    return false;
  }
}

/** Save top-8 once per costume (skip if already fully cached). */
export async function persistSharedPrBaseline(
  teams: TeamEvaluation[],
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): Promise<boolean> {
  if (isPrCostumeFullyCached(costumeId, songLength, poolCardCount)) {
    return false;
  }

  const entries = teams.slice(0, SHARED_TOP_N).map(entryFromTeam);
  if (!entries.length) return false;

  setLocalPrCostumeTop8(costumeId, entries, songLength, poolCardCount);

  const headers = remoteHeaders();
  if (!headers) return true;

  const cacheKey = prBaselineCacheKey(costumeId, songLength, poolCardCount);
  const url = supabaseRestUrl("?on_conflict=cache_key");

  const teamPayload = entries.map((t) => ({
    leader_index: t.leaderIndex,
    card_ids: t.cardIds,
    effective_stat_total: t.effectiveStatTotal,
    coverage: t.coverage,
    avg_score_up: t.avgScoreUp,
    power_rating: t.powerRating ?? null,
  }));

  const body = {
    cache_key: cacheKey,
    costume_id: costumeId,
    song_length: songLength,
    pool_card_count: poolCardCount,
    teams: teamPayload,
    leader_index: entries[0].leaderIndex,
    card_ids: entries[0].cardIds,
    effective_stat_total: entries[0].effectiveStatTotal,
    coverage: entries[0].coverage,
    avg_score_up: entries[0].avgScoreUp,
    updated_at: new Date().toISOString(),
  };

  try {
    let res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (!isMissingTeamsColumn(err)) return false;
      const { teams: _teams, ...legacyBody } = body;
      res = await fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(legacyBody),
      });
    }
    return res.ok;
  } catch {
    return false;
  }
}
