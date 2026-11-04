# Music Recs 規格

任何人輸入幾個喜歡的歌手，就能拿到附試聽和推薦理由的歌曲推薦；用盲聽測驗量出推薦是不是真的比隨機好。

已拍板的決策見 `docs/ai-log.md`（規格與決策衝突時以決策為準）。

## 目標

**作品集要展示的**：Vue 3 前端的互動設計、推薦演算法、公開服務的成本控制、可以量測的 eval。

**明確不做**：帳號系統、社群功能、歌單分享、匯出到 Spotify（Spotify API 開發模式只允許 5 個使用者）、手機 App。上傳 Spotify 匯出檔是 MVP 之後的功能。

## 技術棧

| 層 | 選擇 |
|---|---|
| 框架 | Nuxt 4（Vue 3 + TypeScript strict），頁面在 `app/pages/`，API 在 `server/api/` |
| 狀態 | Pinia |
| 資料抓取 | Nuxt 內建 `useFetch`／`useAsyncData` |
| 樣式 | Tailwind CSS |
| 工具 | VueUse |
| 資料庫 | Postgres 17 + Drizzle ORM；本機 Docker，正式環境 Neon |
| 驗證 | zod：API 輸入、外部 API 回應、LLM 輸出 |
| LLM | Claude Haiku 5.5，結構化輸出，只用來寫推薦理由 |
| 外部資料 | Last.fm API（搜尋、相似歌手、標籤、熱門歌曲）、iTunes Search API（試聽、封面）；都不需要使用者登入 |
| 測試 | Vitest + `@nuxt/test-utils`；Playwright 跑主要流程 |
| 部署 | Vercel + Neon |
| CI | GitHub Actions：typecheck、lint、測試 |

## 使用者流程

1. 打開首頁（`/`），輸入 1–3 個喜歡的歌手（自動完成），按 Recommend
2. 換到推薦頁（`/recommendations?seed=…`，整頁一個畫面、不捲動），看到 10 張推薦唱片：封面、歌名、30 秒試聽、一句推薦理由
3. 從喜歡的那張「Explore from here」往下挖（網址多一層 `&explore=…`），最多 3 層；麵包屑 `Home › 種子 › Pond` 可以點回任一層，瀏覽器的上一頁也能用，Home 帶著種子回首頁重新輸入
4. 拉「大眾 ↔ 冷門」滑桿，推薦跟著變
5. 玩盲聽測驗：聽 3 首、各打 1–5 分、揭曉哪些是推薦的

## 功能

標 **[必要]** 的是 MVP 一定要有的；標 **[可延後]** 的在時程不夠時先砍。

### 1. 種子歌手 [必要]

- 自動完成用 Last.fm `artist.search`，前端 debounce、後端快取
- 選了的歌手存 Pinia，同步到 localStorage

### 2. 推薦 [必要]

演算法放 `server/utils/recommend/`，全部是純函式：

1. 每個種子歌手取 Last.fm 相似歌手（附相似度 `match`）
2. 合併候選：跟越多個種子相似、相似度越高，分數越高
3. 排除種子本身（往下挖時也排除前面各層看過的歌手）
4. 冷門程度：用聽眾人數的對數調整權重 [可延後]
5. 每個歌手取一首代表歌，用 iTunes 補試聽與封面（依序試台灣、美國、日本商店）；找不到試聽就顯示「暫無試聽」，不顯示播放鈕

每次結果標記演算法版本 `algo_version`。

### 3. 推薦理由 [可延後：沒做時顯示「和 A、B 相似」]

- 10 張卡片的理由一次 LLM 呼叫產生
- 以「種子組合 + 推薦歌手」為 key 快取
- 每天全站呼叫上限，超過就退回規則產生的理由

### 4. Explore from here [必要]

（取代原本的「回饋」：喜歡／不喜歡後重新排序，使用者不懂背後的評分，見 `docs/ai-log.md`）

- 每張推薦唱片下有「Explore from here →」：以這位歌手為唯一的種子，推薦下一層
- 下一層排除原本的種子和前面各層顯示過的唱片，每層都是新面孔
- 最多往下挖 3 層，到最深時不顯示 Explore；路徑 `Your artists › Pond › GUM` 可以點回任一層，不重新查詢，停在當時看的那張
- 沒有新歌手時停在原層並提示

