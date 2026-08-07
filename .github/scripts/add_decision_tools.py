from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    'import { optimizeTeamFast, buildOptimizeResultFromCache, hydratePrCostumeTop8 } from "./lib/optimizer";\n',
    'import { optimizeTeamFast, buildOptimizeResultFromCache, hydratePrCostumeTop8 } from "./lib/optimizer";\n',
    "optimizer import anchor",
)
replace_once(
    'import { addTeamFavorite, loadTeamFavorites, removeTeamFavorite } from "./lib/teamFavorites";\n',
    '''import {
  addTeamFavorite,
  loadTeamFavorites,
  removeTeamFavorite,
  updateTeamFavoriteTags,
} from "./lib/teamFavorites";
import {
  compareDecisionMetrics,
  d4cBattleIndex,
  explainTeamDecision,
  teamDecisionKey,
} from "./lib/teamDecision";
import { restoreFullBackup, stringifyFullBackup } from "./lib/fullBackup";
''',
    "decision imports",
)

replace_once(
    'const STORAGE_PREF_CARDS = "holodream-preferred-cards";\n',
    '''const STORAGE_PREF_CARDS = "holodream-preferred-cards";
const STORAGE_LAST_ROSTER_SCORE = "holodream-roster-last-score-v1";
const STORAGE_UI = "holodream-ui-v1";
const DATA_SNAPSHOT = "2026-08-08";
''',
    "storage constants",
)

replace_once(
    '''type OptimizeUiResult = {
  best: TeamEvaluation | null;
  top: TeamEvaluation[];
  byOverall: TeamEvaluation[];
  byStats: TeamEvaluation[];
  byCoverage: TeamEvaluation[];
  byAvgScoreUp: TeamEvaluation[];
  baselineTeam: TeamEvaluation | null;
  searched: number;
  elapsedMs: number;
};
''',
    '''type OptimizeUiResult = {
  best: TeamEvaluation | null;
  top: TeamEvaluation[];
  byOverall: TeamEvaluation[];
  byStats: TeamEvaluation[];
  byCoverage: TeamEvaluation[];
  byAvgScoreUp: TeamEvaluation[];
  baselineTeam: TeamEvaluation | null;
  searched: number;
  elapsedMs: number;
};

type RosterScoreSummary = {
  pr: number | null;
  d4cIndex: number;
  savedAt: string;
};

type CardSimulationResult = {
  cardId: string;
  before: TeamEvaluation | null;
  after: TeamEvaluation | null;
};

type UiState = {
  theme: AppTheme;
  cardsCompact: boolean;
};
''',
    "extra types",
)

replace_once(
    '''function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
''',
    '''function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadUiState(): UiState {
  const raw = loadJson<Partial<UiState>>(STORAGE_UI, {});
  const validTheme: AppTheme[] = ["gallery", "optimize", "roster", "favorites"];
  return {
    theme: raw.theme && validTheme.includes(raw.theme) ? raw.theme : "gallery",
    cardsCompact: raw.cardsCompact !== false,
  };
}

function signed(value: number, digits = 0): string {
  const out = value.toFixed(digits);
  return `${value > 0 ? "+" : ""}${out}`;
}
''',
    "ui loader",
)

replace_once(
    '''  const [rosterBootstrap] = useState(() => bootstrapRosterProfiles(data));
  const [theme, setTheme] = useState<AppTheme>("gallery");
''',
    '''  const [rosterBootstrap] = useState(() => bootstrapRosterProfiles(data));
  const [uiBootstrap] = useState(() => loadUiState());
  const [theme, setTheme] = useState<AppTheme>(uiBootstrap.theme);
''',
    "theme bootstrap",
)
replace_once(
    '''  const [cardsCompact, setCardsCompact] = useState(true);
  const [allowDuplicateSkills, setAllowDuplicateSkills] = useState(true);
  const [teamFavorites, setTeamFavorites] = useState(() => loadTeamFavorites());
''',
    '''  const [cardsCompact, setCardsCompact] = useState(uiBootstrap.cardsCompact);
  const [allowDuplicateSkills, setAllowDuplicateSkills] = useState(true);
  const [teamFavorites, setTeamFavorites] = useState(() => loadTeamFavorites());
  const [favoriteTagFilter, setFavoriteTagFilter] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [compareAKey, setCompareAKey] = useState("");
  const [compareBKey, setCompareBKey] = useState("");
  const [simCardId, setSimCardId] = useState("");
  const [simBusy, setSimBusy] = useState(false);
  const [simulation, setSimulation] = useState<CardSimulationResult | null>(null);
  const [lastRosterScores, setLastRosterScores] = useState<Record<string, RosterScoreSummary>>(
    () => loadJson(STORAGE_LAST_ROSTER_SCORE, {}),
  );
''',
    "decision states",
)

