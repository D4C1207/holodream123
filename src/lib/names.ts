/** Traditional Chinese (JP members) and English (EN/ID) display aliases. */

export const ZH_NAME: Record<string, string> = {
  ときのそら: "時乃空",
  ロボ子さん: "蘿蔔子",
  AZKi: "AZKi",
  さくらみこ: "櫻巫女",
  星街すいせい: "星街彗星",
  夜空メル: "夜空梅露",
  アキ・ローゼンタール: "亞綺・羅森塔爾",
  赤井はあと: "赤井心",
  白上フブキ: "白上吹雪",
  夏色まつり: "夏色祭",
  湊あくあ: "湊阿庫婭",
  紫咲シオン: "紫咲詩音",
  百鬼あやめ: "百鬼綾目",
  癒月ちょこ: "癒月巧可",
  大空スバル: "大空昴",
  大神ミオ: "大神澪",
  猫又おかゆ: "貓又小粥",
  戌神ころね: "戌神沁音",
  兎田ぺこら: "兔田佩克拉",
  不知火フレア: "不知火芙蕾雅",
  白銀ノエル: "白銀諾埃爾",
  宝鐘マリン: "寶鐘瑪琳",
  天音かなた: "天音彼方",
  角巻わため: "角卷綿芽",
  常闇トワ: "常闇永遠",
  姫森ルーナ: "姬森璐娜",
  雪花ラミィ: "雪花菈米",
  桃鈴ねね: "桃鈴音音",
  獅白ぼたん: "獅白牡丹",
  尾丸ポルカ: "尾丸波爾卡",
  ラプラス・ダークネス: "拉普拉斯・暗黑",
  鷹嶺ルイ: "鷹嶺琉衣",
  博衣こより: "博衣小夜璃",
  沙花叉クロヱ: "沙花叉克蘿葉",
  風真いろは: "風真伊呂波",
  音乃瀬奏: "音乃瀨奏",
  一条莉々華: "一條莉々華",
  儒烏風亭らでん: "儒烏風亭紫蘭",
  轟はじめ: "轟始",
};

/** English names for overseas members (EN / ID). Shown instead of Chinese. */
export const EN_NAME: Record<string, string> = {
  アユンダ・リス: "Ayunda Risu",
  ムーナ・ホシノヴァ: "Moona Hoshinova",
  アイラニ・イオフィフティーン: "Airani Iofifteen",
  クレイジー・オリー: "Kureiji Ollie",
  アーニャ・メルフィッサ: "Anya Melfissa",
  パヴォリア・レイネ: "Pavolia Reine",
  ベスティア・ゼータ: "Vestia Zeta",
  カエラ・コヴァルスキア: "Kaela Kovalskia",
  こぼ・かなえる: "Kobo Kanaeru",
  森カリオペ: "Mori Calliope",
  小鳥遊キアラ: "Takanashi Kiara",
  一伊那尓栖: "Ninomae Ina'nis",
  がうる・ぐら: "Gawr Gura",
  ワトソン・アメリア: "Watson Amelia",
  IRyS: "IRyS",
  オーロ・クロニー: "Ouro Kronii",
  ハコス・ベールズ: "Hakos Baelz",
  シオリ・ノヴェラ: "Shiori Novella",
  古石ビジュー: "Koseki Bijou",
  ネリッサ・レイヴンクロフト: "Nerissa Ravencroft",
  フワワ・アビスガード: "Fuwawa Abyssgard",
  モココ・アビスガード: "Mococo Abyssgard",
};

const OVERSEAS_UNITS = new Set([
  "ID1期生",
  "ID2期生",
  "ID3期生",
  "Myth",
  "Promise",
  "Advent",
]);

export function isOverseasMember(units: string[] | undefined): boolean {
  return (units ?? []).some((u) => OVERSEAS_UNITS.has(u));
}

/** Top line + bottom line for stacked name display. */
export function nameParts(
  jp: string,
  units?: string[],
  locale: "zh" | "en" | "ja" = "zh",
): { primary: string; secondary: string | null } {
  const overseas = isOverseasMember(units) || !!EN_NAME[jp];
  const en = EN_NAME[jp];
  const zh = ZH_NAME[jp];

  if (locale === "ja") {
    if (overseas && en && en !== jp) return { primary: jp, secondary: en };
    return { primary: jp, secondary: null };
  }

  if (locale === "en") {
    if (en && en !== jp) return { primary: en, secondary: jp };
    return { primary: jp, secondary: null };
  }

  // zh (default)
  if (overseas && en) {
    if (en !== jp) return { primary: en, secondary: jp };
    return { primary: jp, secondary: null };
  }
  if (zh && zh !== jp) return { primary: zh, secondary: jp };
  return { primary: jp, secondary: null };
}

export function displayName(
  jp: string,
  units?: string[],
  locale: "zh" | "en" | "ja" = "zh",
): string {
  const { primary, secondary } = nameParts(jp, units, locale);
  return secondary ? `${primary} / ${secondary}` : primary;
}

/** Ranking / compact lists. */
export function listName(
  jp: string,
  units?: string[],
  locale: "zh" | "en" | "ja" = "zh",
): string {
  if (locale === "en") {
    return EN_NAME[jp] ?? jp;
  }
  if (isOverseasMember(units) || EN_NAME[jp]) {
    return locale === "ja" ? jp : (EN_NAME[jp] ?? jp);
  }
  return jp;
}

export function matchesQuery(jp: string, query: string, units?: string[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const zh = ZH_NAME[jp]?.toLowerCase() ?? "";
  const en = EN_NAME[jp]?.toLowerCase() ?? "";
  return (
    jp.toLowerCase().includes(q) ||
    zh.includes(q) ||
    en.includes(q) ||
    displayName(jp, units).toLowerCase().includes(q)
  );
}
