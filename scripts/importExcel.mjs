/**
 * Import ★5 card table from hololive_Dreams_.xlsx into gameData.json.
 * Keeps ★3/★4; replaces ★5 from Excel (canonical JP member keys).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const xlsxPath = path.join(root, "hololive_Dreams_.xlsx");
const dataPath = path.join(root, "src/data/gameData.json");

const PROB = { 高: 0.8, 中: 0.5, 低: 0.3 };
const TYPE_MAP = { Happy: "happy", Pure: "pure", Cute: "cute" };

const GEN_TO_UNIT = {
  "Gen 0": "0期生",
  "Gen 1": "1期生",
  "Gen 2": "2期生",
  GAMERS: "ゲーマーズ",
  Gamers: "ゲーマーズ",
  "Gen 3": "3期生",
  "Gen 4": "4期生",
  "Gen 5": "5期生",
  holoX: "holoX",
  "ID Gen 1": "ID1期生",
  "ID Gen 2": "ID2期生",
  "ID Gen 3": "ID3期生",
  Myth: "Myth",
  Promise: "Promise",
  Advent: "Advent",
  ReGLOSS: "ReGLOSS",
};

const EN_TO_JP = {
  "Ayunda Risu": "アユンダ・リス",
  "Moona Hoshinova": "ムーナ・ホシノヴァ",
  "Airani Iofifteen": "アイラニ・イオフィフティーン",
  "Kureiji Ollie": "クレイジー・オリー",
  "Anya Melfissa": "アーニャ・メルフィッサ",
  "Pavolia Reine": "パヴォリア・レイネ",
  "Vestia Zeta": "ベスティア・ゼータ",
  "Kaela Kovalskia": "カエラ・コヴァルスキア",
  "Kobo Kanaeru": "こぼ・かなえる",
  "Mori Calliope": "森カリオペ",
  "Takanashi Kiara": "小鳥遊キアラ",
  "Ninomae Ina'nis": "一伊那尓栖",
  "Ouro Kronii": "オーロ・クロニー",
  "Hakos Baelz": "ハコス・ベールズ",
  "Shiori Novella": "シオリ・ノヴェラ",
  "Koseki Bijou": "古石ビジュー",
  "Nerissa Ravencroft": "ネリッサ・レイヴンクロフト",
  "Fuwawa Abyssgard": "フワワ・アビスガード",
  "Mococo Abyssgard": "モココ・アビスガード",
  "Otonose Kanade": "音乃瀬奏",
  "Ichijou Ririka": "一条莉々華",
  "Juufuutei Raden": "儒烏風亭らでん",
  "Todoroki Hajime": "轟はじめ",
};

/** Incomplete Excel rows → known game8 fills */
const MANUAL_OVERRIDES = {
  "角巻わため|真夏のもふもふフロートタイム": {
    active: "每35秒（高）：12秒 Score +60%；Happy 2人以上 +120%",
    passive: "Happy 2人 Support +11%",
    outfit: "Happy 2人以上：全員 Sense +80% + Support +25%",
  },
};

function splitName(cell) {
  const s = String(cell ?? "").trim();
  if (!s) return { left: "", right: "" };
  if (s.includes(" / ")) {
    const [left, right] = s.split(" / ").map((x) => x.trim());
    return { left, right };
  }
  return { left: s, right: s };
}

function resolveMember(nameCell, knownMembers) {
  const { left, right } = splitName(nameCell);
  const candidates = [left, right, EN_TO_JP[right], EN_TO_JP[left]].filter(Boolean);
  for (const c of candidates) {
    if (knownMembers.has(c)) return c;
  }
  for (const c of candidates) {
    if (EN_TO_JP[c]) return EN_TO_JP[c];
  }
  // Prefer Japanese-looking side (contains kana/kanji beyond latin)
  const jpLike = (s) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(s);
  if (jpLike(left)) return left;
  if (jpLike(right)) return right;
  return right || left;
}

function normalizeUnitToken(tok) {
  const map = {
    Happy: "ハッピータイプ",
    Pure: "ピュアタイプ",
    Cute: "キュートタイプ",
    Gamers: "ゲーマーズ",
    GAMERS: "ゲーマーズ",
  };
  return map[tok] ?? tok;
}

function paramJp(p) {
  return (
    {
      Perf: "パフォーマンス",
      Tech: "テクニック",
      Sense: "センス",
      全參數: "全パラメータ",
      Support: "スコアサポート効果",
    }[p] ?? p
  );
}

