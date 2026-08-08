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
    '''  const [simBusy, setSimBusy] = useState(false);
  const [simulation, setSimulation] = useState<CardSimulationResult | null>(null);
  const [lastRosterScores, setLastRosterScores] = useState<Record<string, RosterScoreSummary>>(
''',
    '''  const [simBusy, setSimBusy] = useState(false);
  const [simulation, setSimulation] = useState<CardSimulationResult | null>(null);
  const [rosterRequiredMembers, setRosterRequiredMembers] = useState<string[]>([]);
  const [rosterFixedCaptain, setRosterFixedCaptain] = useState("");
  const [lastRosterScores, setLastRosterScores] = useState<Record<string, RosterScoreSummary>>(
''',
    "constraint state",
)

text = replace_once(
    text,
    '''  const rosterOwnedCostumeCount = useMemo(
    () => rosterOwnedCostumeIdsForOptimize().size,
    [ownedRosterMembers, rosterOwnedCards],
  );
  const activeAccountFavoriteCount = useMemo(
''',
    '''  const rosterOwnedCostumeCount = useMemo(
    () => rosterOwnedCostumeIdsForOptimize().size,
    [ownedRosterMembers, rosterOwnedCards],
  );
  const rosterCaptainOptions = useMemo(() => {
    const ownedCostumeIds = rosterOwnedCostumeIdsForOptimize();
    const costumeMembers = new Set(
      data.costumes
        .filter((costume) => ownedCostumeIds.has(costume.id))
        .map((costume) => costume.member),
    );
    return ownedRosterMembers
      .filter((member) => costumeMembers.has(member))
      .sort((a, b) => compareMembersByGroup(a, b, unitsOf));
  }, [ownedRosterMembers, rosterOwnedCards]);
  const activeAccountFavoriteCount = useMemo(
''',
    "captain options",
)

text = replace_once(
    text,
    '''  function switchRosterProfile(profileId: string) {
    const inventory = loadRosterInventory(profileId);
    setActiveRosterProfileId(profileId);
    setActiveRosterProfile(profileId);
    setOwnedRosterMembers(inventory.members);
    setRosterOwnedCards(inventory.cardsByMember);
    setOwnedRosterCostumeIds(inventory.costumeIds);
    setResult(null);
  }
''',
    '''  function switchRosterProfile(profileId: string) {
    const inventory = loadRosterInventory(profileId);
    setActiveRosterProfileId(profileId);
    setActiveRosterProfile(profileId);
    setOwnedRosterMembers(inventory.members);
    setRosterOwnedCards(inventory.cardsByMember);
    setOwnedRosterCostumeIds(inventory.costumeIds);
    setRosterRequiredMembers([]);
    setRosterFixedCaptain("");
    setSimulation(null);
    setResult(null);
  }
''',
    "reset constraints on profile switch",
)

text = replace_once(
    text,
    '''  function clearRosterMembers() {
    setOwnedRosterMembers([]);
    setRosterOwnedCards({});
    persistRosterSnapshot([], {}, ownedRosterCostumeIds);
    setResult(null);
  }

''',
    '''  function clearRosterMembers() {
    setOwnedRosterMembers([]);
    setRosterOwnedCards({});
    setRosterRequiredMembers([]);
    setRosterFixedCaptain("");
    setSimulation(null);
    persistRosterSnapshot([], {}, ownedRosterCostumeIds);
    setResult(null);
  }

  function addRosterRequiredMember(member: string) {
    if (!member || !ownedRosterMembers.includes(member)) return;
    setRosterRequiredMembers((prev) => {
      if (prev.includes(member) || prev.length >= 5) return prev;
      return [...prev, member];
    });
    setSimulation(null);
    setResult(null);
  }

  function removeRosterRequiredMember(member: string) {
    setRosterRequiredMembers((prev) => prev.filter((item) => item !== member));
    setSimulation(null);
    setResult(null);
  }

  function clearRosterConstraints() {
    setRosterRequiredMembers([]);
    setRosterFixedCaptain("");
    setSimulation(null);
    setResult(null);
  }

''',
    "constraint handlers",
)

