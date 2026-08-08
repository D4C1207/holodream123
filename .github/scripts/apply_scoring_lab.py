from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# --- optimizer: ratio-to-best PR instead of min-max ---
path = Path("src/lib/optimizer.ts")
text = path.read_text(encoding="utf-8")
old_norm = '''function minMaxNorm(values: number[], v: number): number {
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
'''
new_norm = '''const PR_WEIGHT_UNIT = 0.50;
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
'''
text = replace_once(text, old_norm, new_norm, "PR normalization helpers")
start = text.index("function rankByPowerRating(")
end = text.index("\nfunction pickBaselineTeam", start)
new_rank = '''function rankByPowerRating(
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
}'''
text = text[:start] + new_rank + text[end:]
old_cache = '''export function buildOptimizeResultFromCache(byOverall: TeamEvaluation[]): OptimizeResult {
  const top = byOverall.slice(0, 8);
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
}'''
new_cache = '''export function buildOptimizeResultFromCache(byOverall: TeamEvaluation[]): OptimizeResult {
  const cached = byOverall.slice(0, 8);
  // Cached teams may carry PR values from an older scoring revision. Always
  // re-score the hydrated candidates with the current ratio-to-best formula.
  const top = rankByPowerRating(cached, 8, null);
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
}'''
text = replace_once(text, old_cache, new_cache, "cached PR re-score")
text = text.replace(
    " * PR = mean(stats/base, coverage/base, avgUP/base) × PR_MAX; baseline team = PR_MAX.\n",
    " * PR = weighted completion vs best references: Unit 50% / Avg UP 30% / Coverage 20%.\n",
)
path.write_text(text, encoding="utf-8")

# --- cached baseline: pick best candidate using same 50/30/20 completion logic ---
path = Path("src/lib/prBaselineStore.ts")
text = path.read_text(encoding="utf-8")
old = '''export function getPrBaselineEntry(
  costumeId: string,
  songLength: number,
  poolCardCount: number,
): (PrTeamCacheEntry & { costumeId: string }) | null {
  const teams = getPrCostumeTop8(costumeId, songLength, poolCardCount);
  if (!teams?.length) return null;
  return { costumeId, ...teams[0] };
}'''
new = '''export function getPrBaselineEntry(
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
}'''
text = replace_once(text, old, new, "cached baseline selection")
path.write_text(text, encoding="utf-8")

# --- App integration, Unit Value, specialist tracks, new PR explanation ---
path = Path("src/App.tsx")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    'import { Portrait } from "./components/Portrait";\n',
    'import { Portrait } from "./components/Portrait";\nimport { ManualDeckLab } from "./components/ManualDeckLab";\n',
    "ManualDeckLab import",
)
text = replace_once(
    text,
    'type ResultTrack = "overall" | "stats" | "coverage" | "score";\n',
    'type ResultTrack = "overall" | "stats" | "performance" | "technique" | "sense" | "coverage" | "score";\n',
    "ResultTrack expansion",
)
text = replace_once(
    text,
    '''function signed(value: number, digits = 0): string {
  const out = value.toFixed(digits);
  return `${value > 0 ? "+" : ""}${out}`;
}
''',
    '''function signed(value: number, digits = 0): string {
  const out = value.toFixed(digits);
  return `${value > 0 ? "+" : ""}${out}`;
}

function teamAxisTotal(
  team: TeamEvaluation,
  axis: "performance" | "technique" | "sense",
): number {
  return team.memberEffectiveStats.reduce((sum, member) => sum + member[axis], 0);
}
''',
    "teamAxisTotal helper",
)
old_track = '''  const trackList = useMemo(() => {
    if (!result) return [] as TeamEvaluation[];
    if (resultTrack === "overall") return result.byOverall;
    if (resultTrack === "stats") return result.byStats;
    if (resultTrack === "coverage") return result.byCoverage;
    return result.byAvgScoreUp;
  }, [result, resultTrack]);'''
new_track = '''  const trackList = useMemo(() => {
    if (!result) return [] as TeamEvaluation[];
    if (resultTrack === "overall") return result.byOverall;
    if (resultTrack === "stats") return result.byStats;
    if (resultTrack === "coverage") return result.byCoverage;
    if (resultTrack === "score") return result.byAvgScoreUp;
    const axis = resultTrack;
    const unique = new Map<string, TeamEvaluation>();
    for (const team of [
      ...result.top,
      ...result.byOverall,
      ...result.byStats,
      ...result.byCoverage,
      ...result.byAvgScoreUp,
    ]) {
      unique.set(teamDecisionKey(team), team);
    }
    return [...unique.values()]
      .sort((a, b) => teamAxisTotal(b, axis) - teamAxisTotal(a, axis))
      .slice(0, 8);
  }, [result, resultTrack]);'''
