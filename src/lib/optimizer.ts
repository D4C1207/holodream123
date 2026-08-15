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
import { applyRecommendedSpecialOrder } from "./specialOrder";
import {
  countOptimizerPoolCards,
  getPrBaselineEntry,
} from "./prBaselineStore";

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
  /** Members allowed in the 5-slot lineup (captain may be off-team). Omit = all ★5/event cards. */
  memberPool?: string[];
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
   * Unconstrained best under the same captain costume (no wanted members, full card pool),
   * scored as PR_MAX (9999). Null when not applicable.
   */
  baselineTeam: TeamEvaluation | null;
  searched: number;
  elapsedMs: number;
}

/** Build optimizer UI result from cached top-N teams (skips search). */
export function buildOptimizeResultFromCache(byOverall: TeamEvaluation[]): OptimizeResult {
  const cached = byOverall.slice(0, 8);
  // Cached teams may carry PR values from an older scoring revision. Always
  // re-score the hydrated candidates with the current ratio-to-best formula.
  const top = rankByPowerRating(cached, 8, null).map(applyRecommendedSpecialOrder);
  const byStats = [...top].sort((a, b) => b.effectiveStatTotal - a.effectiveStatTotal);
  const byCoverage = [...top].sort((a, b) => b.coverage - a.coverage);
  const byAvgScoreUp = [...top].sort((a, b) => b.avgScoreUp - a.avgScoreUp);
  const baselineTeam = top.find((t) => t.powerRating === 9999) ?? top[0] ?? null;
  return {
    best: top[0] ?? null,
    top,
    byOverall: top,
    byStats: byStats.slice(0, 8),
    byCoverage: byCoverage.slice(0, 8),
    byAvgScoreUp: byAvgScoreUp.slice(0, 8),
    baselineTeam,
    searched: 0,
    elapsedMs: 0,
  };
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

/** Same Hololive member cannot occupy two lineup slots (e.g. permanent + event ★5). */
export function hasDuplicateMembers(cards: Card[]): boolean {
  const seen = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.member)) return true;
    seen.add(c.member);
  }
  return false;
}

