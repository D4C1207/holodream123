export interface ActiveWindow {
  interval: number;
  duration: number;
  /** Score UP percent, e.g. 100 = +100%. */
  scoreUp: number;
  /** Estimated chance that one interval check activates this skill, 0..1. */
  probability?: number;
}

export interface UncoveredGap {
  /** Inclusive start second. */
  start: number;
  /** Exclusive end second. */
  end: number;
}

export interface CoverageResult {
  /** Expected fraction of the song with at least one Active Score UP running. */
  coverage: number;
  /** Per-second expected effective Score UP %. Overlaps use the strongest active effect. */
  timeline: number[];
  /** Full-song expected effective Score UP %. */
  avgScoreUp: number;
  /** Legacy alias kept for older call sites — same as avgScoreUp. */
  expectedScoreUptime: number;
  /** Ranges where no Active window can possibly cover the timeline. RNG misses are not gaps here. */
  uncoveredGaps: UncoveredGap[];
  /** Total deterministic no-window seconds. */
  uncoveredSeconds: number;
}

export function formatUncoveredGaps(
  gaps: UncoveredGap[],
  labels?: { none: string; range: (a: number, b: number, dur: number) => string; join: string },
): string {
  if (!gaps.length) return labels?.none ?? "無（全程都有可能觸發技能）";
  const join = labels?.join ?? "、";
  return gaps
    .map((g) => {
      const dur = Math.round((g.end - g.start) * 10) / 10;
      const a = Math.round(g.start * 10) / 10;
      const b = Math.round(g.end * 10) / 10;
      return labels?.range(a, b, dur) ?? `${a}–${b}秒（${dur}秒）`;
    })
    .join(join);
}

type ScheduledEffect = { scoreUp: number; probability: number };

function clampProbability(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** Expected maximum of independent Bernoulli effects. */
function expectedStrongest(effects: ScheduledEffect[]): number {
  if (!effects.length) return 0;
  const sorted = [...effects].sort((a, b) => b.scoreUp - a.scoreUp);
  let noneHigher = 1;
  let expected = 0;
  for (const effect of sorted) {
    const p = clampProbability(effect.probability);
    expected += effect.scoreUp * p * noneHigher;
    noneHigher *= 1 - p;
  }
  return expected;
}

function probabilityAny(effects: ScheduledEffect[]): number {
  let none = 1;
  for (const effect of effects) none *= 1 - clampProbability(effect.probability);
  return 1 - none;
}

/**
 * Probability-aware Active Score UP model.
 *
 * Each interval check is treated as an independent activation attempt. At any
 * moment, overlapping Active effects do not stack; instead we calculate the
 * expected value of the strongest successfully activated effect. This follows
 * current community research more closely than the old "every check always
 * fires" model while remaining deterministic and fast enough for optimization.
 */
export function calcScoreUpCoverage(
  actives: ActiveWindow[],
  songLength: number,
  step = 0.25,
): CoverageResult {
  if (songLength <= 0 || actives.length === 0) {
    const gap = songLength > 0 ? [{ start: 0, end: songLength }] : [];
    return {
      coverage: 0,
      timeline: [],
      avgScoreUp: 0,
      expectedScoreUptime: 0,
      uncoveredGaps: gap,
      uncoveredSeconds: songLength > 0 ? songLength : 0,
    };
  }

  const n = Math.ceil(songLength / step);
  const scheduled: ScheduledEffect[][] = Array.from({ length: n }, () => []);

  for (const active of actives) {
    if (!active.interval || !active.duration || active.scoreUp <= 0) continue;
    const probability = clampProbability(active.probability);
    if (probability <= 0) continue;
    for (let start = active.interval; start < songLength + 1e-9; start += active.interval) {
      const end = Math.min(songLength, start + active.duration);
      const i0 = Math.max(0, Math.floor(start / step));
      const i1 = Math.min(n, Math.ceil(end / step));
      for (let i = i0; i < i1; i++) {
        scheduled[i].push({ scoreUp: active.scoreUp, probability });
      }
    }
  }

  let expectedCovered = 0;
  let sumExpectedUp = 0;
  const timeline: number[] = [];
  const perSec = Math.max(1, Math.round(1 / step));
  const uncoveredGaps: UncoveredGap[] = [];
  let gapStart: number | null = null;

  for (let i = 0; i < n; i++) {
    const effects = scheduled[i];
    const expectedUp = expectedStrongest(effects);
    const anyProbability = probabilityAny(effects);
    expectedCovered += anyProbability;
    sumExpectedUp += expectedUp;
    if (i % perSec === 0) timeline.push(expectedUp);

    const t = i * step;
    if (effects.length === 0) {
      if (gapStart == null) gapStart = t;
    } else if (gapStart != null) {
      uncoveredGaps.push({ start: gapStart, end: t });
      gapStart = null;
    }
  }
  if (gapStart != null) uncoveredGaps.push({ start: gapStart, end: songLength });

  const uncoveredSeconds = uncoveredGaps.reduce((sum, gap) => sum + (gap.end - gap.start), 0);
  const avgScoreUp = n > 0 ? sumExpectedUp / n : 0;
  return {
    coverage: n > 0 ? expectedCovered / n : 0,
    timeline,
    avgScoreUp,
    expectedScoreUptime: avgScoreUp,
    uncoveredGaps,
    uncoveredSeconds,
  };
}
