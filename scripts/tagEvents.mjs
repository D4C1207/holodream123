/**
 * Tag swimsuit / event cards with current event name for UI grouping.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "../src/data/gameData.json");

/** Current live event name used as an extra card category. */
export const CURRENT_EVENT = "シンクロする夏のスパークル";

const EVENT_CARD_NAMES = new Set([
  "ビーチで弾ける、光彩ショット！",
  "夏に一閃！水鉄砲のアルペジオ",
]);

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
let n = 0;
for (const card of data.cards) {
  if (EVENT_CARD_NAMES.has(card.costumeName)) {
    card.event = CURRENT_EVENT;
    n += 1;
  } else if (card.event) {
    delete card.event;
  }
}

data.currentEvent = CURRENT_EVENT;
fs.writeFileSync(dataPath, JSON.stringify(data));
console.log({ tagged: n, currentEvent: CURRENT_EVENT });
