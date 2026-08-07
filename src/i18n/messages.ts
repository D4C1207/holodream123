export type Locale = "zh" | "en" | "ja";

export const LOCALES: { id: Locale; label: string; htmlLang: string }[] = [
  { id: "zh", label: "中文", htmlLang: "zh-Hant" },
  { id: "en", label: "English", htmlLang: "en" },
  { id: "ja", label: "日本語", htmlLang: "ja" },
];

export const DEFAULT_LOCALE: Locale = "zh";
export const STORAGE_LOCALE = "holodream-locale";

export type Messages = {
  brand: string;
  brandSub: string;
  madeBy: string;
  footer: string;
  langAria: string;
  themeAria: string;
  themeGallery: string;
  themeGallerySub: string;
  themeOptimize: string;
  themeOptimizeSub: string;
  themeRoster: string;
  themeRosterSub: string;
  rosterTitle: (n: number) => string;
  rosterNote: string;
  rosterCardPickTitle: string;
  rosterCardPickNote: string;
  rosterNeedFive: string;
  rosterClear: string;
  alertRosterMin: string;
  alertRosterCardMin: string;
  fabRosterRun: string;
  galleryTitle: string;
  dataNoticeBefore: string;
  dataNoticeStrong: string;
  dataNoticeAfter: string;
  tagline: string;
  priority1: string;
  priority2: string;
  priority3: (sec: number) => string;
  priority4: string;
  captainTitle: string;
  labelGen: string;
  pickGenFirst: string;
  labelMember: string;
  pickMember: string;
  pickGenFirstShort: string;
  currentCaptain: string;
  songLength: string;
  costumePick: string;
  noCostumeData: string;
  conditionLabel: string;
  conditionUnitHint: (list: string, min: number) => string;
  conditionTypeHint: (list: string, min: number) => string;
  conditionNone: string;
  wantedTitle: (n: number) => string;
  wantedWithLeader: (n: number) => string;
  wantedLocked: (n: number) => string;
  captainOffTeam: string;
  wantedNote: string;
  clearWanted: string;
  removeWantedAria: (name: string) => string;
  resultsTitle: string;
  resultsEmptyWithLeader: (name: string) => string;
  resultsEmpty: string;
  trackAria: string;
  trackOverall: string;
  trackOverallDesc: string;
  prBaselineNote: string;
  prBaselineBtn: string;
  prBaselineBtnTitle: string;
  prBaselineBtnUnavailable: string;
  prBaselineViewBanner: string;
  allowDupSkills: string;
  allowDupSkillsHint: string;
  skillDupWarn: string;
  skillDupPair: (a: string, b: string) => string;
  trackStats: string;
  trackStatsDesc: string;
  trackCoverage: string;
  trackCoverageDesc: string;
  trackScore: string;
  trackScoreDesc: string;
  noTrackTeams: string;
  pickTeamDetail: string;
  costumeSkill: string;
  activated: string;
  notActivated: string;
  allPassives: string;
  satisfied: string;
  notAllSatisfied: string;
  avgScoreUp: string;
  coveragePct: (n: string) => string;
  buffedStats: string;
  baseStats: (n: string) => string;
  skillGaps: string;
  shorterBetter: string;
  leaderCostume: string;
  leader: string;
  memberN: (n: number) => string;
  forced: string;
  costumeColon: (name: string) => string;
  activeLine: (interval: number, duration: number, scoreUp: number) => string;
  passivePrefix: string;
  scoreSupport: (n: number) => string;
  timelineLabel: string;
  gapsTotal: (sec: string) => string;
  typeCounts: (h: number, p: number, c: number) => string;
  searchMeta: (searched: string, ms: number) => string;
  costumeNeed: (min: number) => string;
  fabTitleNeedLeader: string;
  fabTitleReady: string;
  fabBusy: string;
  fabRun: string;
  fabPickLeader: string;
  alertWantedMax: string;
  alertNeedLeader: string;
  alertTooMany: string;
  filterAllStars: string;
  filterAllAttrs: string;
  filterAttrCount: (n: number) => string;
  filterAllGens: string;
  filterGenCount: (n: number) => string;
  metricPr: (n: string) => string;
  metricStats: (n: string) => string;
  metricCoverage: (n: string) => string;
  metricAvgUp: (n: string) => string;
  search: string;
  searchPlaceholder: string;
  filterSettings: string;
  showFull: string;
  hideDetails: string;
  compactOnly: string;
  fullDetails: string;
  rarity: string;
  attribute: string;
  genGroup: string;
  multiSelect: string;
  all: string;
  noMatchingCards: string;
  eventPrefix: (name: string) => string;
  eventBadge: string;
  performance: string;
  technique: string;
  sense: string;
  total: (n: number | string) => string;
  statsMissing: string;
  special: string;
  active: string;
  passive: string;
  attrHappy: string;
  attrPure: string;
  attrCute: string;
  condNone: string;
  condTypeCount: (attr: string, min: number) => string;
  condUnitCount: (unit: string, min: number) => string;
  explainParamUp: (param: string, value: number) => string;
  explainScoreSupport: (value: number) => string;
  explainWhen: (cond: string, effects: string) => string;
  gapsNone: string;
  gapRange: (a: number, b: number, dur: number) => string;
  gapsJoin: string;
  paramPerf: string;
  paramTech: string;
  paramSense: string;
  flagCostumeOn: string;
  flagCostumeOff: string;
  flagPassiveAll: string;
  flagPassiveMiss: string;
  flagStats: (n: string) => string;
  flagCoverage: (n: string) => string;
  flagUp: (n: string) => string;
  commentBoardTitle: string;
  commentBoardNote: string;
  commentBoardNickname: string;
  commentBoardNicknamePlaceholder: string;
  commentBoardBody: string;
  commentBoardBodyPlaceholder: string;
  commentBoardSubmit: string;
  commentBoardSubmitting: string;
  commentBoardEmpty: string;
  commentBoardLoading: string;
  commentBoardLoadError: string;
  commentBoardPostError: string;
  commentBoardUnavailable: string;
  commentBoardAnonymous: string;
  commentBoardRefresh: string;
  commentBoardClose: string;
  commentBoardBack: string;
};

