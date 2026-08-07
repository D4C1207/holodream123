/**
 * Download card arts from Gamerch when gamedbs.jp hasn't indexed them yet.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public/cards");
const mapPath = path.join(root, "src/data/cardImages.json");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; holodream-optimizer/1.0)" };

const GAMERCH = {
  "さくらみこ_5_ビーチで弾ける、光彩ショット！": "https://gamerch.com/hololive-dreams/1003372",
  "星街すいせい_5_夏に一閃！水鉄砲のアルペジオ": "https://gamerch.com/hololive-dreams/1003377",
  "アユンダ・リス_5_いたずらたくらむ木漏れ日の森": "https://gamerch.com/hololive-dreams/999418",
};

async function fetchIllustUrl(pageUrl) {
  const html = await (await fetch(pageUrl, { headers: UA })).text();
  const idx = html.indexOf("## イラスト");
  const section = idx >= 0 ? html.slice(idx, idx + 4000) : html;
  const m = section.match(/https:\/\/cdn\.gamerch\.com\/contents\/wiki\/6026\/entry\/[^"'\s>]+\.(?:png|jpg|webp)/i);
  if (!m) throw new Error(`no illust on ${pageUrl}`);
  return m[0];
}

fs.mkdirSync(outDir, { recursive: true });
const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : {};

for (const [cardId, pageUrl] of Object.entries(GAMERCH)) {
  const safeId = cardId.replace(/[\\/:*?"<>|']/g, "_");
  const file = `${safeId}.webp`;
  const dest = path.join(outDir, file);
  if (map[cardId] && fs.existsSync(dest)) {
    console.log("skip", cardId);
    continue;
  }
  const imgUrl = await fetchIllustUrl(pageUrl);
  const buf = Buffer.from(await (await fetch(imgUrl, { headers: UA })).arrayBuffer());
  await sharp(buf).webp({ quality: 90 }).toFile(dest);
  map[cardId] = `/cards/${file}`;
  console.log("saved", cardId, "<-", imgUrl);
}

fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), "utf8");