replace_once(
    '''  function rosterOwnedCostumeIdsForOptimize(): Set<string> {
    const costumeIds = new Set<string>();
    for (const cardId of rosterOwnedCardIdsForOptimize()) {
      const card = cardById.get(cardId);
      if (!card) continue;
      const costumeId = costumeIdByCardKey.get(`${card.member}|||${card.costumeName}`);
      if (costumeId) costumeIds.add(costumeId);
    }
    return costumeIds;
  }
''',
    '''  function costumeIdsForCardIds(cardIds: Set<string>): Set<string> {
    const costumeIds = new Set<string>();
    for (const cardId of cardIds) {
      const card = cardById.get(cardId);
      if (!card) continue;
      const costumeId = costumeIdByCardKey.get(`${card.member}|||${card.costumeName}`);
      if (costumeId) costumeIds.add(costumeId);
    }
    return costumeIds;
  }

  function rosterOwnedCostumeIdsForOptimize(): Set<string> {
    return costumeIdsForCardIds(rosterOwnedCardIdsForOptimize());
  }
''',
    "costume derivation helper",
)

replace_once(
    '''  const rosterMultiCardMembers = useMemo(() => {
    return ownedRosterMembers.filter((m) => rosterCardsForMember(m).length > 1);
  }, [ownedRosterMembers]);
''',
    '''  const rosterMultiCardMembers = useMemo(() => {
    return ownedRosterMembers.filter((m) => rosterCardsForMember(m).length > 1);
  }, [ownedRosterMembers]);

  const rosterOwnedCardCount = useMemo(
    () => rosterOwnedCardIdsForOptimize().size,
    [ownedRosterMembers, rosterOwnedCards],
  );
  const rosterOwnedCostumeCount = useMemo(
    () => rosterOwnedCostumeIdsForOptimize().size,
    [ownedRosterMembers, rosterOwnedCards],
  );
  const activeAccountFavoriteCount = useMemo(
    () => teamFavorites.filter((item) => item.accountId === activeRosterProfileId).length,
    [teamFavorites, activeRosterProfileId],
  );
  const favoriteTags = useMemo(
    () => [...new Set(teamFavorites.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b)),
    [teamFavorites],
  );
  const visibleFavorites = useMemo(
    () =>
      favoriteTagFilter
        ? teamFavorites.filter((item) => item.tags.includes(favoriteTagFilter))
        : teamFavorites,
    [teamFavorites, favoriteTagFilter],
  );
  const simulatableCards = useMemo(() => {
    const owned = rosterOwnedCardIdsForOptimize();
    return data.cards
      .filter(isOptimizePoolCard)
      .filter((card) => !owned.has(card.id))
      .sort(
        (a, b) =>
          memberSortKey(a.member) - memberSortKey(b.member) ||
          a.member.localeCompare(b.member, "ja") ||
          a.costumeName.localeCompare(b.costumeName, "ja"),
      );
  }, [ownedRosterMembers, rosterOwnedCards]);
''',
    "dashboard memos",
)

replace_once(
    '''  async function prepareAndRunOptimize(
    ownedCardIds: Set<string>,
    options: Omit<Parameters<typeof optimizeTeamFast>[1], "ownedCardIds">,
    sharePr9999Baseline = false,
  ) {
''',
    '''  async function prepareAndRunOptimize(
    ownedCardIds: Set<string>,
    options: Omit<Parameters<typeof optimizeTeamFast>[1], "ownedCardIds">,
    sharePr9999Baseline = false,
    onFinish?: (out: ReturnType<typeof optimizeTeamFast>) => void,
  ) {
''',
    "optimizer callback signature",
)
replace_once(
    '''    const finish = (out: ReturnType<typeof optimizeTeamFast>) => {
      setResult(out);
      setResultTrack("overall");
      setSelectedIdx(0);
      setBusy(false);
''',
    '''    const finish = (out: ReturnType<typeof optimizeTeamFast>) => {
      setResult(out);
      setResultTrack("overall");
      setSelectedIdx(0);
      setBusy(false);
      onFinish?.(out);
''',
    "optimizer finish callback",
)

