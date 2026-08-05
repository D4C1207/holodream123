import type { Locale } from "../i18n/messages";
import type {
  ActiveSkill,
  Attr,
  Condition,
  CostumeSkill,
  PassiveSkill,
  SpecialSkill,
} from "../types";

/** Attribute labels as used in official / wiki skill text. */
const ATTR: Record<Locale, Record<Attr, string>> = {
  ja: { happy: "ハッピータイプ", pure: "ピュアタイプ", cute: "キュートタイプ" },
  zh: { happy: "快樂型", pure: "清純型", cute: "可愛型" },
  en: { happy: "Happy", pure: "Pure", cute: "Cute" },
};

const PARAM: Record<Locale, Record<string, string>> = {
  ja: {
    パフォーマンス: "パフォーマンス",
    テクニック: "テクニック",
    センス: "センス",
    全パラメータ: "全パラメータ",
    performance: "パフォーマンス",
    technique: "テクニック",
    sense: "センス",
  },
  zh: {
    パフォーマンス: "表演力",
    テクニック: "技巧",
    センス: "感性",
    全パラメータ: "全參數",
    performance: "表演力",
    technique: "技巧",
    sense: "感性",
  },
  en: {
    パフォーマンス: "Performance",
    テクニック: "Technique",
    センス: "Sense",
    全パラメータ: "All Stats",
    performance: "Performance",
    technique: "Technique",
    sense: "Sense",
  },
};

const PROB: Record<Locale, Record<string, string>> = {
  ja: { 高確率: "高確率", 中確率: "中確率", 低確率: "低確率" },
  zh: { 高確率: "高機率", 中確率: "中機率", 低確率: "低機率" },
  en: { 高確率: "High chance", 中確率: "Medium chance", 低確率: "Low chance" },
};

function paramLabel(locale: Locale, param?: string): string {
  if (!param) return PARAM[locale]["全パラメータ"];
  return PARAM[locale][param] ?? param;
}

function groupLabel(locale: Locale, group: string): string {
  if (group === "happy" || group === "pure" || group === "cute") {
    return ATTR[locale][group];
  }
  return group;
}

function formatCondition(locale: Locale, condition: Condition | null | undefined): string {
  if (!condition) return "";
  if (condition.type === "typeCount") {
    const a = ATTR[locale][condition.attr];
    if (locale === "ja") return `${a}が${condition.min}人以上`;
    if (locale === "zh") return `${a}${condition.min}人以上`;
    return `${condition.min}+ ${a}`;
  }
  if (condition.type === "unitCount") {
    if (locale === "ja") return `${condition.unit}が${condition.min}人以上`;
    if (locale === "zh") return `${condition.unit}${condition.min}人以上`;
    return `${condition.min}+ ${condition.unit}`;
  }
  return localizeMisc(locale, condition.text);
}

function localizeMisc(locale: Locale, text: string): string {
  const t = text.replace(/\s+/g, "");
  let m = t.match(/ライフ(\d+)以上/);
  if (m) {
    if (locale === "ja") return `ライフ${m[1]}以上`;
    if (locale === "zh") return `生命值${m[1]}以上`;
    return `Life ${m[1]}+`;
  }
  m = t.match(/(\d+)コンボ以上/);
  if (m) {
    if (locale === "ja") return `${m[1]}コンボ以上`;
    if (locale === "zh") return `${m[1]}連擊以上`;
    return `Combo ${m[1]}+`;
  }
  if (t === "Life1000+" || t.startsWith("Life")) {
    const n = t.match(/(\d+)/)?.[1] ?? "1000";
    if (locale === "ja") return `ライフ${n}以上`;
    if (locale === "zh") return `生命值${n}以上`;
    return `Life ${n}+`;
  }
  if (t === "Combo100+" || t.startsWith("Combo")) {
    const n = t.match(/(\d+)/)?.[1] ?? "100";
    if (locale === "ja") return `${n}コンボ以上`;
    if (locale === "zh") return `${n}連擊以上`;
    return `Combo ${n}+`;
  }
  const typed = formatCondition(locale, parseLooseCondition(text));
  if (typed) return typed;
  return text;
}

function parseLooseCondition(text: string): Condition | null {
  const t = text.replace(/\s+/g, "");
  let m = t.match(/(ハッピータイプ|ピュアタイプ|キュートタイプ|快樂型|清純型|可愛型)(\d+)人以上/);
  if (m) {
    const map: Record<string, Attr> = {
      ハッピータイプ: "happy",
      ピュアタイプ: "pure",
      キュートタイプ: "cute",
      快樂型: "happy",
      清純型: "pure",
      可愛型: "cute",
    };
    return { type: "typeCount", attr: map[m[1]], min: +m[2] };
  }
  m = t.match(
    /(0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|holoX|ID1期生|ID2期生|ID3期生|Myth|Promise|Advent|ReGLOSS)が?(\d+)人以上/,
  );
  if (m) return { type: "unitCount", unit: m[1], min: +m[2] };
  return null;
}

