export type Attr = "happy" | "pure" | "cute";

export type Condition =
  | { type: "typeCount"; attr: Attr; min: number }
  | { type: "unitCount"; unit: string; min: number }
  | { type: "misc"; text: string };

export interface ActiveSkill {
  interval: number;
  probability: number;
  probabilityLabel: string;
  duration: number;
  scoreUp: number;
  bonus: {
    conditionText: string;
    condition: Condition;
    scoreUp: number;
  } | null;
  raw: string;
}

export interface PassiveSkill {
  condition: Condition | null;
  effects: Array<{
    kind: string;
    param?: string;
    value: number;
    target?: string;
    targetGroup?: string;
    targetCount?: number;
  }>;
  raw: string;
  score: number;
}

export interface SpecialSkill {
  duration: number;
  scoreSupport: number;
  skillRate: number;
  skillRateCondition: string | null;
  raw: string;
}

export interface CardStats {
  performance: number;
  technique: number;
  sense: number;
  total: number;
}

export interface Card {
  id: string;
  member: string;
  costumeName: string;
  rarity: number;
  type: Attr;
  unit: string;
  /** Optional live-event category label (e.g. swimsuit banner). */
  event?: string;
  stats?: CardStats;
  special: SpecialSkill;
  active: ActiveSkill;
  passive: PassiveSkill;
}

export interface CostumeSkill {
  condition: Condition | null;
  effects: Array<{ kind: string; param?: string; value: number; target?: string }>;
  raw: string;
  score: number;
  unconditional: boolean;
}

export interface Costume {
  id: string;
  member: string;
  costumeName: string;
  skill: CostumeSkill;
}

export interface MemberMeta {
  name: string;
  units: string[];
}

export interface GameData {
  members: Record<string, MemberMeta>;
  cards: Card[];
  costumes: Costume[];
  songLengthDefault: number;
  probabilities: Record<string, number>;
  /** Active event name used for extra card grouping. */
  currentEvent?: string;
}

export interface TeamEvaluation {
  cards: Card[];
  leaderIndex: number;
  costume: Costume;
  costumeSatisfied: boolean;
  costumeScore: number;
  /** True only when every member's passive condition is met. */
  allPassivesSatisfied: boolean;
  passiveScore: number;
  passiveDetails: Array<{ member: string; satisfied: boolean; raw: string; score: number }>;
  /** Fraction of song with any Score UP. */
  coverage: number;
  /** Average effective Score UP % (overlapping buffs take max, do not stack). */
  avgScoreUp: number;
  /** Same as avgScoreUp (legacy alias). */
  expectedScoreUptime: number;
  /** Per-second effective Score UP % (max of overlaps). */
  timeline: number[];
  /** Contiguous ranges with no Score UP (seconds). */
  uncoveredGaps: Array<{ start: number; end: number }>;
  /** Total seconds with no Score UP. */
  uncoveredSeconds: number;
  /** Team total after costume/passive param buffs. */
  effectiveStatTotal: number;
  /** Team total before buffs. */
  baseStatTotal: number;
  /** Sum of score-support % applied (group buffs hit top-N by 三圍). */
  teamScoreSupportPct: number;
  /** Score-support weighted by recipient base 三圍. */
  scoreSupportWeighted: number;
  /** Per-member effective stats after buffs. */
  memberEffectiveStats: Array<{
    member: string;
    performance: number;
    technique: number;
    sense: number;
    total: number;
    bonusPct: { performance: number; technique: number; sense: number };
    scoreSupportPct: number;
  }>;
  typeCounts: Record<Attr, number>;
  unitCounts: Record<string, number>;
  /** Composite PR 0–1000 from stats / coverage / avgScoreUp (set on overall ranking). */
  powerRating?: number;
  /**
   * Active Score UP skills that share the same timing/potency
   * (overlap uses max, so duplicates waste a slot).
   */
  activeDuplicates: Array<{ members: [string, string]; cardIds: [string, string] }>;
}
