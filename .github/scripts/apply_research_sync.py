from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# ---------- optimizer.ts ----------
path = Path("src/lib/optimizer.ts")
text = path.read_text()
text = replace_once(
    text,
    'import { calcScoreUpCoverage } from "./coverage";\n',
    'import { calcScoreUpCoverage } from "./coverage";\nimport { applyBloomMap } from "./bloom";\nimport { activeBaseProbability } from "./skillProbability";\n',
    "optimizer imports",
)
text = replace_once(
    text,
    '  /** Members allowed in the 5-slot lineup (captain may be off-team). Omit = all ★5/event cards. */\n  memberPool?: string[];\n',
    '  /** Members allowed in the 5-slot lineup (captain may be off-team). Omit = all ★5/event cards. */\n  memberPool?: string[];\n  /** Optional per-card ★5 Bloom stage (0–5). Missing entries keep max-bloom gameData values. */\n  cardBloomById?: Record<string, number>;\n',
    "optimizer option",
)
text = replace_once(
    text,
    '''function cardsForOptimizer(data: GameData, ownedCardIds: Set<string>): Card[] {\n  return data.cards.filter(\n    (c) => ownedCardIds.has(c.id) && (c.rarity === 5 || !!c.event),\n  );\n}\n''',
    '''function cardsForOptimizer(\n  data: GameData,\n  ownedCardIds: Set<string>,\n  bloomByCardId?: Record<string, number>,\n): Card[] {\n  const owned = data.cards.filter(\n    (c) => ownedCardIds.has(c.id) && (c.rarity === 5 || !!c.event),\n  );\n  return applyBloomMap(owned, bloomByCardId);\n}\n''',
    "cardsForOptimizer",
)
text = replace_once(
    text,
    '    memberPool: undefined,\n    allowDuplicateSkills: true,\n',
    '    memberPool: undefined,\n    cardBloomById: undefined,\n    allowDuplicateSkills: true,\n',
    "baseline bloom reset",
)
text = text.replace(
    'cardsForOptimizer(data, options.ownedCardIds)',
    'cardsForOptimizer(data, options.ownedCardIds, options.cardBloomById)',
)
text = replace_once(
    text,
    '''      scoreUp: bonusOk && c.active.bonus ? c.active.bonus.scoreUp : c.active.scoreUp,\n    };\n''',
    '''      scoreUp: bonusOk && c.active.bonus ? c.active.bonus.scoreUp : c.active.scoreUp,\n      probability: activeBaseProbability(c.active),\n    };\n''',
    "active probability",
)
text = text.replace(
    'score += (card.active.duration / Math.max(1, card.active.interval)) * card.active.scoreUp * 40;',
    'score += (card.active.duration / Math.max(1, card.active.interval)) * card.active.scoreUp * activeBaseProbability(card.active) * 40;',
)
text = text.replace(
    'const ca = (a.active.duration / Math.max(1, a.active.interval)) * a.active.scoreUp;\n    const cb = (b.active.duration / Math.max(1, b.active.interval)) * b.active.scoreUp;',
    'const ca = (a.active.duration / Math.max(1, a.active.interval)) * a.active.scoreUp * activeBaseProbability(a.active);\n    const cb = (b.active.duration / Math.max(1, b.active.interval)) * b.active.scoreUp * activeBaseProbability(b.active);',
)
path.write_text(text)