function formatEffect(
  locale: Locale,
  e: {
    kind: string;
    param?: string;
    value: number;
    target?: string;
    targetGroup?: string;
    targetCount?: number;
  },
): string {
  if (e.kind === "scoreSupportPassive") {
    if (e.targetGroup && e.targetCount) {
      const g = groupLabel(locale, e.targetGroup);
      if (locale === "ja") return `${g}${e.targetCount}人のスコアサポート効果${e.value}%`;
      if (locale === "zh") return `${g}${e.targetCount}人的分數支援效果${e.value}%`;
      return `Score Support of ${e.targetCount} ${g} +${e.value}%`;
    }
    if (locale === "ja") return `全員のスコアサポート効果${e.value}%`;
    if (locale === "zh") return `全員分數支援效果${e.value}%`;
    return `All Score Support +${e.value}%`;
  }

  if (e.kind === "paramUp") {
    const p = paramLabel(locale, e.param);
    if (e.target === "self") {
      if (locale === "ja") return `自身の${p}が${e.value}%UP`;
      if (locale === "zh") return `自身${p}提升${e.value}%`;
      return `Own ${p} +${e.value}%`;
    }
    if (e.targetGroup && e.targetCount) {
      const g = groupLabel(locale, e.targetGroup);
      if (locale === "ja") return `${g}${e.targetCount}人の${p}が${e.value}%UP`;
      if (locale === "zh") return `${g}${e.targetCount}人的${p}提升${e.value}%`;
      return `${p} of ${e.targetCount} ${g} +${e.value}%`;
    }
    if (locale === "ja") return `全員の${p}が${e.value}%UP`;
    if (locale === "zh") return `全員${p}提升${e.value}%`;
    return `All ${p} +${e.value}%`;
  }

  return JSON.stringify(e);
}

export function formatSpecialSkill(
  skill: SpecialSkill,
  locale: Locale,
  fallbackRaw = true,
): string {
  const parts: string[] = [];
  if (skill.duration && skill.scoreSupport) {
    if (locale === "ja") {
      parts.push(`${skill.duration}秒間スコアサポート効果${skill.scoreSupport}%`);
    } else if (locale === "zh") {
      parts.push(`${skill.duration}秒內分數支援效果${skill.scoreSupport}%`);
    } else {
      parts.push(`Score Support ${skill.scoreSupport}% for ${skill.duration}s`);
    }
  }
  if (skill.skillRate) {
    const cond = skill.skillRateCondition
      ? localizeMisc(locale, skill.skillRateCondition)
      : "";
    if (locale === "ja") {
      parts.push(
        cond
          ? `${cond}でスキル発動率が${skill.skillRate}%UP`
          : `スキル発動率が${skill.skillRate}%UP`,
      );
    } else if (locale === "zh") {
      parts.push(
        cond
          ? `${cond}時，技能發動率提升${skill.skillRate}%`
          : `技能發動率提升${skill.skillRate}%`,
      );
    } else {
      parts.push(
        cond
          ? `When ${cond}: Skill Rate +${skill.skillRate}%`
          : `Skill Rate +${skill.skillRate}%`,
      );
    }
  }
  if (parts.length) return parts.join(locale === "en" ? ". " : "");
  return fallbackRaw ? skill.raw : "";
}

export function formatActiveSkill(
  skill: ActiveSkill,
  locale: Locale,
  fallbackRaw = true,
): string {
  const prob =
    PROB[locale][skill.probabilityLabel] ??
    (locale === "en" ? "chance" : skill.probabilityLabel);
  let base = "";
  if (locale === "ja") {
    base = `${skill.interval}秒毎に${prob}で${skill.duration}秒間スコアが${skill.scoreUp}%UP`;
  } else if (locale === "zh") {
    base = `每${skill.interval}秒以${prob}發動，${skill.duration}秒內分數提升${skill.scoreUp}%`;
  } else {
    base = `Every ${skill.interval}s, ${prob}: Score +${skill.scoreUp}% for ${skill.duration}s`;
  }

  if (skill.bonus) {
    const cond =
      (skill.bonus.condition && formatCondition(locale, skill.bonus.condition)) ||
      localizeMisc(locale, skill.bonus.conditionText);
    if (locale === "ja") {
      base += ` ${cond}でスコアが${skill.bonus.scoreUp}%UP`;
    } else if (locale === "zh") {
      base += `；${cond}時分數提升${skill.bonus.scoreUp}%`;
    } else {
      base += `. When ${cond}: Score +${skill.bonus.scoreUp}%`;
    }
  }

  if (base) return base;
  return fallbackRaw ? skill.raw : "";
}

export function formatPassiveSkill(
  skill: PassiveSkill,
  locale: Locale,
  fallbackRaw = true,
): string {
  const effects = skill.effects.map((e) => formatEffect(locale, e)).filter(Boolean);
  if (!effects.length) return fallbackRaw ? skill.raw : "";

  const effectText = effects.join(locale === "en" ? "; " : "、");
  const cond = formatCondition(locale, skill.condition);
  const useCondPrefix =
    !!cond &&
    (skill.raw.includes("以上") ||
      skill.effects.some((e) => e.target === "self") ||
      skill.effects.some((e) => e.target === "all") ||
      skill.effects.every((e) => !e.targetGroup));

  if (useCondPrefix) {
    if (locale === "ja") return `${cond}で${effectText}`;
    if (locale === "zh") return `${cond}時，${effectText}`;
    return `When ${cond}: ${effectText}`;
  }

  return effectText;
}

export function formatCostumeSkillText(
  skill: CostumeSkill,
  locale: Locale,
  fallbackRaw = true,
): string {
  const effects = skill.effects.map((e) => formatEffect(locale, e)).filter(Boolean);
  if (!effects.length) return fallbackRaw ? skill.raw : "";
  const effectText = effects.join(locale === "en" ? "; " : "、");
  const cond = formatCondition(locale, skill.condition);
  if (!cond || skill.unconditional) return effectText;
  if (locale === "ja") return `${cond}で${effectText}`;
  if (locale === "zh") return `${cond}時，${effectText}`;
  return `When ${cond}: ${effectText}`;
}
