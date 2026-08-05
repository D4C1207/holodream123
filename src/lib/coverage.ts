export interface ActiveWindow {
  interval: number;
  duration: number;
  /** Score UP percent, e.g. 100 = +100%. Assumed to always trigger. */
  scoreUp: number;
}

export interface UncoveredGap {
  /** Inclusive start second. */
  start: number;
  /** Exclusive end second. */
  end: number;
}

export interface CoverageResult {
  /** Fraction of song with any Score UP active. */
  coverage: number;
  /** Per-second effective Score UP percent (max of overlapping buffs, not stacked). */
  timeline: number[];
  /** Average effective Score UP percent over the song (ranking metric). */
  avgScoreUp: number;
  /** Alias kept for older call sites — same as avgScoreUp. */
  expectedScoreUptime: number;
  /** Contiguous ranges with no Score UP. */
  uncoveredGaps: UncoveredGap[];
  /** Total seconds with no Score UP. */
  uncoveredSeconds: number;
}

export function formatUncoveredGaps(
  gaps: UncoveredGap[],
  labels?: { none: string; range: (a: number, b: number, dur: number) => string; join: string },
): string {
  if (!gaps.length) return labels?.none ?? "無（全程有技能）";
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

/**
 * Deterministic Score UP over a song.
 * - Skills always fire at interval, 2×interval, …
 * - Overlapping buffs do NOT stack: each moment uses the highest scoreUp %.
 *
 * Example (both every 19s): A = 100%/10s, B = 110%/6s
 * → seconds 0–6 of window: 110%, seconds 6–10: 100%.
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
  const maxUp = new Float64Array(n); // score-up percent

  for (const a of actives) {
    if (!a.interval || !a.duration || a.scoreUp <= 0) continue;
    for (let start = a.interval; start < songLength + 1e-9; start += a.interval) {
      const end = Math.min(songLength, start + a.duration);
      const i0 = Math.max(0, Math.floor(start / step));
      const i1 = Math.min(n, Math.ceil(end / step));
      for (let i = i0; i < i1; i++) {
        if (a.scoreUp > maxUp[i]) maxUp[i] = a.scoreUp;
      }
    }
  }

  let covered = 0;
  let sum = 0;
  const timeline: number[] = [];
  const perSec = Math.max(1, Math.round(1 / step));
  const uncoveredGaps: UncoveredGap[] = [];
  let gapStart: number | null = null;

  for (let i = 0; i < n; i++) {
    const v = maxUp[i];
    if (v > 0) covered += 1;
    sum += v;
    if (i % perSec === 0) timeline.push(v);

    const t = i * step;
    if (v <= 0) {
      if (gapStart == null) gapStart = t;
    } else if (gapStart != null) {
      uncoveredGaps.push({ start: gapStart, end: t });
      gapStart = null;
    }
  }
  if (gapStart != null) {
    uncoveredGaps.push({ start: gapStart, end: songLength });
  }

  const uncoveredSeconds = uncoveredGaps.reduce((s, g) => s + (g.end - g.start), 0);
  const avgScoreUp = sum / n;
  return {
    coverage: covered / n,
    timeline,
    avgScoreUp,
    expectedScoreUptime: avgScoreUp,
    uncoveredGaps,
    uncoveredSeconds,
  };
}