replace_once(
    '''      },
      false,
    );
  }

  const galleryFilterSummary = [
''',
    '''      },
      false,
      (out) => {
        const best = out.byOverall[0] ?? out.best;
        if (!best) return;
        const next = {
          ...lastRosterScores,
          [activeRosterProfileId]: {
            pr: best.powerRating ?? null,
            d4cIndex: d4cBattleIndex(best),
            savedAt: new Date().toISOString(),
          },
        };
        setLastRosterScores(next);
        localStorage.setItem(STORAGE_LAST_ROSTER_SCORE, JSON.stringify(next));
      },
    );
  }

  const galleryFilterSummary = [
''',
    "save roster best score",
)

replace_once(
    '''  function saveCurrentTeam() {
    if (!detailEv) return;
    const accountId = theme === "roster" ? activeRosterProfile?.id ?? activeRosterProfileId : "__global__";
''',
    '''  function saveCurrentTeam() {
    if (!detailEv) return;
    const accountId = theme === "roster" ? activeRosterProfile?.id ?? activeRosterProfileId : "__global__";
''',
    "save team anchor",
)
replace_once(
    '''        powerRating: detailEv.powerRating ?? null,
        effectiveStatTotal: detailEv.effectiveStatTotal,
''',
    '''        powerRating: detailEv.powerRating ?? null,
        d4cIndex: d4cBattleIndex(detailEv),
        effectiveStatTotal: detailEv.effectiveStatTotal,
''',
    "save D4C index",
)

replace_once(
    '''  function deleteFavorite(favoriteId: string) {
    setTeamFavorites((prev) => removeTeamFavorite(prev, favoriteId));
  }

  useEffect(() => {
    setViewingPrBaseline(false);
  }, [result]);
''',
    '''  function deleteFavorite(favoriteId: string) {
    setTeamFavorites((prev) => removeTeamFavorite(prev, favoriteId));
  }

  function editFavoriteTags(favoriteId: string) {
    const current = teamFavorites.find((item) => item.id === favoriteId)?.tags ?? [];
    const raw = window.prompt(
      locale === "ja"
        ? "タグをカンマ区切りで入力"
        : locale === "en"
          ? "Enter tags separated by commas"
          : "輸入用途標籤，以逗號分隔",
      current.join(", "),
    );
    if (raw == null) return;
    const tags = raw.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
    setTeamFavorites((prev) => updateTeamFavoriteTags(prev, favoriteId, tags));
  }

  function downloadFullBackup() {
    const blob = new Blob([stringifyFullBackup()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `d4c-holodream-full-backup-${DATA_SNAPSHOT}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function restoreFullBackupFile(file: File | null) {
    if (!file) return;
    const ok = window.confirm(
      locale === "ja"
        ? "現在のD4Cローカルデータをバックアップ内容で置き換えますか？"
        : locale === "en"
          ? "Replace current D4C local data with this backup?"
          : "要用這份完整備份取代目前瀏覽器裡的 D4C 資料嗎？",
    );
    if (!ok) return;
    try {
      restoreFullBackup(await file.text());
      location.reload();
    } catch {
      alert(locale === "ja" ? "バックアップを読み込めませんでした。" : locale === "en" ? "Could not restore this backup." : "完整備份無法讀取。" );
    }
  }

  function runCardSimulation() {
    const card = cardById.get(simCardId);
    if (!card) return;
    const beforeIds = rosterOwnedCardIdsForOptimize();
    const afterIds = new Set(beforeIds);
    afterIds.add(card.id);
    const beforeMembers = [...ownedRosterMembers];
    const afterMembers = beforeMembers.includes(card.member)
      ? beforeMembers
      : [...beforeMembers, card.member];
    const beforeCostumes = costumeIdsForCardIds(beforeIds);
    const afterCostumes = costumeIdsForCardIds(afterIds);
    setSimBusy(true);
    setSimulation(null);
    setTimeout(() => {
      const before =
        beforeMembers.length >= 5 && beforeCostumes.size > 0
          ? optimizeTeamFast(data, {
              ownedCardIds: beforeIds,
              ownedCostumeIds: beforeCostumes,
              songLength: SONG_LENGTH,
              fixedLeader: null,
              fixedCostumeId: null,
              fixedMembers: [],
              memberPool: beforeMembers,
              maxResults: 8,
              allowDuplicateSkills,
            }).byOverall[0] ?? null
          : null;
      const after =
        afterMembers.length >= 5 && afterCostumes.size > 0
          ? optimizeTeamFast(data, {
              ownedCardIds: afterIds,
              ownedCostumeIds: afterCostumes,
              songLength: SONG_LENGTH,
              fixedLeader: null,
              fixedCostumeId: null,
              fixedMembers: [],
              memberPool: afterMembers,
              maxResults: 8,
              allowDuplicateSkills,
            }).byOverall[0] ?? null
          : null;
      setSimulation({ cardId: card.id, before, after });
      setSimBusy(false);
    }, 30);
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_UI, JSON.stringify({ theme, cardsCompact }));
  }, [theme, cardsCompact]);

  useEffect(() => {
    setViewingPrBaseline(false);
    setWhyOpen(false);
    const teams = result?.byOverall ?? [];
    setCompareAKey(teams[0] ? teamDecisionKey(teams[0]) : "");
    setCompareBKey(teams[1] ? teamDecisionKey(teams[1]) : "");
  }, [result]);
''',
    "decision functions and effects",
)

