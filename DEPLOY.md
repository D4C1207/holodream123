# D4C 公開部署說明

本工具是**純前端靜態網頁**。訪客只會下載 HTML／JavaScript／CSS／圖片，主要計算在瀏覽器端完成，不需要把個人電腦或家用網路對外開放。

## 正式網站

D4C 版本使用 GitHub Pages：

**https://d4c1207.github.io/holodream123/**

Repository：`D4C1207/holodream123`

## GitHub Pages

本專案已附 `.github/workflows/deploy-pages.yml`。`main` 有新提交時會：

1. 安裝 Node.js 22
2. 執行 `npm ci`
3. 以 `VITE_BASE=/holodream123/` 建置
4. 上傳 `dist`
5. 部署到 GitHub Pages

GitHub → **Settings → Pages** 的 Build and deployment Source 應使用 **GitHub Actions**。

## 本機開發

```bash
npm install
npm run dev
```

開發伺服器僅供本機測試；不要為了分享網站而開路由器埠或把開發伺服器直接暴露到網際網路。

正式建置：

```bash
npm run build
```

## 作者與參考基底

- 本 Fork 作者／維護：**D4C**
- 參考原作者：**108_虎太郎**
- 參考基底：`holodreams123-afk/holodream`

本版本是在原公開專案基礎上進行修改與擴充，不將原作者的既有成果主張為 D4C 原創。

## 版權提醒

本工具為粉絲製作的非官方工具，與 COVER／QualiArts 無關；遊戲角色、圖片與相關素材之權利歸各權利人所有。
