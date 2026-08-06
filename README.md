# Hololive Dreams 小工具

製作者：**108_虎太郎**  
粉絲製作的非官方工具：角色一覽、最強編隊優化（中／英／日介面）。

## 給大家用（公開網站）

**https://holodreams123.github.io/holodream/**

**請用雲端靜態託管，不要把你家電腦的埠開出去。**  
步驟與資安說明見 → [DEPLOY.md](./DEPLOY.md)

簡短版：

1. 推到 GitHub（Public repo）
2. 開 GitHub Pages（已附 Actions）或連到 Cloudflare Pages
3. 把網址分享給朋友即可

訪客只會連到 GitHub／Cloudflare，**連不到你的電腦**。

## 本機開發

```bash
npm install
npm run dev
```

開發伺服器只聽 `127.0.0.1`（本機），不會自動對外開放。

## 配對優先順序（最強編隊）

1. 隊長衣裝技能條件
2. 被動技能全部滿足
3. 有效 Score UP／覆蓋率（預設曲長 160 秒）
4. 加成後三圍

## 注意

- 卡牌／技能資料整理自公開攻略，可能隨版本更新
- 數值顯示為滿綻放・滿等
- 本工具非官方，與 COVER／QualiArts 無關