function parseConditionFromZh(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, "");
  let m;
  m = t.match(/(Happy|Pure|Cute|ハッピータイプ|ピュアタイプ|キュートタイプ)(\d+)人以上/);
  if (m) {
    const attr = {
      Happy: "happy",
      Pure: "pure",
      Cute: "cute",
      ハッピータイプ: "happy",
      ピュアタイプ: "pure",
      キュートタイプ: "cute",
    }[m[1]];
    return { type: "typeCount", attr, min: +m[2] };
  }
  m = t.match(/(Happy|Pure|Cute)(\d+)人(?!以上)/);
  if (m) return { type: "typeCount", attr: TYPE_MAP[m[1]], min: +m[2] };
  m = t.match(
    /(0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|Gamers|GAMERS|holoX|ID1期生|ID2期生|ID3期生|Myth|Promise|Advent|ReGLOSS)(\d+)人以上/,
  );
  if (m) return { type: "unitCount", unit: normalizeUnitToken(m[1]), min: +m[2] };
  m = t.match(
    /(0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|holoX|ID1期生|ID2期生|ID3期生|Myth|Promise|Advent|ReGLOSS)(\d+)人/,
  );
  if (m) return { type: "unitCount", unit: normalizeUnitToken(m[1]), min: +m[2] };
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

function parseOutfit(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return { condition: null, effects: [], raw, score: 0, unconditional: true };
  const effects = [];
  for (const m of raw.matchAll(/全員\s*(全參數|Perf|Tech|Sense)\s*\+(\d+)%/g)) {
    effects.push({ kind: "paramUp", param: paramJp(m[1]), value: +m[2], target: "all" });
  }
  for (const m of raw.matchAll(/Support\s*\+(\d+)%/g)) {
    effects.push({ kind: "scoreSupportPassive", value: +m[1], target: "all" });
  }
  if (!effects.length) {
    const m = raw.match(/(全參數|Perf|Tech|Sense)\s*\+(\d+)%/);
    if (m) effects.push({ kind: "paramUp", param: paramJp(m[1]), value: +m[2], target: "all" });
  }
  const condition = parseConditionFromZh(raw);
  let score = 0;
  for (const e of effects) {
    if (e.kind === "paramUp") score += e.value * (e.param === "全パラメータ" ? 3 : 1.2);
    if (e.kind === "scoreSupportPassive") score += e.value * 2.2;
  }
  return { condition, effects, raw, score, unconditional: !condition };
}

function parseSpecial(text) {
  const raw = String(text ?? "").trim();
  const duration = +(raw.match(/(\d+)秒/)?.[1] ?? 0);
  const support = +(raw.match(/Support\s*\+(\d+)%/)?.[1] ?? 0);
  const condRate = raw.match(/(Life\s*\d+\+|Combo\s*\d+\+)\s*時\s*Skill Rate\s*\+(\d+)%/i);
  const rate = +(condRate?.[2] ?? raw.match(/Skill Rate\s*\+(\d+)%/i)?.[1] ?? 0);
  return {
    duration,
    scoreSupport: support,
    skillRate: rate,
    skillRateCondition: condRate ? condRate[1].replace(/\s+/g, "") : null,
    raw,
  };
}

