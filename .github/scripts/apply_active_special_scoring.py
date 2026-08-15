from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# optimizer.ts: keep Unit as half of PR, split the skill half Active:Special ~= 2:1.
path = Path("src/lib/optimizer.ts")
text = path.read_text()
text = replace_once(
    text,
    'import { applyRecommendedSpecialOrder } from "./specialOrder";\n',
    'import { applyRecommendedSpecialOrder, teamSpecialSynergy } from "./specialOrder";\n',
    "optimizer special import",
)
old_weights = '''const PR_WEIGHT_UNIT = 0.50;\nconst PR_WEIGHT_AVG_UP = 0.30;\nconst PR_WEIGHT_COVERAGE = 0.20;\n'''
new_weights = '''// PR keeps 50% on the actual buffed unit value. The remaining 50% is\n// skill-side completion, split roughly 2:1 between Active and Special to mirror\n// the useful part of Horodori's current Active 20 / Special 10 emphasis.\n// Active is represented by our stronger full-song model: Avg UP + Coverage.\nconst PR_WEIGHT_UNIT = 0.50;\nconst PR_WEIGHT_AVG_UP = 0.23;\nconst PR_WEIGHT_COVERAGE = 0.10;\nconst PR_WEIGHT_SPECIAL = 0.17;\n'''
text = replace_once(text, old_weights, new_weights, "PR weights")
old_completion = '''function prCompletion(\n  team: TeamEvaluation,\n  unitRef: number,\n  avgRef: number,\n  coverageRef: number,\n): number {\n  return (\n    ratioToReference(team.effectiveStatTotal, unitRef) * PR_WEIGHT_UNIT +\n    ratioToReference(team.avgScoreUp, avgRef) * PR_WEIGHT_AVG_UP +\n    ratioToReference(team.coverage, coverageRef) * PR_WEIGHT_COVERAGE\n  );\n}\n'''
new_completion = '''function prCompletion(\n  team: TeamEvaluation,\n  unitRef: number,\n  avgRef: number,\n  coverageRef: number,\n  specialRef: number,\n): number {\n  return (\n    ratioToReference(team.effectiveStatTotal, unitRef) * PR_WEIGHT_UNIT +\n    ratioToReference(team.avgScoreUp, avgRef) * PR_WEIGHT_AVG_UP +\n    ratioToReference(team.coverage, coverageRef) * PR_WEIGHT_COVERAGE +\n    ratioToReference(teamSpecialSynergy(team), specialRef) * PR_WEIGHT_SPECIAL\n  );\n}\n'''
text = replace_once(text, old_completion, new_completion, "PR completion")
text = replace_once(
    text,
    ' * PR = weighted completion vs best references: Unit 50% / Avg UP 30% / Coverage 20%.\n',
    ' * PR = weighted completion vs best references: Unit 50% / Active 33% / Special 17%.\n * Active 33% is Avg UP 23% + Coverage 10%.\n',
    "PR comment",
)
old_refs = '''  const unitRef = baseline?.effectiveStatTotal ?? Math.max(...use.map((t) => t.effectiveStatTotal));\n  const avgRef = baseline?.avgScoreUp ?? Math.max(...use.map((t) => t.avgScoreUp));\n  const coverageRef = baseline?.coverage ?? Math.max(...use.map((t) => t.coverage));\n\n  const raw = use.map((t) => ({\n    t,\n    completion: prCompletion(t, unitRef, avgRef, coverageRef),\n  }));\n'''
new_refs = '''  const unitRef = baseline?.effectiveStatTotal ?? Math.max(...use.map((t) => t.effectiveStatTotal));\n  const avgRef = baseline?.avgScoreUp ?? Math.max(...use.map((t) => t.avgScoreUp));\n  const coverageRef = baseline?.coverage ?? Math.max(...use.map((t) => t.coverage));\n  const specialRef = baseline\n    ? teamSpecialSynergy(baseline)\n    : Math.max(...use.map((t) => teamSpecialSynergy(t)));\n\n  const raw = use.map((t) => ({\n    t,\n    completion: prCompletion(t, unitRef, avgRef, coverageRef, specialRef),\n  }));\n'''
text = replace_once(text, old_refs, new_refs, "PR refs")
path.write_text(text)


