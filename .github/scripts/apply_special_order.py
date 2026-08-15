from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# optimizer.ts: normalize every automatic result into the Special Skill recommendation order.
path = Path("src/lib/optimizer.ts")
text = path.read_text()
text = replace_once(
    text,
    'import type { Card, Costume, GameData, TeamEvaluation } from "../types";\n',
    'import type { Card, Costume, GameData, TeamEvaluation } from "../types";\nimport { applyRecommendedSpecialOrder } from "./specialOrder";\n',
    "optimizer import",
)
text = replace_once(
    text,
    '  const top = rankByPowerRating(cached, 8, null);\n',
    '  const top = rankByPowerRating(cached, 8, null).map(applyRecommendedSpecialOrder);\n',
    "cached ordering",
)
old_finish = '''  const byOverall = rankByPowerRating(prPool, trackSize, baseline);\n  const seen = new Set<string>();\n  const top: TeamEvaluation[] = [];\n  for (const list of [byOverall, byAvgScoreUp, byCoverage, byStats]) {\n    for (const t of list) {\n      const k = teamKey(t);\n      if (seen.has(k)) continue;\n      seen.add(k);\n      top.push(t);\n    }\n  }\n  return {\n    best: byOverall[0] ?? byAvgScoreUp[0] ?? byCoverage[0] ?? byStats[0] ?? null,\n    top,\n    byOverall,\n    byStats,\n    byCoverage,\n    byAvgScoreUp,\n    baselineTeam: baseline,\n'''
new_finish = '''  const byOverall = rankByPowerRating(prPool, trackSize, baseline).map(applyRecommendedSpecialOrder);\n  const orderedByStats = byStats.map(applyRecommendedSpecialOrder);\n  const orderedByCoverage = byCoverage.map(applyRecommendedSpecialOrder);\n  const orderedByAvgScoreUp = byAvgScoreUp.map(applyRecommendedSpecialOrder);\n  const orderedBaseline = baseline ? applyRecommendedSpecialOrder(baseline) : null;\n  const seen = new Set<string>();\n  const top: TeamEvaluation[] = [];\n  for (const list of [byOverall, orderedByAvgScoreUp, orderedByCoverage, orderedByStats]) {\n    for (const t of list) {\n      const k = teamKey(t);\n      if (seen.has(k)) continue;\n      seen.add(k);\n      top.push(t);\n    }\n  }\n  return {\n    best: byOverall[0] ?? orderedByAvgScoreUp[0] ?? orderedByCoverage[0] ?? orderedByStats[0] ?? null,\n    top,\n    byOverall,\n    byStats: orderedByStats,\n    byCoverage: orderedByCoverage,\n    byAvgScoreUp: orderedByAvgScoreUp,\n    baselineTeam: orderedBaseline,\n'''
text = replace_once(text, old_finish, new_finish, "finish ordering")
path.write_text(text)


