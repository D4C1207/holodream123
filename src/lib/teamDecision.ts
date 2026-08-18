import type { Locale } from "../i18n/messages";
import type { TeamEvaluation } from "../types";
import { teamSpecialSynergy } from "./specialOrder";

export type TeamDecisionMetrics = {
  d4cIndex: number;
  effectiveStats: number;
  scoreSupportEquivalent: number;
  avgScoreUp: number;
  coverage: number;
  passiveSatisfied: number;
  passiveTotal: number;
  costumeSatisfied: boolean;
  buffGain: number;
  specialSynergy: number;
};

export type TeamMetricDiff = {
  d4cIndex: number;
  effectiveStats: number;
  scoreSupportEquivalent: number;
  avgScoreUp: number;
  coveragePctPoint: number;
  passiveSatisfied: number;
  buffGain: number;
  specialSynergy: number;
};

export function teamDecisionKey(ev: TeamEvaluation): string {
  return `${ev.costume.id}|${ev.leaderIndex}|${ev.cards.map((card) => card.id).join(",")}`;
}

const DEFAULT_SCORE_SONG_LENGTH = 160;

/**
 * Approximate full-song Score Support percentage. Persistent costume/passive
 * support is converted from its power-weighted equivalent; each one-shot Special
 * is averaged over song length because its exact song-specific trigger position
 * is not loaded by this tool yet.
 */
export function estimatedScoreSupportPct(
  ev: TeamEvaluation,
  songLength = DEFAULT_SCORE_SONG_LENGTH,
): number {
  const persistent = ev.baseStatTotal > 0
    ? (Math.max(0, ev.scoreSupportWeighted) / ev.baseStatTotal) * 100
    : 0;
  const special = songLength > 0
    ? ev.cards.reduce(
        (sum, card) => sum + Math.max(0, card.special.scoreSupport) * Math.min(songLength, Math.max(0, card.special.duration)) / songLength,
        0,
      )
    : 0;
  return persistent + special;
}

/**
 * SC（非官方固定尺度估算）：
 * Unit Value × expected Active Score-Up factor × estimated Score-Support factor.
 *
 * Community research indicates final score scales linearly with Total Power and
 * Score Up is multiplied by (100% + Score Support). Active Avg UP is already
 * probability-aware. Exact chart notes, combo, Special trigger positions, Board,
 * Memory, Connect and Member Enhancement are intentionally outside this proxy.
 */
export function d4cBattleIndex(
  ev: TeamEvaluation,
  songLength = DEFAULT_SCORE_SONG_LENGTH,
): number {
  const scoreUpMultiplier = 1 + Math.max(0, ev.avgScoreUp) / 100;
  const supportMultiplier = 1 + estimatedScoreSupportPct(ev, songLength) / 100;
  return Math.round(ev.effectiveStatTotal * scoreUpMultiplier * supportMultiplier);
}

export function teamDecisionMetrics(ev: TeamEvaluation): TeamDecisionMetrics {
  return {
    d4cIndex: d4cBattleIndex(ev),
    effectiveStats: ev.effectiveStatTotal,
    scoreSupportEquivalent: ev.scoreSupportWeighted,
    avgScoreUp: ev.avgScoreUp,
    coverage: ev.coverage,
    passiveSatisfied: ev.passiveDetails.filter((item) => item.satisfied).length,
    passiveTotal: ev.passiveDetails.length,
    costumeSatisfied: ev.costumeSatisfied,
    buffGain: ev.effectiveStatTotal - ev.baseStatTotal,
    specialSynergy: teamSpecialSynergy(ev),
  };
}

export function compareDecisionMetrics(
  a: TeamEvaluation,
  b: TeamEvaluation,
): TeamMetricDiff {
  const am = teamDecisionMetrics(a);
  const bm = teamDecisionMetrics(b);
  return {
    d4cIndex: am.d4cIndex - bm.d4cIndex,
    effectiveStats: am.effectiveStats - bm.effectiveStats,
    scoreSupportEquivalent: am.scoreSupportEquivalent - bm.scoreSupportEquivalent,
    avgScoreUp: am.avgScoreUp - bm.avgScoreUp,
    coveragePctPoint: (am.coverage - bm.coverage) * 100,
    passiveSatisfied: am.passiveSatisfied - bm.passiveSatisfied,
    buffGain: am.buffGain - bm.buffGain,
    specialSynergy: am.specialSynergy - bm.specialSynergy,
  };
}