# ---------- teamDecision.ts ----------
path = Path("src/lib/teamDecision.ts")
text = path.read_text()
old = '''/**\n * SC（非官方估算）：\n * (加成後三圍 + 分數支援加權值) × (1 + 全曲平均有效 Score UP / 100)\n *\n * Unlike PR, this uses a fixed formula and never normalizes against the current\n * candidate pool, so scores from different inventories can be compared when\n * using the same song-length assumptions.\n */\nexport function d4cBattleIndex(ev: TeamEvaluation): number {\n  const scoreSupportEquivalent = Math.max(0, ev.scoreSupportWeighted);\n  const scoreUpMultiplier = 1 + Math.max(0, ev.avgScoreUp) / 100;\n  return Math.round((ev.effectiveStatTotal + scoreSupportEquivalent) * scoreUpMultiplier);\n}\n'''
new = '''const DEFAULT_SCORE_SONG_LENGTH = 160;\n\n/**\n * Approximate full-song Score Support percentage. Persistent costume/passive\n * support is converted from its power-weighted equivalent; each one-shot Special\n * is averaged over song length because its exact song-specific trigger position\n * is not loaded by this tool yet.\n */\nexport function estimatedScoreSupportPct(\n  ev: TeamEvaluation,\n  songLength = DEFAULT_SCORE_SONG_LENGTH,\n): number {\n  const persistent = ev.baseStatTotal > 0\n    ? (Math.max(0, ev.scoreSupportWeighted) / ev.baseStatTotal) * 100\n    : 0;\n  const special = songLength > 0\n    ? ev.cards.reduce(\n        (sum, card) => sum + Math.max(0, card.special.scoreSupport) * Math.min(songLength, Math.max(0, card.special.duration)) / songLength,\n        0,\n      )\n    : 0;\n  return persistent + special;\n}\n\n/**\n * SC（非官方固定尺度估算）：\n * Unit Value × expected Active Score-Up factor × estimated Score-Support factor.\n *\n * Community research indicates final score scales linearly with Total Power and\n * Score Up is multiplied by (100% + Score Support). Active Avg UP is already\n * probability-aware. Exact chart notes, combo, Special trigger positions, Board,\n * Memory, Connect and Member Enhancement are intentionally outside this proxy.\n */\nexport function d4cBattleIndex(\n  ev: TeamEvaluation,\n  songLength = DEFAULT_SCORE_SONG_LENGTH,\n): number {\n  const scoreUpMultiplier = 1 + Math.max(0, ev.avgScoreUp) / 100;\n  const supportMultiplier = 1 + estimatedScoreSupportPct(ev, songLength) / 100;\n  return Math.round(ev.effectiveStatTotal * scoreUpMultiplier * supportMultiplier);\n}\n'''
text = replace_once(text, old, new, "SC formula")
path.write_text(text)


# ---------- ManualDeckLab.tsx ----------
path = Path("src/components/ManualDeckLab.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { d4cBattleIndex } from "../lib/teamDecision";\n',
    'import { d4cBattleIndex } from "../lib/teamDecision";\nimport { applyBloomMap } from "../lib/bloom";\n',
    "manual bloom import",
)
text = replace_once(
    text,
    '  ownedCostumeIds: string[];\n  seedTeam: TeamEvaluation | null;\n',
    '  ownedCostumeIds: string[];\n  cardBloomById: Record<string, number>;\n  seedTeam: TeamEvaluation | null;\n',
    "manual prop type",
)
text = replace_once(
    text,
    '  ownedCostumeIds,\n  seedTeam,\n}: ManualDeckLabProps) {\n',
    '  ownedCostumeIds,\n  cardBloomById,\n  seedTeam,\n}: ManualDeckLabProps) {\n',
    "manual prop destructure",
)
text = replace_once(
    text,
    '''  const selectedCards = useMemo(\n    () => cardIds.map((id) => cardMap.get(id) ?? null),\n    [cardIds, cardMap],\n  );\n''',
    '''  const selectedCards = useMemo(\n    () => cardIds.map((id) => cardMap.get(id) ?? null),\n    [cardIds, cardMap],\n  );\n  const effectiveSelectedCards = useMemo(\n    () => applyBloomMap(selectedCards.filter((card): card is Card => !!card), cardBloomById),\n    [cardBloomById, selectedCards],\n  );\n''',
    "manual effective cards",
)
text = replace_once(
    text,
    '''    const cards = selectedCards.filter((card): card is Card => !!card);\n    const context = { typeCounts: countTypes(cards), unitCounts: countUnits(cards, data) };\n    return recommendSpecialOrder(cards, context);\n  }, [data, ready, selectedCards]);\n''',
    '''    const cards = effectiveSelectedCards;\n    const context = { typeCounts: countTypes(cards), unitCounts: countUnits(cards, data) };\n    return recommendSpecialOrder(cards, context);\n  }, [data, effectiveSelectedCards, ready]);\n''',
    "manual special cards",
)
text = replace_once(
    text,
    '''    const cards = selectedCards.filter((card): card is Card => !!card);\n    const leaderIndex = cards.findIndex((card) => card.member === selectedCostume.member);\n    return evaluateTeam(cards, leaderIndex, selectedCostume, data, data.songLengthDefault);\n  }, [data, ready, selectedCards, selectedCostume]);\n''',
    '''    const cards = effectiveSelectedCards;\n    const leaderIndex = cards.findIndex((card) => card.member === selectedCostume.member);\n    return evaluateTeam(cards, leaderIndex, selectedCostume, data, data.songLengthDefault);\n  }, [data, effectiveSelectedCards, ready, selectedCostume]);\n''',
    "manual evaluation cards",
)
text = replace_once(
    text,
    '    const cards = selectedCards.filter((card): card is Card => !!card);\n    const base = cards.reduce(\n',
    '    const cards = effectiveSelectedCards;\n    const base = cards.reduce(\n',
    "manual stat cards",
)
text = text.replace('  }, [evaluation, selectedCards]);', '  }, [effectiveSelectedCards, evaluation]);')
path.write_text(text)


