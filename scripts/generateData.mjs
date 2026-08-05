import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillPath =
  "C:/Users/9527/.cursor/projects/d-holodream/agent-tools/cba442a8-55ba-4112-b4be-00e09a8d9be0.txt";
const costumePath =
  "C:/Users/9527/.cursor/projects/d-holodream/agent-tools/a994edb6-981c-4558-9f90-0657f432b954.txt";
const skillText = fs.readFileSync(skillPath, "utf8");
const costumeText = fs.readFileSync(costumePath, "utf8");

const PROB = { 高確率: 0.8, 中確率: 0.5, 低確率: 0.3 };
const TYPE_MAP = {
  ハッピー: "happy",
  ピュア: "pure",
  キュート: "cute",
  ハッピータイプ: "happy",
  ピュアタイプ: "pure",
  キュートタイプ: "cute",
};
const RARITY_MAP = { 星5: 5, 星4: 4, 星3: 3 };

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
  const bonus = text.match(
    /(ライフ\d+以上|\d+コンボ以上|[^\s]+タイプ\s*\d+人以上|[^\s]+が\d+人以上)でスコアが(\d+)%\s*UP/,
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

const cardMap = new Map();
const rowRe =
  /^\| ([^|]+) \| ([^|]+) \| ([^|]+) \| (ハッピー|ピュア|キュート) \| (スペシャル|アクティブ|パッシブ) \| (星[345]) \| ([^|]+) \|/;
for (const line of skillText.split(/\n/)) {
  const m = line.match(rowRe);
  if (!m) continue;
  const [, , skillEffect, member, typeJp, skillClass, rarityJp, unit] = m;
  const costumeMatch = skillEffect.match(/^(.+?)（星[345]）\s*(【.+)$/);
  if (!costumeMatch) continue;
  const costumeName = costumeMatch[1].trim();
  const skillBody = costumeMatch[2].replace(/^【(スペシャル|アクティブ|パッシブ)】/, "").trim();
  const rarity = RARITY_MAP[rarityJp];
  const type = TYPE_MAP[typeJp];
  const key = `${member}|${rarity}|${costumeName}`;
  if (!cardMap.has(key)) {
    cardMap.set(key, {
      id: key.replace(/[\\|/]/g, "_"),
      member,
      costumeName,
      rarity,
      type,
      unit: unit.trim(),
      special: null,
      active: null,
      passive: null,
    });
  }
  const card = cardMap.get(key);
  if (skillClass === "スペシャル") card.special = parseSpecial(skillBody);
  if (skillClass === "アクティブ") card.active = parseActive(skillBody);
  if (skillClass === "パッシブ") card.passive = parsePassive(skillBody);
}

const cards = [...cardMap.values()].filter((c) => c.active && c.passive && c.special);
const costumes = [];
const costumeRe = /^\|\s*([^|\[]+)\[([^\]]+)\]\s*\|\s*(.+?)\s*\|\s*$/;
for (const line of costumeText.split(/\n/)) {
  const trimmed = line.replace(/\r/g, "");
  const m = trimmed.match(costumeRe);
  if (!m) continue;
  const member = m[1].trim();
  const costumeName = m[2].trim();
  const skillTextRaw = m[3].trim();
  if (skillTextRaw === "なし") continue;
  costumes.push({
    id: `${member}_${costumeName}`.replace(/[\\|/]/g, "_"),
    member,
    costumeName,
    skill: parseCostumeSkill(skillTextRaw),
  });
}

const members = [...new Set(cards.map((c) => c.member))];
const memberMeta = {};
for (const mem of members) {
  const units = new Set();
  for (const c of cards.filter((x) => x.member === mem)) if (c.unit) units.add(c.unit);
  if (mem === "白上フブキ") {
    units.add("1期生");
    units.add("ゲーマーズ");
  }
  memberMeta[mem] = { name: mem, units: [...units] };
}

const out = {
  members: memberMeta,
  cards,
  costumes,
  songLengthDefault: 160,
  probabilities: PROB,
};
const outPath = path.join(__dirname, "../src/data/gameData.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
console.log({
  cards: cards.length,
  costumes: costumes.length,
  members: members.length,
  samplePassive: cards.find((c) => c.member === "轟はじめ" && c.rarity === 5)?.passive,
});
