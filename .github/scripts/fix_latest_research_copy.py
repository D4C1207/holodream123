from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

replacements = {
'''          prNote: "PRは絶対戦力ではありません。Unit Value 50%・全曲平均UP 30%・Coverage 20%を、それぞれ今回候補の最高値に対する比率で評価し、総合トップを9999に換算します。最下位を0にするmin-max方式は使用しません。",''':
'''          prNote: "PRは絶対戦力ではありません。Unit Value 50%・Active 33%（期待Avg UP 23%＋期待Coverage 10%）・Special 17%を、それぞれ今回候補の最高値に対する比率で評価し、総合トップを9999に換算します。Activeは期待発動率を使用します。",''',
'''            prNote: "PR is not an absolute power value. Unit Value 50%, full-song Avg UP 30%, and Coverage 20% are scored as ratios to the best value in the current candidate search, then the best weighted completion is scaled to 9999. The weakest candidate is no longer forced to zero by min-max normalization.",''':
'''            prNote: "PR is not an absolute power value. Unit Value 50%, Active 33% (expected Avg UP 23% + expected Coverage 10%), and Special 17% are scored as ratios to the best values in the current candidate search; the best weighted completion is scaled to 9999. Active uses expected activation rates.",''',
'''            prNote: "PR 不是跨帳號的絕對戰力。Unit Value 50%、全曲平均 UP 30%、Coverage 20% 都改用「本次候選最高值＝100%」的比率計分，再把最高綜合完成度換算成 9999；不再用最低候選硬歸零的 min-max。",''':
'''            prNote: "PR 不是跨帳號的絕對戰力。Unit Value 50%、Active 33%（期望 Avg UP 23%＋期望 Coverage 10%）、Special 17% 都以本次候選最高值＝100% 做比率評分，再把綜合第一換算為 9999；Active 使用期望發動率。",''',
'''                    ? "Special は1ライブ中に1回、編成順で発動する仕様に合わせた順序提案です。正確な発動時点と公式スコア式は未公開のため、この順序効果はまだ PR／SC に加算していません。"''':
'''                    ? "Special は1ライブ中に1回、#1→#5 が各楽曲の固定5地点に対応します。D4C はまだ楽曲ごとの5地点とノーツ密度を読み込んでいないため、順序効果は実験的提案として扱い、PR／SC に正確値として加算していません。"''',
'''                      ? "This follows the confirmed one-Special-per-live, formation-order sequence. Exact trigger timing and the official score formula are not public, so order effects are not yet added to PR/SC."''':
'''                      ? "Each Special activates once, with slots #1→#5 mapped to five fixed trigger points in each song. D4C does not yet load those song-specific points or note density, so order effects remain an experimental recommendation rather than an exact PR/SC contribution."''',
'''                      : "這個建議依據「Special 每場一次、按編成順序發動」的規則。由於精確觸發時點與官方分數公式尚未公開，順序效果目前不會硬加進 PR／SC。"''':
'''                      : "每個 Special 每場發動一次，#1→#5 會對應每首歌固定的 5 個觸發位置。D4C 目前還沒有載入各歌曲的 5 個位置與音符密度，因此順序效果仍標示為實驗性建議，不會假裝成 PR／SC 的精確加成。"''',
}

for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected 1 match, got {count}: {old[:80]}')
    text = text.replace(old, new, 1)

path.write_text(text)
print('latest research copy fixed')