const zh: Messages = {
  brand: "Hololive Dreams 小工具",
  brandSub: "製作者 108_虎太郎 · ホロドリ便利ツール",
  madeBy: "made by 108_虎太郎",
  footer: "製作者 108_虎太郎 · 資料對照 Game8 / AppMedia / Gamerch",
  langAria: "介面語言",
  themeAria: "功能主題",
  themeGallery: "角色一覽",
  themeGallerySub: "依期數瀏覽卡面",
  themeOptimize: "最強編隊",
  themeOptimizeSub: "隊長＋想要隊員優化",
  themeRoster: "現有隊員編隊",
  themeRosterSub: "從已擁有★5配對",
  rosterTitle: (n) => `① 已擁有隊員（${n} 人）`,
  rosterNote:
    "點選你持有的★5角色（含活動卡）。至少 5 人後選隊長；有多張★5者可在下方勾選持有卡面。PR 仍與最強編隊同基準（9999）。",
  rosterCardPickTitle: "★5 持有卡面",
  rosterCardPickNote: "勾選你持有的★5卡面（可多選）；編隊時會從中自動挑最適合的組合。",
  rosterNeedFive: "至少選 5 人",
  rosterClear: "清空已選",
  alertRosterMin: "請至少選擇 5 位已擁有隊員。",
  alertRosterCardMin: "每位成員至少需勾選一張★5卡面。",
  fabRosterRun: "從現有隊員配對",
  galleryTitle: "角色一覽",
  dataNoticeBefore: "數值與技能皆為",
  dataNoticeStrong: "滿綻放・滿等",
  dataNoticeAfter: "狀態。部分 ★3／★4 可能尚未收錄三圍。",
  tagline:
    "隊長僅決定衣裝技能，編成五員不必包含隊長。指定隊員固定入隊，其餘由系統補齊。",
  priority1: "隊長衣裝技能",
  priority2: "被動全部滿足",
  priority3: (sec) => `有效 Score UP / 覆蓋率（${sec}s）`,
  priority4: "加成後三圍總和",
  captainTitle: "① 選擇隊長",
  labelGen: "期數 / 分組",
  pickGenFirst: "先選期數",
  labelMember: "成員",
  pickMember: "選擇該期成員",
  pickGenFirstShort: "請先選期數",
  currentCaptain: "目前隊長",
  songLength: "曲長（秒）",
  costumePick: "選擇隊長衣裝技能",
  noCostumeData: "此成員尚無衣裝技能資料。",
  conditionLabel: "發動條件",
  conditionUnitHint: (list, min) =>
    `編成五員中，${list || "（無）"} 至少 ${min} 人（隊長本人不計入也可）。`,
  conditionTypeHint: (list, min) =>
    `對應屬性卡成員：${list || "（無）"}。目標至少 ${min} 人。`,
  conditionNone: "此衣裝無人數條件，系統會依被動與技能覆蓋率優化隊員。",
  wantedTitle: (n) => `② 想要的隊員（${n} / 5）`,
  wantedWithLeader: (n) => `｜含隊長共鎖定 ${n} 人`,
  wantedLocked: (n) => `｜已鎖定 ${n} 人`,
  captainOffTeam: "（不在編成內）",
  wantedNote:
    "點選卡面加入想要隊員（最多 5）。隊長只決定衣裝，不必佔編成名額；鎖定隊員固定入隊，其餘空位由最佳化補齊。",
  clearWanted: "清空想要隊員",
  removeWantedAria: (name) => `取消 ${name}`,
  resultsTitle: "③ 最佳編成結果",
  resultsEmptyWithLeader: (name) => `已選隊長 ${name}，按下右下角「計算編隊」。`,
  resultsEmpty: "請先在上方選擇隊長與衣裝。",
  trackAria: "推薦導向",
  trackOverall: "最強隊伍",
  trackOverallDesc:
    "衣裝＋被動前提下，三圍／覆蓋／平均 UP 相對「同衣裝無指定隊員最強隊」合成 PR 前 8",
  prBaselineNote:
    "PR 以選定衣裝、未指定隊員時的最強編成（★5 常駐＋活動卡）為 9999 分基準，其餘編成以此相對評分。",
  prBaselineBtn: "PR 9999",
  prBaselineBtnTitle: "查看同衣裝、無指定隊員時的最強編隊（PR 基準）",
  prBaselineBtnUnavailable: "需先選定隊長衣裝並計算編隊",
  prBaselineViewBanner: "PR 9999 基準編隊 — 同衣裝、無指定隊員、全池 ★5＋活動最強",
  allowDupSkills: "允許主動技能重複",
  allowDupSkillsHint: "關閉後排除主動 Score UP 時程／倍率相同的編成",
  skillDupWarn: "主動技能重複",
  skillDupPair: (a, b) => `${a} 與 ${b} 主動 Score UP 時程相同（重疊不疊加）`,
  trackStats: "三圍總和",
  trackStatsDesc: "衣裝＋被動優先，加成後三圍前 8",
  trackCoverage: "技能覆蓋率",
  trackCoverageDesc: "衣裝＋被動優先，覆蓋率前 8",
  trackScore: "平均分數加成",
  trackScoreDesc: "衣裝＋被動優先，平均 UP% 前 8",
  noTrackTeams: "此導向沒有可用編成。",
  pickTeamDetail: "請選擇左側其中一組編成查看詳情。",
  costumeSkill: "衣裝技能",
  activated: "發動",
  notActivated: "未發動",
  allPassives: "被動全部",
  satisfied: "滿足",
  notAllSatisfied: "未全滿",
  avgScoreUp: "平均 Score UP",
  coveragePct: (n) => `覆蓋 ${n}%`,
  buffedStats: "加成後三圍",
  baseStats: (n) => `基礎 ${n}`,
  skillGaps: "無技能空窗",
  shorterBetter: "越短越好",
  leaderCostume: "隊長衣裝",
  leader: "隊長",
  memberN: (n) => `隊員 ${n}`,
  forced: "指定",
  costumeColon: (name) => `｜衣裝：${name}`,
  activeLine: (interval, duration, scoreUp) =>
    `Active：每 ${interval}s 發動 / 持續 ${duration}s / ${scoreUp}%（計算時視為必發動）`,
  passivePrefix: "Passive：",
  scoreSupport: (n) => ` · 分數支援 +${n}%`,
  timelineLabel: "有效 Score UP 時間軸（每秒取最高加成％，技能預設全部發動）",
  gapsTotal: (sec) => `合計 ${sec} 秒沒有 Score UP`,
  typeCounts: (h, p, c) => `類型：快樂 ${h} / 清純 ${p} / 可愛 ${c}`,
  searchMeta: (searched, ms) => `｜ 搜尋 ${searched} 組｜耗時 ${ms} ms`,
  costumeNeed: (min) => `（衣裝條件需 ≥ ${min}）`,
  fabTitleNeedLeader: "請先選擇隊長",
  fabTitleReady: "計算最佳配對",
  fabBusy: "計算中…",
  fabRun: "計算編隊",
  fabPickLeader: "先選隊長",
  alertWantedMax: "想要的隊員最多 5 位",
  alertNeedLeader: "請先選擇隊長",
  alertTooMany: "隊長 + 想要的隊員合計不能超過 5 人，請減少想要隊員",
  filterAllStars: "全部星級",
  filterAllAttrs: "全部屬性",
  filterAttrCount: (n) => `屬性×${n}`,
  filterAllGens: "全部期數",
  filterGenCount: (n) => `期數×${n}`,
  metricPr: (n) => `PR ${n}`,
  metricStats: (n) => `三圍 ${n}`,
  metricCoverage: (n) => `覆蓋 ${n}%`,
  metricAvgUp: (n) => `平均 UP ${n}%`,
  search: "搜尋",
  searchPlaceholder: "成員 / 衣裝 / 快樂型…",
  filterSettings: "篩選設定",
  showFull: "顯示完整",
  hideDetails: "隱藏詳情",
  compactOnly: "僅卡面＋名字",
  fullDetails: "卡面／技能全顯示",
  rarity: "稀有度",
  attribute: "屬性",
  genGroup: "期數 / 分組",
  multiSelect: "可多選",
  all: "全部",
  noMatchingCards: "沒有符合篩選的卡片。",
  eventPrefix: (name) => `活動｜${name}`,
  eventBadge: "活動",
  performance: "表演力",
  technique: "技巧",
  sense: "感性",
  total: (n) => `合計 ${n}`,
  statsMissing: "數值資料未收錄",
  special: "特殊",
  active: "主動",
  passive: "被動",
  attrHappy: "快樂型",
  attrPure: "清純型",
  attrCute: "可愛型",
  condNone: "無條件（入場即發動）",
  condTypeCount: (attr, min) => `${attr} ≥ ${min} 人`,
  condUnitCount: (unit, min) => `${unit} ≥ ${min} 人`,
  explainParamUp: (param, value) => `全員${param} +${value}%`,
  explainScoreSupport: (value) => `全員分數支援 +${value}%`,
  explainWhen: (cond, effects) => `${cond} 時：${effects}`,
  gapsNone: "無（全程有技能）",
  gapRange: (a, b, dur) => `${a}–${b}秒（${dur}秒）`,
  gapsJoin: "、",
  paramPerf: "表演力",
  paramTech: "技巧",
  paramSense: "感性",
  flagCostumeOn: "衣裝○",
  flagCostumeOff: "衣裝×",
  flagPassiveAll: "被動全○",
  flagPassiveMiss: "被動缺",
  flagStats: (n) => `三圍 ${n}`,
  flagCoverage: (n) => `覆蓋 ${n}%`,
  flagUp: (n) => `UP ${n}%`,
  commentBoardTitle: "留言板",
  commentBoardNote: "歡迎留下使用心得、資料勘誤或功能建議（公開顯示，請勿貼個資）。",
  commentBoardNickname: "暱稱（選填）",
  commentBoardNicknamePlaceholder: "匿名也可以",
  commentBoardBody: "留言",
  commentBoardBodyPlaceholder: "想說的話…",
  commentBoardSubmit: "送出留言",
  commentBoardSubmitting: "送出中…",
  commentBoardEmpty: "還沒有留言，來當第一個吧。",
  commentBoardLoading: "載入留言中…",
  commentBoardLoadError: "無法載入留言，請稍後再試。",
  commentBoardPostError: "送出失敗，請稍後再試。",
  commentBoardUnavailable: "留言板尚未設定（需 Supabase）。",
  commentBoardAnonymous: "匿名",
  commentBoardRefresh: "重新整理",
  commentBoardClose: "關閉",
  commentBoardBack: "← 返回",
};

