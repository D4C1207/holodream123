/**
 * Precompute PR baseline (strongest ★5 team per captain costume).
 * Usage:
 *   npx tsx scripts/precomputePrBaselines.ts              # ★5 + event only (default)
 *   npx tsx scripts/precomputePrBaselines.ts --all        # all 117 costumes incl. ★3/★4
 *   npx tsx scripts/precomputePrBaselines.ts --from=N
 * Writes src/data/prBaselines.json (resumable — skips existing entries).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import gameData from "../src/data/gameData.json";
import { isStar5OrEventCostume } from "../src/lib/costumes";
import { optimizeTeam } from "../src/lib/optimizer";
import { countOptimizerPoolCards } from "../src/lib/prBaselineStore";
import type { Costume, GameData, TeamEvaluation } from "../src/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = gameData as GameData;
const outPath = path.join(__dirname, "../src/data/prBaselines.json");
const SONG_LENGTH = data.songLengthDefault ?? 160;

const allCardIds = new Set(data.cards.map((c) => c.id));
const allCostumeIds = new Set(data.costumes.map((c) => c.id));
const poolCardCount = countOptimizerPoolCards(data.cards);

const runAll = process.argv.includes("--all");
const fromArg = process.argv.find((a) => a.startsWith("--from="));
const fromIndex = fromArg ? Math.max(0, parseInt(fromArg.split("=")[1], 10) || 0) : 0;

type BaselineEntry = {
  costumeId: string;
  leaderIndex: number;
  cardIds: string[];
  effectiveStatTotal: number;
  coverage: number;
  avgScoreUp: number;
};

type CacheFile = {
  version: number;
  songLength: number;
  poolCardCount: number;
  generatedAt: string | null;
  baselines: Record<string, BaselineEntry>;
};

function loadCache(): CacheFile {
  try {
    const raw = fs.readFileSync(outPath, "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    if (
      parsed.version === 1 &&
      parsed.songLength === SONG_LENGTH &&
      parsed.poolCardCount === poolCardCount
    ) {
      return parsed;
    }
  } catch {
    /* fresh run */
  }
  return {
    version: 1,
    songLength: SONG_LENGTH,
    poolCardCount,
    generatedAt: null,
    baselines: {},
  };
}

function saveCache(cache: CacheFile) {
  fs.writeFileSync(outPath, JSON.stringify(cache));
}

function serializeBaseline(team: TeamEvaluation): BaselineEntry {
  return {
    costumeId: team.costume.id,
    leaderIndex: team.leaderIndex,
    cardIds: team.cards.map((c) => c.id),
    effectiveStatTotal: team.effectiveStatTotal,
    coverage: team.coverage,
    avgScoreUp: team.avgScoreUp,
  };
}

function shouldPrecompute(costume: Costume): boolean {
  if (runAll) return true;
  return isStar5OrEventCostume(costume, data.cards);
}

const cache = loadCache();
const queue = data.costumes.filter(shouldPrecompute).slice(fromIndex);
const skippedTier = runAll ? 0 : data.costumes.filter((c) => !shouldPrecompute(c)).length;
const total = queue.length;
let done = queue.filter((c) => cache.baselines[c.id]).length;
const started = performance.now();

console.log(`Pool: ${poolCardCount} ★5/event cards, song ${SONG_LENGTH}s`);
console.log(
  runAll
    ? `Mode: all costumes (${data.costumes.length})`
    : `Mode: ★5 permanent + event only (${total} costumes, skipping ${skippedTier} ★3/★4)`,
);
console.log(`${done} already cached, ${total - done} remaining${fromIndex ? ` (from #${fromIndex})` : ""}\n`);

for (let i = 0; i < queue.length; i++) {
  const costume = queue[i];
  const globalIdx = fromIndex + i + 1;
  if (cache.baselines[costume.id]) {
    console.log(`[${i + 1}/${total}] skip (cached) ${costume.member} / ${costume.costumeName}`);
    continue;
  }

  const t0 = performance.now();
  const out = optimizeTeam(data, {
    ownedCardIds: allCardIds,
    ownedCostumeIds: allCostumeIds,
    songLength: SONG_LENGTH,
    fixedLeader: costume.member,
    fixedCostumeId: costume.id,
    fixedMembers: [],
    maxResults: 8,
    allowDuplicateSkills: true,
  });

  const team = out.baselineTeam;
  if (!team) {
    console.warn(`[${i + 1}/${total}] NO BASELINE ${costume.id}`);
    continue;
  }

  cache.baselines[costume.id] = serializeBaseline(team);
  cache.generatedAt = new Date().toISOString();
  saveCache(cache);
  done += 1;

  const ms = performance.now() - t0;
  console.log(
    `[${i + 1}/${total}] ${costume.member} / ${costume.costumeName} — ${(ms / 1000).toFixed(1)}s (${out.searched.toLocaleString()} teams) PR ref ${Math.round(team.effectiveStatTotal)}/${team.coverage.toFixed(3)}/${team.avgScoreUp.toFixed(1)}`,
  );
}

const elapsed = ((performance.now() - started) / 1000).toFixed(0);
console.log(`\nDone: ${done}/${total} baselines cached in ${elapsed}s`);
console.log(`Saved: ${outPath}`);