text = replace_once(text, old_track, new_track, "specialist track list")
old_metric = '''    if (resultTrack === "coverage") {
      return t.metricCoverage((ev.coverage * 100).toFixed(1));
    }
    return t.metricAvgUp(ev.avgScoreUp.toFixed(1));'''
new_metric = '''    if (resultTrack === "coverage") {
      return t.metricCoverage((ev.coverage * 100).toFixed(1));
    }
    if (resultTrack === "performance") return `P ${teamAxisTotal(ev, "performance").toLocaleString()}`;
    if (resultTrack === "technique") return `T ${teamAxisTotal(ev, "technique").toLocaleString()}`;
    if (resultTrack === "sense") return `S ${teamAxisTotal(ev, "sense").toLocaleString()}`;
    return t.metricAvgUp(ev.avgScoreUp.toFixed(1));'''
text = replace_once(text, old_metric, new_metric, "specialist metric labels")
old_stats_tab = '''                    {
                      id: "stats" as const,
                      title: t.trackStats,
                      icon: "◆",
                      desc: t.trackStatsDesc,
                    },
                    {
                      id: "coverage" as const,'''
new_stats_tab = '''                    {
                      id: "stats" as const,
                      title: t.trackStats,
                      icon: "◆",
                      desc: t.trackStatsDesc,
                    },
                    {
                      id: "performance" as const,
                      title: locale === "ja" ? "P特化" : locale === "en" ? "P Focus" : "P 特化",
                      icon: "P",
                      desc: locale === "ja" ? "補正後パフォーマンス合計順" : locale === "en" ? "Rank by total buffed Performance" : "依加成後表演力總和排序",
                    },
                    {
                      id: "technique" as const,
                      title: locale === "ja" ? "T特化" : locale === "en" ? "T Focus" : "T 特化",
                      icon: "T",
                      desc: locale === "ja" ? "補正後テクニック合計順" : locale === "en" ? "Rank by total buffed Technique" : "依加成後技巧總和排序",
                    },
                    {
                      id: "sense" as const,
                      title: locale === "ja" ? "S特化" : locale === "en" ? "S Focus" : "S 特化",
                      icon: "S",
                      desc: locale === "ja" ? "補正後センス合計順" : locale === "en" ? "Rank by total buffed Sense" : "依加成後感性總和排序",
                    },
                    {
                      id: "coverage" as const,'''
text = replace_once(text, old_stats_tab, new_stats_tab, "P/T/S tabs")
old_score_strip = '''                <div className="decision-score-card">
                  <span className="label">PR · {locale === "ja" ? "候補内相対評価" : locale === "en" ? "Relative candidate score" : "帳號候選相對評分"}</span>
                  <strong>{detailEv.powerRating?.toFixed(0) ?? "—"}</strong>
                  <small>{locale === "ja" ? "検索候補が変わると尺度も変わります" : locale === "en" ? "Scale changes when the candidate pool changes" : "候選池改變時，PR 尺度也會改變"}</small>
                </div>'''
new_score_strip = '''                <div className="decision-score-card">
                  <span className="label">Unit Value</span>
                  <strong>{detailEv.effectiveStatTotal.toLocaleString()}</strong>
                  <small>{locale === "ja" ? `基礎 ${detailEv.baseStatTotal.toLocaleString()} · 補正 +${(detailEv.effectiveStatTotal - detailEv.baseStatTotal).toLocaleString()}` : locale === "en" ? `Base ${detailEv.baseStatTotal.toLocaleString()} · Buff +${(detailEv.effectiveStatTotal - detailEv.baseStatTotal).toLocaleString()}` : `基礎 ${detailEv.baseStatTotal.toLocaleString()} · 增益 +${(detailEv.effectiveStatTotal - detailEv.baseStatTotal).toLocaleString()}`}</small>
                </div>
                <div className="decision-score-card">
                  <span className="label">PR · {locale === "ja" ? "最高値比の完成度" : locale === "en" ? "Ratio-to-best completion" : "相對最高完成度"}</span>
                  <strong>{detailEv.powerRating?.toFixed(0) ?? "—"}</strong>
                  <small>{locale === "ja" ? "Unit 50%・Avg UP 30%・Coverage 20%" : locale === "en" ? "Unit 50% · Avg UP 30% · Coverage 20%" : "Unit 50% · Avg UP 30% · Coverage 20%"}</small>
                </div>'''
