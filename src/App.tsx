import { useDeferredValue, useEffect, useMemo, useState } from "react";
import gameData from "./data/gameData.json";
import { CardArt } from "./components/CardArt";
import { CardFilterToolbar, CardGroupBrowser } from "./components/CardBrowser";
import { MemberName } from "./components/MemberName";
import { Portrait } from "./components/Portrait";
import { useI18n } from "./i18n/LocaleContext";
import { LOCALES } from "./i18n/messages";
import {
  candidatesForCondition,
  conditionProgress,
  describeCondition,
  formatMemberList,
} from "./lib/explain";
import { formatUncoveredGaps } from "./lib/coverage";
import {
  UNIT_ORDER,
  categorySortKey,
  compareMembersByGroup,
  memberSortKey,
  primaryUnit,
} from "./lib/groups";
import { displayName, listName, matchesQuery } from "./lib/names";
import { captainCostumesForMember } from "./lib/costumes";
import { optimizeTeamFast, buildOptimizeResultFromCache, hydratePrCostumeTop8 } from "./lib/optimizer";
import {
  countOptimizerPoolCards,
  getPrCostumeTop8,
  isPrCostumeFullyCached,
  persistSharedPrBaseline,
  SHARED_TOP_N,
  syncSharedPrBaseline,
} from "./lib/prBaselineStore";
import {
  formatActiveSkill,
  formatCostumeSkillText,
  formatPassiveSkill,
} from "./lib/skillText";
import {
  bootstrapRosterProfiles,
  createRosterProfile,
  deleteRosterInventory,
  exportRosterInventory,
  loadRosterInventory,
  parseRosterImport,
  saveRosterInventory,
  saveRosterProfiles,
  setActiveRosterProfile,
  type RosterProfile,
} from "./lib/rosterProfiles";
import type { Attr, Card, Costume, GameData, TeamEvaluation } from "./types";

const data = gameData as GameData;
const STORAGE_LOCKED = "holodream-wanted-members";
const STORAGE_PREF_CARDS = "holodream-preferred-cards";

const allCardIds = new Set(data.cards.map((c) => c.id));
const allCostumeIds = new Set(data.costumes.map((c) => c.id));
const cardById = new Map(data.cards.map((c) => [c.id, c] as const));
const costumeIdByCardKey = new Map(
  data.costumes.map((c) => [`${c.member}|||${c.costumeName}`, c.id] as const),
);
/** Fixed song length for Score UP / coverage (sec). */
const SONG_LENGTH = data.songLengthDefault;

type AppTheme = "gallery" | "optimize" | "roster";
type ResultTrack = "overall" | "stats" | "coverage" | "score";

