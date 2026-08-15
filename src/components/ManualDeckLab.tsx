import { useEffect, useMemo, useState } from "react";
import type { Locale } from "../i18n/messages";
import { d4cBattleIndex } from "../lib/teamDecision";
import { countTypes, countUnits } from "../lib/conditions";
import { evaluateTeam } from "../lib/optimizer";
import { listName } from "../lib/names";
import { recommendSpecialOrder, specialOrderMetrics } from "../lib/specialOrder";
import {
  formatActiveSkill,
  formatCostumeSkillText,
  formatPassiveSkill,
} from "../lib/skillText";
import type { Card, CardStats, GameData, TeamEvaluation } from "../types";
import { CardArt } from "./CardArt";

const SLOT_COUNT = 5;

type ManualDeckLabProps = {
  data: GameData;
  locale: Locale;
  accountId: string;
  accountName: string;
  ownedCardIds: string[];
  ownedCostumeIds: string[];
  seedTeam: TeamEvaluation | null;
};

type Draft = {
  leaderMember: string;
  costumeId: string;
  cardIds: string[];
};

function baseStats(card: Card): CardStats {
  if (card.stats) return card.stats;
  const total = card.rarity >= 5 ? 25000 : card.rarity === 4 ? 20000 : 15000;
  const each = Math.round(total / 3);
  return { performance: each, technique: each, sense: each, total };
}

function emptySlots(): string[] {
  return Array.from({ length: SLOT_COUNT }, () => "");
}

function localize(locale: Locale, zh: string, en: string, ja: string): string {
  return locale === "en" ? en : locale === "ja" ? ja : zh;
}

