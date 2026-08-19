import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataPath = path.join(root, "src/data/gameData.json");
const bloomPath = path.join(root, "src/data/star5-bloom.json");
const appPath = path.join(root, "src/App.tsx");

const SOURCE = "https://raw.githubusercontent.com/konono/holodreams_solver/main/data/cards.json";
const TARGET_IDS = [
  "nakiri_ayame_swim_5",
  "himemori_luna_swim_5",
  "mori_calliope_swim_5",
  "ninomae_ina_nis_swim_5",
  "kureiji_ollie_swim_5",
];

const TYPE_TO_D4C = { cute: "cute", pure: "pure", happy: "happy" };
const TYPE_TO_JP = { cute: "キュート", pure: "ピュア", happy: "ハッピー" };
const STAT_TO_JP = {
  performance: "パフォーマンス",
  technique: "テクニック",
  sense: "センス",
  all: "全パラメータ",
};
const PROB_LABEL = { high: "高確率", medium: "中確率", low: "低確率" };

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "D4C-holodream-data-sync" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchJson(res.headers.location));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch (error) { reject(error); }
      });
    }).on("error", reject);
  });
}

function conditionToD4c(condition) {
  if (!condition) return null;
  if (condition.type === "type_count") {
    return { type: "typeCount", attr: condition.type_name, min: Number(condition.min_count || 0) };
  }
  if (condition.type === "group_count") {
    return { type: "unitCount", unit: condition.group, min: Number(condition.min_count || 0) };
  }
  return { type: "misc", text: JSON.stringify(condition) };
}

function targetInfo(skill) {
  const target = skill?.target;
  if (!target || target === "self") return { target: "self" };
  if (typeof target === "object" && target.type_match) {
    return { targetGroup: target.type_match, targetCount: Number(target.count || 0) };
  }
  if (typeof target === "object" && target.group) {
    return { targetGroup: target.group, targetCount: Number(target.count || 0) };
  }
  return {};
}

function supportEffects(skill) {
  if (!skill) return [];
  const target = targetInfo(skill);
  const value = Number(skill.value || 0);
  if (String(skill.effect_type || "").includes("score_support")) {
    return [{ kind: "scoreSupportPassive", value, ...target }];
  }
  const param = STAT_TO_JP[skill.stat] || "全パラメータ";
  return [{ kind: "paramUp", param, value, ...target }];
}

function scorePassive(effects) {
  let score = 0;
  for (const effect of effects) {
    if (effect.kind === "paramUp") {
      score += effect.value * (effect.param === "全パラメータ" ? 3 : 1) * (effect.target === "self" ? 0.4 : 1);
    } else if (effect.kind === "scoreSupportPassive") {
      score += effect.value * 2.5;
    }
  }
  return score;
}

function costumeEffects(skill) {
  const effects = [];
  for (const effect of skill?.effects || []) {
    const value = Number(effect.value || 0);
    if (effect.stat === "score_support") {
      effects.push({ kind: "scoreSupportPassive", value, target: "all" });
    } else {
      effects.push({
        kind: "paramUp",
        param: STAT_TO_JP[effect.stat] || "全パラメータ",
        value,
        target: "all",
      });
    }
  }
  return effects;
}

function scoreCostume(effects) {
  let score = 0;
  for (const effect of effects) {
    if (effect.kind === "paramUp") score += effect.value * (effect.param === "全パラメータ" ? 3 : 1.2);
    if (effect.kind === "scoreSupportPassive") score += effect.value * 2.2;
  }
  return score;
}

function describeCondition(condition) {
  if (!condition) return "";
  if (condition.type === "type_count") return `${TYPE_TO_JP[condition.type_name] || condition.type_name}タイプ${condition.min_count}人以上`;
  if (condition.type === "group_count") return `${condition.group}が${condition.min_count}人以上`;
  return "条件成立時";
}

function describeTarget(skill) {
  const target = skill?.target;
  if (!target || target === "self") return "自身";
  if (target.type_match) return `${TYPE_TO_JP[target.type_match] || target.type_match}タイプ${target.count}人`;
  if (target.group) return `${target.group}${target.count}人`;
  return "対象メンバー";
}