replace_once(
    '''  const detailEv = viewingPrBaseline && prBaselineTeam ? prBaselineTeam : selected;
  const detailProgress = detailEv
''',
    '''  const detailEv = viewingPrBaseline && prBaselineTeam ? prBaselineTeam : selected;
  const decisionReference = detailEv
    ? selectedIdx === 0
      ? trackList[1] ?? null
      : trackList[0] ?? null
    : null;
  const decisionExplanation = detailEv
    ? explainTeamDecision(detailEv, decisionReference, locale)
    : null;
  const comparePool = result?.byOverall ?? [];
  const compareA = comparePool.find((ev) => teamDecisionKey(ev) === compareAKey) ?? null;
  const compareB = comparePool.find((ev) => teamDecisionKey(ev) === compareBKey) ?? null;
  const compareDiff = compareA && compareB ? compareDecisionMetrics(compareA, compareB) : null;
  const detailProgress = detailEv
''',
    "decision computed values",
)

# Favorites: tools, filters, tags, D4C score.
replace_once(
    '''          <p className="favorite-pr-note">{favoriteUi.prNote}</p>
          {teamFavorites.length === 0 ? (
''',
    '''          <div className="favorite-tools">
            <label className="field">
              <span>{locale === "ja" ? "タグ絞り込み" : locale === "en" ? "Filter tag" : "用途標籤篩選"}</span>
              <select value={favoriteTagFilter} onChange={(e) => setFavoriteTagFilter(e.target.value)}>
                <option value="">{locale === "ja" ? "すべて" : locale === "en" ? "All tags" : "全部標籤"}</option>
                {favoriteTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>
            <button className="btn btn-ghost" type="button" onClick={downloadFullBackup}>
              {locale === "ja" ? "全データ保存" : locale === "en" ? "Full backup" : "完整備份"}
            </button>
            <label className="btn btn-ghost roster-import-btn">
              {locale === "ja" ? "全データ復元" : locale === "en" ? "Restore backup" : "完整還原"}
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  void restoreFullBackupFile(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          <p className="favorite-pr-note">{favoriteUi.prNote}</p>
          {visibleFavorites.length === 0 ? (
''',
    "favorite tools",
)
replace_once(
    '              {teamFavorites.map((favorite) => {\n',
    '              {visibleFavorites.map((favorite) => {\n',
    "visible favorite map",
)
replace_once(
    '''                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => deleteFavorite(favorite.id)}
                      >
                        {favoriteUi.remove}
                      </button>
''',
    '''                      <div className="favorite-card-actions">
                        <button className="btn btn-ghost" type="button" onClick={() => editFavoriteTags(favorite.id)}>
                          {locale === "ja" ? "タグ" : locale === "en" ? "Tags" : "標籤"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => deleteFavorite(favorite.id)}
                        >
                          {favoriteUi.remove}
                        </button>
                      </div>
''',
    "favorite action buttons",
)
replace_once(
    '''                    <div className="favorite-metrics">
                      <div className="favorite-metric">
                        <strong>PR</strong>
                        <span>{favorite.powerRating?.toFixed(0) ?? "—"}</span>
                      </div>
''',
    '''                    {favorite.tags.length > 0 && (
                      <div className="favorite-tags">
                        {favorite.tags.map((tag) => <span key={tag} className="favorite-tag">{tag}</span>)}
                      </div>
                    )}
                    <div className="favorite-metrics">
                      <div className="favorite-metric">
                        <strong>PR</strong>
                        <span>{favorite.powerRating?.toFixed(0) ?? "—"}</span>
                      </div>
                      <div className="favorite-metric">
                        <strong>D4C</strong>
                        <span>{favorite.d4cIndex?.toLocaleString() ?? "—"}</span>
                      </div>
''',
    "favorite D4C score and tags",
)

