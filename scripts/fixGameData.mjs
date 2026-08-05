/**
 * Fix known data bugs vs Game8/AppMedia/Gamerch and normalize ★5 skill raw → JP.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "src/data/gameData.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const ATTR_JP = { happy: "ハッピータイプ", pure: "ピュアタイプ", cute: "キュートタイプ" };

function describeCondition(cond) {
  if (!cond) return "";
  if (cond.type === "typeCount") return `${ATTR_JP[cond.attr]}が${cond.min}人以上`;
  if (cond.type === "unitCount") return `${cond.unit}が${cond.min}人以上`;
  if (cond.type === "misc") return cond.text;
  return "";
}

function formatActiveJp(a) {
  let s = `${a.interval}秒毎に${a.probabilityLabel}で${a.duration}秒間スコアが${a.scoreUp}%UP`;
  if (!a.bonus) return s;
  const c = a.bonus.condition;
  const up = a.bonus.scoreUp;
  if (c?.type === "misc") {
    const t = a.bonus.conditionText || c.text || "";
    if (/コンボ/.test(t)) {
      const n = t.match(/(\d+)/)?.[1] ?? "";
      s += `${n}コンボ以上でスコアが${up}%UP`;
    } else if (/ライフ|Life/i.test(t)) {
      const n = t.match(/(\d+)/)?.[1] ?? "";
      s += `ライフが${n}以上の場合スコアが${up}%UP`;
    } else {
      s += `${t}でスコアが${up}%UP`;
    }
  } else if (c?.type === "typeCount") {
    s += `${ATTR_JP[c.attr]}が${c.min}人以上でスコアが${up}%UP`;
  } else if (c?.type === "unitCount") {
    s += `${c.unit}が${c.min}人以上でスコアが${up}%UP`;
  }
  return s;
}

function formatPassiveJp(p) {
  const cond = describeCondition(p.condition);
  const parts = [];
  for (const e of p.effects ?? []) {
    if (e.kind === "paramUp") {
      if (e.target === "self") {
        parts.push(`自身の${e.param}が${e.value}%UP`);
      } else if (e.targetGroup && e.targetCount) {
        const g =
          ATTR_JP[e.targetGroup] ||
          e.targetGroup;
        parts.push(`${g}${e.targetCount}人の${e.param}が${e.value}%UP`);
      } else {
        parts.push(`${e.param}が${e.value}%UP`);
      }
    } else if (e.kind === "scoreSupportPassive") {
      if (e.targetGroup && e.targetCount) {
        const g = ATTR_JP[e.targetGroup] || e.targetGroup;
        parts.push(`${g}${e.targetCount}人のスコアサポート効果${e.value}%`);
      } else if (e.target === "all") {
        parts.push(`全員のスコアサポート効果${e.value}%`);
      } else {
        parts.push(`スコアサポート効果${e.value}%`);
      }
    }
  }
  const body = parts.join("");
  if (!body) return p.raw;
  if (!cond) return body;
  // 「XがN人以上で…」
  return `${cond}で${body}`;
}

function formatSpecialJp(s) {
  let out = "";
  if (s.duration && s.scoreSupport) {
    out += `${s.duration}秒間スコアサポート効果${s.scoreSupport}%`;
  }
  if (s.skillRate) {
    if (s.skillRateCondition) {
      out += `${s.skillRateCondition}でスキル発動率が${s.skillRate}%UP`;
    } else {
      out += `スキル発動率が${s.skillRate}%UP`;
    }
  }
  // life recover etc. kept if present in old JP raw
  const life = s.raw?.match(/ライフが(\d+)回復/);
  const perfect = s.raw?.match(/GOOD以上がPERFECT/);
  if (life) out += `ライフが${life[1]}回復`;
  if (perfect) out += `GOOD以上がPERFECTになる`;
  return out || s.raw;
}

function formatCostumeJp(skill) {
  const cond = describeCondition(skill.condition);
  const parts = [];
  for (const e of skill.effects ?? []) {
    if (e.kind === "paramUp") {
      parts.push(`全員の${e.param}が${e.value}%UP`);
    } else if (e.kind === "scoreSupportPassive") {
      parts.push(`全員のスコアサポート効果${e.value}%`);
    }
  }
  const body = parts.join("、");
  if (!body) return skill.raw;
  if (!cond) return body;
  return `${cond}で${body}`;
}

function parseCostumeFromJp(raw) {
  const text = String(raw ?? "").replace(/％/g, "%");
  const effects = [];
  for (const m of text.matchAll(/全員の(全パラメータ|パラメータ|センス|テクニック|パフォーマンス)が(\d+)%UP/g)) {
    const param = m[1] === "パラメータ" ? "全パラメータ" : m[1];
    effects.push({ kind: "paramUp", param, value: +m[2], target: "all" });
  }
  for (const m of text.matchAll(/全員のスコアサポート効果(\d+)%/g)) {
    effects.push({ kind: "scoreSupportPassive", value: +m[1], target: "all" });
  }
  let condition = null;
  let m = text.match(/(ハッピータイプ|ピュアタイプ|キュートタイプ)が?(\d+)人以上/);
  if (m) {
    condition = {
      type: "typeCount",
      attr: { ハッピータイプ: "happy", ピュアタイプ: "pure", キュートタイプ: "cute" }[m[1]],
      min: +m[2],
    };
  } else {
    m = text.match(
      /(0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|holoX|ID1期生|ID2期生|ID3期生|Myth|Promise|Advent|ReGLOSS)が?(\d+)人以上/,
    );
    if (m) condition = { type: "unitCount", unit: m[1], min: +m[2] };
  }
  let score = 0;
  for (const e of effects) {
    if (e.kind === "paramUp") score += e.value * (e.param === "全パラメータ" ? 3 : 1.2);
    if (e.kind === "scoreSupportPassive") score += e.value * 2.2;
  }
  return { condition, effects, raw: text, score, unconditional: !condition };
}

const log = [];

// --- Manual numeric / type fixes (verified vs AppMedia / Game8) ---
for (const c of data.cards) {
  if (c.member === "森カリオペ" && c.rarity === 5 && c.costumeName.includes("Reaper")) {
    if (c.type !== "pure") {
      log.push(`Calli type ${c.type} → pure`);
      c.type = "pure";
    }
  }
  if (c.member === "白銀ノエル" && c.costumeName === "波まとうゆるふわKnight") {
    c.special = {
      duration: 12,
      scoreSupport: 120,
      skillRate: 45,
      skillRateCondition: "3期生が2人以上",
      raw: "12秒間スコアサポート効果120%3期生が2人以上でスキル発動率が45%UP",
    };
    log.push("Noel swimsuit special fixed → SS120 + skillRate45 (3期生≥2)");
  }
  if (c.member === "角巻わため" && c.costumeName === "真夏のもふもふフロートタイム") {
    c.special = {
      duration: 11,
      scoreSupport: 130,
      skillRate: 45,
      skillRateCondition: null,
      raw: "11秒間スコアサポート効果130%スキル発動率が45%UP",
    };
    log.push("Watame swimsuit special fixed → 11s SS130 + skillRate45");
  }
}

// Normalize all ★5 (and any mixed) skill raw from structured fields
let rawFixed = 0;
for (const c of data.cards) {
  const before = [c.active.raw, c.passive.raw, c.special.raw].join("|");
  if (/每\d秒|Score \+|Support \+|Skill Rate|全參數|Perf \+|Tech \+|Sense \+|人以上：/.test(before) || c.rarity === 5) {
    c.active.raw = formatActiveJp(c.active);
    c.passive.raw = formatPassiveJp(c.passive);
    c.special.raw = formatSpecialJp(c.special);
    // round passive score float noise
    if (typeof c.passive.score === "number") {
      c.passive.score = Math.round(c.passive.score * 10) / 10;
    }
    rawFixed += 1;
  }
}
log.push(`Normalized skill raw on ${rawFixed} cards`);

// Costumes: JP raw + fix empty effects + remove pekora typo duplicate
data.costumes = data.costumes.filter((c) => {
  if (c.costumeName === "愛嬌たっぷりビットフィールド") {
    log.push("Removed duplicate costume 愛嬌たっぷりビットフィールド");
    return false;
  }
  return true;
});

for (const c of data.costumes) {
  if (!c.skill.effects?.length && c.skill.raw) {
    const parsed = parseCostumeFromJp(c.skill.raw);
    if (parsed.effects.length) {
      c.skill = parsed;
      log.push(`Reparsed costume ${c.member} ${c.costumeName}`);
    }
  }
  // Normalize Excel-style costume raw
  if (/全參數|Perf|Tech|Sense|Support \+|人以上：/.test(c.skill.raw) || c.skill.effects?.length) {
    if (c.skill.effects?.length) {
      c.skill.raw = formatCostumeJp(c.skill);
      if (typeof c.skill.score === "number") {
        c.skill.score = Math.round(c.skill.score * 10) / 10;
      }
    }
  }
}

fs.writeFileSync(dataPath, JSON.stringify(data));
console.log(log.join("\n"));
console.log("cards", data.cards.length, "costumes", data.costumes.length);