# ---------- App.tsx ----------
path = Path("src/App.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import { ManualDeckLab } from "./components/ManualDeckLab";\n',
    'import { ManualDeckLab } from "./components/ManualDeckLab";\nimport { RosterBloomPanel } from "./components/RosterBloomPanel";\n',
    "app bloom import",
)
text = replace_once(
    text,
    'const DATA_SNAPSHOT = "2026-08-08";\n',
    'const DATA_SNAPSHOT = "2026-08-14";\nconst RULES_REVIEWED = "2026-08-18";\n',
    "data dates",
)
old_state = '''const [ownedRosterCostumeIds, setOwnedRosterCostumeIds] = useState<string[]>(\n    rosterBootstrap.inventory.costumeIds,\n  );\n'''
new_state = old_state + '''  const [rosterCardBloom, setRosterCardBloom] = useState<Record<string, number>>(\n    rosterBootstrap.inventory.bloomByCardId,\n  );\n'''
text = replace_once(text, old_state, new_state, "bloom state")
old_persist = '''  function persistRosterSnapshot(\n    members: string[],\n    cardsByMember: Record<string, string[]>,\n    costumeIds: string[],\n  ) {\n    saveRosterInventory(activeRosterProfileId, { members, cardsByMember, costumeIds });\n  }\n'''
new_persist = '''  function persistRosterSnapshot(\n    members: string[],\n    cardsByMember: Record<string, string[]>,\n    costumeIds: string[],\n    bloomByCardId: Record<string, number> = rosterCardBloom,\n  ) {\n    saveRosterInventory(activeRosterProfileId, { members, cardsByMember, costumeIds, bloomByCardId });\n  }\n\n  function rosterBloomMapForOptimize(cardIds = rosterOwnedCardIdsForOptimize()): Record<string, number> {\n    const next = { ...rosterCardBloom };\n    for (const id of cardIds) {\n      const card = cardById.get(id);\n      if (card?.rarity === 5 && next[id] == null) next[id] = 0;\n    }\n    return next;\n  }\n\n  function setRosterBloomStage(cardId: string, stage: number) {\n    setRosterCardBloom((prev) => {\n      const next = { ...prev, [cardId]: Math.max(0, Math.min(5, Math.floor(stage))) };\n      persistRosterSnapshot(ownedRosterMembers, rosterOwnedCards, ownedRosterCostumeIds, next);\n      return next;\n    });\n    setSimulation(null);\n    setResult(null);\n  }\n'''
text = replace_once(text, old_persist, new_persist, "persist roster")
text = text.replace('const inventory = loadRosterInventory(profileId);', 'const inventory = loadRosterInventory(profileId, data);')
text = text.replace(
    '    setOwnedRosterCostumeIds(inventory.costumeIds);\n',
    '    setOwnedRosterCostumeIds(inventory.costumeIds);\n    setRosterCardBloom(inventory.bloomByCardId);\n',
)
text = text.replace(
    '      members: [], cardsByMember: {}, costumeIds: []',
    '      members: [], cardsByMember: {}, costumeIds: [], bloomByCardId: {}',
)
text = text.replace(
    '      costumeIds: ownedRosterCostumeIds,\n    });',
    '      costumeIds: ownedRosterCostumeIds,\n      bloomByCardId: rosterBloomMapForOptimize(),\n    });',
    1,
)
# import handler may contain the same costume setter; ensure parsed bloom is loaded if not already added by generic replace.
if 'setRosterCardBloom(inventory.bloomByCardId);' not in text:
    raise SystemExit('expected bloom setter after profile/import patch')
