import { calcScoreUpCoverage } from "./coverage";
import { countTypes, countUnits, isConditionMet, memberUnits } from "./conditions";
import {
  calcEffectiveStats,
  cardBaseParam,
  cardBaseTotal,
  preferredParamFromEffects,
  type ParamKey,
} from "./stats";
import type { Card, Costume, GameData, TeamEvaluation } from "../types";

export interface OptimizeOptions {
  /** Card pool available for building teams. */
  ownedCardIds: Set<string>;
  ownedCostumeIds: Set<string>;
  songLength: number;
  /** If set, only use this member as leader. */
  fixedLeader?: string | null;
  /** If set, only use this costume id. */
  fixedCostumeId?: string | null;
  /** Members that must appear in the team (max 5, including leader if set). */
  fixedMembers?: string[];
  /** Preferred card id per member (optional). */
  preferredCardByMember?: Record<string, string>;
  /** Prefer only these rarities when picking a card per member. Empty = any. */
  rarityFilter?: number[];
  maxResults?: number;
  /**
   * When false, teams with duplicate active Score UP signatures are excluded.
   * Default true.
   */
  allowDuplicateSkills?: boolean;
}

export interface OptimizeResult {
  best: TeamEvaluation | null;
  /** Composite ranking (legacy / default pick). */
  top: TeamEvaluation[];
  /**
   * 最強隊伍：衣裝＋全員被動前提下，
   * 以三圍／覆蓋率／平均 UP 相對基準隊合成 PR 取前 8。
   */
  byOverall: TeamEvaluation[];
  /** Top by effective 三圍 (after costume + all-passives priority). */
  byStats: TeamEvaluation[];
  /** Top by skill coverage (after costume + all-passives priority). */
  byCoverage: TeamEvaluation[];
  /** Top by average Score UP % (after costume + all-passives priority). */
  byAvgScoreUp: TeamEvaluation[];
  /**
   * Unconstrained best under the same captain costume (no wanted members),
   * used as PR = 1000 reference. Null when not applicable.
   */
  baselineTeam: TeamEvaluation | null;
  searched: number;
  elapsedMs: number;
}

/** Active Score UP fingerprint — identical timing/potency = wasted overlap. */
export function activeSkillSignature(card: Card): string {
  const a = card.active;
  const bonus = a.bonus ? String(a.bonus.scoreUp) : "-";
  return `${a.interval}|${a.duration}|${a.scoreUp}|${bonus}|${a.probabilityLabel}`;
}

export function findActiveDuplicates(
  cards: Card[],
): Array<{ members: [string, string]; cardIds: [string, string] }> {
  const bySig = new Map<string, Card[]>();
  for (const c of cards) {
    const sig = activeSkillSignature(c);
    const list = bySig.get(sig) ?? [];
    list.push(c);
    bySig.set(sig, list);
  }
  const pairs: Array<{ members: [string, string]; cardIds: [string, string] }> = [];
  for (const group of bySig.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push({
          members: [group[i].member, group[j].member],
          cardIds: [group[i].id, group[j].id],
        });
      }
    }
  }
  return pairs;
}

function teamKey(ev: TeamEvaluation): string {
  return `${ev.costume.id}|${ev.leaderIndex}|${ev.cards.map((c) => c.id).join(",")}`;
}

function insertByMetric(
  top: TeamEvaluation[],
  candidate: TeamEvaluation,
  max: number,
  scoreOf: (t: TeamEvaluation) => number,
): void {
  const key = teamKey(candidate);
  const next = top.filter((t) => teamKey(t) !== key);
  next.push(candidate);
  next.sort((a, b) => {
    // Always prefer captain costume + all passives before track metrics.
    if (a.costumeSatisfied !== b.costumeSatisfied) return a.costumeSatisfied ? -1 : 1;
    if (a.allPassivesSatisfied !== b.allPassivesSatisfied) return a.allPassivesSatisfied ? -1 : 1;
    const ds = scoreOf(b) - scoreOf(a);
    if (ds !== 0) return ds;
    return compareEval(b, a);
  });
  top.length = 0;
  top.push(...next.slice(0, max));
}

/** Rough balanced score to keep PR candidate pool during search. */
function roughPrSeed(t: TeamEvaluation): number {
  return t.effectiveStatTotal / 250 + t.coverage * 120 + t.avgScoreUp;
}