### 5. 盲聽測驗 [必要]

- 每輪 3 首：1–2 首來自推薦，其餘是對照組
- 對照組：從使用者種子歌手最常見的風格標籤中，隨機挑熱門歌曲（同風格才公平）
- 1–5 分；揭曉哪首是推薦
- 每筆評分連同演算法版本存下來

## 匿名身分與隱私

- 第一次進來產生隨機 ID，存在 cookie
- 不收集 email、名字或任何個資
- 匯出檔功能（MVP 之後）：瀏覽器端解析，只送彙總結果到後端

## 成本與濫用

- 外部資料快取在 Postgres，30 天過期
- 速率限制存在 Postgres（Vercel 是 serverless，記憶體計數不可靠）：每個匿名 ID、每個 IP 每分鐘上限；超過回 429
- LLM：快取、每日全站上限、Anthropic 後台每月花費上限
- 外部 API 回應只取需要的欄位，用 zod 驗證

## 資料模型（初稿）

| 表 | 內容 |
|---|---|
| `artists` | Last.fm 歌手：名稱、MusicBrainz ID、聽眾人數、標籤、抓取時間 |
| `artist_similar` | 歌手之間的相似度 |
| `tracks` | 每位歌手的代表歌、iTunes ID、試聽網址、封面 |
| `visitors` | 匿名 ID、建立時間 |
| `reason_cache` | 推薦理由快取 |
| `blind_tests` | 每輪：歌曲、哪首是推薦、評分、演算法版本 |
| `rate_limits` | 速率限制計數 |

## API（初稿）

| Method | 路徑 | 用途 |
|---|---|---|
| GET | `/api/artists/search?q=` | 自動完成 |
| GET | `/api/recommendations?seed=&exclude=` | 種子（＋往下挖時排除的歌手）→ 推薦清單 |
| POST | `/api/blind-tests` | 開始一輪 |
| POST | `/api/blind-tests/:id/ratings` | 送出評分 → 揭曉 |
| GET | `/api/stats` | eval 數字 |

## Eval

- **主要指標**：盲聽測驗中，推薦歌曲平均分數減掉對照組平均分數，附信賴區間
- 每位訪客只算一次平均，避免少數人玩很多輪扭曲結果
- 次要：不同冷門設定、不同演算法版本的比較
- 資料來源：自己、朋友、面試官試玩

## 時程（2026-11-03 起，一週）

| 天 | 內容 |
|---|---|
| 1 | Nuxt 骨架、Docker Postgres、Drizzle schema、測試環境、CI |
| 2 | Last.fm／iTunes client（zod 驗證）、快取；推薦演算法（純函式，TDD） |
| 3 | `/api/recommendations`、首頁：種子輸入、推薦卡片、試聽 |
| 4 | Explore from here、冷門滑桿 |
| 5 | 速率限制、部署 Vercel + Neon；LLM 推薦理由 |
| 6 | 盲聽測驗、`/api/stats` |
| 7 | 緩衝、README、找人試玩 |

時程很緊，落後時依序砍：冷門滑桿 → LLM 理由（改用規則理由） → Playwright。

## 驗收標準

- [ ] 沒有帳號，30 秒內拿到推薦並聽到試聽
- [ ] 同一組種子重複查詢，不再呼叫外部 API 或 LLM
- [ ] 超過速率限制回 429，前端顯示提示
- [ ] 線上 demo 可用
- [ ] 盲聽測驗有評分資料，README 有推薦 vs 對照組的結果表（MVP 後持續累積到 30 位訪客以上）
- [ ] CI 全部通過；README 有架構圖、demo 連結、eval 結果

## 風險

| 風險 | 備案 |
|---|---|
| 冷門歌手的 Last.fm 相似資料太少 | 改用標籤找候選 |
| iTunes 台灣商店找不到試聽（各國商店把歌手名在地化） | 依序試美國、日本商店；都沒有就顯示「暫無試聽」 |
| 盲聽人數太少 | 報告寫清楚樣本數；先找朋友 |
| Last.fm 使用條款 | 非商業使用，標示資料來源 |
| iTunes 速率限制（約每分鐘 20 次） | 結果快取 30 天，「查過、沒有」也快取 |