# Roster dashboard and explanations.
replace_once(
    '''          <div className="roster-account-bar">
''',
    '''          <div className="account-dashboard">
            <div className="account-dashboard-card primary">
              <span className="account-dashboard-label">{rosterUi.account}</span>
              <strong className="account-dashboard-value">{activeRosterProfile?.name ?? rosterUi.account}</strong>
              <span className="account-dashboard-sub">
                {lastRosterScores[activeRosterProfileId]
                  ? `PR ${lastRosterScores[activeRosterProfileId].pr ?? "—"} · D4C ${lastRosterScores[activeRosterProfileId].d4cIndex.toLocaleString()}`
                  : locale === "ja" ? "まだ編成計算していません" : locale === "en" ? "No saved calculation yet" : "尚未記錄最佳計算"}
              </span>
            </div>
            <div className="account-dashboard-card"><span className="account-dashboard-label">{locale === "ja" ? "メンバー" : locale === "en" ? "Members" : "角色"}</span><strong className="account-dashboard-value">{ownedRosterMembers.length}</strong></div>
            <div className="account-dashboard-card"><span className="account-dashboard-label">★5 / Event</span><strong className="account-dashboard-value">{rosterOwnedCardCount}</strong></div>
            <div className="account-dashboard-card"><span className="account-dashboard-label">{locale === "ja" ? "使用可能衣装" : locale === "en" ? "Costumes" : "可用衣裝"}</span><strong className="account-dashboard-value">{rosterOwnedCostumeCount}</strong></div>
            <div className="account-dashboard-card"><span className="account-dashboard-label">{locale === "ja" ? "保存編成" : locale === "en" ? "Saved teams" : "收藏隊伍"}</span><strong className="account-dashboard-value">{activeAccountFavoriteCount}</strong></div>
          </div>
          <div className="roster-account-bar">
''',
    "account dashboard",
)
replace_once(
    '''          </div>
          {ownedRosterMembers.length < 5 && (
            <p className="roster-hint">{t.rosterNeedFive}</p>
          )}
''',
    '''          </div>
          <details className="rule-guide">
            <summary>{locale === "ja" ? "計算ルールを見る" : locale === "en" ? "How the calculation works" : "計算規則與分數說明"}</summary>
            <div className="rule-guide-body">
              <p><strong>PR：</strong>{locale === "ja" ? "このアカウントの今回の候補内での相対評価。" : locale === "en" ? "Relative score inside this account's current candidate search." : "只比較目前帳號這次搜尋中的候選隊伍，是相對分數。"}</p>
              <p><strong>D4C：</strong>{locale === "ja" ? "固定式の実戦指数。(総合パラメータ + スコアサポート加重値) × (1 + 全曲平均Score UP/100)。同じ曲長ならアカウント間で比較できます。" : locale === "en" ? "Fixed battle index: (buffed stats + score-support equivalent) × (1 + full-song Avg Score UP/100). Comparable across accounts under the same song length." : "固定公式的實戰指數：（加成後三圍 + 分數支援加權值）×（1 + 全曲平均有效 Score UP / 100）；同曲長時可跨帳號比較。"}</p>
              <p><strong>{locale === "ja" ? "隊長" : locale === "en" ? "Captain" : "隊長"}：</strong>{locale === "ja" ? "主に衣装スキルを決めます。現有メンバー編成ではシステムが自動で隊長と衣装を試します。" : locale === "en" ? "Mainly determines the costume skill; owned-roster mode automatically tests captain and costume choices." : "主要決定衣裝技能；現有隊員模式會自動測試可用隊長與衣裝，不用先指定。"}</p>
              <p><strong>{locale === "ja" ? "カード→衣装" : locale === "en" ? "Card → costume" : "卡面 → 衣裝"}：</strong>{locale === "ja" ? "選んだカードに対応する衣装だけを所持扱いにします。複数カードのメンバーは下のカード選択が基準です。" : locale === "en" ? "Only costumes linked to selected owned cards count as available; multi-card members use the card picker below." : "持有哪張卡就視為持有該卡對應衣裝；同角色多卡時完全以下方「★5 持有卡面」勾選為準。"}</p>
            </div>
          </details>
          {ownedRosterMembers.length < 5 && (
            <p className="roster-hint">{t.rosterNeedFive}</p>
          )}
''',
    "rule guide",
)

