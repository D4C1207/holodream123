import type { Attr, Card, Condition, GameData, MemberMeta } from "../types";

export function memberUnits(meta: MemberMeta | undefined, card: Card): string[] {
  const units = new Set<string>(meta?.units ?? []);
  if (card.unit) units.add(card.unit);
  return [...units];
}

export function countTypes(cards: Card[]): Record<Attr, number> {
  const counts: Record<Attr, number> = { happy: 0, pure: 0, cute: 0 };
  for (const c of cards) counts[c.type] += 1;
  return counts;
}

export function countUnits(cards: Card[], data: GameData): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    for (const u of memberUnits(data.members[c.member], c)) {
      counts[u] = (counts[u] ?? 0) + 1;
    }
  }
  return counts;
}

/** Life / combo etc. are assumed achievable during a clean play. */
export function isConditionMet(
  condition: Condition | null | undefined,
  typeCounts: Record<Attr, number>,
  unitCounts: Record<string, number>,
): boolean {
  if (!condition) return true;
  if (condition.type === "misc") return true;
  if (condition.type === "typeCount") {
    return (typeCounts[condition.attr] ?? 0) >= condition.min;
  }
  if (condition.type === "unitCount") {
    return (unitCounts[condition.unit] ?? 0) >= condition.min;
  }
  return false;
}

export const ATTR_LABEL: Record<Attr, string> = {
  happy: "快樂型",
  pure: "清純型",
  cute: "可愛型",
};

export const ATTR_JP: Record<Attr, string> = {
  happy: "快樂型",
  pure: "清純型",
  cute: "可愛型",
};
