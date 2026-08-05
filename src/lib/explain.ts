import type { Attr, Condition, Costume, GameData } from "../types";
import type { Messages } from "../i18n/messages";
import { displayName } from "./names";

export function describeCondition(
  condition: Condition | null | undefined,
  t: Messages,
  attrLabel: (attr: Attr) => string,
): string {
  if (!condition) return t.condNone;
  if (condition.type === "typeCount") {
    return t.condTypeCount(attrLabel(condition.attr), condition.min);
  }
  if (condition.type === "unitCount") {
    return t.condUnitCount(condition.unit, condition.min);
  }
  return condition.text;
}

export function conditionProgress(
  condition: Condition | null | undefined,
  typeCounts: Record<Attr, number>,
  unitCounts: Record<string, number>,
  attrLabel: (attr: Attr) => string,
): { current: number; needed: number; label: string } | null {
  if (!condition) return null;
  if (condition.type === "typeCount") {
    return {
      current: typeCounts[condition.attr] ?? 0,
      needed: condition.min,
      label: attrLabel(condition.attr),
    };
  }
  if (condition.type === "unitCount") {
    return {
      current: unitCounts[condition.unit] ?? 0,
      needed: condition.min,
      label: condition.unit,
    };
  }
  return null;
}

/** Members that contribute to a costume skill condition. */
export function candidatesForCondition(
  condition: Condition | null | undefined,
  data: GameData,
  ownedMembers: Set<string>,
): string[] {
  if (!condition) return [];
  if (condition.type === "unitCount") {
    return Object.entries(data.members)
      .filter(([, meta]) => meta.units.includes(condition.unit))
      .map(([name]) => name)
      .filter((name) => ownedMembers.has(name))
      .sort((a, b) => a.localeCompare(b, "ja"));
  }
  if (condition.type === "typeCount") {
    return data.cards
      .filter((c) => ownedMembers.has(c.member) && c.type === condition.attr)
      .map((c) => c.member)
      .filter((name, i, arr) => arr.indexOf(name) === i)
      .sort((a, b) => a.localeCompare(b, "ja"));
  }
  return [];
}

export function explainCostumeSkill(
  costume: Costume,
  t: Messages,
  attrLabel: (attr: Attr) => string,
  paramLabel: (param: string) => string,
): string {
  const cond = describeCondition(costume.skill.condition, t, attrLabel);
  const effects = costume.skill.effects
    .map((e) => {
      if (e.kind === "paramUp") return t.explainParamUp(paramLabel(e.param ?? ""), e.value);
      if (e.kind === "scoreSupportPassive") return t.explainScoreSupport(e.value);
      return JSON.stringify(e);
    })
    .join(t.gapsJoin);
  if (!costume.skill.condition) {
    return effects || costume.skill.raw;
  }
  return t.explainWhen(cond, effects || costume.skill.raw);
}

export function formatMemberList(
  names: string[],
  unitsOf?: (name: string) => string[] | undefined,
  join = "、",
  locale: "zh" | "en" | "ja" = "zh",
): string {
  return names.map((n) => displayName(n, unitsOf?.(n), locale)).join(join);
}