function parseActive(text) {
  const raw = String(text ?? "").trim();
  // 每23秒（高）：8/10秒 Score +115%
  // 每24秒（中）：10秒 Score +100%
  const m = raw.match(/每(\d+)秒[（(](高|中|低)[）)]：(\d+)(?:\/\d+)?秒\s*Score\s*\+(\d+)%/);
  if (!m) {
    return {
      interval: 0,
      probability: 1,
      probabilityLabel: "高確率",
      duration: 0,
      scoreUp: 0,
      bonus: null,
      raw,
    };
  }

  let baseScore = +m[4];
  const slash = raw.match(/Score\s*\+(\d+)%\/(\d+)%/);
  if (slash) baseScore = +slash[1];

  let bonus = null;
  const bonusCombo = raw.match(/Combo\s*(\d+)\+\s*時\s*\+(\d+)%/i);
  const bonusLife = raw.match(/Life\s*(\d+)\+\s*時\s*\+(\d+)%/i);
  const bonusType = raw.match(
    /(Happy|Pure|Cute|0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|holoX|Myth|Promise|Advent|ReGLOSS|ID\d期生)\s*(\d+)人以上[^；;]*?(?:時)?\s*\+(\d+)%/,
  );

  if (bonusCombo) {
    bonus = {
      conditionText: `${bonusCombo[1]}コンボ以上`,
      condition: { type: "misc", text: `${bonusCombo[1]}コンボ以上` },
      scoreUp: +bonusCombo[2],
    };
  } else if (bonusLife) {
    bonus = {
      conditionText: `ライフ${bonusLife[1]}以上`,
      condition: { type: "misc", text: `ライフ${bonusLife[1]}以上` },
      scoreUp: +bonusLife[2],
    };
  } else if (bonusType) {
    const condText = `${normalizeUnitToken(bonusType[1])}${bonusType[2]}人以上`;
    bonus = {
      conditionText: condText,
      condition: parseConditionFromZh(condText) || { type: "misc", text: condText },
      scoreUp: +bonusType[3],
    };
  }

  const label = { 高: "高確率", 中: "中確率", 低: "低確率" }[m[2]];
  return {
    interval: +m[1],
    probability: PROB[m[2]],
    probabilityLabel: label,
    duration: +m[3],
    scoreUp: baseScore,
    bonus,
    raw,
  };
}

function parsePassive(text) {
  const raw = String(text ?? "").trim();
  const condition = parseConditionFromZh(raw);
  const effects = [];

  const self = raw.match(/自身\s*(全參數|Perf|Tech|Sense)\s*\+(\d+)%/);
  if (self) {
    effects.push({
      kind: "paramUp",
      param: paramJp(self[1]),
      value: +self[2],
      target: "self",
    });
  }

  const compact = raw.replace(/\s+/g, "");
  const group = compact.match(
    /(Happy|Pure|Cute|0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|holoX|Myth|Promise|Advent|ReGLOSS|ID\d期生)(\d+)人(?:以上)?(?::|：)?(?:\1(\d+)人)?(全參數|Perf|Tech|Sense|Support)\+(\d+)%/,
  );
  if (group && !self) {
    const tg = group[1];
    const kind = group[4] === "Support" ? "scoreSupportPassive" : "paramUp";
    effects.push({
      kind,
      param: kind === "paramUp" ? paramJp(group[4]) : undefined,
      value: +group[5],
      targetGroup: TYPE_MAP[tg] || normalizeUnitToken(tg),
      targetCount: +(group[3] || group[2]),
    });
  } else if (!effects.length) {
    const simple = compact.match(
      /(Happy|Pure|Cute|0期生|1期生|2期生|3期生|4期生|5期生|ゲーマーズ|holoX|Myth|Promise|Advent|ReGLOSS)(\d+)人(Support|Perf|Tech|Sense|全參數)\+(\d+)%/,
    );
    if (simple) {
      const kind = simple[3] === "Support" ? "scoreSupportPassive" : "paramUp";
      effects.push({
        kind,
        param: kind === "paramUp" ? paramJp(simple[3]) : undefined,
        value: +simple[4],
        targetGroup: TYPE_MAP[simple[1]] || normalizeUnitToken(simple[1]),
        targetCount: +simple[2],
      });
    }
  }

  return { condition, effects, raw, score: scorePassive(effects) };
}

function col(row, ...needles) {
  for (const k of Object.keys(row)) {
    for (const n of needles) if (k === n || k.includes(n)) return row[k];
  }
  return "";
}

// Reload base: keep only ★3/★4 from current, wipe bad English ★5 leftovers by rebuilding members from non-star5 + excel
const prev = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const nonStar5 = prev.cards.filter((c) => c.rarity !== 5);

// Seed known members from previous JP keys + EN map values
const knownMembers = new Set([
  ...Object.keys(prev.members),
  ...Object.values(EN_TO_JP),
  ...nonStar5.map((c) => c.member),
]);

const wb = XLSX.readFile(xlsxPath);
const sheetName = wb.SheetNames.find((n) => n.includes("5")) ?? wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });

const excelCards = [];
const excelCostumes = [];
const warnings = [];
const zhByJp = {};
const memberUnit = {};

