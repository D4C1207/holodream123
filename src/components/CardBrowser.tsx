import type { ReactNode } from "react";
import { useI18n } from "../i18n/LocaleContext";
import {
  formatActiveSkill,
  formatPassiveSkill,
  formatSpecialSkill,
} from "../lib/skillText";
import { MemberName } from "./MemberName";
import { CardArt } from "./CardArt";
import type { Attr, Card } from "../types";

type Props = {
  groups: { unit: string; cards: Card[]; isEvent?: boolean }[];
  compact: boolean;
  unitsOf: (member: string) => string[];
  onCardClick?: (card: Card) => void;
  selectedCardId?: string | null;
  memberLockedSet?: Set<string>;
  preferredByMember?: Record<string, string>;
  leaderMember?: string;
  emptyText?: string;
};

export function CardGroupBrowser({
  groups,
  compact,
  unitsOf,
  onCardClick,
  selectedCardId,
  memberLockedSet,
  preferredByMember = {},
  leaderMember = "",
  emptyText,
}: Props) {
  const { t, attrLabel, locale } = useI18n();
  const empty = emptyText ?? t.noMatchingCards;

  if (!groups.length) {
    return <div className="empty">{empty}</div>;
  }

  return (
    <div className={`card-groups ${compact ? "is-compact" : ""}`}>
      {groups.map((g) => (
        <div key={g.unit} className="group-block">
          <div className={`group-heading ${g.isEvent ? "event" : ""}`}>
            {g.isEvent ? t.eventPrefix(g.unit) : g.unit}
          </div>
          <div className="card-grid">
            {g.cards.map((card) => {
              const preferred = preferredByMember[card.member] === card.id;
              const memberLocked = memberLockedSet?.has(card.member) ?? false;
              const selected = selectedCardId
                ? selectedCardId === card.id
                : preferred;
              const className = `card-item ${selected ? "owned" : ""} ${
                memberLocked && !selected ? "member-locked" : ""
              } ${leaderMember === card.member ? "is-leader" : ""} ${
                compact ? "is-compact" : ""
              } ${onCardClick ? "" : "is-static"}`;
              const body = (
                <>
                  <CardArt cardId={card.id} alt={card.costumeName} />
                  <div className="name">
                    <MemberName member={card.member} units={unitsOf(card.member)} />
                  </div>
                  {!compact && (
                    <>
                      <div className="meta">
                        <span className={`badge ${card.type}`}>{attrLabel(card.type)}</span>
                        <span className="badge star">★{card.rarity}</span>
                        <span className="badge">
                          {card.event ? t.eventBadge : card.unit}
                        </span>
                      </div>
                      <p className="card-sub">{card.costumeName}</p>
                      {card.stats && (
                        <div className="card-stats">
                          <div>
                            {t.performance} {card.stats.performance}
                          </div>
                          <div>
                            {t.technique} {card.stats.technique}
                          </div>
                          <div>
                            {t.sense} {card.stats.sense}
                          </div>
                          <div className="total">{t.total(card.stats.total)}</div>
                        </div>
                      )}
                      {!card.stats && (
                        <div className="card-stats muted-stats">{t.statsMissing}</div>
                      )}
                      <div className="card-skills">
                        <p>
                          <strong>{t.special}</strong>
                          {formatSpecialSkill(card.special, locale) || "—"}
                        </p>
                        <p>
                          <strong>{t.active}</strong>
                          {formatActiveSkill(card.active, locale) || "—"}
                        </p>
                        <p>
                          <strong>{t.passive}</strong>
                          {formatPassiveSkill(card.passive, locale) || "—"}
                        </p>
                      </div>
                    </>
                  )}
                </>
              );
              if (onCardClick) {
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={className}
                    onClick={() => onCardClick(card)}
                    title={formatActiveSkill(card.active, locale)}
                  >
                    {body}
                  </button>
                );
              }
              return (
                <article
                  key={card.id}
                  className={className}
                  title={formatActiveSkill(card.active, locale)}
                >
                  {body}
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

type FilterBarProps = {
  filterOpen: boolean;
  onToggleOpen: () => void;
  compact: boolean;
  onToggleCompact: () => void;
  filterSummary: string;
  rarityFilters: number[];
  typeFilters: Attr[];
  unitFilters: string[];
  unitOptions: string[];
  query: string;
  onQuery: (v: string) => void;
  onClearRarity: () => void;
  onToggleRarity: (r: number) => void;
  onClearType: () => void;
  onToggleType: (t: Attr) => void;
  onClearUnit: () => void;
  onToggleUnit: (u: string) => void;
  extraActions?: ReactNode;
};

export function CardFilterToolbar({
  filterOpen,
  onToggleOpen,
  compact,
  onToggleCompact,
  filterSummary,
  rarityFilters,
  typeFilters,
  unitFilters,
  unitOptions,
  query,
  onQuery,
  onClearRarity,
  onToggleRarity,
  onClearType,
  onToggleType,
  onClearUnit,
  onToggleUnit,
  extraActions,
}: FilterBarProps) {
  const { t, attrLabel } = useI18n();

  return (
    <>
      <div className="toolbar">
        <div className="field grow">
          <label>{t.search}</label>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
          />
        </div>
        <button
          className={`btn btn-ghost ${filterOpen ? "active-toggle" : ""}`}
          type="button"
          onClick={onToggleOpen}
          aria-expanded={filterOpen}
        >
          {t.filterSettings}
          <small className="btn-sub">{filterSummary}</small>
        </button>
        <button
          className={`btn btn-ghost ${compact ? "active-toggle" : ""}`}
          type="button"
          onClick={onToggleCompact}
        >
          {compact ? t.showFull : t.hideDetails}
          <small className="btn-sub">{compact ? t.compactOnly : t.fullDetails}</small>
        </button>
        {extraActions}
      </div>

      {filterOpen && (
        <div className="filter-panel">
          <div className="filter-group">
            <div className="filter-label">
              {t.rarity}
              <span className="filter-hint">{t.multiSelect}</span>
            </div>
            <div className="filters">
              <button
                type="button"
                className={`filter-btn ${rarityFilters.length === 0 ? "active" : ""}`}
                onClick={onClearRarity}
              >
                {t.all}
              </button>
              {([5, 4, 3] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`filter-btn ${rarityFilters.includes(r) ? "active" : ""}`}
                  onClick={() => onToggleRarity(r)}
                >
                  ★{r}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <div className="filter-label">
              {t.attribute}
              <span className="filter-hint">{t.multiSelect}</span>
            </div>
            <div className="filters">
              <button
                type="button"
                className={`filter-btn ${typeFilters.length === 0 ? "active" : ""}`}
                onClick={onClearType}
              >
                {t.all}
              </button>
              {(["happy", "pure", "cute"] as const).map((attr) => (
                <button
                  key={attr}
                  type="button"
                  className={`filter-btn ${typeFilters.includes(attr) ? "active" : ""}`}
                  onClick={() => onToggleType(attr)}
                >
                  {attrLabel(attr)}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <div className="filter-label">
              {t.genGroup}
              <span className="filter-hint">{t.multiSelect}</span>
            </div>
            <div className="filters">
              <button
                type="button"
                className={`filter-btn ${unitFilters.length === 0 ? "active" : ""}`}
                onClick={onClearUnit}
              >
                {t.all}
              </button>
              {unitOptions.map((u) => (
                <button
                  key={u}
                  type="button"
                  className={`filter-btn ${unitFilters.includes(u) ? "active" : ""}`}
                  onClick={() => onToggleUnit(u)}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