text = replace_once(text, old_score_strip, new_score_strip, "Unit Value score card")
# Compare table label
text = text.replace('<tr><td>{favoriteUi.stats}</td><td>{compareA.effectiveStatTotal.toLocaleString()}</td>', '<tr><td>Unit Value</td><td>{compareA.effectiveStatTotal.toLocaleString()}</td>', 1)
# Favorite metric label is now stable across languages.
text = text.replace('stats: "総合パラメータ",', 'stats: "Unit Value",', 1)
text = text.replace('stats: "Buffed stats",', 'stats: "Unit Value",', 1)
text = text.replace('stats: "加成後三圍",', 'stats: "Unit Value",', 1)
# PR explanatory copy in three locales.
text = text.replace(
    'prNote: "PRは絶対戦力ではありません。現有メンバー自動編成では、その検索内の候補について総合パラメータ・Score UPカバー率・平均UPをそれぞれ正規化し、3項目を同じ重みで平均して9999点満点に換算します。異なるアカウント間ではPRだけでなく3つの実数値も合わせて比較してください。",',
    'prNote: "PRは絶対戦力ではありません。Unit Value 50%・全曲平均UP 30%・Coverage 20%を、それぞれ今回候補の最高値に対する比率で評価し、総合トップを9999に換算します。最下位を0にするmin-max方式は使用しません。",',
    1,
)
text = text.replace(
    'prNote: "PR is not an absolute power value. In automatic owned-roster mode, buffed stats, Score UP coverage, and average effective Score UP are normalized within that search, averaged with equal weight, then scaled to 9999. For cross-account comparison, compare the three raw metrics as well as PR.",',
    'prNote: "PR is not an absolute power value. Unit Value 50%, full-song Avg UP 30%, and Coverage 20% are scored as ratios to the best value in the current candidate search, then the best weighted completion is scaled to 9999. The weakest candidate is no longer forced to zero by min-max normalization.",',
    1,
)
text = text.replace(
    'prNote: "PR 不是跨帳號的絕對戰力。現有隊員自動編隊時，會把該次搜尋候選的「加成後三圍、Score UP 覆蓋率、平均有效 Score UP」各自正規化，三項等權平均後換算成 9999 分。不同帳號要比較時，建議連同三項實際數值一起看。",',
    'prNote: "PR 不是跨帳號的絕對戰力。Unit Value 50%、全曲平均 UP 30%、Coverage 20% 都改用「本次候選最高值＝100%」的比率計分，再把最高綜合完成度換算成 9999；不再用最低候選硬歸零的 min-max。",',
    1,
)
# Roster PR context body.
old_context = '''                  : "這裡的 PR 是依目前這個遊戲帳號倉庫中實際持有的卡片與可用衣裝，對本次可組出的候選隊伍做相對評分。不同帳號互相比較時，請連同加成後三圍、覆蓋率與平均 UP 一起看，不要只看 PR。"}'''
new_context = '''                  : "這裡的 PR 是目前帳號倉庫本次候選的完成度評分：Unit Value 50%、平均 UP 30%、Coverage 20%，各自以本次最高值作為 100%，再將最佳綜合完成度換算成 9999。它不會再因為某隊剛好排名最後，就把該項硬算成 0 分。"}'''
text = replace_once(text, old_context, new_context, "zh roster PR context")
text = text.replace(
    '                  ? "ここで表示するPRは、このゲームアカウントの所持カード・衣装から作れる候補編成の中で比較した相対評価です。別アカウントと比較する場合は、PRだけでなく総合パラメータ・カバー率・平均UPも確認してください。"',
    '                  ? "PRはこのアカウントの今回候補に対する完成度です。Unit Value 50%・平均UP 30%・Coverage 20%を各項目の最高値比で評価し、総合トップを9999に換算します。"',
    1,
)
text = text.replace(
    '                  ? "PR here is a relative score among teams that can be built from this game account\'s saved inventory. When comparing different accounts, also compare buffed stats, coverage, and average UP instead of PR alone."',
    '                  ? "PR is a completion score for this account\'s current candidates: Unit Value 50%, Avg UP 30%, and Coverage 20%, each measured as a ratio to the best value in this search, with the top weighted result scaled to 9999."',
    1,
)
# Rule guide PR line.
text = text.replace(
    '<p><strong>PR：</strong>{locale === "ja" ? "このアカウントの今回の候補内での相対評価。" : locale === "en" ? "Relative score inside this account\'s current candidate search." : "只比較目前帳號這次搜尋中的候選隊伍，是相對分數。"}</p>',
    '<p><strong>PR：</strong>{locale === "ja" ? "Unit Value 50%・平均UP 30%・Coverage 20%を各項目の最高値比で評価する完成度。" : locale === "en" ? "Completion score using ratio-to-best Unit Value 50%, Avg UP 30%, and Coverage 20%." : "完成度評分：Unit Value 50%、平均 UP 30%、Coverage 20%，各自除以本次候選最高值後加權。"}</p>',
    1,
)
# Insert manual lab before the existing hypothetical-card simulator.
manual = '''          <ManualDeckLab
            data={data}
            locale={locale}
            accountId={activeRosterProfileId}
            accountName={activeRosterProfile?.name ?? rosterUi.account}
            ownedCardIds={[...rosterOwnedCardIdsForOptimize()]}
            ownedCostumeIds={[...rosterOwnedCostumeIdsForOptimize()]}
            seedTeam={result?.byOverall[0] ?? result?.best ?? null}
          />

'''
text = replace_once(text, '          <div className="simulator-panel">\n', manual + '          <div className="simulator-panel">\n', "manual lab insertion")
path.write_text(text, encoding="utf-8")