const en: Messages = {
  brand: "Hololive Dreams Tools",
  brandSub: "by 108_虎太郎 · Holodori utility",
  madeBy: "made by 108_虎太郎",
  footer: "Created by 108_虎太郎 · Data cross-checked with Game8 / AppMedia / Gamerch",
  langAria: "Interface language",
  themeAria: "Features",
  themeGallery: "Card Gallery",
  themeGallerySub: "Browse by generation",
  themeOptimize: "Best Team",
  themeOptimizeSub: "Captain + locked picks",
  themeRoster: "Owned Roster",
  themeRosterSub: "Build from your ★5",
  rosterTitle: (n) => `① Owned members (${n})`,
  rosterNote:
    "Select owned ★5 members (incl. event). Need 5+, then captain; check owned cards below if they have multiple ★5s. PR uses Best Team 9999 baseline.",
  rosterCardPickTitle: "★5 owned cards",
  rosterCardPickNote: "Check every ★5 you own (multi-select). The optimizer picks the best mix for each team.",
  rosterNeedFive: "Need at least 5",
  rosterClear: "Clear selection",
  alertRosterMin: "Select at least 5 owned members.",
  alertRosterCardMin: "Each member needs at least one ★5 card selected.",
  fabRosterRun: "Match from roster",
  galleryTitle: "Card Gallery",
  dataNoticeBefore: "All stats and skills shown are at ",
  dataNoticeStrong: "max bloom / max level",
  dataNoticeAfter: ". Some ★3 / ★4 cards may not have stats yet.",
  tagline:
    "Pick a captain for the costume skill. The 5 lineup members need not include the captain—lock up to 5 wanted picks; the rest are filled automatically.",
  priority1: "Captain costume skill",
  priority2: "All passives met",
  priority3: (sec) => `Effective Score UP / coverage (${sec}s)`,
  priority4: "Buffed total stats",
  captainTitle: "① Choose captain",
  labelGen: "Generation / group",
  pickGenFirst: "Select a generation",
  labelMember: "Member",
  pickMember: "Select a member",
  pickGenFirstShort: "Pick a generation first",
  currentCaptain: "Captain",
  songLength: "Song length (sec)",
  costumePick: "Captain costume skill",
  noCostumeData: "No costume skill data for this member yet.",
  conditionLabel: "Activation condition",
  conditionUnitHint: (list, min) =>
    `Among the 5 members, need at least ${min} from: ${list || "(none)"} (captain need not be included).`,
  conditionTypeHint: (list, min) =>
    `Members with matching attribute cards: ${list || "(none)"}. Need at least ${min}.`,
  conditionNone:
    "No member-count condition. Teammates are optimized for passives and skill coverage.",
  wantedTitle: (n) => `② Wanted members (${n} / 5)`,
  wantedWithLeader: (n) => `｜ ${n} locked including captain`,
  wantedLocked: (n) => `｜ ${n} locked`,
  captainOffTeam: " (not in lineup)",
  wantedNote:
    "Tap a card to lock a member (max 5). Captain sets the costume only; locked members stay in the team; other slots are optimized.",
  clearWanted: "Clear wanted",
  removeWantedAria: (name) => `Remove ${name}`,
  resultsTitle: "③ Best team results",
  resultsEmptyWithLeader: (name) =>
    `Captain set to ${name}. Tap “Build team” at the bottom right.`,
  resultsEmpty: "Choose a captain and costume above first.",
  trackAria: "Ranking focus",
  trackOverall: "Best overall",
  trackOverallDesc:
    "Costume + passives first; PR from stats / coverage / avg UP vs unconstrained best under this costume — top 8",
  prBaselineNote:
    "PR 9999 = strongest ★5 team for this captain costume with no locked members (permanent + event). Other teams scale relative to it.",
  prBaselineBtn: "PR 9999",
  prBaselineBtnTitle: "View the unconstrained strongest team for this costume (PR baseline)",
  prBaselineBtnUnavailable: "Choose captain costume and run optimization first",
  prBaselineViewBanner:
    "PR 9999 baseline — strongest team for this costume with no locked members (full ★5 + event pool)",
  allowDupSkills: "Allow duplicate active skills",
  allowDupSkillsHint: "Off excludes teams whose active Score UP timing/potency match",
  skillDupWarn: "Duplicate active skills",
  skillDupPair: (a, b) =>
    `${a} and ${b} share the same active Score UP timing (overlaps do not stack)`,
  trackStats: "Total stats",
  trackStatsDesc: "Costume + passives first, then buffed stats — top 8",
  trackCoverage: "Skill coverage",
  trackCoverageDesc: "Costume + passives first, then coverage — top 8",
  trackScore: "Avg Score UP",
  trackScoreDesc: "Costume + passives first, then average UP% — top 8",
  noTrackTeams: "No teams for this ranking focus.",
  pickTeamDetail: "Select a team on the left to see details.",
  costumeSkill: "Costume skill",
  activated: "On",
  notActivated: "Off",
  allPassives: "All passives",
  satisfied: "Met",
  notAllSatisfied: "Incomplete",
  avgScoreUp: "Avg Score UP",
  coveragePct: (n) => `Coverage ${n}%`,
  buffedStats: "Buffed stats",
  baseStats: (n) => `Base ${n}`,
  skillGaps: "No-skill gaps",
  shorterBetter: "Shorter is better",
  leaderCostume: "Captain costume",
  leader: "Captain",
  memberN: (n) => `Member ${n}`,
  forced: "Locked",
  costumeColon: (name) => `｜Costume: ${name}`,
  activeLine: (interval, duration, scoreUp) =>
    `Active: every ${interval}s / lasts ${duration}s / ${scoreUp}% (treated as always triggering)`,
  passivePrefix: "Passive: ",
  scoreSupport: (n) => ` · Score Support +${n}%`,
  timelineLabel:
    "Effective Score UP timeline (per-second max %, skills assumed always on)",
  gapsTotal: (sec) => `${sec}s total without Score UP`,
  typeCounts: (h, p, c) => `Types: Happy ${h} / Pure ${p} / Cute ${c}`,
  searchMeta: (searched, ms) => `｜ Searched ${searched} teams｜${ms} ms`,
  costumeNeed: (min) => `(costume needs ≥ ${min})`,
  fabTitleNeedLeader: "Choose a captain first",
  fabTitleReady: "Find the best team",
  fabBusy: "Working…",
  fabRun: "Build team",
  fabPickLeader: "Pick captain",
  alertWantedMax: "You can lock at most 5 wanted members",
  alertNeedLeader: "Please choose a captain first",
  alertTooMany: "Captain + wanted members cannot exceed 5. Remove some wanted members.",
  filterAllStars: "All rarities",
  filterAllAttrs: "All attributes",
  filterAttrCount: (n) => `Attrs ×${n}`,
  filterAllGens: "All gens",
  filterGenCount: (n) => `Gens ×${n}`,
  metricPr: (n) => `PR ${n}`,
  metricStats: (n) => `Stats ${n}`,
  metricCoverage: (n) => `Coverage ${n}%`,
  metricAvgUp: (n) => `Avg UP ${n}%`,
  search: "Search",
  searchPlaceholder: "Member / costume / Happy…",
  filterSettings: "Filters",
  showFull: "Show details",
  hideDetails: "Compact",
  compactOnly: "Art + name only",
  fullDetails: "Full card info",
  rarity: "Rarity",
  attribute: "Attribute",
  genGroup: "Generation / group",
  multiSelect: "Multi-select",
  all: "All",
  noMatchingCards: "No cards match these filters.",
  eventPrefix: (name) => `Event｜${name}`,
  eventBadge: "Event",
  performance: "Performance",
  technique: "Technique",
  sense: "Sense",
  total: (n) => `Total ${n}`,
  statsMissing: "Stats not listed yet",
  special: "Special",
  active: "Active",
  passive: "Passive",
  attrHappy: "Happy",
  attrPure: "Pure",
  attrCute: "Cute",
  condNone: "No condition (always on)",
  condTypeCount: (attr, min) => `${attr} ≥ ${min}`,
  condUnitCount: (unit, min) => `${unit} ≥ ${min}`,
  explainParamUp: (param, value) => `All ${param} +${value}%`,
  explainScoreSupport: (value) => `All Score Support +${value}%`,
  explainWhen: (cond, effects) => `When ${cond}: ${effects}`,
  gapsNone: "None (full coverage)",
  gapRange: (a, b, dur) => `${a}–${b}s (${dur}s)`,
  gapsJoin: ", ",
  paramPerf: "Performance",
  paramTech: "Technique",
  paramSense: "Sense",
  flagCostumeOn: "Costume ✓",
  flagCostumeOff: "Costume ✗",
  flagPassiveAll: "Passives ✓",
  flagPassiveMiss: "Passives ✗",
  flagStats: (n) => `Stats ${n}`,
  flagCoverage: (n) => `Cover ${n}%`,
  flagUp: (n) => `UP ${n}%`,
  commentBoardTitle: "Guestbook",
  commentBoardNote: "Share feedback, data fixes, or feature ideas (public; no personal info).",
  commentBoardNickname: "Nickname (optional)",
  commentBoardNicknamePlaceholder: "Anonymous is fine",
  commentBoardBody: "Message",
  commentBoardBodyPlaceholder: "Your thoughts…",
  commentBoardSubmit: "Post",
  commentBoardSubmitting: "Posting…",
  commentBoardEmpty: "No messages yet — be the first.",
  commentBoardLoading: "Loading messages…",
  commentBoardLoadError: "Could not load messages. Try again later.",
  commentBoardPostError: "Could not post. Try again later.",
  commentBoardUnavailable: "Guestbook not configured (Supabase required).",
  commentBoardAnonymous: "Anonymous",
  commentBoardRefresh: "Refresh",
  commentBoardClose: "Close",
  commentBoardBack: "← Back",
};