function comboHasDuplicateMembers(slots: MemberCardSlot[]): boolean {
  const seen = new Set<string>();
  for (const s of slots) {
    if (seen.has(s.member)) return true;
    seen.add(s.member);
  }
  return false;
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

/** Strongest unconstrained team under selected costume = this PR; all others scale relative to it. */
const PR_MAX = 9999;
function cardsForOptimizer(data: GameData, ownedCardIds: Set<string>): Card[] {
  return data.cards.filter(
    (c) => ownedCardIds.has(c.id) && (c.rarity === 5 || !!c.event),
  );
}

/** PR baseline search: no wanted members, ★5 + event card pool. */
function baselineSearchOptions(options: OptimizeOptions): OptimizeOptions {
  return {
    ...options,
    fixedMembers: [],
    preferredCardByMember: {},
    memberPool: undefined,
    allowDuplicateSkills: true,
  };
}

function fullOptimizerPoolIds(data: GameData): Set<string> {
  return new Set(
    data.cards.filter((c) => c.rarity === 5 || !!c.event).map((c) => c.id),
  );
}

function fullOptimizerCostumeIds(data: GameData): Set<string> {
  return new Set(data.costumes.map((c) => c.id));
}

function computePrBaselineTeam(data: GameData, options: OptimizeOptions): TeamEvaluation | null {
  if (!options.fixedLeader || !options.fixedCostumeId) return null;
  const fullPoolCount = countOptimizerPoolCards(data.cards);
  const cached = hydratePrBaseline(
    data,
    getPrBaselineEntry(options.fixedCostumeId, options.songLength, fullPoolCount),
    options.songLength,
  );
  if (cached) return { ...cached, powerRating: PR_MAX };
  const free = optimizeTeam(data, {
    ...baselineSearchOptions(options),
    ownedCardIds: fullOptimizerPoolIds(data),
    ownedCostumeIds: fullOptimizerCostumeIds(data),
  });
  const baseline = free.baselineTeam ?? pickBaselineTeam(free);
  return baseline ? { ...baseline, powerRating: PR_MAX } : null;
}

function applyMemberPool(byMember: Map<string, Card[]>, memberPool?: string[]) {
  if (!memberPool?.length) return;
  const allowed = new Set(memberPool);
  for (const key of [...byMember.keys()]) {
    if (!allowed.has(key)) byMember.delete(key);
  }
}

function hydratePrBaseline(
  data: GameData,
  entry: { costumeId: string; leaderIndex: number; cardIds: string[] } | null,
  songLength: number,
): TeamEvaluation | null {
  if (!entry) return null;
  const costume = data.costumes.find((c) => c.id === entry.costumeId);
  if (!costume) return null;
  const cards: Card[] = [];
  for (const id of entry.cardIds) {
    const card = data.cards.find((c) => c.id === id);
    if (!card) return null;
    cards.push(card);
  }
  if (cards.length !== 5) return null;
  if (hasDuplicateMembers(cards)) return null;
  return evaluateTeam(cards, entry.leaderIndex, costume, data, songLength);
}

/** Restore cached top-N teams for one captain costume. */
export function hydratePrCostumeTop8(
  data: GameData,
  entries: Array<{ leaderIndex: number; cardIds: string[]; powerRating?: number }>,
  costumeId: string,
  songLength: number,
): TeamEvaluation[] {
  const out: TeamEvaluation[] = [];
  for (const entry of entries) {
    const ev = hydratePrBaseline(
      data,
      { costumeId, leaderIndex: entry.leaderIndex, cardIds: entry.cardIds },
      songLength,
    );
    if (!ev) continue;
    out.push({
      ...ev,
      powerRating: entry.powerRating ?? ev.powerRating,
    });
  }
  return out;
}

function isSameTeam(a: TeamEvaluation, b: TeamEvaluation): boolean {
  return teamKey(a) === teamKey(b);
}

/** Rough balanced score to keep PR candidate pool during search. */
function roughPrSeed(t: TeamEvaluation): number {
  return t.effectiveStatTotal / 250 + t.coverage * 120 + t.avgScoreUp;
}

const PR_WEIGHT_UNIT = 0.50;
const PR_WEIGHT_AVG_UP = 0.30;
const PR_WEIGHT_COVERAGE = 0.20;

function ratioToReference(value: number, reference: number): number {
  if (reference <= 1e-9) return 1;
  return Math.min(Math.max(value / reference, 0), 1);
}

function prCompletion(
  team: TeamEvaluation,
  unitRef: number,
  avgRef: number,
  coverageRef: number,
): number {
  return (
    ratioToReference(team.effectiveStatTotal, unitRef) * PR_WEIGHT_UNIT +
    ratioToReference(team.avgScoreUp, avgRef) * PR_WEIGHT_AVG_UP +
    ratioToReference(team.coverage, coverageRef) * PR_WEIGHT_COVERAGE
  );
}

/**
 * Build overall PR ranking.
 * When baseline is set (unconstrained best under same costume),
 * PR = weighted completion vs best references: Unit 50% / Avg UP 30% / Coverage 20%.
 */
function rankByPowerRating(
  pool: TeamEvaluation[],
  max: number,
  baseline: TeamEvaluation | null,
): TeamEvaluation[] {
  if (!pool.length) return [];

  const preferred = pool.filter((t) => t.costumeSatisfied && t.allPassivesSatisfied);
  const use = preferred.length > 0 ? preferred : pool;

  // PR is a completion score, not a min-max rank. Each component is measured
  // against the best reference value, so the weakest candidate never becomes
  // an artificial zero just because it happened to be last in this search.
  const unitRef = baseline?.effectiveStatTotal ?? Math.max(...use.map((t) => t.effectiveStatTotal));
  const avgRef = baseline?.avgScoreUp ?? Math.max(...use.map((t) => t.avgScoreUp));
  const coverageRef = baseline?.coverage ?? Math.max(...use.map((t) => t.coverage));

  const raw = use.map((t) => ({
    t,
    completion: prCompletion(t, unitRef, avgRef, coverageRef),
  }));

  // With no external baseline, scale the best weighted completion to PR 9999.
  // With an explicit unconstrained baseline, 9999 stays reserved for that baseline.
  const bestCompletion = baseline
    ? 1
    : Math.max(1e-9, ...raw.map((item) => item.completion));

  const scored = raw.map(({ t, completion }) => {
    let pr = (completion / bestCompletion) * PR_MAX;
    if (baseline && isSameTeam(t, baseline)) pr = PR_MAX;
    if (baseline && !isSameTeam(t, baseline)) pr = Math.min(pr, PR_MAX - 1);
    pr = Math.min(Math.max(pr, 0), PR_MAX);
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
    powerRating: Math.floor(pr),
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
  const byOverall = rankByPowerRating(prPool, trackSize, baseline).map(applyRecommendedSpecialOrder);
  const orderedByStats = byStats.map(applyRecommendedSpecialOrder);
  const orderedByCoverage = byCoverage.map(applyRecommendedSpecialOrder);
  const orderedByAvgScoreUp = byAvgScoreUp.map(applyRecommendedSpecialOrder);
  const orderedBaseline = baseline ? applyRecommendedSpecialOrder(baseline) : null;
  const seen = new Set<string>();
  const top: TeamEvaluation[] = [];
  for (const list of [byOverall, orderedByAvgScoreUp, orderedByCoverage, orderedByStats]) {
    for (const t of list) {
      const k = teamKey(t);
      if (seen.has(k)) continue;
      seen.add(k);
      top.push(t);
    }
  }
  return {
    best: byOverall[0] ?? orderedByAvgScoreUp[0] ?? orderedByCoverage[0] ?? orderedByStats[0] ?? null,
    top,
    byOverall,
    byStats: orderedByStats,
    byCoverage: orderedByCoverage,
    byAvgScoreUp: orderedByAvgScoreUp,
    baselineTeam: orderedBaseline,
    searched,
    elapsedMs: performance.now() - started,
  };
}

type MemberCardSlot = { member: string; cards: Card[] };

function buildMemberSlots(
  byMember: Map<string, Card[]>,
  preferred: Record<string, string>,
  required: Set<string> = new Set(),
): MemberCardSlot[] {
  return [...byMember.keys()]
    .map((member) => {
      const all = byMember.get(member) ?? [];
      if (!all.length) return null;
      const preferredId = preferred[member];
      if (preferredId) {
        const one = all.find((c) => c.id === preferredId);
        return one ? { member, cards: [one] } : null;
      }
      // Locked / single-card members: one slot (enumerate variants if multiple cards).
      if (all.length === 1 || required.has(member)) {
        return { member, cards: all };
      }
      // Optional multi-★5: one slot per owned card; duplicate-member combos filtered later.
      return all.map((card) => ({ member, cards: [card] }));
    })
    .flat()
    .filter((x): x is MemberCardSlot => !!x);
}

function enumerateCardTeams(slots: MemberCardSlot[]): Card[][] {
  const out: Card[][] = [];
  const cur: Card[] = [];
  function go(i: number) {
    if (i === slots.length) {
      out.push([...cur]);
      return;
    }
    for (const card of slots[i].cards) {
      cur.push(card);
      go(i + 1);
      cur.pop();
    }
  }
  go(0);
  return out;
}

function slotFillerPriority(
  slot: MemberCardSlot,
  costume: Costume,
  data: GameData,
  preferParam: ParamKey | "all",
  preferred: Record<string, string>,
): number {
  const card = pickCardForMember(slot.cards, undefined, preferred[slot.member], preferParam);
  return card ? fillerPriority(slot.member, card, costume, data) : 0;
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
  if (hasDuplicateMembers(ev.cards)) return;
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

/** Max filler candidates when enumerating 5-member lineups (~C(28,5) ≈ 98k teams). */
const FIXED_COSTUME_FILLER_POOL = 32;

/**
 * Fast search with a fixed captain costume. Captain need not be in the 5-member lineup.
 * Prunes to top filler candidates instead of full C(n,5) enumeration.
 */
export function optimizeTeamFixedCostume(data: GameData, options: OptimizeOptions): OptimizeResult {
  const started = performance.now();
  const maxResults = options.maxResults ?? 8;
  const maxPerTrack = 8;
  const prPoolSize = 96;
  const songLength = options.songLength;
  const preferred = options.preferredCardByMember ?? {};
  const allowDup = options.allowDuplicateSkills !== false;
  const wanted = (options.fixedMembers ?? []).filter((m) => m && m !== options.fixedLeader);

  const costume = options.fixedCostumeId
    ? data.costumes.find((c) => c.id === options.fixedCostumeId)
    : null;
  if (!costume) return emptyResult(started);

  let baseline: TeamEvaluation | null = null;
  if (options.fixedCostumeId && options.fixedLeader) {
    if (wanted.length > 0 || (options.memberPool?.length ?? 0) > 0) {
      baseline = computePrBaselineTeam(data, options);
    }
  }

  const preferParam = preferredParamFromEffects(costume.skill.effects);
  const ownedCards = cardsForOptimizer(data, options.ownedCardIds);
  const byMember = new Map<string, Card[]>();
  for (const c of ownedCards) {
    const list = byMember.get(c.member) ?? [];
    list.push(c);
    byMember.set(c.member, list);
  }
  applyMemberPool(byMember, options.memberPool);

  const required = new Set<string>(options.fixedMembers ?? []);
  const memberSlots = buildMemberSlots(byMember, preferred, required);

  if (required.size > 5) return emptyResult(started);
  for (const m of required) {
    if (!memberSlots.some((s) => s.member === m)) return emptyResult(started);
  }

  if (memberSlots.length < 5) return emptyResult(started);

  const requiredList = memberSlots.filter((m) => required.has(m.member));
  const need = 5 - requiredList.length;
  let fillers = memberSlots
    .filter((m) => !required.has(m.member))
    .sort(
      (a, b) =>
        slotFillerPriority(b, costume, data, preferParam, preferred) -
        slotFillerPriority(a, costume, data, preferParam, preferred),
    );

  if (fillers.length > FIXED_COSTUME_FILLER_POOL) {
    fillers = fillers.slice(0, FIXED_COSTUME_FILLER_POOL);
  }

  const top: TeamEvaluation[] = [];
  const byStats: TeamEvaluation[] = [];
  const byCoverage: TeamEvaluation[] = [];
  const byAvgScoreUp: TeamEvaluation[] = [];
  const prPool: TeamEvaluation[] = [];
  let searched = 0;

  for (const fill of combinations(fillers, need)) {
    const combo = [...requiredList, ...fill];
    if (comboHasDuplicateMembers(combo)) continue;
    for (const teamCards of enumerateCardTeams(combo)) {
      if (hasDuplicateMembers(teamCards)) continue;
      const captainOnTeam = options.fixedLeader
        ? teamCards.findIndex((c) => c.member === options.fixedLeader)
        : -1;
      const leaderIndex = captainOnTeam >= 0 ? captainOnTeam : -1;
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

  if (!baseline && wanted.length === 0 && !options.memberPool?.length && options.fixedCostumeId && options.fixedLeader) {
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

export function optimizeTeam(data: GameData, options: OptimizeOptions): OptimizeResult {
  const started = performance.now();
  const maxResults = options.maxResults ?? 8;
  const songLength = options.songLength;
  const preferred = options.preferredCardByMember ?? {};
  const allowDup = options.allowDuplicateSkills !== false;
  const wanted = (options.fixedMembers ?? []).filter((m) => m && m !== options.fixedLeader);

  // PR baseline: full-pool strongest under this costume (same as 最強編隊).
  let baseline: TeamEvaluation | null = null;
  if (options.fixedLeader && options.fixedCostumeId) {
    if (wanted.length > 0 || (options.memberPool?.length ?? 0) > 0) {
      baseline = computePrBaselineTeam(data, options);
    }
  }

  const ownedCards = cardsForOptimizer(data, options.ownedCardIds);
  const byMember = new Map<string, Card[]>();
  for (const c of ownedCards) {
    const list = byMember.get(c.member) ?? [];
    list.push(c);
    byMember.set(c.member, list);
  }
  applyMemberPool(byMember, options.memberPool);

  const required = new Set<string>(options.fixedMembers ?? []);

  if (required.size > 5) {
    return emptyResult(started);
  }

  const memberSlots = buildMemberSlots(byMember, preferred, required);

  for (const m of required) {
    if (!memberSlots.some((s) => s.member === m)) {
      return emptyResult(started);
    }
  }

  const costumePrefer = options.fixedCostumeId
    ? data.costumes.find((c) => c.id === options.fixedCostumeId)
    : null;
  const preferParam = costumePrefer
    ? preferredParamFromEffects(costumePrefer.skill.effects)
    : ("all" as const);

  const ownedCostumes = data.costumes.filter((c) => options.ownedCostumeIds.has(c.id));
  const costumesByMember = new Map<string, Costume[]>();
  for (const c of ownedCostumes) {
    const list = costumesByMember.get(c.member) ?? [];
    list.push(c);
    costumesByMember.set(c.member, list);
  }

  const top: TeamEvaluation[] = [];
  const byStats: TeamEvaluation[] = [];
  const byCoverage: TeamEvaluation[] = [];
  const byAvgScoreUp: TeamEvaluation[] = [];
  const prPool: TeamEvaluation[] = [];
  const maxPerTrack = 8;
  const prPoolSize = 96;
  let searched = 0;

  if (memberSlots.length < 5) {
    return emptyResult(started);
  }

  const requiredList = memberSlots.filter((m) => required.has(m.member));
  let fillers = memberSlots.filter((m) => !required.has(m.member));

  if (costumePrefer) {
    fillers = [...fillers].sort(
      (a, b) =>
        slotFillerPriority(b, costumePrefer, data, preferParam, preferred) -
        slotFillerPriority(a, costumePrefer, data, preferParam, preferred),
    );
  } else {
    fillers = [...fillers].sort((a, b) => {
      const cardA = pickCardForMember(a.cards, undefined, preferred[a.member], "all");
      const cardB = pickCardForMember(b.cards, undefined, preferred[b.member], "all");
      if (!cardA || !cardB) return 0;
      return cardBaseTotal(cardB) - cardBaseTotal(cardA) || cardB.passive.score - cardA.passive.score;
    });
  }

  const need = 5 - requiredList.length;

  for (const fill of combinations(fillers, need)) {
    const combo = [...requiredList, ...fill];
    if (comboHasDuplicateMembers(combo)) continue;
    for (const teamCards of enumerateCardTeams(combo)) {
      if (hasDuplicateMembers(teamCards)) continue;
      if (costumePrefer && options.fixedCostumeId) {
        const captainOnTeam = options.fixedLeader
          ? teamCards.findIndex((c) => c.member === options.fixedLeader)
          : -1;
        const leaderIndex = captainOnTeam >= 0 ? captainOnTeam : -1;
        const ev = evaluateTeam(teamCards, leaderIndex, costumePrefer, data, songLength);
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
        continue;
      }

      for (let leaderIndex = 0; leaderIndex < 5; leaderIndex++) {
        const leaderMember = teamCards[leaderIndex]?.member;
        if (!leaderMember) continue;
        if (options.fixedLeader && leaderMember !== options.fixedLeader) continue;

        let costumes = costumesByMember.get(leaderMember) ?? [];
        if (options.fixedCostumeId) {
          costumes = costumes.filter((c) => c.id === options.fixedCostumeId);
        }
        if (!costumes.length) continue;

        const sortedCostumes = [...costumes].sort((a, b) => b.skill.score - a.skill.score);

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
  if (!baseline && wanted.length === 0 && !options.memberPool?.length && options.fixedLeader && options.fixedCostumeId) {
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
  const inventoryMode = (options.memberPool?.length ?? 0) > 0;

  // Fixed captain costume: full enumeration (captain may be off-team).
  if (options.fixedLeader && options.fixedCostumeId) return optimizeTeam(data, options);
  // Inventory mode keeps the bounded fast path even when optional lineup/captain
  // constraints are active, preserving the rule that captain may remain off-team.
  if (!inventoryMode && (ownedCount <= 28 || required.size >= 2)) {
    return optimizeTeam(data, options);
  }

  const started = performance.now();
  const maxResults = options.maxResults ?? 8;
  const maxPerTrack = 8;
  const prPoolSize = 96;
  const preferred = options.preferredCardByMember ?? {};
  const allowDup = options.allowDuplicateSkills !== false;
  const ownedCards = cardsForOptimizer(data, options.ownedCardIds);
  const byMember = new Map<string, Card[]>();
  for (const c of ownedCards) {
    const list = byMember.get(c.member) ?? [];
    list.push(c);
    byMember.set(c.member, list);
  }
  applyMemberPool(byMember, options.memberPool);

  const pick = (member: string, costume?: Costume | null) =>
    pickCardForMember(
      byMember.get(member) ?? [],
      undefined,
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

  for (const costume of ownedCostumes) {
    const must = [...required];
    if (must.length > 5) continue;
    const mustCards = must.map((m) => pick(m, costume)).filter((c): c is Card => !!c);
    if (mustCards.length !== must.length) continue;

    const blocked = new Set(must);
    const others = members
      .filter((m) => !blocked.has(m))
      .map((m) => ({ m, card: pick(m, costume)! }))
      .filter((x) => x.card)
      .sort(
        (a, b) =>
          fillerPriority(b.m, b.card, costume, data) - fillerPriority(a.m, a.card, costume, data),
      );

    const need = 5 - mustCards.length;
    // Keep the automatic inventory search bounded; this is the main large-box speed control.
    const candidatePool = others.slice(0, Math.max(18, need + 12));
    for (const combo of combinations(candidatePool, need)) {
      const teamCards = [...mustCards, ...combo.map((c) => c.card)];
      if (hasDuplicateMembers(teamCards)) continue;
      const leaderIndex = teamCards.findIndex((c) => c.member === costume.member);
      const ev = evaluateTeam(teamCards, leaderIndex, costume, data, options.songLength);
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
