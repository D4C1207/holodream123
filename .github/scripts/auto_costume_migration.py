from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


app_path = Path("src/App.tsx")
text = app_path.read_text(encoding="utf-8")

text = replace_once(
    text,
    '''const allCardIds = new Set(data.cards.map((c) => c.id));
const allCostumeIds = new Set(data.costumes.map((c) => c.id));
''',
    '''const allCardIds = new Set(data.cards.map((c) => c.id));
const allCostumeIds = new Set(data.costumes.map((c) => c.id));
const cardById = new Map(data.cards.map((c) => [c.id, c] as const));
const costumeIdByCardKey = new Map(
  data.costumes.map((c) => [`${c.member}|||${c.costumeName}`, c.id] as const),
);
''',
    "card/costume lookup maps",
)

for old, new, label in [
    (
        '          rosterNote: "このゲームアカウントが所持している★5／イベントカードと衣装を登録してください。隊長・衣装・5人編成は自動で選ばれます。",\n',
        '          rosterNote: "所持している★5／イベントカードだけを登録してください。1枚だけのメンバーは自動登録、複数カードのメンバーは下のカード選択で所持衣装を決めます。隊長・衣装・5人編成は自動で選ばれます。",\n',
        "ja roster note",
    ),
    (
        '          needCostume: "所持衣装を1つ以上選択してください。",\n',
        '          needCostume: "選択したカードに対応する衣装データが見つかりません。複数カードのメンバーは所持カードを1枚以上選択してください。",\n',
        "ja warning",
    ),
    (
        '            rosterNote: "Save the ★5/event cards and costumes owned by this game account. Captain, costume, and the five-member team are selected automatically.",\n',
        '            rosterNote: "Save only owned ★5/event cards. Members with one card are handled automatically; for members with multiple cards, the card picker below determines which costumes you own. Captain, costume, and the five-member team are selected automatically.",\n',
        "en roster note",
    ),
    (
        '            needCostume: "Select at least one owned costume.",\n',
        '            needCostume: "No usable costume was found. For members with multiple cards, select at least one owned card below.",\n',
        "en warning",
    ),
    (
        '            rosterNote: "記錄這個遊戲帳號實際持有的 ★5／活動卡與衣裝；隊長、衣裝與五人編成都會由系統自動挑選。",\n',
        '            rosterNote: "只要記錄實際持有的 ★5／活動卡。只有 1 張卡的角色會自動帶入卡片與衣裝；有多張卡面的角色則以下方「★5 持有卡面」勾選結果決定可用衣裝。隊長、衣裝與五人編成都由系統自動挑選。",\n',
        "zh roster note",
    ),
    (
        '            needCostume: "請至少選擇一件已持有衣裝。",\n',
        '            needCostume: "目前沒有可用衣裝；有多張卡面的角色請在「★5 持有卡面」至少勾選一張。",\n',
        "zh warning",
    ),
]:
    text = replace_once(text, old, new, label)

text = replace_once(
    text,
    '''  const rosterSet = useMemo(() => new Set(ownedRosterMembers), [ownedRosterMembers]);
  const rosterCostumeSet = useMemo(() => new Set(ownedRosterCostumeIds), [ownedRosterCostumeIds]);
''',
    '''  const rosterSet = useMemo(() => new Set(ownedRosterMembers), [ownedRosterMembers]);
''',
    "remove manual costume set",
)

text = replace_once(
    text,
    '''  function rosterOwnedIds(member: string): string[] {
    const cards = rosterCardsForMember(member);
    const stored = rosterOwnedCards[member];
    if (stored?.length) {
      const valid = stored.filter((id) => cards.some((c) => c.id === id));
      if (valid.length) return valid;
    }
    return cards.map((c) => c.id);
  }
''',
    '''  function rosterOwnedIds(member: string): string[] {
    const cards = rosterCardsForMember(member);
    const stored = rosterOwnedCards[member];
    if (stored !== undefined) {
      return stored.filter((id) => cards.some((c) => c.id === id));
    }
    return cards.length === 1 ? [cards[0].id] : [];
  }
''',
    "explicit multi-card ownership",
)

text = replace_once(
    text,
    '''  function rosterOwnedCardIdsForOptimize(): Set<string> {
    const ids = new Set<string>();
    for (const member of ownedRosterMembers) {
      for (const id of rosterOwnedIds(member)) ids.add(id);
    }
    return ids;
  }

''',
    '''  function rosterOwnedCardIdsForOptimize(): Set<string> {
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

''',
    "derive costumes from selected cards",
)

text = replace_once(
    text,
    '''  const rosterCostumeGroups = useMemo(() => {
    const map = new Map<string, Costume[]>();
    for (const costume of data.costumes) {
      const list = map.get(costume.member) ?? [];
      list.push(costume);
      map.set(costume.member, list);
    }
    return [...map.entries()]
      .sort((a, b) => compareMembersByGroup(a[0], b[0], unitsOf))
      .map(([member, costumes]) => ({
        member,
        costumes: [...costumes].sort((a, b) => b.skill.score - a.skill.score),
      }));
  }, []);

''',
    "",
    "remove costume grouping",
)