text = replace_once(
    text,
    '''    const ownedCostumeIds = rosterOwnedCostumeIdsForOptimize();
    if (!ownedCostumeIds.size) {
      alert(rosterUi.needCostume);
      return;
    }

    setBusy(true);
''',
    '''    const ownedCostumeIds = rosterOwnedCostumeIdsForOptimize();
    if (!ownedCostumeIds.size) {
      alert(rosterUi.needCostume);
      return;
    }
    if (rosterRequiredMembers.some((member) => !ownedRosterMembers.includes(member))) {
      alert(locale === "ja" ? "必須メンバーが現在のバッグにありません。" : locale === "en" ? "A required member is not in the current inventory." : "必上場成員中有角色不在目前帳號倉庫。" );
      return;
    }
    if (rosterFixedCaptain && !rosterCaptainOptions.includes(rosterFixedCaptain)) {
      alert(locale === "ja" ? "指定キャプテンに使用可能な所持衣装がありません。" : locale === "en" ? "The selected captain has no usable owned costume." : "指定隊長目前沒有可用的已持有衣裝。" );
      return;
    }

    setBusy(true);
''',
    "constraint validation",
)

text = replace_once(
    text,
    '''        fixedLeader: null,
        fixedCostumeId: null,
        fixedMembers: [],
        memberPool: ownedRosterMembers,
''',
    '''        fixedLeader: rosterFixedCaptain || null,
        fixedCostumeId: null,
        fixedMembers: rosterRequiredMembers,
        memberPool: ownedRosterMembers,
''',
    "roster optimizer constraints",
)

# Apply the same optional constraints to before/after card simulations.
old_sim = '''              fixedLeader: null,
              fixedCostumeId: null,
              fixedMembers: [],
              memberPool: beforeMembers,
'''
new_sim = '''              fixedLeader: rosterFixedCaptain || null,
              fixedCostumeId: null,
              fixedMembers: rosterRequiredMembers,
              memberPool: beforeMembers,
'''
text = replace_once(text, old_sim, new_sim, "simulation before constraints")
old_sim2 = '''              fixedLeader: null,
              fixedCostumeId: null,
              fixedMembers: [],
              memberPool: afterMembers,
'''
new_sim2 = '''              fixedLeader: rosterFixedCaptain || null,
              fixedCostumeId: null,
              fixedMembers: rosterRequiredMembers,
              memberPool: afterMembers,
'''
text = replace_once(text, old_sim2, new_sim2, "simulation after constraints")

text = replace_once(
    text,
    '''  useEffect(() => {
    localStorage.setItem(STORAGE_UI, JSON.stringify({ theme, cardsCompact }));
  }, [theme, cardsCompact]);
''',
    '''  useEffect(() => {
    const owned = new Set(ownedRosterMembers);
    setRosterRequiredMembers((prev) => prev.filter((member) => owned.has(member)));
    setRosterFixedCaptain((prev) =>
      prev && rosterCaptainOptions.includes(prev) ? prev : "",
    );
  }, [ownedRosterMembers, rosterCaptainOptions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_UI, JSON.stringify({ theme, cardsCompact }));
  }, [theme, cardsCompact]);
''',
    "constraint pruning effect",
)

