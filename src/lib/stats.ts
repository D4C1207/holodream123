import { memberUnits } from "./conditions";
import type {
  Attr,
  Card,
  CardStats,
  Condition,
  Costume,
  GameData,
  PassiveSkill,
} from "../types";

const ATTRS: Attr[] = ["happy", "pure", "cute"];
const ATTR_JP: Record<Attr, string> = {
  happy: "ハッピータイプ",
  pure: "ピュアタイプ",
  cute: "キュートタイプ",
};

export type ParamKey = "performance" | "technique" | "sense";

export interface SkillEffectLike {
  kind: string;
  param?: string;
  value: number;
  target?: string;
  targetGroup?: string;
  targetCount?: number;
}

export interface EffectiveMemberStats {
  member: string;
  base: CardStats;
  effective: CardStats;
  /** Applied param % per stat (summed). */
  bonusPct: Record<ParamKey, number>;
  /** Applied score-support % (summed). */
  scoreSupportPct: number;
}

export interface TeamStatResult {
  members: EffectiveMemberStats[];
  /** Sum of effective totals. */
  teamTotal: number;
  baseTotal: number;
  /** Sum of score-support % applied to members. */
  teamScoreSupportPct: number;
  /**
   * Score-support value weighted by base 三圍 of recipients.
   * Prefers putting the buff on highest-stat members of the group.
   */
  scoreSupportWeighted: number;
}

function estimateBase(card: Card): CardStats {
  if (card.stats) return { ...card.stats };
  const total = card.rarity >= 5 ? 25000 : card.rarity === 4 ? 20000 : 15000;
  const each = Math.round(total / 3);
  return { performance: each, technique: each, sense: each, total };
}

export function paramKey(param?: string): ParamKey | "all" | null {
  if (!param) return null;
  if (param === "全パラメータ" || param === "全參數") return "all";
  if (param === "パフォーマンス" || param === "表現力" || param === "表演力" || param === "Perf") {
    return "performance";
  }
  if (param === "テクニック" || param === "技巧" || param === "Tech") return "technique";
  if (param === "センス" || param === "感性" || param === "Sense") return "sense";
  return null;
}

function baseParam(stats: CardStats, key: ParamKey | "all"): number {
  if (key === "all") return stats.total;
  return stats[key];
}

export function matchesGroup(card: Card, group: string, data: GameData): boolean {
  if (ATTRS.includes(group as Attr)) return card.type === group;
  const units = memberUnits(data.members[card.member], card);
  return units.includes(group);
}

function applyPct(base: number, pct: number): number {
  return Math.round(base * (1 + pct / 100));
}

/** Parse 「ピュアタイプ3人の…」 style count from raw skill text. */
function countFromRaw(raw?: string): number | null {
  if (!raw) return null;
  const patterns = [
    /(\d+)人の(?:センス|テクニック|パフォーマンス|スコアサポート効果|全パラメータ)/,
    /(\d+)人\s*(?:Support|全參數|Perf|Tech|Sense)/i,
    /(?:Happy|Pure|Cute|快樂|清純|可愛)\s*(\d+)人/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return +m[1];
  }
  return null;
}

function groupFromRaw(raw?: string): string | null {
  if (!raw) return null;
  for (const attr of ATTRS) {
    if (raw.includes(ATTR_JP[attr]) || raw.toLowerCase().includes(attr)) return attr;
  }
  const units = [
    "0期生",
    "1期生",
    "2期生",
    "3期生",
    "4期生",
    "5期生",
    "ゲーマーズ",
    "holoX",
    "ID1期生",
    "ID2期生",
    "ID3期生",
    "Myth",
    "Promise",
    "Advent",
    "ReGLOSS",
  ];
  for (const u of units) {
    if (raw.includes(u)) return u;
  }
  return null;
}

export type ResolvedTarget =
  | { mode: "all" }
  | { mode: "self" }
  | { mode: "group"; group: string; count: number };

/**
 * Resolve who an effect hits.
 * Group buffs (e.g. 清純2人分數+8%) pick the top `count` by 三圍 when more eligible exist.
 */
export function resolveEffectTarget(
  effect: SkillEffectLike,
  condition: Condition | null | undefined,
  raw?: string,
): ResolvedTarget {
  if (effect.target === "self") return { mode: "self" };
  if (effect.target === "all") return { mode: "all" };

  if (effect.targetGroup && effect.targetCount) {
    return { mode: "group", group: effect.targetGroup, count: effect.targetCount };
  }

  const rawCount = countFromRaw(raw);
  const rawGroup = groupFromRaw(raw);

  if (condition?.type === "typeCount") {
    return {
      mode: "group",
      group: condition.attr,
      count: rawCount ?? effect.targetCount ?? condition.min,
    };
  }
  if (condition?.type === "unitCount") {
    return {
      mode: "group",
      group: condition.unit,
      count: rawCount ?? effect.targetCount ?? condition.min,
    };
  }

  if (rawGroup && rawCount) {
    return { mode: "group", group: rawGroup, count: rawCount };
  }

  // Unconditional / unspecified → whole team
  return { mode: "all" };
}