text = replace_once(
    text,
    '''        if (removing) {
          delete nextPrefs[member];
        } else {
          nextPrefs[member] = defaultRosterCardIds(member);
        }
''',
    '''        if (removing) {
          delete nextPrefs[member];
        } else {
          const cards = rosterCardsForMember(member);
          nextPrefs[member] = cards.length === 1 ? [cards[0].id] : [];
        }
''',
    "single-card auto select, multi-card explicit select",
)

text = replace_once(
    text,
    '''  function toggleRosterCostume(costumeId: string) {
    setOwnedRosterCostumeIds((prev) => {
      const next = prev.includes(costumeId)
        ? prev.filter((id) => id !== costumeId)
        : [...prev, costumeId];
      persistRosterSnapshot(ownedRosterMembers, rosterOwnedCards, next);
      setResult(null);
      return next;
    });
  }

  function clearRosterCostumes() {
    setOwnedRosterCostumeIds([]);
    persistRosterSnapshot(ownedRosterMembers, rosterOwnedCards, []);
    setResult(null);
  }

''',
    "",
    "remove manual costume handlers",
)

text = replace_once(
    text,
    '''    if (!ownedRosterCostumeIds.length) {
      alert(rosterUi.needCostume);
      return;
    }

    setBusy(true);
    void prepareAndRunOptimize(
      rosterOwnedCardIdsForOptimize(),
      {
        ownedCostumeIds: new Set(ownedRosterCostumeIds),
''',
    '''    const ownedCostumeIds = rosterOwnedCostumeIdsForOptimize();
    if (!ownedCostumeIds.size) {
      alert(rosterUi.needCostume);
      return;
    }

    setBusy(true);
    void prepareAndRunOptimize(
      rosterOwnedCardIdsForOptimize(),
      {
        ownedCostumeIds,
''',
    "run optimizer with derived costumes",
)

start_marker = '          <div className="roster-costume-pick">\n'
end_marker = '        </section>\n      )}\n\n      {theme === "optimize" && (\n'
start = text.find(start_marker)
if start < 0:
    raise SystemExit("manual costume picker start not found")
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit("manual costume picker end not found")
text = text[:start] + end_marker + text[end + len(end_marker):]

app_path.write_text(text, encoding="utf-8")

profiles_path = Path("src/lib/rosterProfiles.ts")
profiles = profiles_path.read_text(encoding="utf-8")
profiles = replace_once(
    profiles,
    '''    const normalized = uniqueStrings(Array.isArray(ids) ? ids : [ids]);
    if (normalized.length) out[member] = normalized;
''',
    '''    const normalized = uniqueStrings(Array.isArray(ids) ? ids : [ids]);
    out[member] = normalized;
''',
    "preserve explicit empty card selections",
)
profiles_path.write_text(profiles, encoding="utf-8")

msg_path = Path("src/i18n/messages.ts")
msg = msg_path.read_text(encoding="utf-8")
for old, new, label in [
    (
        '"點選你持有的★5角色（含活動卡）。至少 5 人後選隊長；有多張★5者可在下方勾選持有卡面。PR 仍與最強編隊同基準（9999）。"',
        '"點選你持有的★5角色（含活動卡）。至少選 5 人；只有 1 張卡的角色會自動帶入，多張卡面的角色請在下方勾選實際持有卡面。勾選的卡面同時決定可用衣裝，隊長與衣裝由系統自動挑選。PR 仍與最強編隊同基準（9999）。"',
        "zh roster message",
    ),
    (
        '"勾選你持有的★5卡面（可多選）；編隊時會從中自動挑最適合的組合。"',
        '"有多張卡面的角色請在這裡勾選實際持有的★5／活動卡（可多選）；勾哪張就代表同時擁有該張卡對應衣裝。"',
        "zh card picker message",
    ),
    (
        '"Select owned ★5 members (incl. event). Need 5+, then captain; check owned cards below if they have multiple ★5s. PR uses Best Team 9999 baseline."',
        '"Select at least 5 owned ★5/event members. Single-card members are added automatically; for members with multiple cards, select the cards you actually own below. Those card selections also determine available costumes, while captain and costume are optimized automatically. PR uses the Best Team 9999 baseline."',
        "en roster message",
    ),
    (
        '"Check every ★5 you own (multi-select). The optimizer picks the best mix for each team."',
        '"For members with multiple cards, select every ★5/event card you actually own. Each selected card also unlocks its matching costume."',
        "en card picker message",
    ),
    (
        '"所持の★5メンバー（イベント含む）を選択。5人以上＋キャプテン。★5が複数いる場合は下で所持分をチェック。PRは最強編成と同じ9999基準。"',
        '"所持している★5／イベントメンバーを5人以上選択してください。カードが1枚だけのメンバーは自動登録、複数カードのメンバーは下で実際の所持カードを選択します。そのカード選択が使用可能衣装も決め、キャプテンと衣装は自動最適化されます。PRは最強編成と同じ9999基準。"',
        "ja roster message",
    ),
    (
        '"所持している★5をすべてチェック（複数可）。編成時に最適な組み合わせを自動選択します。"',
        '"複数カードがあるメンバーは、実際に所持する★5／イベントカードをここで選択してください。選んだカードに対応する衣装だけが使用可能になります。"',
        "ja card picker message",
    ),
]:
    msg = replace_once(msg, old, new, label)
msg_path.write_text(msg, encoding="utf-8")

print("Roster card-to-costume migration applied.")