for (const row of rows) {
  const gen = String(col(row, "世代/團體")).trim();
  const nameCell = String(col(row, "角色名稱")).trim();
  let cardName = String(col(row, "卡片名稱")).trim();
  const typeEn = String(col(row, "類型")).trim();
  let outfit = String(col(row, "Outfit")).trim();
  const special = String(col(row, "Special")).trim();
  let active = String(col(row, "Active")).trim();
  let passive = String(col(row, "Passive")).trim();
  const note = String(col(row, "備註")).trim();
  if (!nameCell || !cardName) continue;

  const member = resolveMember(nameCell, knownMembers);
  knownMembers.add(member);

  const { left, right } = splitName(nameCell);
  const zh = left !== member && /[\u4e00-\u9fff]/.test(left) ? left : left.includes("・") ? null : left;
  if (zh && zh !== member && /[\u4e00-\u9fff]/.test(zh)) zhByJp[member] = zh;

  let unit = GEN_TO_UNIT[gen];
  if (!unit || gen === "泳裝限定") {
    unit = memberUnit[member] || prev.members[member]?.units?.[0] || "その他";
  } else {
    memberUnit[member] = unit;
  }

  const override = MANUAL_OVERRIDES[`${member}|${cardName}`];
  if (override) {
    active = override.active;
    passive = override.passive;
    outfit = override.outfit;
  }

  const type = TYPE_MAP[typeEn];
  if (!type) {
    warnings.push(`Bad type: ${member} ${cardName} ${typeEn}`);
    continue;
  }

  const activeParsed = parseActive(active);
  if (!activeParsed.interval) warnings.push(`Active fail: ${member} / ${cardName} :: ${active}`);

  const id = `${member}_5_${cardName}`.replace(/[\\|/]/g, "_");
  const costumeId = `${member}_${cardName}`.replace(/[\\|/]/g, "_");

  excelCards.push({
    id,
    member,
    costumeName: cardName,
    rarity: 5,
    type,
    unit,
    special: parseSpecial(special),
    active: activeParsed,
    passive: parsePassive(passive),
  });
  excelCostumes.push({
    id: costumeId,
    member,
    costumeName: cardName,
    skill: parseOutfit(outfit),
  });
}

// Rebuild members: only JP keys from nonStar5 + excel
const members = {};
for (const c of [...nonStar5, ...excelCards]) {
  if (!members[c.member]) members[c.member] = { name: c.member, units: [] };
  const set = new Set(members[c.member].units);
  if (c.unit) set.add(c.unit);
  members[c.member].units = [...set].filter((u) => u && !String(u).includes(":"));
}
if (members["白上フブキ"]) members["白上フブキ"].units = ["1期生", "ゲーマーズ"];

// Costumes: keep ones tied to remaining ★3/★4 card names, plus excel
const star5CostumeIds = new Set(excelCostumes.map((c) => c.id));
const keptCostumes = prev.costumes.filter((c) => {
  // drop costumes whose id matches a ★5 excel id (replaced)
  if (star5CostumeIds.has(c.id)) return false;
  // drop costumes for English-named phantom members
  if (EN_TO_JP[c.member]) return false;
  // keep if still referenced by non-star5 or is ★4 costume etc.
  return true;
});

const costumeMap = new Map(keptCostumes.map((c) => [c.id, c]));
for (const cos of excelCostumes) costumeMap.set(cos.id, cos);

const out = {
  members,
  cards: [...nonStar5, ...excelCards],
  costumes: [...costumeMap.values()],
  songLengthDefault: prev.songLengthDefault ?? 160,
  probabilities: prev.probabilities ?? { 高確率: 0.8, 中確率: 0.5, 低確率: 0.3 },
};

fs.writeFileSync(dataPath, JSON.stringify(out));

// Merge Chinese names — only write JP keys already in ZH_NAME or skip auto-edit
// (names.ts is maintained separately to avoid breaking apostrophe keys)

const report = {
  sheet: sheetName,
  excelRows: rows.length,
  star5: excelCards.length,
  totalCards: out.cards.length,
  totalCostumes: out.costumes.length,
  members: Object.keys(out.members).length,
  warnings,
  swimsuits: excelCards.filter((c) =>
    [
      "Energeticスプラッシュ！",
      "sparks sunset",
      "波まとうゆるふわKnight",
      "真夏のもふもふフロートタイム",
      "潮風にのせる、笑顔のハーモニー",
    ].includes(c.costumeName),
  ).map((c) => ({
    member: c.member,
    card: c.costumeName,
    unit: c.unit,
    activeOk: !!c.active.interval,
    passive: c.passive.raw,
  })),
};

fs.writeFileSync(path.join(__dirname, "_import_report.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
