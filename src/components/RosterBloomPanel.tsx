import { useMemo } from "react";
import type { Locale } from "../i18n/messages";
import { listName } from "../lib/names";
import type { GameData } from "../types";
import { CardArt } from "./CardArt";

const STAGES = [0, 1, 2, 3, 4, 5] as const;

type Props = {
  data: GameData;
  locale: Locale;
  ownedCardIds: string[];
  bloomByCardId: Record<string, number>;
  onChange: (cardId: string, stage: number) => void;
};

function text(locale: Locale, zh: string, en: string, ja: string) {
  return locale === "en" ? en : locale === "ja" ? ja : zh;
}

export function RosterBloomPanel({ data, locale, ownedCardIds, bloomByCardId, onChange }: Props) {
  const owned = useMemo(() => new Set(ownedCardIds), [ownedCardIds]);
  const cards = useMemo(
    () =>
      data.cards
        .filter((card) => card.rarity === 5 && owned.has(card.id))
        .sort((a, b) => {
          const an = listName(a.member, data.members[a.member]?.units ?? [], locale);
          const bn = listName(b.member, data.members[b.member]?.units ?? [], locale);
          return an.localeCompare(bn, locale === "ja" ? "ja" : undefined)
            || a.costumeName.localeCompare(b.costumeName, "ja");
        }),
    [data, locale, owned],
  );

  if (!cards.length) return null;

  return (
    <details className="roster-bloom-panel">
      <summary>
        <span>
          <strong>{text(locale, "★5 開花階段", "★5 Bloom stages", "★5 開花段階")}</strong>
          <small>
            {text(
              locale,
              "設定每張持有卡的實際開花 0～5；會直接影響三圍與技能數值。",
              "Set each owned card's actual Bloom 0–5; stats and skill values update automatically.",
              "所持カードごとの実際の開花0～5を設定。パラメータとスキル値に反映します。",
            )}
          </small>
        </span>
        <span className="roster-bloom-count">{cards.length}</span>
      </summary>

      <div className="roster-bloom-note">
        {text(
          locale,
          "舊背包首次轉換時，已記錄的 ★5 會先視為開花 5，以維持之前的計算結果；請再改成遊戲中的實際階段。新取得卡預設開花 0。",
          "For compatibility, ★5 cards saved before this update start at Bloom 5 so old results do not suddenly change. Adjust them to your real in-game stage; newly added cards start at 0.",
          "旧データの★5は従来の計算結果を保つため初回のみ開花5として移行します。実際の段階へ調整してください。新規追加カードは開花0です。",
        )}
      </div>

      <div className="roster-bloom-grid">
        {cards.map((card) => {
          const stage = Math.max(0, Math.min(5, Math.floor(bloomByCardId[card.id] ?? 0)));
          return (
            <div className="roster-bloom-row" key={card.id}>
              <CardArt cardId={card.id} alt={card.costumeName} className="roster-bloom-art" />
              <div className="roster-bloom-card-copy">
                <strong>{listName(card.member, data.members[card.member]?.units ?? [], locale)}</strong>
                <span>{card.costumeName}</span>
              </div>
              <label>
                <span>{text(locale, "開花", "Bloom", "開花")}</span>
                <select value={stage} onChange={(event) => onChange(card.id, Number(event.target.value))}>
                  {STAGES.map((value) => (
                    <option key={value} value={value}>{value}{value === 5 ? text(locale, "（滿）", " (Max)", "（最大）") : ""}</option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
      </div>
    </details>
  );
}
