/**
 * Retry download for cards still missing from cardImages.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "src/data/gameData.json"), "utf8"));
const mapPath = path.join(root, "src/data/cardImages.json");
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const outDir = path.join(root, "public/cards");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; holodream-optimizer/1.0)" };

const NAME_FIX = {
  一伊那爾栖: "一伊那尓栖",
  ネリッサ・レイヴングロフト: "ネリッサ・レイヴンクロフト",
};

function norm(s) {
  return String(s)
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[！!？?♡♥'’]/g, "")
    .replace(/と/g, "")
    .toLowerCase();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function download(url, dest) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const indexHtml = await fetchText("https://hololivedreams.gamedbs.jp/");
const chars = new Map(
  [
    ...indexHtml.matchAll(
      /href="https:\/\/hololivedreams\.gamedbs\.jp\/chara\/show\/(\d+)"[^>]*>[\s\S]*?<br>([^<]+)</g,
    ),
  ].map((m) => [NAME_FIX[m[2].trim()] ?? m[2].trim(), m[1]]),
);

const missing = data.cards.filter((c) => !map[c.id]);
console.log("missing", missing.length);

for (const card of missing) {
  const charId = chars.get(card.member);
  if (!charId) {
    console.log("no char id", card.member);
    continue;
  }
  const html = await fetchText(`https://hololivedreams.gamedbs.jp/chara/show/${charId}`);
  const listings = [
    ...html.matchAll(
      /href="(https:\/\/hololivedreams\.gamedbs\.jp\/chara\/show\/\d+\/c\d+)"[^>]*>[\s\S]*?data-src="([^"]+)"[\s\S]*?<br>\s*([^<]+)/gi,
    ),
  ].map((m) => ({
    page: m[1],
    ico: m[2].replace(/\/\/+/g, "/").replace("https:/", "https://"),
    title: m[3].trim(),
  }));

  console.log("\n", card.member, card.costumeName);
  console.log(
    "  gallery titles:",
    listings.map((l) => l.title).join(" || "),
  );

  const target = norm(card.costumeName);
  let best = null;
  let bestScore = -1;
  for (const L of listings) {
    const t = norm(L.title.replace(card.member, ""));
    let sc = 0;
    if (t === target) sc = 100;
    else if (t.includes(target) || target.includes(t)) sc = 80;
    else {
      // longest common substring length
      for (let len = Math.min(t.length, target.length); len >= 4; len--) {
        for (let i = 0; i <= target.length - len; i++) {
          if (t.includes(target.slice(i, i + len))) {
            sc = len;
            break;
          }
        }
        if (sc) break;
      }
    }
    if (sc > bestScore) {
      bestScore = sc;
      best = L;
    }
  }

  // fallback: same rarity heuristic — pick first unmatched ★? We don't know rarity on page.
  if (!best || bestScore < 4) {
    console.log("  no match, score", bestScore);
    continue;
  }
  console.log("  matched", best.title, "score", bestScore);

  let artUrl = best.ico;
  try {
    const pageHtml = await fetchText(best.page);
    const m = pageHtml.match(
      /https:\/\/hololivedreams\.gamedbs\.jp\/image\/card\/img\/+[^"'\\\s>]+\.webp/i,
    );
    if (m) artUrl = m[0].replace(/\/\/+/g, "/").replace("https:/", "https://");
  } catch {
    /* keep ico */
  }

  const safeId = card.id.replace(/[\\/:*?"<>|]/g, "_");
  const file = `${safeId}.webp`;
  const dest = path.join(outDir, file);
  await download(artUrl, dest);
  map[card.id] = `/cards/${file}`;
  console.log("  saved", file);
}

fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), "utf8");
console.log("\nstill missing", data.cards.filter((c) => !map[c.id]).length);
