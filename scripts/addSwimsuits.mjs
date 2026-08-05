/**
 * Merge sunny summer swimsuit ★5 cards into gameData.json.
 * Sources: game8.jp swimsuit card pages (2026/07).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../src/data/gameData.json");

const PROB = { 高確率: 0.8, 中確率: 0.5, 低確率: 0.3 };
const TYPE_MAP = {
  ハッピー: "happy",
  ピュア: "pure",
  キュート: "cute",
  ハッピータイプ: "happy",
  ピュアタイプ: "pure",
  キュートタイプ: "cute",
};

function parseCondition(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, "");
  let m;
  m = t.match(/(ハッピータイプ|ピュアタイプ|キュートタイプ)(\d+)人以上/);
  if (m) return { type: "typeCount", attr: TYPE_MAP[m[1]], min: +m[2] };
  m = t.match(/(ハッピータイプ|ピュアタイプ|キュートタイプ)(\d+)人(?!以上)/);
  if (m) return { type: "typeCount", attr: TYPE_MAP[m[1]], min: +m[2] };
  m = t.match(
    /(0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|holoX|ID1期生|ID2期生|ID3期生|Myth|Promise|Advent|ReGLOSS)が(\d+)人以上/,
  );
  if (m) return { type: "unitCount", unit: m[1], min: +m[2] };
  m = t.match(
    /(0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|holoX|ID1期生|ID2期生|ID3期生|Myth|Promise|Advent|ReGLOSS)(\d+)人/,
  );
  if (m) return { type: "unitCount", unit: m[1], min: +m[2] };
  return null;
}

function scorePassive(effects) {
  let s = 0;
  for (const e of effects) {
    if (e.kind === "paramUp")
      s += e.value * (e.param === "全パラメータ" ? 3 : 1) * (e.target === "self" ? 0.4 : 1);
    if (e.kind === "scoreSupportPassive") s += e.value * 2.5;
  }
  return s;
}

function parseActive(text) {
  const m = text.match(/(\d+)秒毎に(高確率|中確率|低確率)で(\d+)秒間スコアが(\d+)%\s*UP/);
  if (!m) return null;
  const bonus = text.replace(/\s+/g, "").match(
    /(ライフ\d+以上|\d+コンボ以上|ハッピータイプ\d+人以上|ピュアタイプ\d+人以上|キュートタイプ\d+人以上|.+?が\d+人以上)でスコアが(\d+)%UP/,
  );
  return {
    interval: +m[1],
    probability: PROB[m[2]],
    probabilityLabel: m[2],
    duration: +m[3],
    scoreUp: +m[4],
    bonus: bonus
      ? {
          conditionText: bonus[1],
          condition: parseCondition(bonus[1]) || { type: "misc", text: bonus[1] },
          scoreUp: +bonus[2],
        }
      : null,
    raw: text,
  };
}

function parsePassive(text) {
  const cond = parseCondition(text);
  const effects = [];
  const selfParam = text.match(/自身の全パラメータが(\d+)/);
  if (selfParam)
    effects.push({
      kind: "paramUp",
      param: "全パラメータ",
      value: +selfParam[1],
      target: "self",
    });
  const groupParam = text
    .replace(/\s+/g, "")
    .match(
      /(ハッピータイプ|ピュアタイプ|キュートタイプ|0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|holoX|ID1期生|ID2期生|ID3期生|Myth|Promise|Advent|ReGLOSS)(\d+)人の(センス|テクニック|パフォーマンス|スコアサポート効果|全パラメータ)が(\d+)%/,
    );
  if (groupParam) {
    const tg = groupParam[1];
    effects.push({
      kind: groupParam[3] === "スコアサポート効果" ? "scoreSupportPassive" : "paramUp",
      param: groupParam[3] === "スコアサポート効果" ? undefined : groupParam[3],
      value: +groupParam[4],
      targetGroup: TYPE_MAP[tg] || tg,
      targetCount: +groupParam[2],
    });
  } else if (!selfParam) {
    const simple = text.match(/(センス|テクニック|パフォーマンス)が(\d+)%/);
    if (simple) effects.push({ kind: "paramUp", param: simple[1], value: +simple[2] });
    const ss = text.match(/スコアサポート効果(\d+)%/);
    if (ss) effects.push({ kind: "scoreSupportPassive", value: +ss[1] });
  }
  return { condition: cond, effects, raw: text, score: scorePassive(effects) };
}

function parseSpecial(text) {
  const durationMatch = text.match(/(\d+)秒間/);
  const support = text.match(/スコアサポート効果(\d+)%/);
  const condRate = text.match(/(ライフ\d+以上|\d+コンボ以上)でスキル発動率が(\d+)%/);
  const rate = text.match(/スキル発動率が(\d+)%/);
  return {
    duration: durationMatch ? +durationMatch[1] : 0,
    scoreSupport: support ? +support[1] : 0,
    skillRate: condRate ? +condRate[2] : rate ? +rate[1] : 0,
    skillRateCondition: condRate ? condRate[1] : null,
    raw: text,
  };
}

function parseCostumeSkill(text) {
  if (!text || text.trim() === "なし")
    return { condition: null, effects: [], raw: text, score: 0, unconditional: true };
  const condition = parseCondition(text);
  const effects = [];
  for (const x of text.matchAll(/全員の(全パラメータ|センス|テクニック|パフォーマンス)が(\d+)%\s*UP/g)) {
    effects.push({ kind: "paramUp", param: x[1], value: +x[2], target: "all" });
  }
  for (const x of text.matchAll(/全員のスコアサポート効果(\d+)%/g)) {
    effects.push({ kind: "scoreSupportPassive", value: +x[1], target: "all" });
  }
  let score = 0;
  for (const e of effects) {
    if (e.kind === "paramUp") score += e.value * (e.param === "全パラメータ" ? 3 : 1.2);
    if (e.kind === "scoreSupportPassive") score += e.value * 2.2;
  }
  return { condition, effects, raw: text, score, unconditional: !condition };
}

const swimsuits = [
  {
    member: "大空スバル",
    costumeName: "Energeticスプラッシュ！",
    rarity: 5,
    typeJp: "ピュア",
    unit: "2期生",
    special: "10秒間スコアサポート効果160%",
    active:
      "17秒毎に中確率で7秒間スコアが55%UP 40コンボ以上でスコアが105%UP",
    passive: "ピュアタイプ2人の全パラメータが15%UP",
    costumeSkill: "全員のスコアサポート効果60%",
  },
  {
    member: "不知火フレア",
    costumeName: "sparks sunset",
    rarity: 5,
    typeJp: "ハッピー",
    unit: "3期生",
    special: "12秒間スコアサポート効果120% スキル発動率が40%UP",
    active:
      "33秒毎に高確率で11秒間スコアが60%UP ハッピータイプ2人以上でスコアが125%UP",
    passive: "ハッピータイプ2人のスコアサポート効果11%",
    costumeSkill:
      "ハッピータイプ2人以上で全員のテクニックが80%UP、ハッピータイプ2人以上で全員のスコアサポート効果25%",
  },
  {
    member: "白銀ノエル",
    costumeName: "波まとうゆるふわKnight",
    rarity: 5,
    typeJp: "キュート",
    unit: "3期生",
    special:
      "12秒間スコアサポート効果120% 3期生が2人以上で3期生2人のスコアサポート効果12%",
    active: "21秒毎に高確率で7秒間スコアが120%UP",
    passive: "3期生が2人以上で3期生2人のスコアサポート効果12%",
    costumeSkill: "3期生が2人以上で全員のパフォーマンスが135%UP",
  },
  {
    member: "角巻わため",
    costumeName: "真夏のもふもふフロートタイム",
    rarity: 5,
    typeJp: "ハッピー",
    unit: "4期生",
    special: "11秒間スコアサポート効果130% スキル発動率が45%UP",
    active:
      "35秒毎に高確率で12秒間スコアが60%UP ハッピータイプ2人以上でスコアが120%UP",
    passive: "ハッピータイプ2人のスコアサポート効果11%",
    costumeSkill:
      "ハッピータイプ2人以上で全員のセンスが80%UP、ハッピータイプ2人以上で全員のスコアサポート効果25%",
  },
  {
    member: "音乃瀬奏",
    costumeName: "潮風にのせる、笑顔のハーモニー",
    rarity: 5,
    typeJp: "ハッピー",
    unit: "ReGLOSS",
    special: "14秒間スコアサポート効果115%",
    active: "23秒毎に中確率で8秒間スコアが120%UP",
    passive: "ハッピータイプ2人以上でハッピータイプ2人のパフォーマンスが43%UP",
    costumeSkill: "ハッピータイプ2人以上で全員のパフォーマンスが130%UP",
  },
];

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
let addedCards = 0;
let addedCostumes = 0;

for (const s of swimsuits) {
  const cardId = `${s.member}_${s.rarity}_${s.costumeName}`.replace(/[\\|/]/g, "_");
  const costumeId = `${s.member}_${s.costumeName}`.replace(/[\\|/]/g, "_");

  if (!data.cards.some((c) => c.id === cardId)) {
    const active = parseActive(s.active);
    if (!active) throw new Error(`Failed to parse active for ${s.member}: ${s.active}`);
    data.cards.push({
      id: cardId,
      member: s.member,
      costumeName: s.costumeName,
      rarity: s.rarity,
      type: TYPE_MAP[s.typeJp],
      unit: s.unit,
      special: parseSpecial(s.special),
      active,
      passive: parsePassive(s.passive),
    });
    addedCards += 1;
  }

  if (!data.costumes.some((c) => c.id === costumeId)) {
    data.costumes.push({
      id: costumeId,
      member: s.member,
      costumeName: s.costumeName,
      skill: parseCostumeSkill(s.costumeSkill),
    });
    addedCostumes += 1;
  }

  if (!data.members[s.member]) {
    data.members[s.member] = { name: s.member, units: [s.unit] };
  } else if (!data.members[s.member].units.includes(s.unit)) {
    data.members[s.member].units.push(s.unit);
  }
}

// Clean known bad unit tag on Fubuki
if (data.members["白上フブキ"]) {
  data.members["白上フブキ"].units = ["1期生", "ゲーマーズ"];
}

fs.writeFileSync(dataPath, JSON.stringify(data));
console.log({
  addedCards,
  addedCostumes,
  totalCards: data.cards.length,
  totalCostumes: data.costumes.length,
  sample: data.cards.find((c) => c.costumeName === "波まとうゆるふわKnight"),
  flareCostume: data.costumes.find((c) => c.costumeName === "sparks sunset"),
});
