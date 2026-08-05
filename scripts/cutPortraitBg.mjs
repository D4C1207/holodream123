/**
 * Make portrait backgrounds transparent via corner flood-fill.
 * Reads public/portraits/*.webp → public/portraits-cut/*.png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "public/portraits");
const outDir = path.join(root, "public/portraits-cut");
const mapPath = path.join(root, "src/data/portraits.json");
const cutMapPath = path.join(root, "src/data/portraitsCut.json");

fs.mkdirSync(outDir, { recursive: true });

const portraits = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const cutMap = {};

function colorDist(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function removeBg(rgba, width, height, threshold = 42) {
  const data = Buffer.from(rgba);
  const visited = new Uint8Array(width * height);
  const queue = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    visited[i] = 1;
    queue.push(i);
  };

  // Sample corner colors as background seeds
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];

  const seeds = corners.map(([x, y]) => {
    const o = (y * width + x) * 4;
    return [data[o], data[o + 1], data[o + 2]];
  });

  for (const [x, y] of corners) push(x, y);

  // Also seed near-uniform edge pixels matching any corner
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const o = (y * width + x) * 4;
      const c = [data[o], data[o + 1], data[o + 2]];
      if (seeds.some((s) => colorDist(s, c) <= threshold)) push(x, y);
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const o = (y * width + x) * 4;
      const c = [data[o], data[o + 1], data[o + 2]];
      if (seeds.some((s) => colorDist(s, c) <= threshold)) push(x, y);
    }
  }

  while (queue.length) {
    const i = queue.pop();
    const o = i * 4;
    const c = [data[o], data[o + 1], data[o + 2]];
    if (!seeds.some((s) => colorDist(s, c) <= threshold)) continue;
    data[o + 3] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // Soften fringe: lower alpha for near-bg pixels adjacent to transparent
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const o = i * 4;
      if (data[o + 3] === 0) continue;
      const c = [data[o], data[o + 1], data[o + 2]];
      if (!seeds.some((s) => colorDist(s, c) <= threshold + 18)) continue;
      let nearClear = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (data[((y + dy) * width + (x + dx)) * 4 + 3] === 0) nearClear = true;
      }
      if (nearClear) data[o + 3] = Math.min(data[o + 3], 90);
    }
  }

  return data;
}

let n = 0;
for (const [member, rel] of Object.entries(portraits)) {
  const src = path.join(root, "public", rel.replace(/^\//, ""));
  if (!fs.existsSync(src)) continue;
  const safe = member.replace(/[\\/:*?"<>|]/g, "_");
  const outFile = `${safe}.png`;
  const dest = path.join(outDir, outFile);

  try {
    const { data: rgba, info } = await sharp(src)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cut = removeBg(rgba, info.width, info.height);
    await sharp(cut, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toFile(dest);
    cutMap[member] = `/portraits-cut/${outFile}`;
    n += 1;
    process.stdout.write(".");
  } catch (err) {
    console.error("\nfail", member, err.message);
  }
}

fs.writeFileSync(cutMapPath, JSON.stringify(cutMap, null, 2), "utf8");
console.log(`\ndone ${n} cutouts → ${cutMapPath}`);
