/**
 * Merge Performance/Technique/Sense from Excel ★5 sheet into gameData cards.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const xlsxPath = path.join(root, "hololive_Dreams_.xlsx");
const dataPath = path.join(root, "src/data/gameData.json");

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

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const wb = XLSX.readFile(xlsxPath);
const sheet = wb.Sheets[wb.SheetNames.find((n) => n.includes("5")) ?? wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

function resolveMember(nameCell) {
  const s = String(nameCell).trim();
  const parts = s.includes(" / ") ? s.split(" / ").map((x) => x.trim()) : [s, s];
  for (const p of parts) {
    if (data.members[p]) return p;
    if (EN_TO_JP[p]) return EN_TO_JP[p];
  }
  return parts.find((p) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(p)) || parts[0];
}

let updated = 0;
for (const row of rows) {
  const member = resolveMember(row["角色名稱"]);
  const cardName = String(row["卡片名稱"] || "").trim();
  if (!member || !cardName) continue;
  const perf = +row["Performance"] || 0;
  const tech = +row["Technique"] || 0;
  const sense = +row["Sense"] || 0;
  const total = +row["總分"] || perf + tech + sense;
  const card = data.cards.find((c) => c.member === member && c.costumeName === cardName);
  if (!card) continue;
  card.stats = { performance: perf, technique: tech, sense, total };
  updated += 1;
}

fs.writeFileSync(dataPath, JSON.stringify(data));
console.log({ updated, withStats: data.cards.filter((c) => c.stats).length });