type Reason = { weight: number; text: string };

function signedNumber(value: number, digits = 0): string {
  const fixed = value.toFixed(digits);
  return `${value > 0 ? "+" : ""}${fixed}`;
}

function localized(
  locale: Locale,
  zh: string,
  en: string,
  ja: string,
): string {
  return locale === "en" ? en : locale === "ja" ? ja : zh;
}

export function explainTeamDecision(
  selected: TeamEvaluation,
  reference: TeamEvaluation | null,
  locale: Locale,
): { headline: string; reasons: string[] } {
  const sm = teamDecisionMetrics(selected);
  const reasons: Reason[] = [];

  if (!reference) {
    reasons.push({
      weight: Math.max(1, sm.buffGain / Math.max(1, selected.baseStatTotal)),
      text: localized(
        locale,
        `衣裝／被動生效後，三圍由 ${selected.baseStatTotal.toLocaleString()} 提升到 ${selected.effectiveStatTotal.toLocaleString()}（+${sm.buffGain.toLocaleString()}）。`,
        `Costume/passive effects raise stats from ${selected.baseStatTotal.toLocaleString()} to ${selected.effectiveStatTotal.toLocaleString()} (+${sm.buffGain.toLocaleString()}).`,
        `衣装／パッシブ適用後、総合パラメータが ${selected.baseStatTotal.toLocaleString()} から ${selected.effectiveStatTotal.toLocaleString()}（+${sm.buffGain.toLocaleString()}）へ上昇します。`,
      ),
    });
    reasons.push({
      weight: sm.avgScoreUp / 100,
      text: localized(
        locale,
        `全曲平均有效 Score UP 為 ${sm.avgScoreUp.toFixed(1)}%，技能覆蓋率 ${(sm.coverage * 100).toFixed(1)}%。`,
        `Full-song average effective Score UP is ${sm.avgScoreUp.toFixed(1)}% with ${(sm.coverage * 100).toFixed(1)}% coverage.`,
        `全曲平均の有効 Score UP は ${sm.avgScoreUp.toFixed(1)}%、カバー率は ${(sm.coverage * 100).toFixed(1)}% です。`,
      ),
    });
  } else {
    const diff = compareDecisionMetrics(selected, reference);
    const statPct = diff.effectiveStats / Math.max(1, reference.effectiveStatTotal);
    if (Math.abs(diff.effectiveStats) >= 1) {
      reasons.push({
        weight: Math.abs(statPct) * 12,
        text: localized(
          locale,
          `加成後三圍比比較隊伍 ${diff.effectiveStats >= 0 ? "高" : "低"} ${Math.abs(diff.effectiveStats).toLocaleString()}。`,
          `Buffed stats are ${Math.abs(diff.effectiveStats).toLocaleString()} ${diff.effectiveStats >= 0 ? "higher" : "lower"} than the comparison team.`,
          `総合パラメータは比較編成より ${Math.abs(diff.effectiveStats).toLocaleString()} ${diff.effectiveStats >= 0 ? "高い" : "低い"}です。`,
        ),
      });
    }
    if (Math.abs(diff.avgScoreUp) >= 0.05) {
      reasons.push({
        weight: Math.abs(diff.avgScoreUp) / 2,
        text: localized(
          locale,
          `全曲平均 Score UP ${diff.avgScoreUp >= 0 ? "高" : "低"} ${Math.abs(diff.avgScoreUp).toFixed(1)} 個百分點。`,
          `Full-song average Score UP is ${Math.abs(diff.avgScoreUp).toFixed(1)} percentage points ${diff.avgScoreUp >= 0 ? "higher" : "lower"}.`,
          `全曲平均 Score UP は ${Math.abs(diff.avgScoreUp).toFixed(1)} ポイント ${diff.avgScoreUp >= 0 ? "高い" : "低い"}です。`,
        ),
      });
    }
    if (Math.abs(diff.coveragePctPoint) >= 0.05) {
      reasons.push({
        weight: Math.abs(diff.coveragePctPoint) / 5,
        text: localized(
          locale,
          `技能覆蓋率 ${diff.coveragePctPoint >= 0 ? "高" : "低"} ${Math.abs(diff.coveragePctPoint).toFixed(1)} 個百分點。`,
          `Skill coverage is ${Math.abs(diff.coveragePctPoint).toFixed(1)} percentage points ${diff.coveragePctPoint >= 0 ? "higher" : "lower"}.`,
          `スキルカバー率は ${Math.abs(diff.coveragePctPoint).toFixed(1)} ポイント ${diff.coveragePctPoint >= 0 ? "高い" : "低い"}です。`,
        ),
      });
    }
    if (diff.passiveSatisfied !== 0) {
      reasons.push({
        weight: Math.abs(diff.passiveSatisfied) * 1.5,
        text: localized(
          locale,
          `發動被動數量 ${diff.passiveSatisfied > 0 ? "多" : "少"} ${Math.abs(diff.passiveSatisfied)} 個（本隊 ${sm.passiveSatisfied}/${sm.passiveTotal}）。`,
          `${Math.abs(diff.passiveSatisfied)} ${diff.passiveSatisfied > 0 ? "more" : "fewer"} passive skills activate (${sm.passiveSatisfied}/${sm.passiveTotal} on this team).`,
          `発動パッシブ数が ${Math.abs(diff.passiveSatisfied)} 個 ${diff.passiveSatisfied > 0 ? "多い" : "少ない"}です（この編成は ${sm.passiveSatisfied}/${sm.passiveTotal}）。`,
        ),
      });
    }
    if (Math.abs(diff.scoreSupportEquivalent) >= 1) {
      reasons.push({
        weight: Math.abs(diff.scoreSupportEquivalent) / 5000,
        text: localized(
          locale,
          `分數支援加權值差異 ${signedNumber(diff.scoreSupportEquivalent, 0)}。`,
          `Score-support equivalent differs by ${signedNumber(diff.scoreSupportEquivalent, 0)}.`,
          `スコアサポート加重値の差は ${signedNumber(diff.scoreSupportEquivalent, 0)} です。`,
        ),
      });
    }
    if (Math.abs(diff.specialSynergy) >= 0.01) {
      reasons.push({
        weight: Math.abs(diff.specialSynergy) / Math.max(1, reference ? teamSpecialSynergy(reference) : 1),
        text: localized(
          locale,
          `Special × Active 聯動潛力 ${diff.specialSynergy >= 0 ? "較高" : "較低"}（差 ${signedNumber(diff.specialSynergy, 1)}）。`,
          `Special × Active synergy is ${diff.specialSynergy >= 0 ? "higher" : "lower"} (${signedNumber(diff.specialSynergy, 1)} difference).`,
          `Special × Active 連動ポテンシャルは ${diff.specialSynergy >= 0 ? "高い" : "低い"}です（差 ${signedNumber(diff.specialSynergy, 1)}）。`,
        ),
      });
    }
  }

  if (selected.costumeSatisfied) {
    reasons.push({
      weight: 1.1,
      text: localized(
        locale,
        `隊長衣裝「${selected.costume.costumeName}」條件已滿足。`,
        `Captain costume “${selected.costume.costumeName}” is active.`,
        `隊長衣装「${selected.costume.costumeName}」の条件を満たしています。`,
      ),
    });
  }
  if (selected.allPassivesSatisfied) {
    reasons.push({
      weight: 1,
      text: localized(
        locale,
        `全員被動 ${sm.passiveSatisfied}/${sm.passiveTotal} 全部發動。`,
        `All passives are active (${sm.passiveSatisfied}/${sm.passiveTotal}).`,
        `全員のパッシブが発動しています（${sm.passiveSatisfied}/${sm.passiveTotal}）。`,
      ),
    });
  }

  reasons.sort((a, b) => b.weight - a.weight);
  const topReasons = reasons.slice(0, 4).map((item) => item.text);
  const headline = reference
    ? localized(
        locale,
        `SC ${d4cBattleIndex(selected).toLocaleString()}，相較比較隊伍 ${signedNumber(d4cBattleIndex(selected) - d4cBattleIndex(reference), 0)}。`,
        `SC ${d4cBattleIndex(selected).toLocaleString()}, ${signedNumber(d4cBattleIndex(selected) - d4cBattleIndex(reference), 0)} versus the comparison team.`,
        `SC ${d4cBattleIndex(selected).toLocaleString()}、比較編成との差は ${signedNumber(d4cBattleIndex(selected) - d4cBattleIndex(reference), 0)} です。`,
      )
    : localized(
        locale,
        `SC ${d4cBattleIndex(selected).toLocaleString()}。`,
        `SC ${d4cBattleIndex(selected).toLocaleString()}.`,
        `SC ${d4cBattleIndex(selected).toLocaleString()}。`,
      );
  return { headline, reasons: topReasons };
}
