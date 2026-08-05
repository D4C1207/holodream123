/**
 * Download member portrait icons from hololivedreams.gamedbs.jp
 * into public/portraits/ and write src/data/portraits.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public/portraits");
const mapPath = path.join(root, "src/data/portraits.json");

const NAME_FIX = {
  一伊那爾栖: "一伊那尓栖",
  ネリッサ・レイヴングロフト: "ネリッサ・レイヴンクロフト",
};

fs.mkdirSync(outDir, { recursive: true });

const html = await (
  await fetch("https://hololivedreams.gamedbs.jp/", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; holodream-optimizer/1.0)" },
  })
).text();

const re =
  /<a href="https:\/\/hololivedreams\.gamedbs\.jp\/chara\/show\/(\d+)"><img data-src="([^"]+)"[^>]*>\s*<br>([^<]+)<\/a>/g;
const entries = [];
for (const m of html.matchAll(re)) {
  let name = m[3].trim();
  name = NAME_FIX[name] ?? name;
  entries.push({ id: m[1], name, url: m[2] });
}

console.log("found", entries.length, "portraits");

const map = {};
let ok = 0;
for (const e of entries) {
  const safe = e.name.replace(/[\\/:*?"<>|]/g, "_");
  const file = `${safe}.webp`;
  const dest = path.join(outDir, file);
  try {
    if (!fs.existsSync(dest)) {
      const res = await fetch(e.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; holodream-optimizer/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
    }
    map[e.name] = `/portraits/${file}`;
    ok += 1;
    process.stdout.write(".");
  } catch (err) {
    console.error("\nfail", e.name, err.message);
  }
}

fs.writeFileSync(mapPath, JSON.stringify(map, null, 2), "utf8");
console.log(`\ndone ${ok}/${entries.length} → ${mapPath}`);
