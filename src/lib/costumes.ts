import type { Card, Costume } from "../types";

/** Costume tied to a ★5 permanent or event-tagged card. */
export function isStar5OrEventCostume(costume: Costume, cards: Card[]): boolean {
  return cards.some(
    (c) =>
      c.member === costume.member &&
      c.costumeName === costume.costumeName &&
      (c.rarity === 5 || !!c.event),
  );
}

/** All captain costumes for a member, strongest skill first. */
export function captainCostumesForMember(costumes: Costume[], member: string): Costume[] {
  return costumes
    .filter((c) => c.member === member)
    .sort((a, b) => b.skill.score - a.skill.score);
}