const ja: Messages = {
  brand: "Hololive Dreams 便利ツール",
  brandSub: "制作 108_虎太郎 · ホロドリ補助ツール",
  madeBy: "made by 108_虎太郎",
  footer: "制作 108_虎太郎 · データ照合：Game8 / AppMedia / Gamerch",
  langAria: "表示言語",
  themeAria: "機能メニュー",
  themeGallery: "キャラ一覧",
  themeGallerySub: "期生ごとにカードを見る",
  themeOptimize: "最強編成",
  themeOptimizeSub: "キャプテン＋固定メンバー最適化",
  themeRoster: "所持メン編成",
  themeRosterSub: "所持★5から編成",
  rosterTitle: (n) => `① 所持メンバー（${n}人）`,
  rosterNote:
    "所持の★5メンバー（イベント含む）を選択。5人以上＋キャプテン。★5が複数いる場合は下で所持分をチェック。PRは最強編成と同じ9999基準。",
  rosterCardPickTitle: "★5所持カード",
  rosterCardPickNote: "所持している★5をすべてチェック（複数可）。編成時に最適な組み合わせを自動選択します。",
  rosterNeedFive: "5人以上必要",
  rosterClear: "選択をクリア",
  alertRosterMin: "所持メンバーを5人以上選んでください。",
  alertRosterCardMin: "各メンバーは★5を1枚以上選んでください。",
  fabRosterRun: "所持から編成",
  galleryTitle: "キャラ一覧",
  dataNoticeBefore: "表示している数値・スキルはすべて",
  dataNoticeStrong: "満開花・最大レベル",
  dataNoticeAfter: "です。一部の★3／★4はステータス未収録の場合があります。",
  tagline:
    "キャプテンは衣装スキル用。編成5人にキャプテン本人は不要。入れたいメンバーを最大5人まで固定し、残りは自動で埋めます。",
  priority1: "キャプテン衣装スキル",
  priority2: "パッシブ全達成",
  priority3: (sec) => `有効 Score UP / カバー率（${sec}秒）`,
  priority4: "バフ後ステータス合計",
  captainTitle: "① キャプテン選択",
  labelGen: "期生 / グループ",
  pickGenFirst: "期生を選ぶ",
  labelMember: "メンバー",
  pickMember: "メンバーを選ぶ",
  pickGenFirstShort: "先に期生を選んでください",
  currentCaptain: "現在のキャプテン",
  songLength: "曲の長さ（秒）",
  costumePick: "キャプテン衣装スキル",
  noCostumeData: "このメンバーの衣装スキルデータはまだありません。",
  conditionLabel: "発動条件",
  conditionUnitHint: (list, min) =>
    `編成5人のうち、${list || "（なし）"} から ${min} 人以上（キャプテン本人は含めなくて可）。`,
  conditionTypeHint: (list, min) =>
    `該当属性カードを持つメンバー：${list || "（なし）"}。必要人数 ${min} 以上。`,
  conditionNone:
    "人数条件はありません。パッシブとスキルカバー率を優先してメンバーを最適化します。",
  wantedTitle: (n) => `② 入れたいメンバー（${n} / 5）`,
  wantedWithLeader: (n) => `｜キャプテン込みで固定 ${n} 人`,
  wantedLocked: (n) => `｜固定 ${n} 人`,
  captainOffTeam: "（編成外）",
  wantedNote:
    "カードをタップして固定（最大5）。キャプテンは衣装のみで編成枠を使いません。固定メンバーは必ず入り、残りを最適化します。",
  clearWanted: "固定をクリア",
  removeWantedAria: (name) => `${name} を外す`,
  resultsTitle: "③ 最適編成結果",
  resultsEmptyWithLeader: (name) =>
    `キャプテンは ${name} です。右下の「編成を計算」を押してください。`,
  resultsEmpty: "上でキャプテンと衣装を選んでください。",
  trackAria: "ランキング観点",
  trackOverall: "総合最強",
  trackOverallDesc:
    "衣装＋パッシブ優先。同衣装・指名なし最強編成を基準にステ／カバー／平均UPからPR上位8",
  prBaselineNote:
    "PR9999＝この衣装・指名なし最強編成（★5常駐＋イベントカード）。他編成はこれを基準に相対評価。",
  prBaselineBtn: "PR 9999",
  prBaselineBtnTitle: "同衣装・指名なし最強編成（PR基準）を表示",
  prBaselineBtnUnavailable: "先にキャプテン衣装を選び編成を計算してください",
  prBaselineViewBanner:
    "PR9999基準編成 — 同衣装・指名なし・★5＋イベント全池最強",
  allowDupSkills: "同一アクティブスキルを許可",
  allowDupSkillsHint: "OFFにすると Score UP の間隔・倍率などが同じ編成を除外",
  skillDupWarn: "アクティブスキル重複",
  skillDupPair: (a, b) =>
    `${a} と ${b} はアクティブ Score UP のタイミングが同じ（重複は加算されない）`,
  trackStats: "ステータス合計",
  trackStatsDesc: "衣装＋パッシブ優先、バフ後ステ上位8",
  trackCoverage: "スキルカバー率",
  trackCoverageDesc: "衣装＋パッシブ優先、カバー率上位8",
  trackScore: "平均スコアUP",
  trackScoreDesc: "衣装＋パッシブ優先、平均UP%上位8",
  noTrackTeams: "この観点の編成はありません。",
  pickTeamDetail: "左の編成を選ぶと詳細を表示します。",
  costumeSkill: "衣装スキル",
  activated: "発動",
  notActivated: "未発動",
  allPassives: "パッシブ全体",
  satisfied: "達成",
  notAllSatisfied: "未達",
  avgScoreUp: "平均 Score UP",
  coveragePct: (n) => `カバー ${n}%`,
  buffedStats: "バフ後ステ",
  baseStats: (n) => `基礎 ${n}`,
  skillGaps: "スキル空白",
  shorterBetter: "短いほど良い",
  leaderCostume: "キャプテン衣装",
  leader: "キャプテン",
  memberN: (n) => `メンバー ${n}`,
  forced: "固定",
  costumeColon: (name) => `｜衣装：${name}`,
  activeLine: (interval, duration, scoreUp) =>
    `Active：${interval}秒ごと / 持続 ${duration}秒 / ${scoreUp}%（計算上は必ず発動）`,
  passivePrefix: "Passive：",
  scoreSupport: (n) => ` · スコアサポート +${n}%`,
  timelineLabel: "有効 Score UP タイムライン（秒ごとに最大％、スキルは常時発動想定）",
  gapsTotal: (sec) => `Score UP なし合計 ${sec} 秒`,
  typeCounts: (h, p, c) => `タイプ：ハッピー ${h} / ピュア ${p} / キュート ${c}`,
  searchMeta: (searched, ms) => `｜ 探索 ${searched} 組｜所要 ${ms} ms`,
  costumeNeed: (min) => `（衣装条件 ≥ ${min}）`,
  fabTitleNeedLeader: "先にキャプテンを選んでください",
  fabTitleReady: "最適編成を計算",
  fabBusy: "計算中…",
  fabRun: "編成を計算",
  fabPickLeader: "キャプテンを選ぶ",
  alertWantedMax: "入れたいメンバーは最大5人までです",
  alertNeedLeader: "先にキャプテンを選んでください",
  alertTooMany:
    "キャプテン＋入れたいメンバーは合計5人までです。人数を減らしてください。",
  filterAllStars: "全レアリティ",
  filterAllAttrs: "全属性",
  filterAttrCount: (n) => `属性×${n}`,
  filterAllGens: "全期生",
  filterGenCount: (n) => `期生×${n}`,
  metricPr: (n) => `PR ${n}`,
  metricStats: (n) => `ステ ${n}`,
  metricCoverage: (n) => `カバー ${n}%`,
  metricAvgUp: (n) => `平均UP ${n}%`,
  search: "検索",
  searchPlaceholder: "メンバー / 衣装 / ハッピー…",
  filterSettings: "絞り込み",
  showFull: "詳細を表示",
  hideDetails: "簡易表示",
  compactOnly: "カード＋名前のみ",
  fullDetails: "カード情報を全部表示",
  rarity: "レアリティ",
  attribute: "属性",
  genGroup: "期生 / グループ",
  multiSelect: "複数選択可",
  all: "すべて",
  noMatchingCards: "条件に合うカードがありません。",
  eventPrefix: (name) => `イベント｜${name}`,
  eventBadge: "イベント",
  performance: "パフォーマンス",
  technique: "テクニック",
  sense: "センス",
  total: (n) => `合計 ${n}`,
  statsMissing: "ステータス未収録",
  special: "スペシャル",
  active: "アクティブ",
  passive: "パッシブ",
  attrHappy: "ハッピー型",
  attrPure: "ピュア型",
  attrCute: "キュート型",
  condNone: "条件なし（入場で発動）",
  condTypeCount: (attr, min) => `${attr} ≥ ${min} 人`,
  condUnitCount: (unit, min) => `${unit} ≥ ${min} 人`,
  explainParamUp: (param, value) => `全員${param} +${value}%`,
  explainScoreSupport: (value) => `全員スコアサポート +${value}%`,
  explainWhen: (cond, effects) => `${cond} のとき：${effects}`,
  gapsNone: "なし（全程カバー）",
  gapRange: (a, b, dur) => `${a}–${b}秒（${dur}秒）`,
  gapsJoin: "、",
  paramPerf: "パフォーマンス",
  paramTech: "テクニック",
  paramSense: "センス",
  flagCostumeOn: "衣装○",
  flagCostumeOff: "衣装×",
  flagPassiveAll: "パッシブ全○",
  flagPassiveMiss: "パッシブ欠",
  flagStats: (n) => `ステ ${n}`,
  flagCoverage: (n) => `カバー ${n}%`,
  flagUp: (n) => `UP ${n}%`,
  commentBoardTitle: "掲示板",
  commentBoardNote: "ご意見・データ修正・機能要望など（公開表示。個人情報は書かないでください）。",
  commentBoardNickname: "ニックネーム（任意）",
  commentBoardNicknamePlaceholder: "匿名でもOK",
  commentBoardBody: "コメント",
  commentBoardBodyPlaceholder: "メッセージ…",
  commentBoardSubmit: "投稿",
  commentBoardSubmitting: "投稿中…",
  commentBoardEmpty: "まだコメントがありません。",
  commentBoardLoading: "読み込み中…",
  commentBoardLoadError: "読み込みに失敗しました。",
  commentBoardPostError: "投稿に失敗しました。",
  commentBoardUnavailable: "掲示板は未設定です（Supabase が必要）。",
  commentBoardAnonymous: "匿名",
  commentBoardRefresh: "更新",
  commentBoardClose: "閉じる",
  commentBoardBack: "← 戻る",
};

export const MESSAGES: Record<Locale, Messages> = { zh, en, ja };

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "zh" || v === "en" || v === "ja";
}