# Insert simulator immediately after card picker block and before roster section closes.
marker = '''          {rosterMultiCardMembers.length > 0 && (
            <div className="roster-card-pick">'''
start = text.find(marker)
if start < 0:
    raise SystemExit("simulator anchor start not found")
section_end = text.find('''        </section>\n      )}\n\n      {theme === "optimize" && (''', start)
if section_end < 0:
    raise SystemExit("simulator section end not found")
simulator = '''
          <div className="simulator-panel">
            <h3>{locale === "ja" ? "もしこのカードを持っていたら？" : locale === "en" ? "What if I owned this card?" : "如果我有這張卡呢？"}</h3>
            <p className="panel-note">
              {locale === "ja"
                ? "バッグを変更せず、未所持カードを1枚だけ仮追加して再計算します。別検索同士なのでPRではなくD4C実戦指数で前後比較します。"
                : locale === "en"
                  ? "Temporarily add one unowned card without changing your inventory. Because these are separate searches, the before/after comparison uses the fixed D4C Battle Index rather than PR."
                  : "不修改背包，暫時假設多持有一張卡重新計算。因為前後是兩次不同搜尋，所以用固定公式的 D4C 實戰指數比較，不拿 PR 硬比。"}
            </p>
            <div className="simulator-controls">
              <select value={simCardId} onChange={(e) => { setSimCardId(e.target.value); setSimulation(null); }}>
                <option value="">{locale === "ja" ? "未所持カードを選択" : locale === "en" ? "Choose an unowned card" : "選擇一張目前未持有卡"}</option>
                {simulatableCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {listName(card.member, unitsOf(card.member), locale)} · {card.costumeName}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" type="button" disabled={!simCardId || simBusy} onClick={runCardSimulation}>
                {simBusy ? (locale === "ja" ? "計算中…" : locale === "en" ? "Calculating…" : "試算中…") : (locale === "ja" ? "仮所持で計算" : locale === "en" ? "Simulate" : "假設持有並試算")}
              </button>
            </div>
            {simulation && (() => {
              const card = cardById.get(simulation.cardId);
              const beforeD4c = simulation.before ? d4cBattleIndex(simulation.before) : null;
              const afterD4c = simulation.after ? d4cBattleIndex(simulation.after) : null;
              const beforeMembers = new Set(simulation.before?.cards.map((c) => c.member) ?? []);
              const afterMembers = new Set(simulation.after?.cards.map((c) => c.member) ?? []);
              const entered = [...afterMembers].filter((m) => !beforeMembers.has(m));
              const left = [...beforeMembers].filter((m) => !afterMembers.has(m));
              return (
                <div className="simulator-result">
                  <div className="simulator-metric"><span>{locale === "ja" ? "仮カード" : locale === "en" ? "Hypothetical card" : "假設卡片"}</span><strong>{card ? listName(card.member, unitsOf(card.member), locale) : simulation.cardId}</strong></div>
                  <div className="simulator-metric"><span>D4C</span><strong>{beforeD4c == null ? "—" : beforeD4c.toLocaleString()} → {afterD4c == null ? "—" : afterD4c.toLocaleString()}</strong></div>
                  <div className="simulator-metric"><span>{locale === "ja" ? "総合パラメータ差" : locale === "en" ? "Buffed stats Δ" : "三圍差"}</span><strong>{simulation.before && simulation.after ? signed(simulation.after.effectiveStatTotal - simulation.before.effectiveStatTotal) : "—"}</strong></div>
                  <div className="simulator-metric"><span>Avg UP / Coverage</span><strong>{simulation.before && simulation.after ? `${signed(simulation.after.avgScoreUp - simulation.before.avgScoreUp, 1)}% / ${signed((simulation.after.coverage - simulation.before.coverage) * 100, 1)}pt` : "—"}</strong></div>
                  <p className="simulator-lineup-change">
                    {locale === "ja" ? "編成変更：" : locale === "en" ? "Lineup change: " : "隊伍變化："}
                    {entered.length || left.length
                      ? `${left.length ? `OUT ${left.map((m) => listName(m, unitsOf(m), locale)).join("、")}` : ""}${left.length && entered.length ? " / " : ""}${entered.length ? `IN ${entered.map((m) => listName(m, unitsOf(m), locale)).join("、")}` : ""}`
                      : locale === "ja" ? "メンバー変更なし" : locale === "en" ? "No member change" : "成員沒有變動"}
                  </p>
                </div>
              );
            })()}
          </div>
'''
text = text[:section_end] + simulator + text[section_end:]