# teamDecision.ts: expose Special synergy in comparisons and explanations; fix old D4C label to SC.
path = Path("src/lib/teamDecision.ts")
text = path.read_text()
text = replace_once(
    text,
    'import type { TeamEvaluation } from "../types";\n',
    'import type { TeamEvaluation } from "../types";\nimport { teamSpecialSynergy } from "./specialOrder";\n',
    "decision import",
)
text = replace_once(
    text,
    '  buffGain: number;\n};\n',
    '  buffGain: number;\n  specialSynergy: number;\n};\n',
    "decision metrics type",
)
text = replace_once(
    text,
    '  buffGain: number;\n};\n\nexport function teamDecisionKey',
    '  buffGain: number;\n  specialSynergy: number;\n};\n\nexport function teamDecisionKey',
    "decision diff type",
)
text = replace_once(
    text,
    '    buffGain: ev.effectiveStatTotal - ev.baseStatTotal,\n',
    '    buffGain: ev.effectiveStatTotal - ev.baseStatTotal,\n    specialSynergy: teamSpecialSynergy(ev),\n',
    "decision metrics value",
)
text = replace_once(
    text,
    '    buffGain: am.buffGain - bm.buffGain,\n',
    '    buffGain: am.buffGain - bm.buffGain,\n    specialSynergy: am.specialSynergy - bm.specialSynergy,\n',
    "decision diff value",
)
support_anchor = '''    if (Math.abs(diff.scoreSupportEquivalent) >= 1) {\n      reasons.push({\n        weight: Math.abs(diff.scoreSupportEquivalent) / 5000,\n        text: localized(\n          locale,\n          `分數支援加權值差異 ${signedNumber(diff.scoreSupportEquivalent, 0)}。`,\n          `Score-support equivalent differs by ${signedNumber(diff.scoreSupportEquivalent, 0)}.`,\n          `スコアサポート加重値の差は ${signedNumber(diff.scoreSupportEquivalent, 0)} です。`,\n        ),\n      });\n    }\n'''
support_new = support_anchor + '''    if (Math.abs(diff.specialSynergy) >= 0.01) {\n      reasons.push({\n        weight: Math.abs(diff.specialSynergy) / Math.max(1, reference ? teamSpecialSynergy(reference) : 1),\n        text: localized(\n          locale,\n          `Special × Active 聯動潛力 ${diff.specialSynergy >= 0 ? "較高" : "較低"}（差 ${signedNumber(diff.specialSynergy, 1)}）。`,\n          `Special × Active synergy is ${diff.specialSynergy >= 0 ? "higher" : "lower"} (${signedNumber(diff.specialSynergy, 1)} difference).`,\n          `Special × Active 連動ポテンシャルは ${diff.specialSynergy >= 0 ? "高い" : "低い"}です（差 ${signedNumber(diff.specialSynergy, 1)}）。`,\n        ),\n      });\n    }\n'''
text = replace_once(text, support_anchor, support_new, "special explanation")
text = text.replace('D4C 實戰指數 ${d4cBattleIndex(selected).toLocaleString()}', 'SC ${d4cBattleIndex(selected).toLocaleString()}')
text = text.replace('D4C Battle Index ${d4cBattleIndex(selected).toLocaleString()}', 'SC ${d4cBattleIndex(selected).toLocaleString()}')
text = text.replace('D4C 実戦指数 ${d4cBattleIndex(selected).toLocaleString()}', 'SC ${d4cBattleIndex(selected).toLocaleString()}')
path.write_text(text)


