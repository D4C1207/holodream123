import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const map = JSON.parse(fs.readFileSync(path.join(root, "src/data/cardImages.json"), "utf8"));
const portraits = JSON.parse(fs.readFileSync(path.join(root, "src/data/portraits.json"), "utf8"));
const cut = JSON.parse(fs.readFileSync(path.join(root, "src/data/portraitsCut.json"), "utf8"));

function check(label, entries) {
  const missing = [];
  for (const [, p] of Object.entries(entries)) {
    const rel = p.replace(/^\//, "");
    if (!fs.existsSync(path.join(root, "public", rel))) missing.push(p);
  }
  console.log(`${label}: ${missing.length} missing`);
  missing.slice(0, 15).forEach((p) => console.log(" ", p));
  return missing;
}

check("cards", map);
check("portraits", portraits);
check("portraits-cut", cut);