export function ManualDeckLab({
  data,
  locale,
  accountId,
  accountName,
  ownedCardIds,
  ownedCostumeIds,
  seedTeam,
}: ManualDeckLabProps) {
  const storageKey = `holodream-manual-deck-v1:${accountId}`;
  const ownedCardSet = useMemo(() => new Set(ownedCardIds), [ownedCardIds]);
  const ownedCostumeSet = useMemo(() => new Set(ownedCostumeIds), [ownedCostumeIds]);
  const cardMap = useMemo(() => new Map(data.cards.map((card) => [card.id, card] as const)), [data]);
  const costumeMap = useMemo(
    () => new Map(data.costumes.map((costume) => [costume.id, costume] as const)),
    [data],
  );
  const [leaderMember, setLeaderMember] = useState("");
  const [costumeId, setCostumeId] = useState("");
  const [cardIds, setCardIds] = useState<string[]>(emptySlots);
  const [loadedAccount, setLoadedAccount] = useState("");

  const ownedCards = useMemo(
    () =>
      data.cards
        .filter((card) => ownedCardSet.has(card.id))
        .sort((a, b) => {
          const nameA = listName(a.member, data.members[a.member]?.units ?? [], locale);
          const nameB = listName(b.member, data.members[b.member]?.units ?? [], locale);
          return nameA.localeCompare(nameB, locale === "ja" ? "ja" : undefined) ||
            a.costumeName.localeCompare(b.costumeName, "ja");
        }),
    [data, locale, ownedCardSet],
  );

  const ownedCostumes = useMemo(
    () => data.costumes.filter((costume) => ownedCostumeSet.has(costume.id)),
    [data, ownedCostumeSet],
  );

  const leaderMembers = useMemo(
    () =>
      [...new Set(ownedCostumes.map((costume) => costume.member))].sort((a, b) =>
        listName(a, data.members[a]?.units ?? [], locale).localeCompare(
          listName(b, data.members[b]?.units ?? [], locale),
          locale === "ja" ? "ja" : undefined,
        ),
      ),
    [data, locale, ownedCostumes],
  );

  const leaderCostumes = useMemo(
    () => ownedCostumes.filter((costume) => costume.member === leaderMember),
    [leaderMember, ownedCostumes],
  );

  useEffect(() => {
    let draft: Draft = { leaderMember: "", costumeId: "", cardIds: emptySlots() };
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Draft>;
        draft = {
          leaderMember: typeof parsed.leaderMember === "string" ? parsed.leaderMember : "",
          costumeId: typeof parsed.costumeId === "string" ? parsed.costumeId : "",
          cardIds: Array.isArray(parsed.cardIds)
            ? parsed.cardIds.filter((id): id is string => typeof id === "string").slice(0, SLOT_COUNT)
            : emptySlots(),
        };
      }
    } catch {
      // Ignore malformed local drafts.
    }
    const validCards = [...draft.cardIds, ...emptySlots()]
      .slice(0, SLOT_COUNT)
      .map((id) => (ownedCardSet.has(id) ? id : ""));
    const validCostume = ownedCostumeSet.has(draft.costumeId) ? draft.costumeId : "";
    const validLeader = validCostume ? costumeMap.get(validCostume)?.member ?? "" : "";
    setLeaderMember(validLeader);
    setCostumeId(validCostume);
    setCardIds(validCards);
    setLoadedAccount(accountId);
  }, [accountId]);

  useEffect(() => {
    if (loadedAccount !== accountId) return;
    const draft: Draft = { leaderMember, costumeId, cardIds };
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // Local storage is best-effort only.
    }
  }, [accountId, cardIds, costumeId, leaderMember, loadedAccount, storageKey]);

  useEffect(() => {
    setCardIds((prev) => prev.map((id) => (ownedCardSet.has(id) ? id : "")));
    if (costumeId && !ownedCostumeSet.has(costumeId)) {
      setCostumeId("");
      setLeaderMember("");
    }
  }, [ownedCardSet, ownedCostumeSet]);

  function chooseLeader(member: string) {
    setLeaderMember(member);
    const firstCostume = ownedCostumes.find((costume) => costume.member === member);
    setCostumeId(firstCostume?.id ?? "");
  }

  function setSlot(index: number, cardId: string) {
    setCardIds((prev) => prev.map((id, i) => (i === index ? cardId : id)));
  }

  function moveSlot(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= SLOT_COUNT) return;
    setCardIds((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function clearDraft() {
    setLeaderMember("");
    setCostumeId("");
    setCardIds(emptySlots());
  }

  const seedAvailable = useMemo(() => {
    if (!seedTeam) return false;
    return (
      ownedCostumeSet.has(seedTeam.costume.id) &&
      seedTeam.cards.every((card) => ownedCardSet.has(card.id))
    );
  }, [ownedCardSet, ownedCostumeSet, seedTeam]);

  function loadSeedTeam() {
    if (!seedTeam || !seedAvailable) return;
    setLeaderMember(seedTeam.costume.member);
    setCostumeId(seedTeam.costume.id);
    setCardIds([...seedTeam.cards.map((card) => card.id), ...emptySlots()].slice(0, SLOT_COUNT));
  }

  const selectedCards = useMemo(
    () => cardIds.map((id) => cardMap.get(id) ?? null),
    [cardIds, cardMap],
  );
  const selectedCostume = costumeMap.get(costumeId) ?? null;
  const selectedMembers = selectedCards.filter((card): card is Card => !!card).map((card) => card.member);
  const hasDuplicateMember = new Set(selectedMembers).size !== selectedMembers.length;
  const ready = selectedCards.every((card) => !!card) && !!selectedCostume && !hasDuplicateMember;
  const specialSuggestion = useMemo(() => {
    if (!ready) return [];
    const cards = selectedCards.filter((card): card is Card => !!card);
    const context = { typeCounts: countTypes(cards), unitCounts: countUnits(cards, data) };
    return recommendSpecialOrder(cards, context);
  }, [data, ready, selectedCards]);

  function applySpecialSuggestion() {
    if (specialSuggestion.length !== SLOT_COUNT) return;
    setCardIds(specialSuggestion.map((entry) => entry.card.id));
  }

  const evaluation = useMemo(() => {
    if (!ready || !selectedCostume) return null;
    const cards = selectedCards.filter((card): card is Card => !!card);
    const leaderIndex = cards.findIndex((card) => card.member === selectedCostume.member);
    return evaluateTeam(cards, leaderIndex, selectedCostume, data, data.songLengthDefault);
  }, [data, ready, selectedCards, selectedCostume]);

  const statSummary = useMemo(() => {
    if (!evaluation) return null;
    const cards = selectedCards.filter((card): card is Card => !!card);
    const base = cards.reduce(
      (sum, card) => {
        const stats = baseStats(card);
        sum.performance += stats.performance;
        sum.technique += stats.technique;
        sum.sense += stats.sense;
        return sum;
      },
      { performance: 0, technique: 0, sense: 0 },
    );
    const effective = evaluation.memberEffectiveStats.reduce(
      (sum, stats) => {
        sum.performance += stats.performance;
        sum.technique += stats.technique;
        sum.sense += stats.sense;
        return sum;
      },
      { performance: 0, technique: 0, sense: 0 },
    );
    return { base, effective };
  }, [evaluation, selectedCards]);

  return (
    <details className="manual-deck-lab">
      <summary>
        <span className="manual-lab-summary-title">
          {localize(locale, "D4C 手動試算實驗室", "D4C Manual Deck Lab", "D4C 手動編成ラボ")}
        </span>
        <span className="manual-lab-summary-sub">
          {localize(
            locale,
            "自己排隊長、衣裝與 1～5 號位，即時看技能與數值",
            "Build captain, costume and slots 1–5 with live skill/stat checks",
            "キャプテン・衣装・1～5番を手動で組み、スキルと数値を即時確認",
          )}
        </span>
      </summary>

      <div className="manual-lab-shell">
        <div className="manual-lab-builder">
          <div className="manual-lab-head">
            <div>
              <span className="manual-lab-eyebrow">FORMATION LAB · {accountName}</span>
              <h3>{localize(locale, "用自己的倉庫自由試隊", "Experiment with your own inventory", "自分の所持カードで自由に試す")}</h3>
            </div>
            <div className="manual-lab-actions">
              <button className="btn btn-ghost" type="button" disabled={!seedAvailable} onClick={loadSeedTeam}>
                {localize(locale, "載入目前最佳隊", "Load current best", "現在の最適編成を読込")}
              </button>
              <button className="btn btn-ghost" type="button" disabled={!ready} onClick={applySpecialSuggestion}>
                ↕ {localize(locale, "套用 Special 建議順序", "Apply Special order", "Special 推奨順を適用")}
              </button>
              <button className="btn btn-ghost" type="button" onClick={clearDraft}>
                {localize(locale, "清空", "Clear", "クリア")}
              </button>
            </div>
          </div>

          <div className="manual-leader-grid">
            <label className="manual-field">
              <span>STEP 1 · {localize(locale, "隊長", "Captain", "キャプテン")}</span>
              <select value={leaderMember} onChange={(event) => chooseLeader(event.target.value)}>
                <option value="">{localize(locale, "選擇隊長…", "Choose captain…", "キャプテンを選択…")}</option>
                {leaderMembers.map((member) => (
                  <option key={member} value={member}>
                    {listName(member, data.members[member]?.units ?? [], locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="manual-field">
              <span>{localize(locale, "衣裝技能", "Costume skill", "衣装スキル")}</span>
              <select
                value={costumeId}
                disabled={!leaderMember}
                onChange={(event) => setCostumeId(event.target.value)}
              >
                <option value="">{localize(locale, "選擇衣裝…", "Choose costume…", "衣装を選択…")}</option>
                {leaderCostumes.map((costume) => (
                  <option key={costume.id} value={costume.id}>
                    {costume.costumeName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="manual-slot-head">
            <div>
              <span className="manual-lab-eyebrow">STEP 2</span>
              <h4>{localize(locale, "5 人編成與遊戲位置", "Five-member lineup and game order", "5人編成とゲーム内の順番")}</h4>
            </div>
            <span className="manual-slot-count">{selectedCards.filter(Boolean).length} / 5</span>
          </div>

          <div className="manual-slots">
            {cardIds.map((cardId, index) => {
              const currentCard = cardMap.get(cardId) ?? null;
              const otherMembers = new Set(
                cardIds
                  .filter((_, otherIndex) => otherIndex !== index)
                  .map((id) => cardMap.get(id)?.member)
                  .filter((member): member is string => !!member),
              );
              const options = ownedCards.filter(
                (card) => card.id === cardId || !otherMembers.has(card.member),
              );
              return (
                <div key={index} className={`manual-slot ${currentCard ? "filled" : ""}`}>
                  <span className="manual-slot-number">#{index + 1}</span>
                  <div className="manual-slot-art">
                    {currentCard ? (
                      <CardArt cardId={currentCard.id} alt={currentCard.costumeName} />
                    ) : (
                      <span>＋</span>
                    )}
                  </div>
                  <div className="manual-slot-main">
                    <select value={cardId} onChange={(event) => setSlot(index, event.target.value)}>
                      <option value="">{localize(locale, "加入卡片…", "Add card…", "カードを追加…")}</option>
                      {options.map((card) => (
                        <option key={card.id} value={card.id}>
                          {listName(card.member, data.members[card.member]?.units ?? [], locale)} · {card.costumeName}
                        </option>
                      ))}
                    </select>
                    {currentCard && (
                      <span className="manual-slot-card-name">
                        {listName(currentCard.member, data.members[currentCard.member]?.units ?? [], locale)} · {currentCard.costumeName}
                      </span>
                    )}
                  </div>
                  <div className="manual-slot-order">
                    <button type="button" disabled={index === 0} onClick={() => moveSlot(index, -1)}>↑</button>
                    <button type="button" disabled={index === SLOT_COUNT - 1} onClick={() => moveSlot(index, 1)}>↓</button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="manual-order-note">
            {localize(
              locale,
              "#1～#5 就是遊戲內實際擺放順序，也是 Special Skill 的發動先後。可自行調整，或用上方按鈕套用實驗性建議順序；目前 PR／SC 不會把尚未公開的 Special 精確時點硬算進去。",
              "Slots #1–#5 are the actual in-game order and therefore the Special Skill activation sequence. Reorder manually or apply the experimental suggestion above; PR/SC do not invent unconfirmed Special timing effects.",
              "#1～#5 はゲーム内の実際の配置順で、Special Skill の発動順でもあります。手動調整または上の実験的推奨順を利用できます。未公開の正確な発動時点は PR／SC に無理に算入しません。",
            )}
          </p>
          {selectedCards.some(Boolean) && (
            <div className="manual-special-order">
              <div className="manual-special-order-head">
                <strong>{localize(locale, "目前 Special 發動序", "Current Special sequence", "現在の Special 発動順")}</strong>
                <span className="special-order-badge">EXPERIMENTAL</span>
              </div>
              <div className="manual-special-order-list">
                {selectedCards.map((card, index) => {
                  if (!card) return null;
                  const teamCards = selectedCards.filter((item): item is Card => !!item);
                  const context = { typeCounts: countTypes(teamCards), unitCounts: countUnits(teamCards, data) };
                  const metrics = specialOrderMetrics(card, teamCards, context);
                  const reason = metrics.skillRate > 0
                    ? localize(
                        locale,
                        `${metrics.conditionalSkillRate ? "條件型 " : ""}Skill Rate +${metrics.skillRate}% × Active聯動 ${metrics.activeSynergy.toFixed(1)}`,
                        `${metrics.conditionalSkillRate ? "Conditional " : ""}Skill Rate +${metrics.skillRate}% × Active synergy ${metrics.activeSynergy.toFixed(1)}`,
                        `${metrics.conditionalSkillRate ? "条件付き " : ""}Skill Rate +${metrics.skillRate}% × Active連動 ${metrics.activeSynergy.toFixed(1)}`,
                      )
                    : `Support ${metrics.scoreSupport}% × ${metrics.duration}s · Active ${metrics.activeSynergy.toFixed(1)}`;
                  return (
                    <div key={`${card.id}-${index}`} className="manual-special-order-item">
                      <span>#{index + 1}</span>
                      <span>{listName(card.member, data.members[card.member]?.units ?? [], locale)} · {card.special.raw}</span>
                      <small>{reason}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="manual-lab-readout">
          <div className="manual-readout-head">
            <span className="manual-lab-eyebrow">LIVE READOUT</span>
            <h3>{localize(locale, "即時試算", "Live estimate", "リアルタイム試算")}</h3>
          </div>

          {!evaluation || !statSummary ? (
            <div className="manual-empty-state">
              <strong>{localize(locale, "等待完整編成", "Waiting for a complete lineup", "編成待ち")}</strong>
              <span>{localize(locale, "選好隊長、衣裝與 5 張不同成員卡後就會立即計算。", "Choose a captain, costume and five different member cards to calculate instantly.", "キャプテン・衣装・異なる5人のカードを選ぶと即時計算します。")}</span>
            </div>
          ) : (
            <>
              <div className="manual-score-grid">
                <div className="manual-score-card accent">
                  <span>SC</span>
                  <strong>{d4cBattleIndex(evaluation).toLocaleString()}</strong>
                  <small>{localize(locale, "固定公式實戰指數", "Fixed-formula battle index", "固定式の実戦指数")}</small>
                </div>
                <div className="manual-score-card">
                  <span>Unit Value</span>
                  <strong>{evaluation.effectiveStatTotal.toLocaleString()}</strong>
                  <small>+{(evaluation.effectiveStatTotal - evaluation.baseStatTotal).toLocaleString()}</small>
                </div>
                <div className="manual-score-card">
                  <span>Coverage</span>
                  <strong>{(evaluation.coverage * 100).toFixed(1)}%</strong>
                  <small>{evaluation.uncoveredSeconds.toFixed(0)}s gap</small>
                </div>
                <div className="manual-score-card">
                  <span>Avg UP</span>
                  <strong>{evaluation.avgScoreUp.toFixed(1)}%</strong>
                  <small>{localize(locale, "全曲平均", "full-song average", "全曲平均")}</small>
                </div>
              </div>

              <div className="manual-axis-grid">
                {([
                  ["P", "performance", localize(locale, "表演力", "Performance", "パフォーマンス")],
                  ["T", "technique", localize(locale, "技巧", "Technique", "テクニック")],
                  ["S", "sense", localize(locale, "感性", "Sense", "センス")],
                ] as const).map(([short, key, label]) => (
                  <div key={key} className="manual-axis-card">
                    <span>{short} · {label}</span>
                    <strong>{statSummary.effective[key].toLocaleString()}</strong>
                    <small>
                      {statSummary.base[key].toLocaleString()} → {statSummary.effective[key].toLocaleString()}
                      {` (${statSummary.effective[key] >= statSummary.base[key] ? "+" : ""}${(statSummary.effective[key] - statSummary.base[key]).toLocaleString()})`}
                    </small>
                  </div>
                ))}
              </div>

              <div className="manual-skill-checks">
                <div className={`manual-skill-row ${evaluation.costumeSatisfied ? "ok" : "fail"}`}>
                  <span className="manual-skill-status">{evaluation.costumeSatisfied ? "✓" : "!"}</span>
                  <div>
                    <strong>{localize(locale, "衣裝技能", "Costume skill", "衣装スキル")} · {evaluation.costume.costumeName}</strong>
                    <p>{formatCostumeSkillText(evaluation.costume.skill, locale)}</p>
                  </div>
                </div>

                {evaluation.passiveDetails.map((detail, index) => {
                  const card = evaluation.cards[index];
                  return (
                    <div key={`${card.id}-${index}`} className={`manual-skill-row ${detail.satisfied ? "ok" : "fail"}`}>
                      <span className="manual-skill-status">{detail.satisfied ? "✓" : "!"}</span>
                      <div>
                        <strong>#{index + 1} {listName(card.member, data.members[card.member]?.units ?? [], locale)} · Passive</strong>
                        <p>{formatPassiveSkill(card.passive, locale)}</p>
                        <small>{formatActiveSkill(card.active, locale)}</small>
                      </div>
                    </div>
                  );
                })}
              </div>

              {evaluation.activeDuplicates.length > 0 ? (
                <div className="manual-duplicate-warning">
                  <strong>{localize(locale, "⚠ Active 技能可能重複", "⚠ Possible Active skill overlap", "⚠ アクティブスキル重複候補")}</strong>
                  <span>
                    {evaluation.activeDuplicates
                      .map((pair) => pair.members.map((member) => listName(member, data.members[member]?.units ?? [], locale)).join(" × "))
                      .join("、")}
                  </span>
                </div>
              ) : (
                <div className="manual-clean-check">✓ {localize(locale, "未發現相同 Active 時序／效果的重複組合", "No identical Active timing/potency pairs detected", "同一タイミング／効果のアクティブ重複は未検出")}</div>
              )}
            </>
          )}

          <div className="manual-scope-note">
            <strong>{localize(locale, "計算範圍", "Calculation scope", "計算範囲")}</strong>
            <span>
              {localize(
                locale,
                "使用與自動編隊相同的卡片三圍、衣裝／被動參數效果、Score Support 權重與 Active Coverage／Avg UP 模型。SC 是 D4C 的比較指標，不是官方遊戲最終分數；未建模的 Board、Connect、特殊技能順序與其他育成差異不會出現在這個數值裡。",
                "Uses the same card stats, costume/passive parameter effects, Score Support weighting, and Active Coverage/Avg UP model as auto optimization. SC is a D4C comparison metric, not the official in-game score; unmodeled Board, Connect, special-skill order and other progression differences are excluded.",
                "自動編成と同じカードパラメータ、衣装／パッシブ補正、Score Support 加重、Active Coverage／Avg UP モデルを使用します。SC は D4C の比較指標で公式ゲーム内スコアではなく、未モデル化のボード、コネクト、スペシャルスキル順、育成差は含みません。",
              )}
            </span>
          </div>
        </div>
      </div>
    </details>
  );
}