# ManualDeckLab.tsx: make order suggestions explicitly Active-aware, including satisfied Active bonuses.
path = Path("src/components/ManualDeckLab.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { d4cBattleIndex } from "../lib/teamDecision";\n',
    'import { d4cBattleIndex } from "../lib/teamDecision";\nimport { countTypes, countUnits } from "../lib/conditions";\n',
    "manual condition import",
)
old_suggestion = '''  const specialSuggestion = useMemo(() => {\n    if (!ready) return [];\n    return recommendSpecialOrder(selectedCards.filter((card): card is Card => !!card));\n  }, [ready, selectedCards]);\n'''
new_suggestion = '''  const specialSuggestion = useMemo(() => {\n    if (!ready) return [];\n    const cards = selectedCards.filter((card): card is Card => !!card);\n    const context = { typeCounts: countTypes(cards), unitCounts: countUnits(cards, data) };\n    return recommendSpecialOrder(cards, context);\n  }, [data, ready, selectedCards]);\n'''
text = replace_once(text, old_suggestion, new_suggestion, "manual active-aware suggestion")
old_manual_metrics = '''                  const metrics = specialOrderMetrics(card);\n                  const reason = metrics.skillRate > 0\n                    ? localize(\n                        locale,\n                        `${metrics.conditionalSkillRate ? "條件型 " : ""}Skill Rate +${metrics.skillRate}%`,\n                        `${metrics.conditionalSkillRate ? "Conditional " : ""}Skill Rate +${metrics.skillRate}%`,\n                        `${metrics.conditionalSkillRate ? "条件付き " : ""}Skill Rate +${metrics.skillRate}%`,\n                      )\n                    : `Support ${metrics.scoreSupport}% × ${metrics.duration}s`;\n'''
new_manual_metrics = '''                  const teamCards = selectedCards.filter((item): item is Card => !!item);\n                  const context = { typeCounts: countTypes(teamCards), unitCounts: countUnits(teamCards, data) };\n                  const metrics = specialOrderMetrics(card, teamCards, context);\n                  const reason = metrics.skillRate > 0\n                    ? localize(\n                        locale,\n                        `${metrics.conditionalSkillRate ? "條件型 " : ""}Skill Rate +${metrics.skillRate}% × Active聯動 ${metrics.activeSynergy.toFixed(1)}`,\n                        `${metrics.conditionalSkillRate ? "Conditional " : ""}Skill Rate +${metrics.skillRate}% × Active synergy ${metrics.activeSynergy.toFixed(1)}`,\n                        `${metrics.conditionalSkillRate ? "条件付き " : ""}Skill Rate +${metrics.skillRate}% × Active連動 ${metrics.activeSynergy.toFixed(1)}`,\n                      )\n                    : `Support ${metrics.scoreSupport}% × ${metrics.duration}s · Active ${metrics.activeSynergy.toFixed(1)}`;\n'''
text = replace_once(text, old_manual_metrics, new_manual_metrics, "manual active-aware display")
path.write_text(text)


# App.tsx: update PR display and Special-order explanation to Active-aware scoring.
path = Path("src/App.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { specialOrderMetrics } from "./lib/specialOrder";\n',
    'import { specialOrderMetrics, teamSpecialSynergy } from "./lib/specialOrder";\n',
    "app special import",
)
text = text.replace('Unit 50% · Avg UP 30% · Coverage 20%', 'Unit 50% · Active 33% · Special 17%')
text = text.replace('Unit 50%・Avg UP 30%・Coverage 20%', 'Unit 50%・Active 33%・Special 17%')
old_special_intro_zh = '會依 #1→#5 發動。目前採實驗性規則：優先把 Skill Rate UP 放前面，再依 Score Support × 持續時間排列。'
new_special_intro_zh = '會依 #1→#5 發動。建議順序會同時看 Special 與 5 張卡的 Active：發動間隔、機率、持續時間、Score UP 與已成立的追加倍率。'
text = text.replace(old_special_intro_zh, new_special_intro_zh)
text = text.replace(
    'Activates #1→#5. The current experimental rule places Skill Rate UP earlier, then prioritizes Score Support × duration.',
    'Activates #1→#5. The suggestion is Active-aware: interval, probability, duration, Score UP and satisfied Active bonuses are evaluated together with each Special.',
)
text = text.replace(
    '#1→#5 の順で発動。現在は Skill Rate UP を前寄せし、その後に Score Support × 継続時間を優先する実験的ルールです。',
    '#1→#5 の順で発動。Special だけでなく、5枚の Active の間隔・確率・継続時間・Score UP・成立した追加倍率も合わせて評価します。',
)
old_app_metrics = '''                    const metrics = specialOrderMetrics(card);\n                    const reason = metrics.skillRate > 0\n                      ? (locale === "ja"\n                          ? `${metrics.conditionalSkillRate ? "条件付き " : ""}Skill Rate +${metrics.skillRate}% を前寄せ`\n                          : locale === "en"\n                            ? `${metrics.conditionalSkillRate ? "Conditional " : ""}Skill Rate +${metrics.skillRate}% earlier`\n                            : `${metrics.conditionalSkillRate ? "條件型 " : ""}Skill Rate +${metrics.skillRate}% 優先前置`)\n                      : `Support ${metrics.scoreSupport}% × ${metrics.duration}s`;\n'''
new_app_metrics = '''                    const metrics = specialOrderMetrics(card, detailEv.cards, {\n                      typeCounts: detailEv.typeCounts,\n                      unitCounts: detailEv.unitCounts,\n                    });\n                    const reason = metrics.skillRate > 0\n                      ? (locale === "ja"\n                          ? `${metrics.conditionalSkillRate ? "条件付き " : ""}Skill Rate +${metrics.skillRate}% · Active連動 ${metrics.activeSynergy.toFixed(1)}`\n                          : locale === "en"\n                            ? `${metrics.conditionalSkillRate ? "Conditional " : ""}Skill Rate +${metrics.skillRate}% · Active synergy ${metrics.activeSynergy.toFixed(1)}`\n                            : `${metrics.conditionalSkillRate ? "條件型 " : ""}Skill Rate +${metrics.skillRate}% · Active聯動 ${metrics.activeSynergy.toFixed(1)}`)\n                      : `Support ${metrics.scoreSupport}% × ${metrics.duration}s · Active ${metrics.activeSynergy.toFixed(1)}`;\n'''
text = replace_once(text, old_app_metrics, new_app_metrics, "app active-aware special display")
avg_row = '''                        <tr><td>{favoriteUi.avgUp}</td><td>{compareA.avgScoreUp.toFixed(1)}%</td><td>{compareB.avgScoreUp.toFixed(1)}%</td><td className={`compare-diff ${compareDiff.avgScoreUp >= 0 ? "good" : "bad"}`}>{signed(compareDiff.avgScoreUp, 1)}pt</td></tr>\n'''
new_avg_row = avg_row + '''                        <tr><td>Special × Active</td><td>{teamSpecialSynergy(compareA).toFixed(1)}</td><td>{teamSpecialSynergy(compareB).toFixed(1)}</td><td className={`compare-diff ${compareDiff.specialSynergy >= 0 ? "good" : "bad"}`}>{signed(compareDiff.specialSynergy, 1)}</td></tr>\n'''
text = replace_once(text, avg_row, new_avg_row, "compare special row")
path.write_text(text)