text = replace_once(
    text,
    '''    setOwnedRosterMembers([]);\n    setRosterOwnedCards({});\n    setRosterRequiredMembers([]);\n''',
    '''    setOwnedRosterMembers([]);\n    setRosterOwnedCards({});\n    setRosterCardBloom({});\n    setRosterRequiredMembers([]);\n''',
    "clear bloom",
)
text = text.replace(
    'persistRosterSnapshot([], {}, ownedRosterCostumeIds);',
    'persistRosterSnapshot([], {}, ownedRosterCostumeIds, {});',
)
# Roster optimization and card simulation: pass Bloom map. Add after memberPool in each relevant roster call.
text = text.replace(
    '        memberPool: ownedRosterMembers,\n        maxResults: 8,',
    '        memberPool: ownedRosterMembers,\n        cardBloomById: rosterBloomMapForOptimize(),\n        maxResults: 8,',
)
text = text.replace(
    '              memberPool: beforeMembers,\n              maxResults: 8,',
    '              memberPool: beforeMembers,\n              cardBloomById: rosterBloomMapForOptimize(beforeIds),\n              maxResults: 8,',
)
text = text.replace(
    '              memberPool: afterMembers,\n              maxResults: 8,',
    '              memberPool: afterMembers,\n              cardBloomById: { ...rosterBloomMapForOptimize(afterIds), [card.id]: rosterCardBloom[card.id] ?? 0 },\n              maxResults: 8,',
)
# Render Bloom controls immediately before the manual lab.
manual_marker = '''              <ManualDeckLab\n                data={data}\n                locale={locale}\n                accountId={activeRosterProfileId}\n                accountName={activeRosterProfile?.name ?? rosterUi.account}\n                ownedCardIds={[...rosterOwnedCardIdsForOptimize()]}\n                ownedCostumeIds={[...rosterOwnedCostumeIdsForOptimize()]}\n                seedTeam={result?.byOverall?.[0] ?? result?.best ?? null}\n              />\n'''
manual_new = '''              <RosterBloomPanel\n                data={data}\n                locale={locale}\n                ownedCardIds={[...rosterOwnedCardIdsForOptimize()]}\n                bloomByCardId={rosterBloomMapForOptimize()}\n                onChange={setRosterBloomStage}\n              />\n              <ManualDeckLab\n                data={data}\n                locale={locale}\n                accountId={activeRosterProfileId}\n                accountName={activeRosterProfile?.name ?? rosterUi.account}\n                ownedCardIds={[...rosterOwnedCardIdsForOptimize()]}\n                ownedCostumeIds={[...rosterOwnedCostumeIdsForOptimize()]}\n                cardBloomById={rosterBloomMapForOptimize()}\n                seedTeam={result?.byOverall?.[0] ?? result?.best ?? null}\n              />\n'''
text = replace_once(text, manual_marker, manual_new, "manual lab render")
# Explain that Active metrics are probability-aware and PR uses researched rates.
text = text.replace(
    'Unit 50% · Active 33% · Special 17%',
    'Unit 50% · Active 33% · Special 17% · Active採期望發動率',
)
text = text.replace(
    'Unit 50%・Active 33%・Special 17%',
    'Unit 50%・Active 33%・Special 17%・Activeは期待発動率',
)
text = text.replace(
    'Unit 50% · Active 33% · Special 17% · Active採期望發動率',
    'Unit 50% · Active 33% · Special 17% · Active uses expected rates' if False else 'Unit 50% · Active 33% · Special 17% · Active採期望發動率',
)
old_footer = '''            {locale === "ja" ? "内蔵データ" : locale === "en" ? "Data snapshot" : "遊戲資料快照"} · {DATA_SNAPSHOT} · {data.cards.length} cards · {data.costumes.length} costumes\n'''
new_footer = '''            {locale === "ja" ? "内蔵データ" : locale === "en" ? "Data snapshot" : "遊戲資料快照"} · {DATA_SNAPSHOT} · {data.cards.length} cards · {data.costumes.length} costumes\n            {" · "}{locale === "ja" ? "仕様確認" : locale === "en" ? "Mechanics reviewed" : "機制複核"} · {RULES_REVIEWED}\n'''
text = replace_once(text, old_footer, new_footer, "footer provenance")
path.write_text(text)