# Comparison controls before result split.
replace_once(
    '''              {resultTrack === "overall" && result.baselineTeam && (
                <p className="pr-baseline-note">{t.prBaselineNote}</p>
              )}

              <div className="result-split">
''',
    '''              {resultTrack === "overall" && result.baselineTeam && (
                <p className="pr-baseline-note">{t.prBaselineNote}</p>
              )}

              {comparePool.length >= 2 && (
                <div className="compare-zone">
                  <div className="compare-toolbar">
                    <strong>A</strong>
                    <select value={compareAKey} onChange={(e) => setCompareAKey(e.target.value)}>
                      {comparePool.map((ev, idx) => <option key={`a-${teamDecisionKey(ev)}`} value={teamDecisionKey(ev)}>{idx + 1}. {ev.cards.map((c) => listName(c.member, unitsOf(c.member), locale)).join(" / ")}</option>)}
                    </select>
                    <strong>B</strong>
                    <select value={compareBKey} onChange={(e) => setCompareBKey(e.target.value)}>
                      {comparePool.map((ev, idx) => <option key={`b-${teamDecisionKey(ev)}`} value={teamDecisionKey(ev)}>{idx + 1}. {ev.cards.map((c) => listName(c.member, unitsOf(c.member), locale)).join(" / ")}</option>)}
                    </select>
                  </div>
                  {compareA && compareB && compareDiff && (
                    <table className="compare-table">
                      <thead><tr><th>{locale === "ja" ? "指標" : locale === "en" ? "Metric" : "指標"}</th><th>A</th><th>B</th><th>Δ A-B</th></tr></thead>
                      <tbody>
                        <tr><td>D4C</td><td>{d4cBattleIndex(compareA).toLocaleString()}</td><td>{d4cBattleIndex(compareB).toLocaleString()}</td><td className={`compare-diff ${compareDiff.d4cIndex >= 0 ? "good" : "bad"}`}>{signed(compareDiff.d4cIndex)}</td></tr>
                        <tr><td>PR</td><td>{compareA.powerRating?.toFixed(0) ?? "—"}</td><td>{compareB.powerRating?.toFixed(0) ?? "—"}</td><td>{compareA.powerRating != null && compareB.powerRating != null ? signed(compareA.powerRating - compareB.powerRating) : "—"}</td></tr>
                        <tr><td>{favoriteUi.stats}</td><td>{compareA.effectiveStatTotal.toLocaleString()}</td><td>{compareB.effectiveStatTotal.toLocaleString()}</td><td className={`compare-diff ${compareDiff.effectiveStats >= 0 ? "good" : "bad"}`}>{signed(compareDiff.effectiveStats)}</td></tr>
                        <tr><td>{favoriteUi.coverage}</td><td>{(compareA.coverage * 100).toFixed(1)}%</td><td>{(compareB.coverage * 100).toFixed(1)}%</td><td className={`compare-diff ${compareDiff.coveragePctPoint >= 0 ? "good" : "bad"}`}>{signed(compareDiff.coveragePctPoint, 1)}pt</td></tr>
                        <tr><td>{favoriteUi.avgUp}</td><td>{compareA.avgScoreUp.toFixed(1)}%</td><td>{compareB.avgScoreUp.toFixed(1)}%</td><td className={`compare-diff ${compareDiff.avgScoreUp >= 0 ? "good" : "bad"}`}>{signed(compareDiff.avgScoreUp, 1)}pt</td></tr>
                        <tr><td>{locale === "ja" ? "パッシブ" : locale === "en" ? "Passives" : "被動"}</td><td>{compareA.passiveDetails.filter((p) => p.satisfied).length}/{compareA.passiveDetails.length}</td><td>{compareB.passiveDetails.filter((p) => p.satisfied).length}/{compareB.passiveDetails.length}</td><td>{signed(compareDiff.passiveSatisfied)}</td></tr>
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <div className="result-split">
''',
    "A B comparison",
)