# README: document the verified Horodori update and the D4C adaptation, without claiming its deck score includes live skills.
path = Path("README.md")
text = path.read_text()
old_pr = '''PR 是目前搜尋候選池的「相對最高完成度」。不再採用最低候選＝0、最高候選＝1 的 min-max 正規化；改為將各隊的 **Unit Value／本次最高 Unit Value**、**全曲平均有效 Score UP／本次最高 Avg UP**、**Coverage／本次最高 Coverage** 轉成連續比率，再依 **50%／30%／20%** 加權。最後將本次最高綜合完成度換算為 9999。這樣兩支實際只差少量數值的隊伍，不會因為其中一支剛好墊底就被某一項強制算成 0 分。\n'''
new_pr = '''PR 是目前搜尋候選池的「相對最高完成度」，不採最低候選＝0 的 min-max。2026-08-15 起參考 Horodori 2026-08-08 評分更新中「Active 權重高於 Special（20:10）」的可用概念，但沒有照抄其卡片 Tier 公式。D4C 隊伍 PR 改為 **Unit Value 50%／Active 33%／Special 17%**：Active 33% 由本工具實際模擬的 **Avg UP 23% + Coverage 10%** 組成；Special 17% 則使用五張卡的 **Special × Active 聯動潛力**，會讀取 Active 的發動間隔、機率、持續時間、Score UP 與已成立追加倍率。各項都用本次最高參考值的連續比率計算，再將最高綜合完成度換算為 9999。\n\nHorodori 的 Deck Builder 本身仍把 Active／Special／Score Support／Board／Connect 等列為 Unit Score 未算入項目；D4C 只借用其「Active 與 Special 分開評價」及相對權重思路。Board／Connect／Member Bonus 因本工具沒有每個玩家的實際育成狀態，暫不納入 PR／SC。\n'''
text = replace_once(text, old_pr, new_pr, "README PR section")
old_bullet = '- PR 採「相對最高完成度」：Unit Value 50%、Avg UP 30%、Coverage 20%，各項以本次候選最高值為 100%，再將最高綜合完成度換算為 9999\n'
new_bullet = '- PR 採「相對最高完成度」：Unit Value 50%、Active 33%（Avg UP 23% + Coverage 10%）、Special × Active 聯動 17%，各項以本次候選最高值為 100%，再將最高綜合完成度換算為 9999\n'
text = replace_once(text, old_bullet, new_bullet, "README PR bullet")
text = text.replace(
    '- Special Skill 發動順序建議：自動編隊會輸出 #1→#5 的實驗性 Special 順序（優先 Skill Rate UP，再比較 Score Support × 持續時間）；手動試算可一鍵套用或自行調整。由於官方完整觸發時點／分數公式未公開，此順序效果目前不納入 PR／SC\n',
    '- Special Skill 發動順序建議：自動編隊會輸出 #1→#5 的實驗性順序，並把 Special 與五張卡的 Active 發動間隔、機率、持續時間、Score UP、已成立追加倍率一起評估；手動試算可一鍵套用或自行調整。精確的「位置時點效果」仍因官方觸發時點未公開而不直接加進 SC\n',
)
path.write_text(text)

print("Applied Horodori-informed Active/Special PR weighting and Active-aware explanations.")