type OptimizeUiResult = {
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

function unitsOf(member: string): string[] {
  return data.members[member]?.units ?? [];
}

function isOptimizePoolCard(c: Card) {
  return c.rarity === 5 || !!c.event;
}

function rosterCardsForMember(member: string): Card[] {
  return data.cards
    .filter((c) => c.member === member && isOptimizePoolCard(c))
    .sort((a, b) => {
      const ta = a.stats?.total ?? 0;
      const tb = b.stats?.total ?? 0;
      if (tb !== ta) return tb - ta;
      return a.costumeName.localeCompare(b.costumeName, "ja");
    });
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const { locale, setLocale, t, attrLabel } = useI18n();
  const rosterUi =
    locale === "ja"
      ? {
          account: "ゲームアカウント",
          rosterNote: "所持している★5／イベントカードだけを登録してください。1枚だけのメンバーは自動登録、複数カードのメンバーは下のカード選択で所持衣装を決めます。隊長・衣装・5人編成は自動で選ばれます。",
          emptyReady: "バッグ設定後、右下のボタンで隊長・衣装・5人編成を自動計算します。",
          newAccount: "追加",
          rename: "名前変更",
          delete: "削除",
          import: "バッグをインポート",
          export: "エクスポート",
          costumeTitle: "所持している衣装",
          costumeNote: "所持衣装だけを選択してください。隊長と衣装は計算時に自動選択されます。",
          clearCostumes: "衣装をクリア",
          needCostume: "選択したカードに対応する衣装データが見つかりません。複数カードのメンバーは所持カードを1枚以上選択してください。",
          autoCaptain: "隊長・衣装を自動選択",
          accountPrompt: "新しいゲームアカウント名",
          renamePrompt: "ゲームアカウント名を変更",
          deleteConfirm: "このアカウントのローカル保存データを削除しますか？",
          importOk: "このアカウントのバッグを更新しました。",
          importFail: "バッグJSONを読み込めませんでした。",
        }
      : locale === "en"
        ? {
            account: "Game account",
            rosterNote: "Save only owned ★5/event cards. Members with one card are handled automatically; for members with multiple cards, the card picker below determines which costumes you own. Captain, costume, and the five-member team are selected automatically.",
            emptyReady: "After setting the inventory, use the button at bottom right to calculate the best captain, costume, and five-member team.",
            newAccount: "Add",
            rename: "Rename",
            delete: "Delete",
            import: "Import inventory",
            export: "Export",
            costumeTitle: "Owned costumes",
            costumeNote: "Select only costumes this account owns. Captain and costume are chosen automatically.",
            clearCostumes: "Clear costumes",
            needCostume: "No usable costume was found. For members with multiple cards, select at least one owned card below.",
            autoCaptain: "Auto captain + costume",
            accountPrompt: "New game account name",
            renamePrompt: "Rename game account",
            deleteConfirm: "Delete this account's locally saved inventory?",
            importOk: "Inventory updated for this account.",
            importFail: "Could not read the inventory JSON.",
          }
        : {
            account: "遊戲帳號",
            rosterNote: "只要記錄實際持有的 ★5／活動卡。只有 1 張卡的角色會自動帶入卡片與衣裝；有多張卡面的角色則以下方「★5 持有卡面」勾選結果決定可用衣裝。隊長、衣裝與五人編成都由系統自動挑選。",
            emptyReady: "背包設定完成後，按右下角即可自動計算最佳隊長、衣裝與五人編成。",
            newAccount: "新增帳號",
            rename: "改名",
            delete: "刪除",
            import: "匯入背包",
            export: "匯出",
            costumeTitle: "持有衣裝",
            costumeNote: "只勾選此帳號實際持有的衣裝；計算時會自動挑隊長與衣裝，不用先指定。",
            clearCostumes: "清空衣裝",
            needCostume: "目前沒有可用衣裝；有多張卡面的角色請在「★5 持有卡面」至少勾選一張。",
            autoCaptain: "自動挑隊長＋衣裝",
            accountPrompt: "新增遊戲帳號名稱",
            renamePrompt: "修改遊戲帳號名稱",
            deleteConfirm: "要刪除這個帳號在瀏覽器內保存的背包資料嗎？",
            importOk: "已更新此帳號的背包。",
            importFail: "背包 JSON 無法讀取。",
          };

  const [rosterBootstrap] = useState(() => bootstrapRosterProfiles(data));
  const [theme, setTheme] = useState<AppTheme>("gallery");
  const [wantedMembers, setWantedMembers] = useState<string[]>(() =>
    loadJson<string[]>(STORAGE_LOCKED, []).slice(0, 5),
  );
  const [preferredCards, setPreferredCards] = useState<Record<string, string>>(() =>
    loadJson(STORAGE_PREF_CARDS, {}),
  );
  const [typeFilters, setTypeFilters] = useState<Attr[]>([]);
  const [rarityFilters, setRarityFilters] = useState<number[]>([]);
  const [unitFilters, setUnitFilters] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [leaderUnit, setLeaderUnit] = useState("");
  const [leaderMember, setLeaderMember] = useState("");
  const [leaderCostumeId, setLeaderCostumeId] = useState("");
  const [result, setResult] = useState<OptimizeUiResult | null>(null);
  const [resultTrack, setResultTrack] = useState<ResultTrack>("overall");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [viewingPrBaseline, setViewingPrBaseline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [cardsCompact, setCardsCompact] = useState(true);
  const [allowDuplicateSkills, setAllowDuplicateSkills] = useState(true);
  const [rosterProfiles, setRosterProfiles] = useState<RosterProfile[]>(rosterBootstrap.profiles);
  const [activeRosterProfileId, setActiveRosterProfileId] = useState(rosterBootstrap.activeId);
  const [ownedRosterMembers, setOwnedRosterMembers] = useState<string[]>(
    rosterBootstrap.inventory.members,
  );
  const [rosterOwnedCards, setRosterOwnedCards] = useState<Record<string, string[]>>(
    rosterBootstrap.inventory.cardsByMember,
  );
  const [ownedRosterCostumeIds, setOwnedRosterCostumeIds] = useState<string[]>(
    rosterBootstrap.inventory.costumeIds,
  );

  const wantedSet = useMemo(() => new Set(wantedMembers), [wantedMembers]);
  const rosterSet = useMemo(() => new Set(ownedRosterMembers), [ownedRosterMembers]);
  const activeRosterProfile = useMemo(
    () => rosterProfiles.find((p) => p.id === activeRosterProfileId) ?? rosterProfiles[0],
    [rosterProfiles, activeRosterProfileId],
  );

  const unitOptions = useMemo(() => {
    const present = new Set(
      Object.keys(data.members).map((m) => primaryUnit(unitsOf(m))),
    );
    return UNIT_ORDER.filter((u) => present.has(u));
  }, []);

  const membersInLeaderUnit = useMemo(() => {
    if (!leaderUnit) return [] as string[];
    return Object.keys(data.members)
      .filter((m) => primaryUnit(unitsOf(m)) === leaderUnit)
      .sort((a, b) => memberSortKey(a) - memberSortKey(b) || a.localeCompare(b, "ja"));
  }, [leaderUnit]);

  const leaderCostumes = useMemo(() => {
    if (!leaderMember) return [] as Costume[];
    return captainCostumesForMember(data.costumes, leaderMember);
  }, [leaderMember]);

  const selectedCostume = useMemo(
    () => leaderCostumes.find((c) => c.id === leaderCostumeId) ?? null,
    [leaderCostumes, leaderCostumeId],
  );

  const allMembersSet = useMemo(() => new Set(Object.keys(data.members)), []);

  const conditionCandidates = useMemo(() => {
    if (!selectedCostume) return [] as string[];
    return candidatesForCondition(selectedCostume.skill.condition, data, allMembersSet).sort(
      (a, b) => compareMembersByGroup(a, b, unitsOf),
    );
  }, [selectedCostume, allMembersSet]);

  const cardCategory = (c: Card) => c.event || primaryUnit(unitsOf(c.member), c.unit);

  function rosterOwnedIds(member: string): string[] {
    const cards = rosterCardsForMember(member);
    const stored = rosterOwnedCards[member];
    if (stored !== undefined) {
      return stored.filter((id) => cards.some((c) => c.id === id));
    }
    return cards.length === 1 ? [cards[0].id] : [];
  }

  function rosterOwnedCardIdsForOptimize(): Set<string> {
    const ids = new Set<string>();
    for (const member of ownedRosterMembers) {
      for (const id of rosterOwnedIds(member)) ids.add(id);
    }
    return ids;
  }

  function rosterOwnedCostumeIdsForOptimize(): Set<string> {
    const costumeIds = new Set<string>();
    for (const cardId of rosterOwnedCardIdsForOptimize()) {
      const card = cardById.get(cardId);
      if (!card) continue;
      const costumeId = costumeIdByCardKey.get(`${card.member}|||${card.costumeName}`);
      if (costumeId) costumeIds.add(costumeId);
    }
    return costumeIds;
  }

  const rosterMultiCardMembers = useMemo(() => {
    return ownedRosterMembers.filter((m) => rosterCardsForMember(m).length > 1);
  }, [ownedRosterMembers]);

  function filterAndSortCards(cards: Card[], includeRarity: boolean): Card[] {
    return cards
      .filter((c) => (typeFilters.length ? typeFilters.includes(c.type) : true))
      .filter((c) =>
        includeRarity && rarityFilters.length ? rarityFilters.includes(c.rarity) : true,
      )
      .filter((c) => {
        if (!unitFilters.length) return true;
        return unitFilters.includes(primaryUnit(unitsOf(c.member), c.unit));
      })
      .filter((c) => {
        if (!deferredQuery.trim()) return true;
        const q = deferredQuery.trim().toLowerCase();
        return (
          matchesQuery(c.member, q, unitsOf(c.member)) ||
          c.costumeName.toLowerCase().includes(q) ||
          c.unit.toLowerCase().includes(q) ||
          (c.event ?? "").toLowerCase().includes(q) ||
          attrLabel(c.type).includes(deferredQuery.trim())
        );
      })
      .sort((a, b) => {
        const ca = cardCategory(a);
        const cb = cardCategory(b);
        const byCat = categorySortKey(ca) - categorySortKey(cb);
        if (byCat !== 0) return byCat;
        if (ca !== cb) return ca.localeCompare(cb, "ja");
        const byMember = memberSortKey(a.member) - memberSortKey(b.member);
        if (byMember !== 0) return byMember;
        if (b.rarity !== a.rarity) return b.rarity - a.rarity;
        return a.costumeName.localeCompare(b.costumeName, "ja");
      });
  }

  const galleryVisibleCards = useMemo(
    () => filterAndSortCards(data.cards, true),
    [typeFilters, rarityFilters, unitFilters, deferredQuery, locale],
  );

  const optimizeVisibleCards = useMemo(
    () => filterAndSortCards(data.cards.filter(isOptimizePoolCard), false),
    [typeFilters, unitFilters, deferredQuery, locale],
  );

  function toggleUnitFilter(unit: string) {
    setUnitFilters((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit],
    );
  }

  function toggleRarityFilter(r: number) {
    setRarityFilters((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r].sort((a, b) => b - a),
    );
  }

  function toggleTypeFilter(t: Attr) {
    setTypeFilters((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const cardGroups = useMemo(() => {
    const groups: { unit: string; cards: Card[]; isEvent: boolean }[] = [];
    for (const c of optimizeVisibleCards) {
      const unit = cardCategory(c);
      const last = groups[groups.length - 1];
      if (last && last.unit === unit) last.cards.push(c);
      else groups.push({ unit, cards: [c], isEvent: !!c.event });
    }
    return groups;
  }, [optimizeVisibleCards]);

  /** 角色一覽：嚴格依期數／分組排列（活動卡歸入該成員期數） */
  const galleryGroups = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of galleryVisibleCards) {
      const unit = primaryUnit(unitsOf(c.member), c.unit);
      const list = map.get(unit);
      if (list) list.push(c);
      else map.set(unit, [c]);
    }
    const ordered = [
      ...UNIT_ORDER.filter((u) => map.has(u)),
      ...[...map.keys()].filter((u) => !UNIT_ORDER.includes(u)).sort((a, b) => a.localeCompare(b, "ja")),
    ];
    return ordered.map((unit) => {
      const cards = [...(map.get(unit) ?? [])].sort((a, b) => {
        const byMember = memberSortKey(a.member) - memberSortKey(b.member);
        if (byMember !== 0) return byMember;
        if (a.member !== b.member) return a.member.localeCompare(b.member, "ja");
        if (b.rarity !== a.rarity) return b.rarity - a.rarity;
        return a.costumeName.localeCompare(b.costumeName, "ja");
      });
      return { unit, cards, isEvent: false };
    });
  }, [galleryVisibleCards]);

  const rosterMemberGroups = useMemo(() => {
    const eligible = new Set<string>();
    for (const c of data.cards) {
      if (c.rarity === 5 || c.event) eligible.add(c.member);
    }
    const map = new Map<string, string[]>();
    for (const member of eligible) {
      const unit = primaryUnit(unitsOf(member));
      const list = map.get(unit);
      if (list) list.push(member);
      else map.set(unit, [member]);
    }
    const ordered = [
      ...UNIT_ORDER.filter((u) => map.has(u)),
      ...[...map.keys()].filter((u) => !UNIT_ORDER.includes(u)).sort((a, b) => a.localeCompare(b, "ja")),
    ];
    return ordered.map((unit) => ({
      unit,
      members: (map.get(unit) ?? []).sort(
        (a, b) => memberSortKey(a) - memberSortKey(b) || a.localeCompare(b, "ja"),
      ),
    }));
  }, []);

  function persistRosterSnapshot(
    members: string[],
    cardsByMember: Record<string, string[]>,
    costumeIds: string[],
  ) {
    saveRosterInventory(activeRosterProfileId, { members, cardsByMember, costumeIds });
  }

  function switchRosterProfile(profileId: string) {
    const inventory = loadRosterInventory(profileId);
    setActiveRosterProfileId(profileId);
    setActiveRosterProfile(profileId);
    setOwnedRosterMembers(inventory.members);
    setRosterOwnedCards(inventory.cardsByMember);
    setOwnedRosterCostumeIds(inventory.costumeIds);
    setResult(null);
  }

  function addRosterProfile() {
    const name = window.prompt(rosterUi.accountPrompt)?.trim();
    if (!name) return;
    const profile = createRosterProfile(name);
    const next = [...rosterProfiles, profile];
    setRosterProfiles(next);
    saveRosterProfiles(next);
    saveRosterInventory(profile.id, { members: [], cardsByMember: {}, costumeIds: [] });
    switchRosterProfile(profile.id);
  }

  function renameRosterProfile() {
    if (!activeRosterProfile) return;
    const name = window.prompt(rosterUi.renamePrompt, activeRosterProfile.name)?.trim();
    if (!name) return;
    const next = rosterProfiles.map((p) =>
      p.id === activeRosterProfile.id ? { ...p, name } : p,
    );
    setRosterProfiles(next);
    saveRosterProfiles(next);
  }

  function removeRosterProfile() {
    if (!activeRosterProfile || rosterProfiles.length <= 1) return;
    if (!window.confirm(rosterUi.deleteConfirm)) return;
    const next = rosterProfiles.filter((p) => p.id !== activeRosterProfile.id);
    deleteRosterInventory(activeRosterProfile.id);
    setRosterProfiles(next);
    saveRosterProfiles(next);
    switchRosterProfile(next[0].id);
  }

  async function importRosterFile(file: File | null) {
    if (!file) return;
    try {
      const inventory = parseRosterImport(await file.text(), data);
      setOwnedRosterMembers(inventory.members);
      setRosterOwnedCards(inventory.cardsByMember);
      setOwnedRosterCostumeIds(inventory.costumeIds);
      saveRosterInventory(activeRosterProfileId, inventory);
      setResult(null);
      alert(rosterUi.importOk);
    } catch {
      alert(rosterUi.importFail);
    }
  }

  function exportActiveRoster() {
    if (!activeRosterProfile) return;
    const payload = exportRosterInventory(activeRosterProfile, {
      members: ownedRosterMembers,
      cardsByMember: rosterOwnedCards,
      costumeIds: ownedRosterCostumeIds,
    });
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `holodream-${activeRosterProfile.name.replace(/[^\p{L}\p{N}_-]+/gu, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function toggleRosterMember(member: string) {
    setOwnedRosterMembers((prev) => {
      const removing = prev.includes(member);
      const next = removing ? prev.filter((m) => m !== member) : [...prev, member];
      setRosterOwnedCards((prefs) => {
        const nextPrefs = { ...prefs };
        if (removing) {
          delete nextPrefs[member];
        } else {
          const cards = rosterCardsForMember(member);
          nextPrefs[member] = cards.length === 1 ? [cards[0].id] : [];
        }
        persistRosterSnapshot(next, nextPrefs, ownedRosterCostumeIds);
        return nextPrefs;
      });
      setResult(null);
      return next;
    });
  }

  function toggleRosterCard(card: Card) {
    if (!rosterSet.has(card.member)) return;
    const current = rosterOwnedIds(card.member);
    const has = current.includes(card.id);
    if (has && current.length <= 1) {
      alert(t.alertRosterCardMin);
      return;
    }
    setRosterOwnedCards((prev) => {
      const nextIds = has ? current.filter((id) => id !== card.id) : [...current, card.id];
      const next = { ...prev, [card.member]: nextIds };
      persistRosterSnapshot(ownedRosterMembers, next, ownedRosterCostumeIds);
      setResult(null);
      return next;
    });
  }

  function clearRosterMembers() {
    setOwnedRosterMembers([]);
    setRosterOwnedCards({});
    persistRosterSnapshot([], {}, ownedRosterCostumeIds);
    setResult(null);
  }

  function persistWanted(members: string[], prefs: Record<string, string>) {
    localStorage.setItem(STORAGE_LOCKED, JSON.stringify(members));
    localStorage.setItem(STORAGE_PREF_CARDS, JSON.stringify(prefs));
  }

  function toggleWantedCard(card: Card) {
    setWantedMembers((prev) => {
      const isWanted = prev.includes(card.member);
      let next: string[];
      let nextPrefs = { ...preferredCards };

      if (isWanted && preferredCards[card.member] === card.id) {
        // Deselect this member
        next = prev.filter((m) => m !== card.member);
        delete nextPrefs[card.member];
      } else if (isWanted) {
        // Switch preferred card for same member
        next = prev;
        nextPrefs[card.member] = card.id;
      } else {
        if (prev.length >= 5) {
          alert(t.alertWantedMax);
          return prev;
        }
        // If leader already set and adding would exceed with leader constraint later — still allow; optimize validates
        next = [...prev, card.member];
        nextPrefs[card.member] = card.id;
      }

      setPreferredCards(nextPrefs);
      persistWanted(next, nextPrefs);
      setResult(null);
      return next;
    });
  }

  function removeWanted(member: string) {
    setWantedMembers((prev) => {
      const next = prev.filter((m) => m !== member);
      const nextPrefs = { ...preferredCards };
      delete nextPrefs[member];
      setPreferredCards(nextPrefs);
      persistWanted(next, nextPrefs);
      setResult(null);
      return next;
    });
  }

  function clearWanted() {
    setWantedMembers([]);
    setPreferredCards({});
    persistWanted([], {});
    setResult(null);
  }

  function pickLeader(member: string) {
    setLeaderMember(member);
    const unit = primaryUnit(unitsOf(member));
    setLeaderUnit(unit);
    const costumes = captainCostumesForMember(data.costumes, member);
    setLeaderCostumeId(costumes[0]?.id ?? "");
    setResult(null);
    setSelectedIdx(0);
  }

  function onLeaderUnitChange(unit: string) {
    setLeaderUnit(unit);
    setLeaderMember("");
    setLeaderCostumeId("");
    setResult(null);
    setSelectedIdx(0);
  }

  const fullPoolCardCount = useMemo(
    () => countOptimizerPoolCards(data.cards),
    [],
  );

  async function prepareAndRunOptimize(
    ownedCardIds: Set<string>,
    options: Omit<Parameters<typeof optimizeTeamFast>[1], "ownedCardIds">,
    sharePr9999Baseline = false,
  ) {
    const costumeId = options.fixedCostumeId;
    const noWantedMembers = !options.fixedMembers?.length;
    const unconstrainedRun = noWantedMembers && !options.memberPool?.length;
    let prFullyCached = false;

    if (costumeId) {
      prFullyCached = isPrCostumeFullyCached(costumeId, SONG_LENGTH, fullPoolCardCount);
      if (!prFullyCached) {
        await syncSharedPrBaseline(costumeId, SONG_LENGTH, fullPoolCardCount);
        prFullyCached = isPrCostumeFullyCached(costumeId, SONG_LENGTH, fullPoolCardCount);
      }
    }

    const finish = (out: ReturnType<typeof optimizeTeamFast>) => {
      setResult(out);
      setResultTrack("overall");
      setSelectedIdx(0);
      setBusy(false);
      requestAnimationFrame(() => {
        document.getElementById("optimize-results")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    };

    if (sharePr9999Baseline && costumeId && unconstrainedRun && prFullyCached) {
      const entries = getPrCostumeTop8(costumeId, SONG_LENGTH, fullPoolCardCount);
      if (entries?.length) {
        const hydrated = hydratePrCostumeTop8(data, entries, costumeId, SONG_LENGTH);
        if (hydrated.length >= SHARED_TOP_N) {
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              finish(buildOptimizeResultFromCache(hydrated));
              resolve();
            }, 30);
          });
          return;
        }
      }
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        const out = optimizeTeamFast(data, {
          ...options,
          ownedCardIds,
        });
        if (
          sharePr9999Baseline &&
          unconstrainedRun &&
          !prFullyCached &&
          out.byOverall.length &&
          costumeId
        ) {
          void persistSharedPrBaseline(
            out.byOverall,
            costumeId,
            SONG_LENGTH,
            fullPoolCardCount,
          );
        }
        finish(out);
        resolve();
      }, 30);
    });
  }

  function runOptimize() {
    if (!leaderMember) {
      alert(t.alertNeedLeader);
      return;
    }
    if (wantedMembers.length > 5) {
      alert(t.alertWantedMax);
      return;
    }

    setBusy(true);
    void prepareAndRunOptimize(
      allCardIds,
      {
        ownedCostumeIds: allCostumeIds,
        songLength: SONG_LENGTH,
        fixedLeader: leaderMember,
        fixedCostumeId: leaderCostumeId || null,
        fixedMembers: wantedMembers,
        preferredCardByMember: preferredCards,
        maxResults: 8,
        allowDuplicateSkills,
      },
      true,
    );
  }

  function runRosterOptimize() {
    if (ownedRosterMembers.length < 5) {
      alert(t.alertRosterMin);
      return;
    }
    for (const member of ownedRosterMembers) {
      if (!rosterOwnedIds(member).length) {
        alert(t.alertRosterCardMin);
        return;
      }
    }
    const ownedCostumeIds = rosterOwnedCostumeIdsForOptimize();
    if (!ownedCostumeIds.size) {
      alert(rosterUi.needCostume);
      return;
    }

    setBusy(true);
    void prepareAndRunOptimize(
      rosterOwnedCardIdsForOptimize(),
      {
        ownedCostumeIds,
        songLength: SONG_LENGTH,
        fixedLeader: null,
        fixedCostumeId: null,
        fixedMembers: [],
        memberPool: ownedRosterMembers,
        maxResults: 8,
        allowDuplicateSkills,
      },
      false,
    );
  }

  const galleryFilterSummary = [
    rarityFilters.length === 0
      ? t.filterAllStars
      : rarityFilters.length === 1
        ? `★${rarityFilters[0]}`
        : `★${rarityFilters.join("/")}`,
    typeFilters.length === 0
      ? t.filterAllAttrs
      : typeFilters.length === 1
        ? attrLabel(typeFilters[0])
        : t.filterAttrCount(typeFilters.length),
    unitFilters.length === 0
      ? t.filterAllGens
      : unitFilters.length <= 2
        ? unitFilters.join(t.gapsJoin)
        : t.filterGenCount(unitFilters.length),
  ].join(" · ");

  const optimizeFilterSummary = [
    typeFilters.length === 0
      ? t.filterAllAttrs
      : typeFilters.length === 1
        ? attrLabel(typeFilters[0])
        : t.filterAttrCount(typeFilters.length),
    unitFilters.length === 0
      ? t.filterAllGens
      : unitFilters.length <= 2
        ? unitFilters.join(t.gapsJoin)
        : t.filterGenCount(unitFilters.length),
  ].join(" · ");

  const trackList = useMemo(() => {
    if (!result) return [] as TeamEvaluation[];
    if (resultTrack === "overall") return result.byOverall;
    if (resultTrack === "stats") return result.byStats;
    if (resultTrack === "coverage") return result.byCoverage;
    return result.byAvgScoreUp;
  }, [result, resultTrack]);

  const selected = trackList[selectedIdx] ?? null;

  const prBaselineTeam = useMemo(() => {
    if (!result) return null;
    return result.baselineTeam ?? null;
  }, [result]);

  const detailEv = viewingPrBaseline && prBaselineTeam ? prBaselineTeam : selected;
  const detailProgress = detailEv
    ? conditionProgress(
        detailEv.costume.skill.condition,
        detailEv.typeCounts,
        detailEv.unitCounts,
        attrLabel,
      )
    : null;

  useEffect(() => {
    setViewingPrBaseline(false);
  }, [result]);

  const requiredCount = wantedMembers.length;

  function trackMetricLabel(ev: TeamEvaluation): string {
    if (resultTrack === "overall") {
      return t.metricPr(ev.powerRating?.toFixed(0) ?? "—");
    }
    if (resultTrack === "stats") {
      return t.metricStats(ev.effectiveStatTotal.toLocaleString());
    }
    if (resultTrack === "coverage") {
      return t.metricCoverage((ev.coverage * 100).toFixed(1));
    }
    return t.metricAvgUp(ev.avgScoreUp.toFixed(1));
  }

  function rankClass(idx: number): string {
    if (idx === 0) return "rank-gold";
    if (idx === 1) return "rank-silver";
    if (idx === 2) return "rank-bronze";
    return "rank-plain";
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-glow" aria-hidden />
        <div className="lang-switch" role="group" aria-label={t.langAria}>
          {LOCALES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`lang-btn ${locale === l.id ? "active" : ""}`}
              aria-pressed={locale === l.id}
              onClick={() => setLocale(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="hero-main">
          <div className="hero-copy">
            <p className="hero-kicker">{t.madeBy}</p>
            <h1 className="brand">
              <span className="brand-mark" aria-hidden />
              {t.brand}
            </h1>
            <p className="brand-sub">{t.brandSub}</p>
            <nav className="theme-tabs" aria-label={t.themeAria}>
              <button
                type="button"
                className={`theme-tab ${theme === "gallery" ? "active" : ""}`}
                aria-selected={theme === "gallery"}
                onClick={() => setTheme("gallery")}
              >
                {t.themeGallery}
                <small>{t.themeGallerySub}</small>
              </button>
              <button
                type="button"
                className={`theme-tab ${theme === "optimize" ? "active" : ""}`}
                aria-selected={theme === "optimize"}
                onClick={() => setTheme("optimize")}
              >
                {t.themeOptimize}
                <small>{t.themeOptimizeSub}</small>
              </button>
              <button
                type="button"
                className={`theme-tab ${theme === "roster" ? "active" : ""}`}
                aria-selected={theme === "roster"}
                onClick={() => setTheme("roster")}
              >
                {t.themeRoster}
                <small>{t.themeRosterSub}</small>
              </button>
            </nav>
          </div>
          <div className="hero-mascot">
            <Portrait member="常闇トワ" size="lg" className="hero-portrait" />
            <span className="hero-mascot-caption">常闇トワ</span>
          </div>
        </div>
      </header>

      {theme === "gallery" && (
        <section className="panel gallery-panel">
          <div className="panel-head">
            <h2>{t.galleryTitle}</h2>
            <p className="data-notice" role="note">
              {t.dataNoticeBefore}
              <strong>{t.dataNoticeStrong}</strong>
              {t.dataNoticeAfter}
            </p>
          </div>
          <CardFilterToolbar
            filterOpen={filterOpen}
            onToggleOpen={() => setFilterOpen((v) => !v)}
            compact={cardsCompact}
            onToggleCompact={() => setCardsCompact((v) => !v)}
            filterSummary={galleryFilterSummary}
            showRarityFilter
            rarityFilters={rarityFilters}
            typeFilters={typeFilters}
            unitFilters={unitFilters}
            unitOptions={unitOptions}
            query={query}
            onQuery={setQuery}
            onClearRarity={() => setRarityFilters([])}
            onToggleRarity={toggleRarityFilter}
            onClearType={() => setTypeFilters([])}
            onToggleType={toggleTypeFilter}
            onClearUnit={() => setUnitFilters([])}
            onToggleUnit={toggleUnitFilter}
          />
          <CardGroupBrowser
            groups={galleryGroups}
            compact={cardsCompact}
            unitsOf={unitsOf}
          />
        </section>
      )}

      {(theme === "optimize" || theme === "roster") && (
        <>
          <section className="theme-intro">
            <p className="tagline">{t.tagline}</p>
            <div className="priority">
              <span className="chip">
                <strong>1</strong> {t.priority1}
              </span>
              <span className="chip">
                <strong>2</strong> {t.priority2}
              </span>
              <span className="chip">
                <strong>3</strong> {t.priority3(SONG_LENGTH)}
              </span>
              <span className="chip">
                <strong>4</strong> {t.priority4}
              </span>
            </div>
          </section>

      {theme === "roster" && (
        <section className="panel roster-panel">
          <div className="panel-head roster-panel-head">
            <h2>{t.rosterTitle(ownedRosterMembers.length)}</h2>
            <button className="btn btn-ghost" type="button" onClick={clearRosterMembers}>
              {t.rosterClear}
            </button>
          </div>
          <div className="roster-account-bar">
            <label className="field grow">
              <span>{rosterUi.account}</span>
              <select
                value={activeRosterProfileId}
                onChange={(e) => switchRosterProfile(e.target.value)}
              >
                {rosterProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-ghost" type="button" onClick={addRosterProfile}>
              {rosterUi.newAccount}
            </button>
            <button className="btn btn-ghost" type="button" onClick={renameRosterProfile}>
              {rosterUi.rename}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={rosterProfiles.length <= 1}
              onClick={removeRosterProfile}
            >
              {rosterUi.delete}
            </button>
            <label className="btn btn-ghost roster-import-btn">
              {rosterUi.import}
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  void importRosterFile(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button className="btn btn-ghost" type="button" onClick={exportActiveRoster}>
              {rosterUi.export}
            </button>
          </div>
          <p className="panel-note">{t.rosterNote}</p>
          {ownedRosterMembers.length < 5 && (
            <p className="roster-hint">{t.rosterNeedFive}</p>
          )}
          <div className="roster-groups">
            {rosterMemberGroups.map((g) => (
              <div key={g.unit} className="roster-group">
                <div className="group-heading">{g.unit}</div>
                <div className="roster-member-grid">
                  {g.members.map((member) => {
                    const selected = rosterSet.has(member);
                    const cards = rosterCardsForMember(member);
                    const ownedCount = selected
                      ? rosterOwnedIds(member).filter((id) => cards.some((c) => c.id === id)).length
                      : cards.length;
                    return (
                      <button
                        key={member}
                        type="button"
                        className={`roster-member-btn ${selected ? "active" : ""}`}
                        onClick={() => toggleRosterMember(member)}
                        title={displayName(member, unitsOf(member), locale)}
                      >
                        <Portrait member={member} size="md" />
                        {cards.length > 1 && selected && (
                          <span className="roster-member-badge" aria-hidden>
                            ★5 {ownedCount}/{cards.length}
                          </span>
                        )}
                        <span className="roster-member-name">
                          <MemberName member={member} units={unitsOf(member)} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {rosterMultiCardMembers.length > 0 && (
            <div className="roster-card-pick">
              <h3>{t.rosterCardPickTitle}</h3>
              <p className="panel-note">{t.rosterCardPickNote}</p>
              {rosterMultiCardMembers.map((member) => {
                const cards = rosterCardsForMember(member);
                const owned = new Set(rosterOwnedIds(member));
                return (
                  <div key={member} className="roster-card-pick-row">
                    <div className="roster-card-pick-label">
                      <Portrait member={member} size="sm" />
                      <MemberName member={member} units={unitsOf(member)} />
                    </div>
                    <div className="roster-card-pick-options">
                      {cards.map((card) => {
                        const isOwned = owned.has(card.id);
                        return (
                        <button
                          key={card.id}
                          type="button"
                          className={`roster-card-option ${isOwned ? "active" : ""}`}
                          onClick={() => toggleRosterCard(card)}
                          title={card.costumeName}
                          aria-pressed={isOwned}
                        >
                          {isOwned && <span className="roster-card-check" aria-hidden>✓</span>}
                          <CardArt cardId={card.id} alt={card.costumeName} />
                          <span className="roster-card-option-name">{card.costumeName}</span>
                          {card.event && <span className="badge">{t.eventBadge}</span>}
                        </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {theme === "optimize" && (
      <section className="panel captain-panel">
        <h2>{t.captainTitle}</h2>
        <div className="toolbar">
          <div className="field">
            <label>{t.labelGen}</label>
            <select
              value={leaderUnit}
              onChange={(e) => onLeaderUnitChange(e.target.value)}
            >
              <option value="">{t.pickGenFirst}</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="field grow">
            <label>{t.labelMember}</label>
            <select
              value={leaderMember}
              disabled={!leaderUnit}
              onChange={(e) => {
                const m = e.target.value;
                if (m) pickLeader(m);
                else {
                  setLeaderMember("");
                  setLeaderCostumeId("");
                  setResult(null);
                }
              }}
            >
              <option value="">{leaderUnit ? t.pickMember : t.pickGenFirstShort}</option>
              {membersInLeaderUnit.map((m) => (
                <option key={m} value={m}>
                  {displayName(m, unitsOf(m), locale)}
                </option>
              ))}
            </select>
          </div>
          {leaderMember && (
            <div className="field leader-preview-field">
              <label>{t.currentCaptain}</label>
              <div className="leader-summary static">
                <Portrait member={leaderMember} size="md" />
                <span>
                  <MemberName member={leaderMember} units={unitsOf(leaderMember)} />
                  <small>{leaderUnit}</small>
                </span>
              </div>
            </div>
          )}
          <div className="field">
            <label>{t.songLength}</label>
            <input type="number" value={SONG_LENGTH} readOnly aria-readonly tabIndex={-1} />
          </div>
        </div>
        {leaderMember && (
          <div className="costume-pick">
            <h3>
              {t.costumePick} —{" "}
              <MemberName member={leaderMember} units={unitsOf(leaderMember)} />
            </h3>
            <div className="costume-grid">
              {leaderCostumes.length === 0 ? (
                <p className="empty-inline">{t.noCostumeData}</p>
              ) : (
                leaderCostumes.map((cos) => {
                  const card = data.cards.find(
                    (c) => c.member === cos.member && c.costumeName === cos.costumeName,
                  );
                  return (
                    <button
                      key={cos.id}
                      type="button"
                      className={`costume-card ${leaderCostumeId === cos.id ? "active" : ""}`}
                      onClick={() => {
                        setLeaderCostumeId(cos.id);
                        setResult(null);
                      }}
                    >
                      <CardArt
                        cardId={card?.id}
                        alt={cos.costumeName}
                        className="costume-card-art"
                      />
                      <div className="costume-card-body">
                        <div className="costume-name">{cos.costumeName}</div>
                        <div className="costume-skill">
                          {formatCostumeSkillText(cos.skill, locale)}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedCostume && (
              <div className="condition-box">
                <div>
                  <span className="label">{t.conditionLabel}</span>
                  <strong>
                    {describeCondition(selectedCostume.skill.condition, t, attrLabel)}
                  </strong>
                </div>
                {selectedCostume.skill.condition?.type === "unitCount" && (
                  <p>
                    {t.conditionUnitHint(
                      conditionCandidates.length
                        ? formatMemberList(conditionCandidates, unitsOf, t.gapsJoin, locale)
                        : "",
                      selectedCostume.skill.condition.min,
                    )}
                  </p>
                )}
                {selectedCostume.skill.condition?.type === "typeCount" && (
                  <p>
                    {t.conditionTypeHint(
                      conditionCandidates.length
                        ? formatMemberList(conditionCandidates, unitsOf, t.gapsJoin, locale)
                        : "",
                      selectedCostume.skill.condition.min,
                    )}
                  </p>
                )}
                {!selectedCostume.skill.condition && <p>{t.conditionNone}</p>}
              </div>
            )}
          </div>
        )}
      </section>
      )}

      <div className="stack">
        {theme === "optimize" && (
        <section className="panel">
          <h2>
            {t.wantedTitle(wantedMembers.length)}
            {wantedMembers.length > 0 ? t.wantedLocked(requiredCount) : ""}
          </h2>
          <p className="panel-note">{t.wantedNote}</p>
          <label className="dup-option">
            <input
              type="checkbox"
              checked={allowDuplicateSkills}
              onChange={(e) => {
                setAllowDuplicateSkills(e.target.checked);
                setResult(null);
              }}
            />
            <span>
              {t.allowDupSkills}
              <small>{t.allowDupSkillsHint}</small>
            </span>
          </label>
          <CardFilterToolbar
            filterOpen={filterOpen}
            onToggleOpen={() => setFilterOpen((v) => !v)}
            compact={cardsCompact}
            onToggleCompact={() => setCardsCompact((v) => !v)}
            filterSummary={optimizeFilterSummary}
            showRarityFilter={false}
            rarityFilters={rarityFilters}
            typeFilters={typeFilters}
            unitFilters={unitFilters}
            unitOptions={unitOptions}
            query={query}
            onQuery={setQuery}
            onClearRarity={() => setRarityFilters([])}
            onToggleRarity={toggleRarityFilter}
            onClearType={() => setTypeFilters([])}
            onToggleType={toggleTypeFilter}
            onClearUnit={() => setUnitFilters([])}
            onToggleUnit={toggleUnitFilter}
            extraActions={
              <button className="btn btn-ghost" type="button" onClick={clearWanted}>
                {t.clearWanted}
              </button>
            }
          />

          {wantedMembers.length > 0 && (
            <div className="wanted-bar">
              {wantedMembers.map((m) => {
                const cardId = preferredCards[m];
                const card = data.cards.find((c) => c.id === cardId);
                return (
                  <div key={m} className="wanted-card">
                    <CardArt cardId={cardId} alt={card?.costumeName ?? m} className="wanted-card-art" />
                    <div className="wanted-card-body">
                      <MemberName member={m} units={unitsOf(m)} />
                      {card && (
                        <small>
                          ★{card.rarity} · {attrLabel(card.type)}
                          <br />
                          {card.costumeName}
                        </small>
                      )}
                    </div>
                    <button
                      type="button"
                      className="wanted-chip-x"
                      aria-label={t.removeWantedAria(m)}
                      onClick={() => removeWanted(m)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <CardGroupBrowser
            groups={cardGroups}
            compact={cardsCompact}
            unitsOf={unitsOf}
            onCardClick={toggleWantedCard}
            memberLockedSet={wantedSet}
            preferredByMember={preferredCards}
            leaderMember={leaderMember}
          />
        </section>
        )}

        <section className="panel" id="optimize-results">
          <div className="panel-head">
            <h2>{t.resultsTitle}</h2>
          </div>
          {!result ? (
            <div className="empty">
              {theme === "roster"
                ? ownedRosterMembers.length < 5
                  ? t.rosterNeedFive
                  : rosterUi.emptyReady
                : leaderMember
                  ? t.resultsEmptyWithLeader(
                      displayName(leaderMember, unitsOf(leaderMember), locale),
                    )
                  : t.resultsEmpty}
            </div>
          ) : (
            <>
              <div className="browser-tabs" role="tablist" aria-label={t.trackAria}>
                {(
                  [
                    {
                      id: "overall" as const,
                      title: t.trackOverall,
                      icon: "♛",
                      desc: t.trackOverallDesc,
                    },
                    {
                      id: "stats" as const,
                      title: t.trackStats,
                      icon: "◆",
                      desc: t.trackStatsDesc,
                    },
                    {
                      id: "coverage" as const,
                      title: t.trackCoverage,
                      icon: "⏱",
                      desc: t.trackCoverageDesc,
                    },
                    {
                      id: "score" as const,
                      title: t.trackScore,
                      icon: "%",
                      desc: t.trackScoreDesc,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    title={tab.desc}
                    aria-selected={!viewingPrBaseline && resultTrack === tab.id}
                    className={`browser-tab ${!viewingPrBaseline && resultTrack === tab.id ? "active" : ""}`}
                    onClick={() => {
                      setResultTrack(tab.id);
                      setSelectedIdx(0);
                      setViewingPrBaseline(false);
                    }}
                  >
                    <span className="browser-tab-icon" aria-hidden>
                      {tab.icon}
                    </span>
                    <span className="browser-tab-title">{tab.title}</span>
                  </button>
                ))}
                <button
                  type="button"
                  role="tab"
                  className={`browser-tab browser-tab-pr ${viewingPrBaseline ? "active" : ""}`}
                  disabled={!prBaselineTeam}
                  aria-selected={viewingPrBaseline}
                  title={
                    prBaselineTeam ? t.prBaselineBtnTitle : t.prBaselineBtnUnavailable
                  }
                  onClick={() => setViewingPrBaseline((on) => !on)}
                >
                  <span className="browser-tab-icon" aria-hidden>
                    PR
                  </span>
                  <span className="browser-tab-title">{t.prBaselineBtn}</span>
                </button>
              </div>

              {resultTrack === "overall" && result.baselineTeam && (
                <p className="pr-baseline-note">{t.prBaselineNote}</p>
              )}

              <div className="result-split">
                <aside className="result-rank-col">
                  <div className="track-picks track-picks-vertical">
                    {trackList.length === 0 ? (
                      <div className="empty">{t.noTrackTeams}</div>
                    ) : (
                      trackList.map((ev, idx) => (
                        <button
                          key={`${resultTrack}-${ev.costume.id}-${ev.cards.map((c) => c.id).join("-")}`}
                          type="button"
                          className={`track-pick ${idx === selectedIdx ? "active" : ""}`}
                          onClick={() => {
                            setSelectedIdx(idx);
                            setViewingPrBaseline(false);
                          }}
                        >
                          <span className={`track-pick-rank ${rankClass(idx)}`}>
                            {idx + 1}
                            {ev.activeDuplicates.length > 0 && (
                              <span
                                className="skill-dup-mark"
                                title={ev.activeDuplicates
                                  .map((d) =>
                                    t.skillDupPair(
                                      listName(d.members[0], unitsOf(d.members[0]), locale),
                                      listName(d.members[1], unitsOf(d.members[1]), locale),
                                    ),
                                  )
                                  .join("\n")}
                              >
                                !
                              </span>
                            )}
                          </span>
                          <span className="track-pick-names-col">
                            {ev.cards.map((c) => (
                              <span key={c.id} className="track-pick-name-line">
                                {listName(c.member, unitsOf(c.member), locale)}
                              </span>
                            ))}
                          </span>
                          <span className="track-pick-meta-col">
                            <span className="track-pick-metric">{trackMetricLabel(ev)}</span>
                            <span className="track-pick-flags">
                              {ev.costumeSatisfied ? t.flagCostumeOn : t.flagCostumeOff}
                            </span>
                            <span className="track-pick-flags">
                              {ev.allPassivesSatisfied ? t.flagPassiveAll : t.flagPassiveMiss}
                            </span>
                            {resultTrack === "overall" ? (
                              <>
                                <span className="track-pick-flags">
                                  {t.flagStats(ev.effectiveStatTotal.toLocaleString())}
                                </span>
                                <span className="track-pick-flags">
                                  {t.flagCoverage((ev.coverage * 100).toFixed(0))}
                                </span>
                                <span className="track-pick-flags">
                                  {t.flagUp(ev.avgScoreUp.toFixed(0))}
                                </span>
                              </>
                            ) : null}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </aside>

                <div className="result-detail-col">
              {!detailEv ? (
                <div className="empty">{t.pickTeamDetail}</div>
              ) : (
                <>
              {viewingPrBaseline && prBaselineTeam ? (
                <p className="pr-baseline-banner">{t.prBaselineViewBanner}</p>
              ) : null}
              <div className="stats-row stats-row-5">
                <div className="stat">
                  <div className="label">{t.costumeSkill}</div>
                  <div className={`value ${detailEv.costumeSatisfied ? "ok" : "bad"}`}>
                    {detailEv.costumeSatisfied ? t.activated : t.notActivated}
                  </div>
                  {detailProgress && (
                    <div className="sub">
                      {detailProgress.label} {detailProgress.current}/{detailProgress.needed}
                    </div>
                  )}
                </div>
                <div className="stat">
                  <div className="label">{t.allPassives}</div>
                  <div className={`value ${detailEv.allPassivesSatisfied ? "ok" : "bad"}`}>
                    {detailEv.allPassivesSatisfied ? t.satisfied : t.notAllSatisfied}
                  </div>
                  <div className="sub">
                    {detailEv.passiveDetails.filter((p) => p.satisfied).length}/
                    {detailEv.passiveDetails.length}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">{t.avgScoreUp}</div>
                  <div className="value">{detailEv.avgScoreUp.toFixed(1)}%</div>
                  <div className="sub">
                    {t.coveragePct((detailEv.coverage * 100).toFixed(0))}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">{t.buffedStats}</div>
                  <div className="value">{detailEv.effectiveStatTotal.toLocaleString()}</div>
                  <div className="sub">
                    {t.baseStats(detailEv.baseStatTotal.toLocaleString())}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">{t.skillGaps}</div>
                  <div className={`value ${detailEv.uncoveredSeconds <= 0 ? "ok" : ""}`}>
                    {detailEv.uncoveredSeconds.toFixed(1)}s
                  </div>
                  <div className="sub">{t.shorterBetter}</div>
                </div>
              </div>

              <div className="skill-banner">
                <strong>{t.leaderCostume}</strong>
                <span>
                  {displayName(detailEv.costume.member, unitsOf(detailEv.costume.member), locale)}
                  {detailEv.leaderIndex < 0 ? t.captainOffTeam : ""}
                  {" · "}
                  {formatCostumeSkillText(detailEv.costume.skill, locale)}
                </span>
              </div>

              {detailEv.activeDuplicates.length > 0 && (
                <div className="skill-dup-banner" role="alert">
                  <span className="skill-dup-mark" aria-hidden>
                    !
                  </span>
                  <div>
                    <strong>{t.skillDupWarn}</strong>
                    <ul>
                      {detailEv.activeDuplicates.map((d) => (
                        <li key={`${d.cardIds[0]}-${d.cardIds[1]}`}>
                          {t.skillDupPair(
                            listName(d.members[0], unitsOf(d.members[0]), locale),
                            listName(d.members[1], unitsOf(d.members[1]), locale),
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="team">
                {detailEv.cards.map((card, i) => {
                  const isLeader = detailEv.leaderIndex >= 0 && i === detailEv.leaderIndex;
                  const units = data.members[card.member]?.units ?? [card.unit];
                  const forced = wantedSet.has(card.member);
                  return (
                    <div key={card.id} className={`slot ${isLeader ? "leader" : ""}`}>
                      <div className="slot-pos">
                        {isLeader ? t.leader : t.memberN(i + 1)}
                        <CardArt cardId={card.id} className="card-art-md" />
                        <strong>{attrLabel(card.type)}</strong>
                      </div>
                      <div>
                        <h3>
                          <MemberName member={card.member} units={unitsOf(card.member)} />{" "}
                          <span className="badge star">★{card.rarity}</span>
                          {forced && <span className="badge">{t.forced}</span>}
                        </h3>
                        <p>
                          {units.join(" · ")}
                          {isLeader
                            ? t.costumeColon(detailEv.costume.costumeName)
                            : `｜${card.costumeName}`}
                        </p>
                        <p>
                          {t.activeLine(
                            card.active.interval,
                            card.active.duration,
                            card.active.scoreUp,
                          )}
                        </p>
                        <p className="skill-raw-line">{formatActiveSkill(card.active, locale)}</p>
                        <p>
                          {t.passivePrefix}
                          <span
                            style={{
                              color: detailEv.passiveDetails[i]?.satisfied
                                ? "var(--ok)"
                                : "var(--bad)",
                            }}
                          >
                            {detailEv.passiveDetails[i]?.satisfied
                              ? t.activated
                              : t.notActivated}
                          </span>{" "}
                          {formatPassiveSkill(card.passive, locale)}
                        </p>
                        {detailEv.memberEffectiveStats[i] && (
                          <p className="slot-stats">
                            {t.performance}{" "}
                            {detailEv.memberEffectiveStats[i].performance.toLocaleString()}
                            {detailEv.memberEffectiveStats[i].bonusPct.performance > 0
                              ? ` (+${detailEv.memberEffectiveStats[i].bonusPct.performance}%)`
                              : ""}
                            {" · "}
                            {t.technique}{" "}
                            {detailEv.memberEffectiveStats[i].technique.toLocaleString()}
                            {detailEv.memberEffectiveStats[i].bonusPct.technique > 0
                              ? ` (+${detailEv.memberEffectiveStats[i].bonusPct.technique}%)`
                              : ""}
                            {" · "}
                            {t.sense}{" "}
                            {detailEv.memberEffectiveStats[i].sense.toLocaleString()}
                            {detailEv.memberEffectiveStats[i].bonusPct.sense > 0
                              ? ` (+${detailEv.memberEffectiveStats[i].bonusPct.sense}%)`
                              : ""}
                            {detailEv.memberEffectiveStats[i].scoreSupportPct > 0
                              ? t.scoreSupport(
                                  detailEv.memberEffectiveStats[i].scoreSupportPct,
                                )
                              : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="timeline-wrap">
                <div className="label" style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                  {t.timelineLabel}
                </div>
                <div className="timeline" aria-hidden>
                  {(() => {
                    const peak = Math.max(1, ...detailEv.timeline);
                    return detailEv.timeline.map((p, i) => (
                      <span
                        key={i}
                        className={p > 0 ? "on" : ""}
                        style={{
                          height: `${Math.max(4, (p / peak) * 100)}%`,
                          opacity: p > 0 ? 0.35 + (p / peak) * 0.65 : 0.15,
                        }}
                        title={`${i}s：${p.toFixed(0)}%`}
                      />
                    ));
                  })()}
                </div>
                <div className="gap-banner">
                  <strong>{t.skillGaps}</strong>
                  <span>
                    {formatUncoveredGaps(detailEv.uncoveredGaps, {
                      none: t.gapsNone,
                      range: t.gapRange,
                      join: t.gapsJoin,
                    })}
                  </span>
                  <small>{t.gapsTotal(detailEv.uncoveredSeconds.toFixed(1))}</small>
                </div>
                <div className="meta-line">
                  {t.typeCounts(
                    detailEv.typeCounts.happy,
                    detailEv.typeCounts.pure,
                    detailEv.typeCounts.cute,
                  )}
                  {"　"}
                  {t.searchMeta(
                    result?.searched.toLocaleString() ?? "0",
                    result ? Math.round(result.elapsedMs) : 0,
                  )}
                </div>
              </div>

              <ul className="list">
                {Object.entries(detailEv.unitCounts)
                  .filter(([, n]) => n > 0)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([unit, n]) => (
                    <li key={unit}>
                      {unit} × {n}
                      {detailEv.costume.skill.condition?.type === "unitCount" &&
                        detailEv.costume.skill.condition.unit === unit && (
                          <span
                            style={{
                              color: detailEv.costumeSatisfied ? "var(--ok)" : "var(--bad)",
                              marginLeft: "0.5rem",
                            }}
                          >
                            {t.costumeNeed(detailEv.costume.skill.condition.min)}
                          </span>
                        )}
                    </li>
                  ))}
              </ul>
                </>
              )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <button
        type="button"
        className={`fab-optimize ${busy ? "is-busy" : ""}`}
        onClick={theme === "roster" ? runRosterOptimize : runOptimize}
        disabled={
          busy ||
          (theme === "roster"
            ? ownedRosterMembers.length < 5 || rosterOwnedCostumeIdsForOptimize().size === 0
            : !leaderMember)
        }
        title={
          theme === "roster"
            ? ownedRosterMembers.length < 5
              ? t.rosterNeedFive
              : rosterOwnedCostumeIdsForOptimize().size === 0
                ? rosterUi.needCostume
                : rosterUi.autoCaptain
            : !leaderMember
              ? t.fabTitleNeedLeader
              : t.fabTitleReady
        }
      >
        <span className="fab-optimize-label">
          {busy ? t.fabBusy : theme === "roster" ? t.fabRosterRun : t.fabRun}
        </span>
        <span className="fab-optimize-sub">
          {theme === "roster"
            ? ownedRosterMembers.length < 5
              ? t.rosterNeedFive
              : rosterOwnedCostumeIdsForOptimize().size === 0
                ? rosterUi.needCostume
                : rosterUi.autoCaptain
            : leaderMember
              ? displayName(leaderMember, unitsOf(leaderMember), locale)
              : t.fabPickLeader}
        </span>
      </button>
        </>
      )}

      <footer className="site-footer">
        <span>{t.footer}</span>
        <span className="footer-devil" aria-hidden />
      </footer>
    </div>
  );
}
