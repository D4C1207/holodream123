/**
 * Download card face arts from hololivedreams.gamedbs.jp
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataPath = path.join(root, "src/data/gameData.json");
const outDir = path.join(root, "public/cards");
const mapPath = path.join(root, "src/data/cardImages.json");

const NAME_FIX = {
  一伊那爾栖: "一伊那尓栖",
  ネリッサ・レイヴングロフト: "ネリッサ・レイヴンクロフト",
};

const UA = { "User-Agent": "Mozilla/5.0 (compatible; holodream-optimizer/1.0)" };

fs.mkdirSync(outDir, { recursive: true });
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : {};

function norm(s) {
  return String(s)
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[！!？?♡♥]/g, "")
    .replace(/と/g, "")
    .toLowerCase();
}

function stripMemberSuffix(title, member) {
  let t = title.trim();
  if (member && t.endsWith(member)) t = t.slice(0, -member.length).trim();
  return t;
}

function scoreTitle(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  // token overlap
  let hit = 0;
  for (let i = 0; i < nb.length - 2; i++) {
    if (na.includes(nb.slice(i, i + 3))) hit += 1;
  }
  return hit;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function download(url, dest) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const indexHtml = await fetchText("https://hololivedreams.gamedbs.jp/");
const chars = [
  ...indexHtml.matchAll(
    /href="https:\/\/hololivedreams\.gamedbs\.jp\/chara\/show\/(\d+)"[^>]*>[\s\S]*?<br>([^<]+)</g,
  ),
].map((m) => ({
  id: m[1],
  name: NAME_FIX[m[2].trim()] ?? m[2].trim(),
}));

console.log("characters", chars.length);

let matched = 0;
let downloaded = 0;

for (const ch of chars) {
  const memberUrl = `https://hololivedreams.gamedbs.jp/chara/show/${ch.id}`;
  let html;
  try {
    html = await fetchText(memberUrl);
  } catch (e) {
    console.error("member fail", ch.name, e.message);
    continue;
  }

  const listings = [
    ...html.matchAll(
      /href="(https:\/\/hololivedreams\.gamedbs\.jp\/chara\/show\/\d+\/c\d+)"[^>]*>[\s\S]*?data-src="([^"]+)"[\s\S]*?<br>\s*([^<]+)/gi,
    ),
  ].map((m) => ({
    page: m[1],
    ico: m[2].replace(/\/\/+/g, "/").replace("https:/", "https://"),
    title: stripMemberSuffix(m[3], ch.name),
  }));

  // Deduplicate by page
  const byPage = new Map();
  for (const L of listings) if (!byPage.has(L.page)) byPage.set(L.page, L);
  const list = [...byPage.values()];

  const memberCards = data.cards.filter((c) => c.member === ch.name);
  for (const card of memberCards) {
    if (map[card.id] && fs.existsSync(path.join(root, "public", map[card.id].replace(/^\//, "")))) {
      matched += 1;
      continue;
    }

    let best = null;
    let bestScore = 0;
    for (const L of list) {
      const sc = scoreTitle(card.costumeName, L.title);
      if (sc > bestScore) {
        bestScore = sc;
        best = L;
      }
    }
    if (!best || bestScore < 40) continue;

    let artUrl = null;
    try {
      const pageHtml = await fetchText(best.page);
      const m = pageHtml.match(
        /https:\/\/hololivedreams\.gamedbs\.jp\/image\/card\/img\/+[^"'\\\s>]+\.webp/i,
      );
      if (m) artUrl = m[0].replace(/\/\/+/g, "/").replace("https:/", "https://");
    } catch {
      /* ignore */
    }
    if (!artUrl) {
      // fallback to icon (still a card face thumbnail)
      artUrl = best.ico;
    }

    const safeId = card.id.replace(/[\\/:*?"<>|']/g, "_");
    const file = `${safeId}.webp`;
    const dest = path.join(outDir, file);
    try {
      if (!fs.existsSync(dest)) {
        await download(artUrl, dest);
        downloaded += 1;
      }
      map[card.id] = `/cards/${file}`;
      matched += 1;
      process.stdout.write(".");
    } catch (err) {
      console.error("\nfail", card.id, err.message);
    }
  }
}

fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), "utf8");
const missing = data.cards.filter((c) => !map[c.id]);
console.log(`\nmatched ${matched}/${data.cards.length}, downloaded ${downloaded}, missing ${missing.length}`);
if (missing.length) {
  console.log(missing.slice(0, 25).map((c) => `${c.member}|${c.costumeName}`).join("\n"));
}