function passiveRaw(skill) {
  if (!skill) return "";
  const prefix = describeCondition(skill.condition);
  const target = describeTarget(skill);
  if (String(skill.effect_type || "").includes("score_support")) {
    return `${prefix ? `${prefix}で` : ""}${target}のスコアサポート効果${skill.value}%`;
  }
  return `${prefix ? `${prefix}で` : ""}${target}の${STAT_TO_JP[skill.stat] || "全パラメータ"}が${skill.value}%UP`;
}

function costumeRaw(skill) {
  if (!skill) return "";
  const prefix = describeCondition(skill.condition);
  const chunks = (skill.effects || []).map((effect) => {
    if (effect.stat === "score_support") return `全員のスコアサポート効果${effect.value}%UP`;
    return `全員の${STAT_TO_JP[effect.stat] || "全パラメータ"}が${effect.value}%UP`;
  });
  return `${prefix ? `${prefix}で` : ""}${chunks.join("、")}`;
}

function specialRaw(skill) {
  if (!skill) return "";
  const chunks = [`${skill.duration}秒間スコアサポート効果${skill.score_support}%`];
  if (skill.skill_rate_up) chunks.push(`スキル発動率${skill.skill_rate_up}%UP`);
  return chunks.join(" ");
}

function activeRaw(skill) {
  const label = PROB_LABEL[skill.probability] || skill.probability;
  let raw = `${skill.interval}秒毎に${label}で${skill.duration}秒間スコアが${skill.score_up}%UP`;
  if (skill.condition && skill.conditional_score_up != null) {
    raw += ` ${describeCondition(skill.condition)}でスコアが${skill.conditional_score_up}%UP`;
  }
  return raw;
}

function d4cCard(sourceCard) {
  const p0 = sourceCard.potential_data.find((p) => p.potential === 0);
  const p4 = sourceCard.potential_data.find((p) => p.potential === 4) || sourceCard.potential_data.at(-1);
  if (!p0 || !p4) throw new Error(`Missing progression data: ${sourceCard.id}`);
  const active = p4.center_skill;
  const passiveEffects = supportEffects(p4.support_skill);
  const stats = p4.ref_stats_lv80;
  const probabilityLabel = PROB_LABEL[active.probability] || active.probability;
  const probability = Number(active.activation_probability_permil || 0) / 1000;
  return {
    id: `${sourceCard.character}_${sourceCard.rarity}_${sourceCard.card_name}`.replace(/[\\|/]/g, "_"),
    member: sourceCard.character,
    costumeName: sourceCard.card_name,
    rarity: sourceCard.rarity,
    type: TYPE_TO_D4C[sourceCard.type] || sourceCard.type,
    unit: sourceCard.group,
    stats: {
      performance: Number(stats.performance),
      technique: Number(stats.technique),
      sense: Number(stats.sense),
      total: Number(stats.performance) + Number(stats.technique) + Number(stats.sense),
    },
    special: {
      duration: Number(p4.special_skill?.duration || 0),
      scoreSupport: Number(p4.special_skill?.score_support || 0),
      skillRate: Number(p4.special_skill?.skill_rate_up || 0),
      skillRateCondition: null,
      raw: specialRaw(p4.special_skill),
    },
    active: {
      interval: Number(active.interval || 0),
      probability,
      probabilityLabel,
      duration: Number(active.duration || 0),
      scoreUp: Number(active.score_up || 0),
      bonus: active.condition && active.conditional_score_up != null
        ? {
            conditionText: describeCondition(active.condition),
            condition: conditionToD4c(active.condition),
            scoreUp: Number(active.conditional_score_up),
          }
        : null,
      raw: activeRaw(active),
    },
    passive: {
      condition: conditionToD4c(p4.support_skill?.condition),
      effects: passiveEffects,
      raw: passiveRaw(p4.support_skill),
      score: scorePassive(passiveEffects),
    },
  };
}

function d4cCostume(sourceCard) {
  const p4 = sourceCard.potential_data.find((p) => p.potential === 4) || sourceCard.potential_data.at(-1);
  const skill = p4?.costume_skill;
  const effects = costumeEffects(skill);
  return {
    id: `${sourceCard.character}_${sourceCard.card_name}`.replace(/[\\|/]/g, "_"),
    member: sourceCard.character,
    costumeName: sourceCard.card_name,
    skill: {
      condition: conditionToD4c(skill?.condition),
      effects,
      raw: costumeRaw(skill),
      score: scoreCostume(effects),
      unconditional: !skill?.condition,
    },
  };
}