# ManualDeckLab.tsx: add a one-click Special sequence suggestion but preserve manual control.
path = Path("src/components/ManualDeckLab.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { listName } from "../lib/names";\n',
    'import { listName } from "../lib/names";\nimport { recommendSpecialOrder, specialOrderMetrics } from "../lib/specialOrder";\n',
    "manual import",
)
ready_anchor = '''  const hasDuplicateMember = new Set(selectedMembers).size !== selectedMembers.length;\n  const ready = selectedCards.every((card) => !!card) && !!selectedCostume && !hasDuplicateMember;\n\n'''
ready_new = '''  const hasDuplicateMember = new Set(selectedMembers).size !== selectedMembers.length;\n  const ready = selectedCards.every((card) => !!card) && !!selectedCostume && !hasDuplicateMember;\n  const specialSuggestion = useMemo(() => {\n    if (!ready) return [];\n    return recommendSpecialOrder(selectedCards.filter((card): card is Card => !!card));\n  }, [ready, selectedCards]);\n\n  function applySpecialSuggestion() {\n    if (specialSuggestion.length !== SLOT_COUNT) return;\n    setCardIds(specialSuggestion.map((entry) => entry.card.id));\n  }\n\n'''
text = replace_once(text, ready_anchor, ready_new, "manual suggestion logic")
button_anchor = '''              <button className="btn btn-ghost" type="button" disabled={!seedAvailable} onClick={loadSeedTeam}>\n                {localize(locale, "載入目前最佳隊", "Load current best", "現在の最適編成を読込")}\n              </button>\n'''
button_new = button_anchor + '''              <button className="btn btn-ghost" type="button" disabled={!ready} onClick={applySpecialSuggestion}>\n                ↕ {localize(locale, "套用 Special 建議順序", "Apply Special order", "Special 推奨順を適用")}\n              </button>\n'''
text = replace_once(text, button_anchor, button_new, "manual suggestion button")
old_note = '''          <p className="manual-order-note">\n            {localize(\n              locale,\n              "#1～#5 會保存為實際遊戲擺放順序。SC 目前不模擬特殊技能的發動先後，所以順序可以保留，但不會因此改變本頁 SC。",\n              "Slots #1–#5 are saved as the in-game order. SC does not currently model special-skill activation order, so reordering does not change SC here.",\n              "#1～#5 はゲーム内の配置順として保存されます。SC は現時点でスペシャルスキルの発動順をモデル化していないため、並べ替えてもこの画面の SC は変わりません。",\n            )}\n          </p>\n'''
new_note = '''          <p className="manual-order-note">\n            {localize(\n              locale,\n              "#1～#5 就是遊戲內實際擺放順序，也是 Special Skill 的發動先後。可自行調整，或用上方按鈕套用實驗性建議順序；目前 PR／SC 不會把尚未公開的 Special 精確時點硬算進去。",\n              "Slots #1–#5 are the actual in-game order and therefore the Special Skill activation sequence. Reorder manually or apply the experimental suggestion above; PR/SC do not invent unconfirmed Special timing effects.",\n              "#1～#5 はゲーム内の実際の配置順で、Special Skill の発動順でもあります。手動調整または上の実験的推奨順を利用できます。未公開の正確な発動時点は PR／SC に無理に算入しません。",\n            )}\n          </p>\n          {selectedCards.some(Boolean) && (\n            <div className="manual-special-order">\n              <div className="manual-special-order-head">\n                <strong>{localize(locale, "目前 Special 發動序", "Current Special sequence", "現在の Special 発動順")}</strong>\n                <span className="special-order-badge">EXPERIMENTAL</span>\n              </div>\n              <div className="manual-special-order-list">\n                {selectedCards.map((card, index) => {\n                  if (!card) return null;\n                  const metrics = specialOrderMetrics(card);\n                  const reason = metrics.skillRate > 0\n                    ? localize(\n                        locale,\n                        `${metrics.conditionalSkillRate ? "條件型 " : ""}Skill Rate +${metrics.skillRate}%`,\n                        `${metrics.conditionalSkillRate ? "Conditional " : ""}Skill Rate +${metrics.skillRate}%`,\n                        `${metrics.conditionalSkillRate ? "条件付き " : ""}Skill Rate +${metrics.skillRate}%`,\n                      )\n                    : `Support ${metrics.scoreSupport}% × ${metrics.duration}s`;\n                  return (\n                    <div key={`${card.id}-${index}`} className="manual-special-order-item">\n                      <span>#{index + 1}</span>\n                      <span>{listName(card.member, data.members[card.member]?.units ?? [], locale)} · {card.special.raw}</span>\n                      <small>{reason}</small>\n                    </div>\n                  );\n                })}\n              </div>\n            </div>\n          )}\n'''
text = replace_once(text, old_note, new_note, "manual order note")
path.write_text(text)


