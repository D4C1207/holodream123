# 公開部署說明（資安安全版）

本工具是**純前端靜態網頁**：沒有後端、沒有資料庫、沒有登入。  
訪客瀏覽器只會下載 HTML／JS／圖片，**計算全部在對方電腦完成**，不會連到你家的電腦。

## 為什麼這樣比較安全？

| 做法 | 風險 |
| --- | --- |
| 在家用 `npm run dev -- --host` 或開路由器埠給別人用 | 高：外人可能掃到你的電腦／區網 |
| 把網站丟到 **GitHub Pages／Cloudflare Pages／Netlify** | 低：流量打在雲端 CDN，你家電腦離線也沒差 |

**請不要**為了分享而：

- 對路由器做埠轉發（port forward）
- 用 `ngrok`／內網穿透把本機 `5173` 公開
- 在 Vite 設 `host: true` 再對外分享 IP

本專案的 `vite.config.ts` 已把開發伺服器鎖在 `127.0.0.1`（僅本機）。

## 網站上別人能看到什麼？

- 公開的卡牌資料、圖片、介面程式碼（這是前端本來就會下載的）
- **看不到**你的電腦檔案、區網、Windows 帳號、本機路徑
- 使用者勾選／語系存在**他們自己瀏覽器**的 `localStorage`，不到你的伺服器（因為根本沒有伺服器）

## 推薦：GitHub Pages（免費）

1. 到 [GitHub](https://github.com) 註冊／登入，新建一個 **Public** repository（例如 `holodream`）。
2. 在本機專案資料夾執行：

```bash
git init
git add .
git commit -m "Publish Hololive Dreams tools as static site"
git branch -M main
git remote add origin https://github.com/holodreams123-afk/holodream.git
git push -u origin main
```

3. GitHub → **Settings → Pages** → Build and deployment 選 **GitHub Actions**。
4. 等 Actions 跑完，網址會類似：

`https://holodreams123-afk.github.io/holodream/`

之後只要 `git push`，網站會自動更新。

> 若 repository 名稱不是 `holodream`，workflow 會用 repo 名稱當路徑，無需改設定。

## 更推薦：Cloudflare Pages（免費＋防攻擊較強）

1. 先把專案推到 GitHub（同上）。
2. 到 [Cloudflare Pages](https://pages.cloudflare.com/) → Create project → 連接 GitHub repo。
3. 建置設定：

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **環境變數:** 不要設 `VITE_BASE`（預設 `/`）

4. 完成後會得到 `https://xxxx.pages.dev`，也可綁自己的網域。  
Cloudflare 會擋大量惡意掃描／DDoS，流量不會進你家。

## 一次性上傳（不想用 Git）

1. 本機執行：`npm run build`
2. 把 `dist` 資料夾整個拖到 [Netlify Drop](https://app.netlify.com/drop) 或 Cloudflare Pages「Direct Upload」  
即可得到公開網址。之後更新要再上傳一次。

## 版權提醒

本工具為粉絲製作的非官方小工具，卡圖／角色為 COVER／QualiArts 等權利方所有。  
公開分享時請標明非官方、勿用於商業用途。