text = replace_once(
    text,
    '''          </div>
          <p className="panel-note">{t.rosterNote}</p>
          <div className="roster-pr-context">
''',
    '''          </div>
          <div className="roster-constraints">
            <div className="roster-constraints-head">
              <div>
                <strong>{locale === "ja" ? "編成条件（任意）" : locale === "en" ? "Lineup constraints (optional)" : "編隊限制（選填）"}</strong>
                <small>
                  {locale === "ja"
                    ? "未指定なら今まで通り全自動。必要なメンバーやキャプテンだけを固定できます。"
                    : locale === "en"
                      ? "Leave both blank for full auto. Lock only the members or captain you care about."
                      : "兩欄都不選時就是原本的全自動；只在你需要時鎖定必上場成員或隊長。"}
                </small>
              </div>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={rosterRequiredMembers.length === 0 && !rosterFixedCaptain}
                onClick={clearRosterConstraints}
              >
                {locale === "ja" ? "条件をクリア" : locale === "en" ? "Clear constraints" : "清除條件"}
              </button>
            </div>

            <div className="roster-constraint-field">
              <span className="roster-constraint-label">
                {locale === "ja" ? "必須出場メンバー（複数可）" : locale === "en" ? "Required lineup members (multi-select)" : "必上場成員（可複選）"}
              </span>
              <select
                value=""
                disabled={rosterRequiredMembers.length >= 5 || ownedRosterMembers.length === 0}
                onChange={(e) => {
                  addRosterRequiredMember(e.target.value);
                  e.currentTarget.value = "";
                }}
              >
                <option value="">
                  {rosterRequiredMembers.length >= 5
                    ? (locale === "ja" ? "最大5人です" : locale === "en" ? "Maximum 5 members" : "最多 5 人")
                    : (locale === "ja" ? "必須メンバーを追加…" : locale === "en" ? "Add a required member…" : "加入必上場成員…")}
                </option>
                {ownedRosterMembers
                  .filter((member) => !rosterRequiredMembers.includes(member))
                  .sort((a, b) => compareMembersByGroup(a, b, unitsOf))
                  .map((member) => (
                    <option key={member} value={member}>
                      {listName(member, unitsOf(member), locale)}
                    </option>
                  ))}
              </select>
              <div className="roster-required-chips">
                {rosterRequiredMembers.length ? (
                  rosterRequiredMembers.map((member) => (
                    <span key={member} className="roster-required-chip">
                      {listName(member, unitsOf(member), locale)}
                      <button
                        type="button"
                        onClick={() => removeRosterRequiredMember(member)}
                        aria-label={`Remove ${member}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="roster-constraint-hint">
                    {locale === "ja" ? "未指定：5人はすべて自動選択" : locale === "en" ? "None: all five slots are chosen automatically" : "未指定：5 個位置全部由系統自動挑選"}
                  </span>
                )}
              </div>
            </div>

            <label className="roster-constraint-field">
              <span className="roster-constraint-label">
                {locale === "ja" ? "キャプテン指定（任意）" : locale === "en" ? "Fixed captain (optional)" : "指定隊長（選填）"}
              </span>
              <select
                value={rosterFixedCaptain}
                onChange={(e) => {
                  setRosterFixedCaptain(e.target.value);
                  setSimulation(null);
                  setResult(null);
                }}
              >
                <option value="">
                  {locale === "ja" ? "自動で選ぶ" : locale === "en" ? "Auto-select captain" : "由系統自動選隊長"}
                </option>
                {rosterCaptainOptions.map((member) => (
                  <option key={member} value={member}>
                    {listName(member, unitsOf(member), locale)}
                  </option>
                ))}
              </select>
              <span className="roster-constraint-hint">
                {rosterFixedCaptain
                  ? (locale === "ja" ? "このメンバーの所持衣装だけを比較します。本人も5人に入れたい場合は左にも追加してください。" : locale === "en" ? "Only owned costumes for this captain are tested. To also force them into the five-member lineup, add them on the left." : "只比較這位隊長實際持有的衣裝；如果本人也一定要在 5 人隊伍裡，請再把他加入左邊的必上場成員。")
                  : (locale === "ja" ? "未指定：所持衣装から最適なキャプテンを自動比較" : locale === "en" ? "None: compare all eligible owned captains automatically" : "未指定：系統會比較所有有可用衣裝的持有角色，自動挑最佳隊長")}
              </span>
            </label>
          </div>
          <p className="panel-note">{t.rosterNote}</p>
          <div className="roster-pr-context">
''',
    "constraint UI",
)

app_path.write_text(text, encoding="utf-8")

optimizer_path = Path("src/lib/optimizer.ts")
optimizer = optimizer_path.read_text(encoding="utf-8")
optimizer = replace_once(
    optimizer,
    '''  const required = new Set<string>(options.fixedMembers ?? []);
  const autoCaptainInventory =
    !options.fixedLeader && (options.memberPool?.length ?? 0) > 0;

  // Fixed captain costume: full enumeration (captain may be off-team).
  if (options.fixedLeader && options.fixedCostumeId) return optimizeTeam(data, options);
  if (!autoCaptainInventory && (ownedCount <= 28 || required.size >= 2)) {
    return optimizeTeam(data, options);
  }
''',
    '''  const required = new Set<string>(options.fixedMembers ?? []);
  const inventoryMode = (options.memberPool?.length ?? 0) > 0;

  // Fixed captain costume: full enumeration (captain may be off-team).
  if (options.fixedLeader && options.fixedCostumeId) return optimizeTeam(data, options);
  // Inventory mode keeps the bounded fast path even when optional lineup/captain
  // constraints are active, preserving the rule that captain may remain off-team.
  if (!inventoryMode && (ownedCount <= 28 || required.size >= 2)) {
    return optimizeTeam(data, options);
  }
''',
    "inventory fast path with fixed captain",
)
optimizer_path.write_text(optimizer, encoding="utf-8")

print("Optional roster constraints applied")