# --- Manual lab naming ---
path = Path("src/components/ManualDeckLab.tsx")
text = path.read_text(encoding="utf-8")
text = text.replace(
    '<span>{localize(locale, "加成後三圍", "Buffed stats", "補正後パラメータ")}</span>',
    '<span>Unit Value</span>',
    1,
)
path.write_text(text, encoding="utf-8")

# --- load styles ---
path = Path("src/main.tsx")
text = path.read_text(encoding="utf-8")
if 'import "./manual-deck-lab.css";' not in text:
    text = replace_once(
        text,
        'import "./decision-tools.css";\n',
        'import "./decision-tools.css";\nimport "./manual-deck-lab.css";\n',
        "manual lab CSS import",
    )
path.write_text(text, encoding="utf-8")

# --- README: scoring model and new tools ---
path = Path("README.md")
text = path.read_text(encoding="utf-8")
feature_anchor = '- 「為什麼是這隊？」規則式解釋：比較三圍、全曲平均 Score UP、Coverage、被動發動數與衣裝條件\n'
feature_extra = '- D4C 手動試算實驗室：用目前帳號倉庫自由指定隊長、衣裝與 #1～#5 卡面，即時顯示技能成立、Unit Value、P/T/S、SC、Coverage、Avg UP 與重複技能警告\n- 結果新增 P／T／S 特化排序，方便尋找表演力、技巧或感性取向的候選隊伍\n'
if feature_extra not in text:
    text = replace_once(text, feature_anchor, feature_anchor + feature_extra, "README manual lab features")
old_pr = '''PR 是依目前搜尋候選池做相對評分。現有隊員自動編隊時，會把候選隊伍的加成後三圍、Score UP Coverage、全曲平均有效 Score UP 正規化後合成，因此候選池不同時 PR 尺度也可能不同。'''
new_pr = '''PR 是目前搜尋候選池的「相對最高完成度」。不再採用最低候選＝0、最高候選＝1 的 min-max 正規化；改為將各隊的 **Unit Value／本次最高 Unit Value**、**全曲平均有效 Score UP／本次最高 Avg UP**、**Coverage／本次最高 Coverage** 轉成連續比率，再依 **50%／30%／20%** 加權。最後將本次最高綜合完成度換算為 9999。這樣兩支實際只差少量數值的隊伍，不會因為其中一支剛好墊底就被某一項強制算成 0 分。'''
text = replace_once(text, old_pr, new_pr, "README PR explanation")
unit_section = '''\n### Unit Value\n\nUnit Value 是隊伍在衣裝與已成立被動增益後的 P／T／S 總和，也就是目前介面原本的「加成後三圍」。網站會另外顯示基礎值與增益差，讓玩家區分「卡片本身高」與「靠隊伍效果拉高」兩種來源。\n'''
if '### Unit Value' not in text:
    text = text.replace('\n### SC\n', unit_section + '\n### SC\n', 1)
path.write_text(text, encoding="utf-8")

print("Applied ratio-to-best PR, Unit Value, P/T/S tracks, and manual deck lab integration.")