# ---------- main.tsx ----------
path = Path("src/main.tsx")
text = path.read_text()
text = replace_once(
    text,
    'import "./special-order.css";\n',
    'import "./special-order.css";\nimport "./roster-bloom.css";\n',
    "main bloom css",
)
path.write_text(text)


# ---------- README.md ----------
path = Path("README.md")
text = path.read_text()
text = text.replace(
    '- SC（非官方估算）：`（Unit Value + 分數支援加權值）×（1 + 全曲平均有效 Score UP / 100）`；不依候選池正規化，同曲長時可跨帳號比較\n',
    '- SC（非官方固定尺度估算）：依研究中的基本得分關係改為 `Unit Value × 期望 Active Score-Up 倍率 × 估計 Score-Support 倍率`；Active 高／中／低機率採社群實測約 55%／45%／35%，同曲長時可跨帳號比較\n',
)
text = text.replace(
    '- 編隊結果的第 1～5 位代表遊戲內實際位置，遊戲中應依網站輸出的相同順序擺放\n',
    '- ★5 開花（Bloom）0～5 可依帳號逐卡保存，並直接套用原作者 2026-08-14 資料表調整三圍、Active、Special 與 Passive；舊背包為維持既有結果首次轉換視為開花5，新卡預設0\n- Active 改用機率期望模型：高／中／低約 55%／45%／35%，重疊時仍只取最強效果，Coverage 與 Avg UP 改為期望值\n- 編隊結果的第 1～5 位代表遊戲內實際位置，遊戲中應依網站輸出的相同順序擺放\n',
)
old_sc = '''SC 採固定公式，不使用本次候選池的最大／最小值：\n\n```text\nSC = (Unit Value + 分數支援加權值) × (1 + 全曲平均有效 Score UP / 100)\n```\n\n`Avg Score UP` 已經是包含技能空窗的全曲平均值，因此不再額外乘一次 Coverage，以免重複扣分。SC 為本工具的非官方估算，不等同遊戲官方分數公式；其用途是讓相同曲長假設下的不同帳號／不同試算結果有一致尺度可以比較。\n'''
new_sc = '''SC 採固定公式，不使用本次候選池的最大／最小值：\n\n```text\nSC = Unit Value × (1 + 期望 Avg Score UP / 100) × (1 + 估計平均 Score Support / 100)\n```\n\nActive 的高／中／低機率依 hololive Dreams Lab 社群實測約 55%／45%／35% 計算；每個檢查點以機率期望值處理，重疊 Active 仍只取最強效果。Score Support 依已知得分乘法關係處理；因本工具尚未載入各歌曲五個 Special 固定觸發位置，Special Support 先按持續時間做全曲平均。SC 仍是非官方比較指標，不等同遊戲最終分數，也不包含玩家個別 Board、Memory、Connect、Member Enhancement 與實際譜面 Combo／判定。\n'''
text = replace_once(text, old_sc, new_sc, "README SC")
text += '''\n## 資料／機制同步紀錄（2026-08-18）\n\n- 卡片、衣裝與 ★5 開花資料同步／核對原作者 `holodreams123-afk/holodream` 最新 2026-08-14 資料版本；原作者 8/15 另修正低開花技能文字。\n- 得分與技能機制交叉核對 hololive Dreams Lab、Horodori、AppMedia、Gamerch、Game8：Total Power 與分數線性、Active 為機率觸發且重疊取最強、Special 依 #1→#5 對應歌曲固定位置、Skill Rate UP 為乘法提升等。\n- Board、Memory、Connect 與 Member Enhancement 屬玩家個別育成狀態，目前不自動假設；未輸入的玩家專屬數值不會偷偷加進 SC／PR。\n'''
path.write_text(text)

print("research sync patches applied")
