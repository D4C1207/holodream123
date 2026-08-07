from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')

def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)

replace_once(
'''          <div className="hero-mascot">
            <Portrait member="常闇トワ" size="lg" className="hero-portrait" />
            <span className="hero-mascot-caption">常闇トワ</span>
          </div>
''',
'''          <div className="hero-mascot">
            <Portrait member="星街彗星" size="lg" className="hero-portrait" />
            <span className="hero-mascot-caption">星街すいせい</span>
          </div>
''',
'hero mascot',
)

replace_once(
'''          <p className="panel-note">{t.rosterNote}</p>
          {ownedRosterMembers.length < 5 && (
''',
'''          <p className="panel-note">{t.rosterNote}</p>
          <div className="roster-pr-context">
            <strong>PR · 帳號倉庫評分</strong>
            <span>
              {locale === "ja"
                ? "ここで表示するPRは、このゲームアカウントの所持カード・衣装から作れる候補編成の中で比較した相対評価です。別アカウントと比較する場合は、PRだけでなく総合パラメータ・カバー率・平均UPも確認してください。"
                : locale === "en"
                  ? "PR here is a relative score among teams that can be built from this game account's saved inventory. When comparing different accounts, also compare buffed stats, coverage, and average UP instead of PR alone."
                  : "這裡的 PR 是依目前這個遊戲帳號倉庫中實際持有的卡片與可用衣裝，對本次可組出的候選隊伍做相對評分。不同帳號互相比較時，請連同加成後三圍、覆蓋率與平均 UP 一起看，不要只看 PR。"}
            </span>
          </div>
          {ownedRosterMembers.length < 5 && (
''',
'roster PR context',
)

replace_once(
'''              <div className="team">
                {detailEv.cards.map((card, i) => {
''',
'''              <div className="team-order-note">
                <strong>{locale === "ja" ? "配置順" : locale === "en" ? "Lineup order" : "隊伍順序"}</strong>
                <span>
                  {locale === "ja"
                    ? "下の1〜5番はゲーム内でも同じ順番で配置してください。表示順は単なる一覧ではなく、実際の編成スロット順です。"
                    : locale === "en"
                      ? "Place members in the game in the same slot order shown below. Positions 1–5 are the actual lineup order, not just a display list."
                      : "下面顯示的第 1～5 位就是遊戲內實際的編成位置，請照輸出的順序放入；不是單純的名單排序。"}
                </span>
              </div>
              <div className="team">
                {detailEv.cards.map((card, i) => {
''',
'result lineup order note',
)

replace_once(
'''                      <div className="slot-pos">
                        {isLeader ? t.leader : t.memberN(i + 1)}
''',
'''                      <div className="slot-pos">
                        <span className="slot-order-text">#{i + 1} · {isLeader ? t.leader : t.memberN(i + 1)}</span>
''',
'result slot numbering',
)

replace_once(
'''                      {favorite.cardIds.map((cardId) => {
                        const card = cardById.get(cardId);
''',
'''                      {favorite.cardIds.map((cardId, index) => {
                        const card = cardById.get(cardId);
''',
'favorite map index',
)

replace_once(
'''                          <div key={cardId} className="favorite-member">
                            <CardArt cardId={card.id} alt={card.costumeName} />
''',
'''                          <div key={cardId} className="favorite-member">
                            <span className="favorite-slot-number">{index + 1}</span>
                            <CardArt cardId={card.id} alt={card.costumeName} />
''',
'favorite slot numbering',
)

path.write_text(text, encoding='utf-8')
print('Applied Suisei mascot, PR context, and lineup order guidance.')