function bloomEntry(sourceCard) {
  const p0 = sourceCard.potential_data.find((p) => p.potential === 0);
  const p1 = sourceCard.potential_data.find((p) => p.potential === 1) || p0;
  const p3 = sourceCard.potential_data.find((p) => p.potential === 3) || p1;
  const p4 = sourceCard.potential_data.find((p) => p.potential === 4) || p3;
  const out = {
    activeLow: p0.center_skill?.score_up ?? null,
    activeHigh: p1.center_skill?.score_up ?? null,
    activeBonusLow: p0.center_skill?.conditional_score_up ?? null,
    activeBonusHigh: p1.center_skill?.conditional_score_up ?? null,
    specialLow: p0.special_skill?.score_support ?? null,
    specialHigh: p3.special_skill?.score_support ?? null,
    specialSkillRateLow: p0.special_skill?.skill_rate_up ?? null,
    specialSkillRateHigh: p3.special_skill?.skill_rate_up ?? null,
    passiveLow: supportEffects(p0.support_skill),
    passiveHigh: supportEffects(p4.support_skill),
  };
  if (p0.center_skill?.interval !== p1.center_skill?.interval) {
    out.activeIntervalLow = p0.center_skill?.interval ?? null;
    out.activeIntervalHigh = p1.center_skill?.interval ?? null;
  }
  if (p0.center_skill?.duration !== p1.center_skill?.duration) {
    out.activeDurationLow = p0.center_skill?.duration ?? null;
    out.activeDurationHigh = p1.center_skill?.duration ?? null;
  }
  if (p0.special_skill?.duration !== p3.special_skill?.duration) {
    out.specialDurationLow = p0.special_skill?.duration ?? null;
    out.specialDurationHigh = p3.special_skill?.duration ?? null;
  }
  return out;
}

const source = await fetchJson(SOURCE);
const sourceCards = new Map((source.cards || []).map((card) => [card.id, card]));
const selected = TARGET_IDS.map((id) => {
  const card = sourceCards.get(id);
  if (!card) throw new Error(`Holodori source card not found: ${id}`);
  return card;
});

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const bloom = JSON.parse(fs.readFileSync(bloomPath, "utf8"));
let addedCards = 0;
let updatedCards = 0;
let addedCostumes = 0;
let updatedCostumes = 0;

for (const sourceCard of selected) {
  const card = d4cCard(sourceCard);
  const costume = d4cCostume(sourceCard);
  const cardIndex = data.cards.findIndex((item) => item.id === card.id);
  if (cardIndex >= 0) {
    data.cards[cardIndex] = card;
    updatedCards += 1;
  } else {
    data.cards.push(card);
    addedCards += 1;
  }
  const costumeIndex = data.costumes.findIndex((item) => item.id === costume.id);
  if (costumeIndex >= 0) {
    data.costumes[costumeIndex] = costume;
    updatedCostumes += 1;
  } else {
    data.costumes.push(costume);
    addedCostumes += 1;
  }
  bloom[card.id] = bloomEntry(sourceCard);
}

fs.writeFileSync(dataPath, JSON.stringify(data));
fs.writeFileSync(bloomPath, `${JSON.stringify(bloom, null, 2)}\n`);

let app = fs.readFileSync(appPath, "utf8");
app = app.replace(/const DATA_SNAPSHOT = "[^"]+";/, 'const DATA_SNAPSHOT = "2026-08-18";');
app = app.replace(/const RULES_REVIEWED = "[^"]+";/, 'const RULES_REVIEWED = "2026-08-19";');
fs.writeFileSync(appPath, app);

console.log(JSON.stringify({
  source: source.source,
  generated: source.generated,
  addedCards,
  updatedCards,
  addedCostumes,
  updatedCostumes,
  totalCards: data.cards.length,
  totalCostumes: data.costumes.length,
  cards: selected.map((card) => ({ id: card.id, character: card.character, name: card.card_name })),
}, null, 2));
