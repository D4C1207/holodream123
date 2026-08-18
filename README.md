# D4C

**作者：D4C**  
Hololive Dreams（ホロドリ）粉絲製作的非官方工具：角色一覽、編隊優化與現有隊員配對（中／英／日介面）。

## 參考基底與作者說明

本版本由 **D4C** 修改、整理並維護。

本專案參考並基於原作者 **108_虎太郎** 的公開專案 [holodreams123-afk/holodream](https://github.com/holodreams123-afk/holodream) 進行修改與擴充。原始專案的設計、資料整理與既有成果之貢獻歸原作者；此 Fork 的現行版本作者與維護者為 **D4C**。

> 本工具為粉絲製作的非官方工具，與 COVER／QualiArts 無關。遊戲角色、圖片與相關素材之權利歸各權利人所有。

## 公開網站

**https://d4c1207.github.io/holodream123/**

網站使用 GitHub Pages + GitHub Actions 部署，不需要開放本機連接埠。

## 目前功能

- 角色與卡面瀏覽
- 最強編隊計算
- 現有隊員編隊
- 多遊戲帳號背包記憶（各帳號分開保存）
- 已持有角色／卡片管理
- 只有 1 張 ★5／活動卡的角色會自動帶入該卡與對應衣裝
- 有多張卡面的角色，以「★5 持有卡面」勾選結果決定實際持有卡片與可用衣裝
- 不需另外重複勾選「持有衣裝」；配對按鈕會直接依目前勾選卡面判斷可用衣裝
- 背包 JSON 匯入／匯出
- 現有隊員模式自動挑選隊長、衣裝與五人編成
- 編隊限制（選填）：可複選「必上場成員」，也可指定一名隊長；兩欄留空即維持全自動。指定隊長只鎖定隊長／衣裝來源，如也要求本人上場，可同時加入必上場成員
- 帳號摘要儀表板：角色、持有卡、可用衣裝、收藏隊伍與最近一次最佳分數
- 「為什麼是這隊？」規則式解釋：比較 Unit Value、全曲平均 Score UP、Coverage、被動發動數與衣裝條件
- D4C 手動試算實驗室：用目前帳號倉庫自由指定隊長、衣裝與 #1～#5 卡面，即時顯示技能成立、Unit Value、P/T/S、SC、Coverage、Avg UP 與重複技能警告
- 結果新增 P／T／S 特化排序，方便尋找表演力、技巧或感性取向的候選隊伍
- 隊伍 A/B 比較：直接比較 PR、SC、Unit Value、Coverage、Avg UP 與被動
- 「如果我有這張卡呢？」抽卡試算：不修改背包，暫時加入未持有卡重新配隊，並用固定 SC 比較前後差異
- SC（非官方固定尺度估算）：依研究中的基本得分關係改為 `Unit Value × 期望 Active Score-Up 倍率 × 估計 Score-Support 倍率`；Active 高／中／低機率採社群實測約 55%／45%／35%，同曲長時可跨帳號比較
- PR 採「相對最高完成度」：Unit Value 50%、Active 33%（Avg UP 23% + Coverage 10%）、Special × Active 聯動 17%，各項以本次候選最高值為 100%，再將最高綜合完成度換算為 9999
- 隊伍收藏：所有遊戲帳號的收藏可在同一頁一次查看，並顯示帳號標籤
- 收藏隊伍可加入自訂用途標籤並依標籤篩選
- 一鍵完整備份／還原所有 `holodream-*` 瀏覽器資料，包含帳號、背包、收藏與 UI 設定
- ★5 開花（Bloom）0～5 可依帳號逐卡保存，並直接套用原作者 2026-08-14 資料表調整三圍、Active、Special 與 Passive；舊背包為維持既有結果首次轉換視為開花5，新卡預設0
- Active 改用機率期望模型：高／中／低約 55%／45%／35%，重疊時仍只取最強效果，Coverage 與 Avg UP 改為期望值
- 編隊結果的第 1～5 位代表遊戲內實際位置，遊戲中應依網站輸出的相同順序擺放
- Special Skill 發動順序建議：自動編隊會輸出 #1→#5 的實驗性順序，並把 Special 與五張卡的 Active 發動間隔、機率、持續時間、Score UP、已成立追加倍率一起評估；手動試算可一鍵套用或自行調整。已知 #1→#5 會對應每首歌固定的 5 個 Special 位置，但本工具尚未載入各歌曲的位置與音符密度，因此不把順序效果假裝成 SC／PR 的精確加成
- 頁尾顯示內建遊戲資料快照日期、卡片數與衣裝數
- D4C 外框版面重新設計；保留角色倉庫、★5 卡面挑選與結果排名／詳情等核心操作區
- 網站上方看板角色使用星街彗星（星街すいせい）
- 衣裝技能、被動技能、Score UP 與三圍比較
- 中文／English／日本語介面

## 評分說明

### PR

PR 是目前搜尋候選池的「相對最高完成度」，不採最低候選＝0 的 min-max。2026-08-15 起參考 Horodori 2026-08-08 評分更新中「Active 權重高於 Special（20:10）」的可用概念，但沒有照抄其卡片 Tier 公式。D4C 隊伍 PR 改為 **Unit Value 50%／Active 33%／Special 17%**：Active 33% 由本工具實際模擬的 **Avg UP 23% + Coverage 10%** 組成；Special 17% 則使用五張卡的 **Special × Active 聯動潛力**，會讀取 Active 的發動間隔、機率、持續時間、Score UP 與已成立追加倍率。各項都用本次最高參考值的連續比率計算，再將最高綜合完成度換算為 9999。

Horodori 的 Deck Builder 本身仍把 Active／Special／Score Support／Board／Connect 等列為 Unit Score 未算入項目；D4C 只借用其「Active 與 Special 分開評價」及相對權重思路。Board／Connect／Member Bonus 因本工具沒有每個玩家的實際育成狀態，暫不納入 PR／SC。

### Unit Value

Unit Value 是隊伍在衣裝與已成立被動增益後的 P／T／S 總和，也就是介面原本的「加成後三圍」。網站會另外顯示基礎值與增益差，讓玩家區分「卡片本身高」與「靠隊伍效果拉高」兩種來源。

### SC

SC 採固定公式，不使用本次候選池的最大／最小值：

```text
SC = Unit Value × (1 + 期望 Avg Score UP / 100) × (1 + 估計平均 Score Support / 100)
```

Active 的高／中／低機率依 hololive Dreams Lab 社群實測約 55%／45%／35% 計算；每個檢查點以機率期望值處理，重疊 Active 仍只取最強效果。Score Support 依已知得分乘法關係處理；因本工具尚未載入各歌曲五個 Special 固定觸發位置，Special Support 先按持續時間做全曲平均。SC 仍是非官方比較指標，不等同遊戲最終分數，也不包含玩家個別 Board、Memory、Connect、Member Enhancement 與實際譜面 Combo／判定。

## 本機開發

```bash
npm install
npm run dev
```

正式建置：

```bash
npm run build
```

## 編隊評價概念

- **PR**：看目前候選隊伍距離本次最佳完成度有多近，適合看同一次搜尋中的綜合排名。
- **Unit Value**：看 P／T／S 在衣裝與被動加成後的純隊伍數值。
- **SC**：加入 Score Support 與全曲 Avg UP 後的固定尺度估值，適合相同曲長假設下跨帳號／跨試算比較。
- **P／T／S 特化**：分別依加成後表演力、技巧、感性總和排序，方便找特定參數取向的隊伍。

## 資料與聲明

- D4C 版本：`D4C1207/holodream123`
- 參考基底：`holodreams123-afk/holodream`
- 原作者：108_虎太郎
- 本 Fork 作者／維護：D4C
- 卡牌與技能資料來自公開攻略整理，可能隨遊戲版本更新
- ★5 數值會依各帳號設定的實際開花 0～5 計算；未設定的新卡預設開花0，舊背包首次轉換則為維持既有結果視為開花5
- 本工具非官方，請勿將此專案誤認為遊戲官方服務

## 資料／機制同步紀錄（2026-08-18）

- 卡片、衣裝與 ★5 開花資料同步／核對原作者 `holodreams123-afk/holodream` 最新 2026-08-14 資料版本；原作者 8/15 另修正低開花技能文字。
- 得分與技能機制交叉核對 hololive Dreams Lab、Horodori、AppMedia、Gamerch、Game8：Total Power 與分數線性、Active 為機率觸發且重疊取最強、Special 依 #1→#5 對應歌曲固定位置、Skill Rate UP 為乘法提升等。
- Board、Memory、Connect 與 Member Enhancement 屬玩家個別育成狀態，目前不自動假設；未輸入的玩家專屬數值不會偷偷加進 SC／PR。