# App.tsx: show why the automatic #1-#5 sequence was chosen.
path = Path("src/App.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { restoreFullBackup, stringifyFullBackup } from "./lib/fullBackup";\n',
    'import { restoreFullBackup, stringifyFullBackup } from "./lib/fullBackup";\nimport { specialOrderMetrics } from "./lib/specialOrder";\n',
    "app import",
)
team_anchor = '''              <div className="team">\n                {detailEv.cards.map((card, i) => {\n'''
special_panel = '''              <div className="special-order-panel">\n                <div className="special-order-head">\n                  <div>\n                    <strong>{locale === "ja" ? "Special Skill 発動順" : locale === "en" ? "Special Skill activation order" : "Special Skill 發動順序"}</strong>\n                    <small>\n                      {locale === "ja"\n                        ? "#1→#5 の順で発動。現在は Skill Rate UP を前寄せし、その後に Score Support × 継続時間を優先する実験的ルールです。"\n                        : locale === "en"\n                          ? "Activates #1→#5. The current experimental rule places Skill Rate UP earlier, then prioritizes Score Support × duration."\n                          : "會依 #1→#5 發動。目前採實驗性規則：優先把 Skill Rate UP 放前面，再依 Score Support × 持續時間排列。"}\n                    </small>\n                  </div>\n                  <span className="special-order-badge">EXPERIMENTAL</span>\n                </div>\n                <div className="special-order-list">\n                  {detailEv.cards.map((card, index) => {\n                    const metrics = specialOrderMetrics(card);\n                    const reason = metrics.skillRate > 0\n                      ? (locale === "ja"\n                          ? `${metrics.conditionalSkillRate ? "条件付き " : ""}Skill Rate +${metrics.skillRate}% を前寄せ`\n                          : locale === "en"\n                            ? `${metrics.conditionalSkillRate ? "Conditional " : ""}Skill Rate +${metrics.skillRate}% earlier`\n                            : `${metrics.conditionalSkillRate ? "條件型 " : ""}Skill Rate +${metrics.skillRate}% 優先前置`)\n                      : `Support ${metrics.scoreSupport}% × ${metrics.duration}s`;\n                    return (\n                      <div key={`special-${card.id}-${index}`} className="special-order-row">\n                        <span className="special-order-number">#{index + 1}</span>\n                        <div>\n                          <strong>{listName(card.member, unitsOf(card.member), locale)}</strong>\n                          <span>{card.special.raw}</span>\n                        </div>\n                        <small className="special-order-reason">{reason}</small>\n                      </div>\n                    );\n                  })}\n                </div>\n                <p className="special-order-footnote">\n                  {locale === "ja"\n                    ? "Special は1ライブ中に1回、編成順で発動する仕様に合わせた順序提案です。正確な発動時点と公式スコア式は未公開のため、この順序効果はまだ PR／SC に加算していません。"\n                    : locale === "en"\n                      ? "This follows the confirmed one-Special-per-live, formation-order sequence. Exact trigger timing and the official score formula are not public, so order effects are not yet added to PR/SC."\n                      : "這個建議依據「Special 每場一次、按編成順序發動」的規則。由於精確觸發時點與官方分數公式尚未公開，順序效果目前不會硬加進 PR／SC。"}\n                </p>\n              </div>\n\n'''
text = replace_once(text, team_anchor, special_panel + team_anchor, "result special panel")
path.write_text(text)


# main.tsx: load styles.
path = Path("src/main.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import "./roster-constraints.css";\n',
    'import "./roster-constraints.css";\nimport "./special-order.css";\n',
    "main css import",
)
path.write_text(text)


# README: document behavior and limitation.
path = Path("README.md")
text = path.read_text()
anchor = '- 編隊結果的第 1～5 位代表遊戲內實際位置，遊戲中應依網站輸出的相同順序擺放\n'
new = anchor + '- Special Skill 發動順序建議：自動編隊會輸出 #1→#5 的實驗性 Special 順序（優先 Skill Rate UP，再比較 Score Support × 持續時間）；手動試算可一鍵套用或自行調整。由於官方完整觸發時點／分數公式未公開，此順序效果目前不納入 PR／SC\n'
text = replace_once(text, anchor, new, "README bullet")
path.write_text(text)

print("Applied Special Skill activation-order recommendation and UI.")
