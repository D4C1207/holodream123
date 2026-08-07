/** Hololive generation / unit display order for member pickers. */
export const UNIT_ORDER: string[] = [
  "0期生",
  "1期生",
  "2期生",
  "ゲーマーズ",
  "3期生",
  "4期生",
  "5期生",
  "holoX",
  "ID1期生",
  "ID2期生",
  "ID3期生",
  "Myth",
  "Promise",
  "Advent",
  "ReGLOSS",
];

/** Event categories sort before permanent gens. */
export function isEventCategory(label: string): boolean {
  return !UNIT_ORDER.includes(label) && label !== "その他";
}

export function categorySortKey(label: string): number {
  if (isEventCategory(label)) return -100;
  return unitSortKey(label);
}

/** Preferred debut order within each unit (when member exists). */
export const MEMBER_ORDER: string[] = [
  // 0期生
  "ときのそら",
  "ロボ子さん",
  "AZKi",
  "さくらみこ",
  "星街すいせい",
  // 1期生
  "夜空メル",
  "アキ・ローゼンタール",
  "赤井はあと",
  "白上フブキ",
  "夏色まつり",
  // 2期生
  "湊あくあ",
  "紫咲シオン",
  "百鬼あやめ",
  "癒月ちょこ",
  "大空スバル",
  // ゲーマーズ
  "大神ミオ",
  "猫又おかゆ",
  "戌神ころね",
  // 3期生
  "兎田ぺこら",
  "不知火フレア",
  "白銀ノエル",
  "宝鐘マリン",
  // 4期生
  "天音かなた",
  "角巻わため",
  "常闇トワ",
  "姫森ルーナ",
  // 5期生
  "雪花ラミィ",
  "桃鈴ねね",
  "獅白ぼたん",
  "尾丸ポルカ",
  // holoX
  "ラプラス・ダークネス",
  "鷹嶺ルイ",
  "博衣こより",
  "沙花叉クロヱ",
  "風真いろは",
  // ID1期生
  "アユンダ・リス",
  "ムーナ・ホシノヴァ",
  "アイラニ・イオフィフティーン",
  // ID2期生
  "クレイジー・オリー",
  "アーニャ・メルフィッサ",
  "パヴォリア・レイネ",
  // ID3期生
  "ベスティア・ゼータ",
  "カエラ・コヴァルスキア",
  "こぼ・かなえる",
  // EN
  "森カリオペ",
  "小鳥遊キアラ",
  "一伊那尓栖",
  "がうる・ぐら",
  "ワトソン・アメリア",
  "IRyS",
  "オーロ・クロニー",
  "ハコス・ベールズ",
  "シオリ・ノヴェラ",
  "古石ビジュー",
  "ネリッサ・レイヴンクロフト",
  "フワワ・アビスガード",
  "モココ・アビスガード",
  // ReGLOSS
  "音乃瀬奏",
  "一条莉々華",
  "儒烏風亭らでん",
  "轟はじめ",
];

export function primaryUnit(units: string[] | undefined, fallback = ""): string {
  if (!units?.length) return fallback || "その他";
  const cleaned = units.filter((u) => u && !u.includes(":"));
  let best = cleaned[0] ?? units[0];
  let bestIdx = Infinity;
  for (const u of cleaned) {
    const idx = UNIT_ORDER.indexOf(u);
    if (idx >= 0 && idx < bestIdx) {
      bestIdx = idx;
      best = u;
    }
  }
  return best;
}

export function unitSortKey(unit: string): number {
  const idx = UNIT_ORDER.indexOf(unit);
  return idx >= 0 ? idx : UNIT_ORDER.length + unit.localeCompare(unit, "ja");
}

export function memberSortKey(member: string): number {
  const idx = MEMBER_ORDER.indexOf(member);
  return idx >= 0 ? idx : MEMBER_ORDER.length + 1000;
}

export function compareMembersByGroup(
  a: string,
  b: string,
  unitsOf: (name: string) => string[] | undefined,
): number {
  const ua = primaryUnit(unitsOf(a));
  const ub = primaryUnit(unitsOf(b));
  const byUnit = unitSortKey(ua) - unitSortKey(ub);
  if (byUnit !== 0) return byUnit;
  const byMember = memberSortKey(a) - memberSortKey(b);
  if (byMember !== 0) return byMember;
  return a.localeCompare(b, "ja");
}

export function groupLabel(unit: string): string {
  return unit || "その他";
}