function topGroupIndices(
  cards: Card[],
  bases: CardStats[],
  group: string,
  count: number,
  data: GameData,
  /** Sort key: specific param, or total 三圍. */
  sortKey: ParamKey | "all",
): number[] {
  return cards
    .map((c, i) => ({ i, c }))
    .filter(({ c }) => matchesGroup(c, group, data))
    .sort(
      (a, b) =>
        baseParam(bases[b.i], sortKey) - baseParam(bases[a.i], sortKey) ||
        bases[b.i].total - bases[a.i].total,
    )
    .slice(0, count)
    .map(({ i }) => i);
}

/**
 * Apply costume + passive paramUp / scoreSupport buffs.
 * Group-limited effects choose the highest-三圍 (or highest relevant param) members.
 */
export function calcEffectiveStats(
  cards: Card[],
  costume: Costume,
  costumeSatisfied: boolean,
  passiveSatisfied: boolean[],
  data: GameData,
): TeamStatResult {
  const bases = cards.map(estimateBase);
  const bonus = cards.map(() => ({
    performance: 0,
    technique: 0,
    sense: 0,
  }));
  const scoreSupport = cards.map(() => 0);

  const addParam = (index: number, key: ParamKey | "all", value: number) => {
    if (key === "all") {
      bonus[index].performance += value;
      bonus[index].technique += value;
      bonus[index].sense += value;
    } else {
      bonus[index][key] += value;
    }
  };

  const applyToTargets = (
    target: ResolvedTarget,
    selfIndex: number | null,
    sortKey: ParamKey | "all",
    apply: (index: number) => void,
  ) => {
    if (target.mode === "self") {
      if (selfIndex != null) apply(selfIndex);
      return;
    }
    if (target.mode === "all") {
      for (let i = 0; i < cards.length; i++) apply(i);
      return;
    }
    for (const i of topGroupIndices(cards, bases, target.group, target.count, data, sortKey)) {
      apply(i);
    }
  };

  const applyEffect = (
    effect: SkillEffectLike,
    condition: Condition | null | undefined,
    raw: string | undefined,
    selfIndex: number | null,
  ) => {
    const target = resolveEffectTarget(effect, condition, raw);

    if (effect.kind === "paramUp") {
      const key = paramKey(effect.param);
      if (!key) return;
      // Param group buffs: rank by that param (全パラメータ / score-style → 三圍 total).
      applyToTargets(target, selfIndex, key === "all" ? "all" : key, (i) =>
        addParam(i, key, effect.value),
      );
      return;
    }

    if (effect.kind === "scoreSupportPassive") {
      // Score support on a type/unit group: always pick highest 三圍 members.
      applyToTargets(target, selfIndex, "all", (i) => {
        scoreSupport[i] += effect.value;
      });
    }
  };

  if (costumeSatisfied) {
    for (const e of costume.skill.effects) {
      applyEffect(e, costume.skill.condition, costume.skill.raw, null);
    }
  }

  cards.forEach((card, i) => {
    if (!passiveSatisfied[i]) return;
    for (const e of card.passive.effects) {
      applyEffect(e, card.passive.condition, card.passive.raw, i);
    }
  });

  const members: EffectiveMemberStats[] = cards.map((card, i) => {
    const base = bases[i];
    const b = bonus[i];
    const performance = applyPct(base.performance, b.performance);
    const technique = applyPct(base.technique, b.technique);
    const sense = applyPct(base.sense, b.sense);
    const effective: CardStats = {
      performance,
      technique,
      sense,
      total: performance + technique + sense,
    };
    return {
      member: card.member,
      base,
      effective,
      bonusPct: { ...b },
      scoreSupportPct: scoreSupport[i],
    };
  });

  const teamScoreSupportPct = members.reduce((s, m) => s + m.scoreSupportPct, 0);
  const scoreSupportWeighted = members.reduce(
    (s, m) => s + (m.base.total * m.scoreSupportPct) / 100,
    0,
  );

  return {
    members,
    teamTotal: members.reduce((s, m) => s + m.effective.total, 0),
    baseTotal: members.reduce((s, m) => s + m.base.total, 0),
    teamScoreSupportPct,
    scoreSupportWeighted,
  };
}

/** Preferred param when sorting candidates for a costume / passive context. */
export function preferredParamFromEffects(
  effects: Array<{ kind: string; param?: string }>,
): ParamKey | "all" {
  for (const e of effects) {
    if (e.kind !== "paramUp") continue;
    const k = paramKey(e.param);
    if (k) return k;
  }
  // Score-support-only skills → rank by 三圍 total
  if (effects.some((e) => e.kind === "scoreSupportPassive")) return "all";
  return "all";
}

export function cardBaseTotal(card: Card): number {
  return estimateBase(card).total;
}

export function cardBaseParam(card: Card, key: ParamKey | "all"): number {
  return baseParam(estimateBase(card), key);
}

export function passiveTargetsGroup(passive: PassiveSkill): string | null {
  for (const e of passive.effects) {
    if (e.targetGroup) return e.targetGroup;
  }
  const t = resolveEffectTarget(
    passive.effects[0] ?? { kind: "", value: 0 },
    passive.condition,
    passive.raw,
  );
  return t.mode === "group" ? t.group : null;
}
