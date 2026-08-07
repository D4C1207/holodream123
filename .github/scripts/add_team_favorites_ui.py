from pathlib import Path

path = Path("src/App.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    text = text.replace(old, new, 1)


replace_once(
    'import type { Attr, Card, Costume, GameData, TeamEvaluation } from "./types";\n',
    'import { addTeamFavorite, loadTeamFavorites, removeTeamFavorite } from "./lib/teamFavorites";\nimport type { Attr, Card, Costume, GameData, TeamEvaluation } from "./types";\n',
    "favorites import",
)

replace_once(
    'type AppTheme = "gallery" | "optimize" | "roster";\n',
    'type AppTheme = "gallery" | "optimize" | "roster" | "favorites";\n',
    "favorites theme type",
)

replace_once(
    '''          };\n\n  const [rosterBootstrap] = useState(() => bootstrapRosterProfiles(data));\n''',
    '''          };\n\n  const favoriteUi =\n    locale === "ja"\n      ? {\n          tab: "保存編成",\n          tabSub: "全アカウント一覧",\n          title: "保存した編成",\n          note: "ゲームアカウントを切り替えず、すべての保存編成をまとめて表示します。アカウント名はタグで表示されます。",\n          empty: "保存した編成はまだありません。編成結果から「この編成を保存」を押してください。",\n          save: "この編成を保存",\n          saved: "編成を保存しました。",\n          remove: "削除",\n          globalPool: "最強編成 / 全カード",\n          account: "アカウント",\n          costume: "衣装",\n          stats: "総合パラメータ",\n          coverage: "カバー率",\n          avgUp: "平均UP",\n          prNote: "PRは絶対戦力ではありません。現有メンバー自動編成では、その検索内の候補について総合パラメータ・Score UPカバー率・平均UPをそれぞれ正規化し、3項目を同じ重みで平均して9999点満点に換算します。異なるアカウント間ではPRだけでなく3つの実数値も合わせて比較してください。",\n        }\n      : locale === "en"\n        ? {\n            tab: "Saved teams",\n            tabSub: "All accounts",\n            title: "Saved teams",\n            note: "View saved teams from every game account together without switching accounts. Each team carries an account tag.",\n            empty: "No saved teams yet. Save one from a team result.",\n            save: "Save this team",\n            saved: "Team saved.",\n            remove: "Delete",\n            globalPool: "Best Team / full pool",\n            account: "Account",\n            costume: "Costume",\n            stats: "Buffed stats",\n            coverage: "Coverage",\n            avgUp: "Avg UP",\n            prNote: "PR is not an absolute power value. In automatic owned-roster mode, buffed stats, Score UP coverage, and average effective Score UP are normalized within that search, averaged with equal weight, then scaled to 9999. For cross-account comparison, compare the three raw metrics as well as PR.",\n          }\n        : {\n            tab: "收藏隊伍",\n            tabSub: "全部帳號一覽",\n            title: "收藏隊伍",\n            note: "不用切換遊戲帳號，這裡會一次顯示所有帳號收藏的隊伍；每一隊都會附上帳號小標籤。",\n            empty: "目前還沒有收藏隊伍。請先在編隊結果按「收藏這隊」。",\n            save: "收藏這隊",\n            saved: "已收藏這隊。",\n            remove: "刪除",\n            globalPool: "最強編隊／全卡池",\n            account: "帳號",\n            costume: "衣裝",\n            stats: "加成後三圍",\n            coverage: "覆蓋率",\n            avgUp: "平均 UP",\n            prNote: "PR 不是跨帳號的絕對戰力。現有隊員自動編隊時，會把該次搜尋候選的「加成後三圍、Score UP 覆蓋率、平均有效 Score UP」各自正規化，三項等權平均後換算成 9999 分。不同帳號要比較時，建議連同三項實際數值一起看。",\n          };\n\n  const [rosterBootstrap] = useState(() => bootstrapRosterProfiles(data));\n''',
    "favorites locale ui",
)

replace_once(
    '''  const [allowDuplicateSkills, setAllowDuplicateSkills] = useState(true);\n  const [rosterProfiles, setRosterProfiles] = useState<RosterProfile[]>(rosterBootstrap.profiles);\n''',
    '''  const [allowDuplicateSkills, setAllowDuplicateSkills] = useState(true);\n  const [teamFavorites, setTeamFavorites] = useState(() => loadTeamFavorites());\n  const [rosterProfiles, setRosterProfiles] = useState<RosterProfile[]>(rosterBootstrap.profiles);\n''',
    "favorites state",
)

replace_once(
    '''  const detailProgress = detailEv\n    ? conditionProgress(\n        detailEv.costume.skill.condition,\n        detailEv.typeCounts,\n        detailEv.unitCounts,\n        attrLabel,\n      )\n    : null;\n\n  useEffect(() => {\n''',
    '''  const detailProgress = detailEv\n    ? conditionProgress(\n        detailEv.costume.skill.condition,\n        detailEv.typeCounts,\n        detailEv.unitCounts,\n        attrLabel,\n      )\n    : null;\n\n  function saveCurrentTeam() {\n    if (!detailEv) return;\n    const accountId = theme === "roster" ? activeRosterProfile?.id ?? activeRosterProfileId : "__global__";\n    const accountName =\n      theme === "roster" ? activeRosterProfile?.name ?? rosterUi.account : favoriteUi.globalPool;\n    setTeamFavorites((prev) =>\n      addTeamFavorite(prev, {\n        accountId,\n        accountName,\n        cardIds: detailEv.cards.map((card) => card.id),\n        costumeId: detailEv.costume.id,\n        leaderIndex: detailEv.leaderIndex,\n        powerRating: detailEv.powerRating ?? null,\n        effectiveStatTotal: detailEv.effectiveStatTotal,\n        coverage: detailEv.coverage,\n        avgScoreUp: detailEv.avgScoreUp,\n      }),\n    );\n    alert(favoriteUi.saved);\n  }\n\n  function deleteFavorite(favoriteId: string) {\n    setTeamFavorites((prev) => removeTeamFavorite(prev, favoriteId));\n  }\n\n  useEffect(() => {\n''',
    "favorites handlers",
)

replace_once(
    '''              <button\n                type="button"\n                className={`theme-tab ${theme === "roster" ? "active" : ""}`}\n                aria-selected={theme === "roster"}\n                onClick={() => setTheme("roster")}\n              >\n                {t.themeRoster}\n                <small>{t.themeRosterSub}</small>\n              </button>\n            </nav>\n''',
    '''              <button\n                type="button"\n                className={`theme-tab ${theme === "roster" ? "active" : ""}`}\n                aria-selected={theme === "roster"}\n                onClick={() => setTheme("roster")}\n              >\n                {t.themeRoster}\n                <small>{t.themeRosterSub}</small>\n              </button>\n              <button\n                type="button"\n                className={`theme-tab ${theme === "favorites" ? "active" : ""}`}\n                aria-selected={theme === "favorites"}\n                onClick={() => setTheme("favorites")}\n              >\n                {favoriteUi.tab}\n                <small>{favoriteUi.tabSub}</small>\n              </button>\n            </nav>\n''',
    "favorites nav button",
)

replace_once(
    '''      )}\n\n      {(theme === "optimize" || theme === "roster") && (\n''',
    '''      )}\n\n      {theme === "favorites" && (\n        <section className="panel favorites-panel">\n          <div className="panel-head">\n            <div>\n              <h2>{favoriteUi.title}</h2>\n              <p className="panel-note">{favoriteUi.note}</p>\n            </div>\n            <span className="favorite-count">{teamFavorites.length}</span>\n          </div>\n          <p className="favorite-pr-note">{favoriteUi.prNote}</p>\n          {teamFavorites.length === 0 ? (\n            <div className="empty">{favoriteUi.empty}</div>\n          ) : (\n            <div className="favorites-grid">\n              {teamFavorites.map((favorite) => {\n                const costume = data.costumes.find((item) => item.id === favorite.costumeId);\n                const currentAccountName =\n                  rosterProfiles.find((profile) => profile.id === favorite.accountId)?.name ??\n                  favorite.accountName;\n                return (\n                  <article key={favorite.id} className="favorite-card">\n                    <div className="favorite-card-head">\n                      <div>\n                        <span className="favorite-account-tag">\n                          {favoriteUi.account} · {currentAccountName}\n                        </span>\n                        <div className="favorite-date">\n                          {new Date(favorite.savedAt).toLocaleString()}\n                        </div>\n                      </div>\n                      <button\n                        className="btn btn-ghost"\n                        type="button"\n                        onClick={() => deleteFavorite(favorite.id)}\n                      >\n                        {favoriteUi.remove}\n                      </button>\n                    </div>\n                    <div className="favorite-metrics">\n                      <div className="favorite-metric">\n                        <strong>PR</strong>\n                        <span>{favorite.powerRating?.toFixed(0) ?? "—"}</span>\n                      </div>\n                      <div className="favorite-metric">\n                        <strong>{favoriteUi.stats}</strong>\n                        <span>{favorite.effectiveStatTotal.toLocaleString()}</span>\n                      </div>\n                      <div className="favorite-metric">\n                        <strong>{favoriteUi.coverage}</strong>\n                        <span>{(favorite.coverage * 100).toFixed(1)}%</span>\n                      </div>\n                      <div className="favorite-metric">\n                        <strong>{favoriteUi.avgUp}</strong>\n                        <span>{favorite.avgScoreUp.toFixed(1)}%</span>\n                      </div>\n                    </div>\n                    <p className="favorite-costume">\n                      {favoriteUi.costume} · {costume?.costumeName ?? favorite.costumeId}\n                    </p>\n                    <div className="favorite-team">\n                      {favorite.cardIds.map((cardId) => {\n                        const card = cardById.get(cardId);\n                        if (!card) return null;\n                        return (\n                          <div key={cardId} className="favorite-member">\n                            <CardArt cardId={card.id} alt={card.costumeName} />\n                            <span className="favorite-member-name">\n                              {listName(card.member, unitsOf(card.member), locale)}\n                            </span>\n                          </div>\n                        );\n                      })}\n                    </div>\n                  </article>\n                );\n              })}\n            </div>\n          )}\n        </section>\n      )}\n\n      {(theme === "optimize" || theme === "roster") && (\n''',
    "favorites overview section",
)

replace_once(
    '''              {viewingPrBaseline && prBaselineTeam ? (\n                <p className="pr-baseline-banner">{t.prBaselineViewBanner}</p>\n              ) : null}\n              <div className="stats-row stats-row-5">\n''',
    '''              {viewingPrBaseline && prBaselineTeam ? (\n                <p className="pr-baseline-banner">{t.prBaselineViewBanner}</p>\n              ) : null}\n              <div className="result-actions">\n                <button className="btn btn-primary" type="button" onClick={saveCurrentTeam}>\n                  ☆ {favoriteUi.save}\n                </button>\n              </div>\n              <div className="stats-row stats-row-5">\n''',
    "save favorite button",
)

path.write_text(text, encoding="utf-8")
print("Team favorites UI migration applied.")