# Decision explanation and D4C score near result actions.
replace_once(
    '''              <div className="result-actions">
                <button className="btn btn-primary" type="button" onClick={saveCurrentTeam}>
                  ☆ {favoriteUi.save}
                </button>
              </div>
              <div className="stats-row stats-row-5">
''',
    '''              <div className="result-actions">
                <button className="btn btn-primary" type="button" onClick={saveCurrentTeam}>
                  ☆ {favoriteUi.save}
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setWhyOpen((open) => !open)}>
                  ✦ {locale === "ja" ? "なぜこの編成？" : locale === "en" ? "Why this team?" : "為什麼是這隊？"}
                </button>
              </div>
              <div className="decision-score-strip">
                <div className="decision-score-card">
                  <span className="label">D4C · {locale === "ja" ? "実戦指数" : locale === "en" ? "Battle Index" : "實戰指數"}</span>
                  <strong>{d4cBattleIndex(detailEv).toLocaleString()}</strong>
                  <small>{locale === "ja" ? "固定式・同じ曲長ならアカウント間比較可" : locale === "en" ? "Fixed formula · comparable across accounts at the same song length" : "固定公式 · 同曲長可跨帳號比較"}</small>
                </div>
                <div className="decision-score-card">
                  <span className="label">PR · {locale === "ja" ? "候補内相対評価" : locale === "en" ? "Relative candidate score" : "帳號候選相對評分"}</span>
                  <strong>{detailEv.powerRating?.toFixed(0) ?? "—"}</strong>
                  <small>{locale === "ja" ? "検索候補が変わると尺度も変わります" : locale === "en" ? "Scale changes when the candidate pool changes" : "候選池改變時，PR 尺度也會改變"}</small>
                </div>
              </div>
              {whyOpen && decisionExplanation && (
                <div className="decision-explain">
                  <h3>{locale === "ja" ? "この編成を選ぶ理由" : locale === "en" ? "Why this team ranks here" : "為什麼推薦這隊"}</h3>
                  <p className="decision-explain-headline">{decisionExplanation.headline}</p>
                  <ul className="decision-reasons">{decisionExplanation.reasons.map((reason, idx) => <li key={`${idx}-${reason}`}>{reason}</li>)}</ul>
                </div>
              )}
              <div className="stats-row stats-row-5">
''',
    "why team panel",
)

# Footer data version.
replace_once(
    '''      <footer className="site-footer">
        <span>{t.footer}</span>
        <span className="footer-devil" aria-hidden />
      </footer>
''',
    '''      <footer className="site-footer">
        <span>
          {t.footer}
          <small className="data-version">
            {locale === "ja" ? "内蔵データ" : locale === "en" ? "Data snapshot" : "遊戲資料快照"} · {DATA_SNAPSHOT} · {data.cards.length} cards · {data.costumes.length} costumes
          </small>
        </span>
        <span className="footer-devil" aria-hidden />
      </footer>
''',
    "data version footer",
)

path.write_text(text, encoding="utf-8")
print("Decision tools migration applied")
