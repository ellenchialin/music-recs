# Music Recs

輸入喜歡的歌手 → 推薦歌曲（試聽＋理由）→ 回饋重新排序 → 盲聽測驗量推薦好不好。規格見 `SPEC.md`，已拍板的決策見 `docs/ai-log.md`（規格與決策衝突時以決策為準）。

## 技術棧

Nuxt 4（Vue 3）+ TypeScript strict、Pinia、Tailwind、VueUse、Postgres 17（本機 Docker）+ Drizzle ORM、zod、Vitest + `@nuxt/test-utils`、Playwright、pnpm、Node 24 LTS。部署 Vercel + Neon。

## 指令

先 `nvm use`（Node 24；Homebrew 的 Node 25 Nuxt 不支援）。

| 指令 | 用途 |
|---|---|
| `pnpm dev` | 開發伺服器 http://localhost:3000 |
| `pnpm test` / `pnpm test:watch` | Vitest 全部：`unit`（`server/`、`shared/` 的純函式）、`db`（`*.db.test.ts`，連 `music_test`，需先 `pnpm db:up`）、`nuxt`（`app/` 的元件，happy-dom） |
| `pnpm test:unit` / `pnpm test:db` | 只跑其中一個 project |
| `pnpm typecheck` | `nuxt typecheck`（vue-tsc） |
| `pnpm lint` | ESLint（`@nuxt/eslint`） |
| `pnpm db:up` / `pnpm db:down` | 本機 Postgres 17（Docker，port 5434；開發 DB `music`、測試 DB `music_test`） |
| `pnpm db:generate` / `pnpm db:migrate` | drizzle-kit 產生／套用 migration（schema 在 `server/db/schema.ts`） |
| `pnpm db:studio` | Drizzle Studio，看資料表 |
| `pnpm db:sandbox` | 進 `music_test` 的 psql |
| `pnpm record:lastfm` | 打真的 Last.fm API，重錄 `server/lastfm/fixtures/`（需要 `.env` 的 `LASTFM_API_KEY`；測試不需要） |
| `pnpm record:itunes` | 打真的 iTunes Search API，重錄 `server/itunes/fixtures/`（不需要 key） |

CI（`.github/workflows/ci.yml`）跑 typecheck → lint → test。

## 慣例

- **TDD**：先寫會失敗的測試 → 寫最少的程式讓它通過 → 重構。每個功能先有測試才有實作
- 推薦演算法、排序、評分統計都寫成純函式，放 `server/utils/`，測試放在被測檔案旁（`*.test.ts`）
- 外部 API（Last.fm、iTunes）和 LLM 的回應一律用 zod 驗證；測試用錄好的 fixture，不打真的 API
- 環境變數經 zod schema 讀取，不直接讀 `process.env`
- **UI 主題**：Cyberpunk，配色參考 Edgerunners key art 的氛圍（只取顏色和造型語彙，不用它的 logo、角色、字體）。顏色、字型、光暈只用 `app/assets/css/main.css` `@theme` 裡的 token（`bg-surface`、`text-neon-cyan`、`shadow-glow-cyan`…）與造型 utility（`clip-corner` 切角、`stripes` 斜紋、`skew-slash` 斜切；不用圓角），不寫死色碼；缺 token 就先加 token。功能期只套 token，特效（glitch、掃描線等）留到第 7 天 polish
- **UI 動態**：互動回饋（卡片進場、喜歡／不喜歡後重新排序、測驗揭曉、按鈕按壓）用 Motion for Vue（`motion-v`）做，不手刻 CSS transition。重新排序用 `layout` 動畫、元素出現／消失用 `AnimatePresence`；時間與彈簧參數統一從 `app/utils/motion.ts` 取。`app.vue` 的 `MotionConfig reduced-motion="user"` 會尊重系統的「減少動態效果」設定，不要拿掉
- 不收集個資；匿名 ID 之外不存任何可識別使用者的資料
- 不改 schema 就不要動 migration；migration 一律由 drizzle-kit 產生
- commit 只在我說的時候做

## 協作方式

我的背景：前端工程師（React、TypeScript 4 年，Vue 也用過），後端在上一個專案（job-alert-triage）學過 Postgres、Drizzle、API route、transaction、冪等寫入、advisory lock、eval。

這個專案沿用上一個專案的學習模式，加上 TDD：

1. **先講概念**：新概念用前端類比說明，補進 `docs/concepts.md`
2. **示範**（Claude）：先寫測試，用白話說明每個測試在檢查什麼；再寫實作，逐行解說
3. **親眼看結果**：除了測試變綠，也要看得到結果：頁面、API 回傳的 JSON、Drizzle Studio 的資料表
4. **自己做變化**（我）：Claude 給一個會失敗的測試和提示，我寫實作讓它通過；卡住先給提示，我明確要求才給程式碼
5. **Review**（Claude）：問「如果……會怎樣」，並請我補一個測試案例

出題的規則：

- 題目放 `docs/exercises/NN-<主題>.md`，未完成的函式以 `throw new Error("TODO: 練習 N")` 標示，對應的測試先是紅的
- 可複製的程式碼區塊一定要能直接執行，不放 `?` 之類的空格
- 每題只引進一個新概念
- 時程只有一週，練習要小：一題 30 分鐘內做得完

每完成一步，說明：用到哪個概念、為什麼這樣設計、替代做法與取捨、我可以怎麼自己驗證。
