/**
 * Add アユンダ・リス ★5 [いたずらたくらむ木漏れ日の森] (costume already in gameData).
 * Source: game8.jp/hololive-dreams/801387 (2026/07)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../src/data/gameData.json");

const PROB = { 高確率: 0.8, 中確率: 0.5, 低確率: 0.3 };

function parsePassive(text) {
  return {
    condition: { type: "typeCount", attr: "happy", min: 2 },
    effects: [
      {
        kind: "scoreSupportPassive",
        value: 11,
        targetGroup: "happy",
        targetCount: 2,
      },
    ],
    raw: text,
    score: 27.5,
  };
}

const entry = {
  member: "アユンダ・リス",
  costumeName: "いたずらたくらむ木漏れ日の森",
  rarity: 5,
  type: "happy",
  unit: "ID1期生",
  special: {
    duration: 12,
    scoreSupport: 120,
    skillRate: 45,
    skillRateCondition: "ライフ1000以上",
    raw: "12秒間スコアサポート効果120%ライフ1000以上でスキル発動率が45%UP",
  },
  active: {
    interval: 34,
    probability: PROB["高確率"],
    probabilityLabel: "高確率",
    duration: 15,
    scoreUp: 90,
    bonus: null,
    raw: "34秒毎に高確率で15秒間スコアが90%UP",
  },
  passive: parsePassive("ハッピータイプ2人のスコアサポート効果11%"),
  stats: {
    performance: 6947,
    technique: 11145,
    sense: 7828,
    total: 25920,
  },
};

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const cardId = `${entry.member}_${entry.rarity}_${entry.costumeName}`.replace(/[\\|/]/g, "_");

if (data.cards.some((c) => c.id === cardId)) {
  console.log("Card already exists:", cardId);
  process.exit(0);
}

data.cards.push({ id: cardId, ...entry });

if (!data.members[entry.member]) {
  data.members[entry.member] = { name: entry.member, units: [entry.unit] };
} else if (!data.members[entry.member].units.includes(entry.unit)) {
  data.members[entry.member].units.push(entry.unit);
}

fs.writeFileSync(dataPath, JSON.stringify(data));
console.log({ added: cardId, totalCards: data.cards.length });