function minMaxNorm(values: number[], v: number): number {
  if (!values.length) return 0;
  let lo = values[0];
  let hi = values[0];
  for (const x of values) {
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  if (hi - lo < 1e-9) return 1;
  return (v - lo) / (hi - lo);
}

function ratioToBaseline(value: number, base: number): number {
  if (base <= 1e-9) return 1;
  return value / base;
}

/**
 * Build overall PR ranking.
 * When baseline is set (unconstrained best under same costume),
 * PR = mean(stats/base, coverage/base, avgUP/base) × 1000.
 */
function rankByPowerRating(
  pool: TeamEvaluation[],
  max: number,
  baseline: TeamEvaluation | null,
): TeamEvaluation[] {
  if (!pool.length) return [];

  const preferred = pool.filter((t) => t.costumeSatisfied && t.allPassivesSatisfied);
  const use = preferred.length > 0 ? preferred : pool;

  const stats = use.map((t) => t.effectiveStatTotal);
  const cov = use.map((t) => t.coverage);
  const avg = use.map((t) => t.avgScoreUp);

  const scored = use.map((t) => {
    let pr: number;
    if (baseline) {
      const s = ratioToBaseline(t.effectiveStatTotal, baseline.effectiveStatTotal);
      const c = ratioToBaseline(t.coverage, baseline.coverage);
      const a = ratioToBaseline(t.avgScoreUp, baseline.avgScoreUp);
      pr = ((s + c + a) / 3) * 1000;
    } else {
      pr =
        ((minMaxNorm(stats, t.effectiveStatTotal) +
          minMaxNorm(cov, t.coverage) +
          minMaxNorm(avg, t.avgScoreUp)) /
          3) *
        1000;
    }
    return { t, pr };
  });

  scored.sort((a, b) => {
    if (a.t.costumeSatisfied !== b.t.costumeSatisfied) return a.t.costumeSatisfied ? -1 : 1;
    if (a.t.allPassivesSatisfied !== b.t.allPassivesSatisfied) {
      return a.t.allPassivesSatisfied ? -1 : 1;
    }
    if (b.pr !== a.pr) return b.pr - a.pr;
    return compareEval(b.t, a.t);
  });

  return scored.slice(0, max).map(({ t, pr }) => ({
    ...t,
    powerRating: Math.round(pr * 10) / 10,
  }));
}

function pickBaselineTeam(result: OptimizeResult): TeamEvaluation | null {
  const pools = [
    ...result.byOverall,
    ...result.byStats,
    ...result.byCoverage,
    ...result.byAvgScoreUp,
    ...result.top,
  ];
  const ok = pools.filter((t) => t.costumeSatisfied && t.allPassivesSatisfied);
  if (!ok.length) return null;
  return [...ok].sort((a, b) => compareEval(b, a))[0];
}

function emptyResult(started: number): OptimizeResult {
  return {
    best: null,
    top: [],
    byOverall: [],
    byStats: [],
    byCoverage: [],
    byAvgScoreUp: [],
    baselineTeam: null,
    searched: 0,
    elapsedMs: performance.now() - started,
  };
}

function finishResult(
  byStats: TeamEvaluation[],
  byCoverage: TeamEvaluation[],
  byAvgScoreUp: TeamEvaluation[],
  prPool: TeamEvaluation[],
  searched: number,
  started: number,
  trackSize: number,
  baseline: TeamEvaluation | null,
): OptimizeResult {
  const byOverall = rankByPowerRating(prPool, trackSize, baseline);
  const seen = new Set<string>();
  const top: TeamEvaluation[] = [];
  for (const list of [byOverall, byAvgScoreUp, byCoverage, byStats]) {
    for (const t of list) {
      const k = teamKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      top.push(t);
    }
  }
  return {
    best: byOverall[0] ?? byAvgScoreUp[0] ?? byCoverage[0] ?? byStats[0] ?? null,
    top,
    byOverall,
    byStats,
    byCoverage,
    byAvgScoreUp,
    baselineTeam: baseline,
    searched,
    elapsedMs: performance.now() - started,
  };
}

function pickCardForMember(
  cards: Card[],
  rarityFilter?: number[],
  preferredId?: string,
  preferParam: ParamKey | "all" = "all",
): Card | null {
  if (preferredId) {
    const preferred = cards.find((c) => c.id === preferredId);
    if (preferred) return preferred;
  }
  let pool = cards;
  if (rarityFilter && rarityFilter.length > 0) {
    const filtered = cards.filter((c) => rarityFilter.includes(c.rarity));
    if (filtered.length) pool = filtered;
  }
  if (!pool.length) return null;
  return [...pool].sort((a, b) => {
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    const sa = cardBaseParam(a, preferParam);
    const sb = cardBaseParam(b, preferParam);
    if (sb !== sa) return sb - sa;
    const ta = cardBaseTotal(a);
    const tb = cardBaseTotal(b);
    if (tb !== ta) return tb - ta;
    const ca = (a.active.duration / Math.max(1, a.active.interval)) * a.active.scoreUp;
    const cb = (b.active.duration / Math.max(1, b.active.interval)) * b.active.scoreUp;
    if (cb !== ca) return cb - ca;
    return b.passive.score - a.passive.score;
  })[0];
}

function compareEval(a: TeamEvaluation, b: TeamEvaluation): number {
  if (a.costumeSatisfied !== b.costumeSatisfied) return a.costumeSatisfied ? 1 : -1;
  if (a.costumeScore !== b.costumeScore) return a.costumeScore - b.costumeScore;

  if (a.allPassivesSatisfied !== b.allPassivesSatisfied) {
    return a.allPassivesSatisfied ? 1 : -1;
  }
  if (a.passiveScore !== b.passiveScore) return a.passiveScore - b.passiveScore;

  if (a.avgScoreUp !== b.avgScoreUp) return a.avgScoreUp - b.avgScoreUp;
  if (a.coverage !== b.coverage) return a.coverage - b.coverage;

  if (a.scoreSupportWeighted !== b.scoreSupportWeighted) {
    return a.scoreSupportWeighted - b.scoreSupportWeighted;
  }
  if (a.effectiveStatTotal !== b.effectiveStatTotal) {
    return a.effectiveStatTotal - b.effectiveStatTotal;
  }
  if (a.uncoveredSeconds !== b.uncoveredSeconds) {
    return b.uncoveredSeconds - a.uncoveredSeconds; // fewer gaps wins
  }
  return a.baseStatTotal - b.baseStatTotal;
}

export function evaluateTeam(
  cards: Card[],
  leaderIndex: number,
  costume: Costume,
  data: GameData,
  songLength: number,
): TeamEvaluation {
  const typeCounts = countTypes(cards);
  const unitCounts = countUnits(cards, data);
  const costumeSatisfied = isConditionMet(costume.skill.condition, typeCounts, unitCounts);
  const costumeScore = costumeSatisfied ? costume.skill.score : 0;

  const passiveDetails = cards.map((c) => {
    const satisfied = isConditionMet(c.passive.condition, typeCounts, unitCounts);
    return {
      member: c.member,
      satisfied,
      raw: c.passive.raw,
      score: satisfied ? c.passive.score : 0,
    };
  });
  const allPassivesSatisfied = passiveDetails.every((p) => p.satisfied);
  const passiveScore = passiveDetails.reduce((s, p) => s + p.score, 0);

  const actives = cards.map((c) => {
    const bonusOk =
      !!c.active.bonus &&
      isConditionMet(c.active.bonus.condition, typeCounts, unitCounts);
    return {
      interval: c.active.interval,
      duration: c.active.duration,
      scoreUp: bonusOk && c.active.bonus ? c.active.bonus.scoreUp : c.active.scoreUp,
    };
  });

  const {
    coverage,
    timeline,
    avgScoreUp,
    expectedScoreUptime,
    uncoveredGaps,
    uncoveredSeconds,
  } = calcScoreUpCoverage(actives, songLength);

  const stats = calcEffectiveStats(
    cards,
    costume,
    costumeSatisfied,
    passiveDetails.map((p) => p.satisfied),
    data,
  );

  const activeDuplicates = findActiveDuplicates(cards);

  return {
    cards,
    leaderIndex,
    costume,
    costumeSatisfied,
    costumeScore,
    allPassivesSatisfied,
    passiveScore,
    passiveDetails,
    coverage,
    avgScoreUp,
    expectedScoreUptime,
    timeline,
    uncoveredGaps,
    uncoveredSeconds,
    effectiveStatTotal: stats.teamTotal,
    baseStatTotal: stats.baseTotal,
    teamScoreSupportPct: stats.teamScoreSupportPct,
    scoreSupportWeighted: stats.scoreSupportWeighted,
    memberEffectiveStats: stats.members.map((m) => ({
      member: m.member,
      performance: m.effective.performance,
      technique: m.effective.technique,
      sense: m.effective.sense,
      total: m.effective.total,
      bonusPct: m.bonusPct,
      scoreSupportPct: m.scoreSupportPct,
    })),
    typeCounts,
    unitCounts,
    activeDuplicates,
  };
}

function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  const n = arr.length;
  if (k > n || k < 0) return;
  if (k === 0) {
    yield [];
    return;
  }
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => arr[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i -= 1;
    if (i < 0) return;
    idx[i] += 1;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

function insertTop(top: TeamEvaluation[], candidate: TeamEvaluation, max: number) {
  if (top.length < max) {
    top.push(candidate);
    top.sort((a, b) => compareEval(b, a));
    return;
  }
  if (compareEval(candidate, top[top.length - 1]) <= 0) return;
  top[top.length - 1] = candidate;
  top.sort((a, b) => compareEval(b, a));
}

function recordCandidate(
  ev: TeamEvaluation,
  composite: TeamEvaluation[],
  byStats: TeamEvaluation[],
  byCoverage: TeamEvaluation[],
  byAvgScoreUp: TeamEvaluation[],
  prPool: TeamEvaluation[],
  maxComposite: number,
  maxPerTrack: number,
  prPoolSize: number,
  allowDuplicateSkills: boolean,
) {
  if (!allowDuplicateSkills && ev.activeDuplicates.length > 0) return;
  insertTop(composite, ev, maxComposite);
  insertByMetric(byStats, ev, maxPerTrack, (t) => t.effectiveStatTotal);
  insertByMetric(byCoverage, ev, maxPerTrack, (t) => t.coverage);
  insertByMetric(byAvgScoreUp, ev, maxPerTrack, (t) => t.avgScoreUp);
  insertByMetric(prPool, ev, prPoolSize, roughPrSeed);
}

/** Score how useful a member is as filler for a given costume. */
function fillerPriority(
  member: string,
  card: Card,
  costume: Costume,
  data: GameData,
): number {
  const prefer = preferredParamFromEffects(costume.skill.effects);
  let score = cardBaseParam(card, prefer) + cardBaseTotal(card) * 0.15;
  score += card.passive.score * 80;
  score += (card.active.duration / Math.max(1, card.active.interval)) * card.active.scoreUp * 40;

  const cond = costume.skill.condition;
  const units = memberUnits(data.members[member], card);

  if (cond?.type === "unitCount" && units.includes(cond.unit)) {
    // Prefer high relevant-stat members of the conditioned unit (e.g. high Perf 4期生).
    score += 50000 + cardBaseParam(card, prefer) * 2;
  }
  if (cond?.type === "typeCount" && card.type === cond.attr) {
    score += 50000 + cardBaseParam(card, prefer) * 2;
  }

  // Passive group buffs: prefer high-stat members of that group.
  const pGroup = card.passive.effects.find((e) => e.targetGroup)?.targetGroup;
  const pParam = preferredParamFromEffects(card.passive.effects);
  if (pGroup && matchesFillerGroup(card, pGroup, data)) {
    score += cardBaseParam(card, pParam) * 1.5;
  }

  return score;
}

function matchesFillerGroup(card: Card, group: string, data: GameData): boolean {
  if (group === "happy" || group === "pure" || group === "cute") return card.type === group;
  return memberUnits(data.members[card.member], card).includes(group);
}

export function optimizeTeam(data: GameData, options: OptimizeOptions): OptimizeResult {
  const started = performance.now();
  const maxResults = options.maxResults ?? 8;
  const songLength = options.songLength;
  const preferred = options.preferredCardByMember ?? {};
  const allowDup = options.allowDuplicateSkills !== false;
  const wanted = (options.fixedMembers ?? []).filter((m) => m && m !== options.fixedLeader);

  // PR ceiling: strongest team under this costume with no wanted members.
  let baseline: TeamEvaluation | null = null;
  if (options.fixedLeader && options.fixedCostumeId && wanted.length > 0) {
    const free = optimizeTeam(data, {
      ...options,
      fixedMembers: [],
      allowDuplicateSkills: true,
    });
    baseline = free.baselineTeam ?? pickBaselineTeam(free);
  }

  const ownedCards = data.cards.filter((c) => options.ownedCardIds.has(c.id));
  const byMember = new Map<string, Card[]>();
  for (const c of ownedCards) {
    const list = byMember.get(c.member) ?? [];
    list.push(c);
    byMember.set(c.member, list);
  }

  const costumePrefer = options.fixedCostumeId
    ? data.costumes.find((c) => c.id === options.fixedCostumeId)
    : null;
  const preferParam = costumePrefer
    ? preferredParamFromEffects(costumePrefer.skill.effects)
    : ("all" as const);

  const pick = (member: string) =>
    pickCardForMember(
      byMember.get(member) ?? [],
      options.rarityFilter,
      preferred[member],
      preferParam,
    );

  const memberCards = [...byMember.keys()]
    .map((member) => {
      const card = pick(member);
      return card ? { member, card } : null;
    })
    .filter((x): x is { member: string; card: Card } => !!x);

  const ownedCostumes = data.costumes.filter((c) => options.ownedCostumeIds.has(c.id));
  const costumesByMember = new Map<string, Costume[]>();
  for (const c of ownedCostumes) {
    const list = costumesByMember.get(c.member) ?? [];
    list.push(c);
    costumesByMember.set(c.member, list);
  }

  const required = new Set<string>(options.fixedMembers ?? []);
  if (options.fixedLeader) required.add(options.fixedLeader);

  if (required.size > 5) {
    return emptyResult(started);
  }
  for (const m of required) {
    if (!byMember.has(m) || !pick(m)) {
      return emptyResult(started);
    }
  }

  const top: TeamEvaluation[] = [];
  const byStats: TeamEvaluation[] = [];
  const byCoverage: TeamEvaluation[] = [];
  const byAvgScoreUp: TeamEvaluation[] = [];
  const prPool: TeamEvaluation[] = [];
  const maxPerTrack = 8;
  const prPoolSize = 96;
  let searched = 0;

  if (memberCards.length < 5) {
    return emptyResult(started);
  }

  const requiredList = memberCards.filter((m) => required.has(m.member));
  let fillers = memberCards.filter((m) => !required.has(m.member));

  if (costumePrefer) {
    fillers = [...fillers].sort(
      (a, b) =>
        fillerPriority(b.member, b.card, costumePrefer, data) -
        fillerPriority(a.member, a.card, costumePrefer, data),
    );
  } else {
    fillers = [...fillers].sort(
      (a, b) => cardBaseTotal(b.card) - cardBaseTotal(a.card) || b.card.passive.score - a.card.passive.score,
    );
  }

  const need = 5 - requiredList.length;

  for (const fill of combinations(fillers, need)) {
    const combo = [...requiredList, ...fill];

    for (let leaderIndex = 0; leaderIndex < 5; leaderIndex++) {
      const leader = combo[leaderIndex];
      if (options.fixedLeader && leader.member !== options.fixedLeader) continue;

      let costumes = costumesByMember.get(leader.member) ?? [];
      if (options.fixedCostumeId) {
        costumes = costumes.filter((c) => c.id === options.fixedCostumeId);
      }
      if (!costumes.length) continue;

      const sortedCostumes = [...costumes].sort((a, b) => b.skill.score - a.skill.score);
      const teamCards = combo.map((m) => m.card);

      for (const costume of sortedCostumes) {
        const ev = evaluateTeam(teamCards, leaderIndex, costume, data, songLength);
        searched += 1;
        recordCandidate(
          ev,
          top,
          byStats,
          byCoverage,
          byAvgScoreUp,
          prPool,
          maxResults,
          maxPerTrack,
          prPoolSize,
          allowDup,
        );
      }
    }
  }

  const result = finishResult(
    byStats,
    byCoverage,
    byAvgScoreUp,
    prPool,
    searched,
    started,
    maxPerTrack,
    baseline,
  );

  // No wanted members: this search defines the PR baseline.
  if (!baseline && options.fixedLeader && options.fixedCostumeId && wanted.length === 0) {
    const base = pickBaselineTeam(result);
    return finishResult(
      byStats,
      byCoverage,
      byAvgScoreUp,
      prPool,
      searched,
      started,
      maxPerTrack,
      base,
    );
  }

  return result;
}

/** Heuristic for large boxes: seed from strong owned costumes, then fill. */
export function optimizeTeamFast(data: GameData, options: OptimizeOptions): OptimizeResult {
  const ownedCount = new Set(
    data.cards.filter((c) => options.ownedCardIds.has(c.id)).map((c) => c.member),
  ).size;

  const required = new Set<string>(options.fixedMembers ?? []);
  if (options.fixedLeader) required.add(options.fixedLeader);

  // Fixed leader+costume (or small box / multiple locks): full search for absolute track tops.
  if (options.fixedLeader && options.fixedCostumeId) return optimizeTeam(data, options);
  if (ownedCount <= 28 || required.size >= 2) return optimizeTeam(data, options);

  const started = performance.now();
  const maxResults = options.maxResults ?? 8;
  const maxPerTrack = 8;
  const prPoolSize = 96;
  const preferred = options.preferredCardByMember ?? {};
  const allowDup = options.allowDuplicateSkills !== false;
  const ownedCards = data.cards.filter((c) => options.ownedCardIds.has(c.id));
  const byMember = new Map<string, Card[]>();
  for (const c of ownedCards) {
    const list = byMember.get(c.member) ?? [];
    list.push(c);
    byMember.set(c.member, list);
  }

  const pick = (member: string, costume?: Costume | null) =>
    pickCardForMember(
      byMember.get(member) ?? [],
      options.rarityFilter,
      preferred[member],
      costume ? preferredParamFromEffects(costume.skill.effects) : "all",
    );

  const ownedCostumes = data.costumes
    .filter((c) => options.ownedCostumeIds.has(c.id))
    .filter((c) => (options.fixedCostumeId ? c.id === options.fixedCostumeId : true))
    .filter((c) => (options.fixedLeader ? c.member === options.fixedLeader : true))
    .sort((a, b) => b.skill.score - a.skill.score);

  const top: TeamEvaluation[] = [];
  const byStats: TeamEvaluation[] = [];
  const byCoverage: TeamEvaluation[] = [];
  const byAvgScoreUp: TeamEvaluation[] = [];
  const prPool: TeamEvaluation[] = [];
  let searched = 0;
  const members = [...byMember.keys()];

  for (const costume of ownedCostumes.slice(0, 40)) {
    if (required.size && !required.has(costume.member) && options.fixedLeader) continue;
    const leaderCard = pick(costume.member, costume);
    if (!leaderCard) continue;

    const must = [...required].filter((m) => m !== costume.member);
    if (1 + must.length > 5) continue;
    const mustCards = must.map((m) => pick(m, costume)).filter((c): c is Card => !!c);
    if (mustCards.length !== must.length) continue;

    const blocked = new Set([costume.member, ...must]);
    const others = members
      .filter((m) => !blocked.has(m))
      .map((m) => ({ m, card: pick(m, costume)! }))
      .filter((x) => x.card)
      .sort(
        (a, b) =>
          fillerPriority(b.m, b.card, costume, data) - fillerPriority(a.m, a.card, costume, data),
      );

    const need = 4 - mustCards.length;
    // Larger pool so absolute metric tops are less likely to be missed.
    const candidatePool = others.slice(0, Math.max(24, need + 16));
    for (const combo of combinations(candidatePool, need)) {
      const teamCards = [leaderCard, ...mustCards, ...combo.map((c) => c.card)];
      const ev = evaluateTeam(teamCards, 0, costume, data, options.songLength);
      searched += 1;
      recordCandidate(
        ev,
        top,
        byStats,
        byCoverage,
        byAvgScoreUp,
        prPool,
        maxResults,
        maxPerTrack,
        prPoolSize,
        allowDup,
      );
    }
  }

  if (!byStats.length && !byCoverage.length && !byAvgScoreUp.length) {
    return optimizeTeam(data, options);
  }

  return finishResult(
    byStats,
    byCoverage,
    byAvgScoreUp,
    prPool,
    searched,
    started,
    maxPerTrack,
    null,
  );
}
