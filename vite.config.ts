import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages 專案網址需設 base，例如 /holodream/；Cloudflare / Netlify 用 / 即可 */
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    // 產出靜態檔，可丟到任何 CDN／靜態主機，無需自架伺服器
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    // 本機開發預設只綁 localhost，不要對外開放埠
    host: "127.0.0.1",
    strictPort: false,
  },
  preview: {
    host: "127.0.0.1",
  },
});
