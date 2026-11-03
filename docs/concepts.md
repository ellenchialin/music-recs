# 概念筆記（給前端工程師）

每個概念先用前端類比，再指出它在這個專案的哪裡、怎麼親眼看到。上一個專案學過的（資料表、migration、transaction、advisory lock……）見 job-alert-triage 的 `docs/concepts.md`，這裡只寫新的。

## 1. Nuxt：一個專案同時有前端和後端

> **前端類比**：像 Next.js 的 App Router + Route Handlers，只是換成 Vue。`app/` 是跑在瀏覽器（和 SSR）的 Vue 程式，`server/` 是跑在 Node 的 API。

| 資料夾 | 跑在哪裡 | 放什麼 |
|---|---|---|
| `app/pages/` | 瀏覽器＋SSR | 頁面，檔名就是路由（`index.vue` → `/`） |
| `app/components/`、`app/composables/` | 瀏覽器＋SSR | 元件、`useXxx()`，自動 import |
| `server/api/` | Node（Nitro） | API，檔名就是路徑（`server/api/artists/search.get.ts` → `GET /api/artists/search`） |
| `server/utils/` | Node | 後端共用函式，`server/` 裡自動 import；推薦演算法放這裡 |

**界線**：`app/` 不能 import `server/` 的東西（不然 DB 連線字串會被打包進瀏覽器）。兩邊都要用的型別放 `shared/`。

**親眼看**：`pnpm dev` 後打開 http://localhost:3000 看頁面；之後有 API 時直接打開 http://localhost:3000/api/... 看 JSON。

## 2. 兩種測試環境

> **前端類比**：就像 Jest 的 `testEnvironment: "node"` 和 `"jsdom"`。

`vitest.config.ts` 分兩個 project：

- **`unit`**：`server/`、`shared/` 的 `*.test.ts`。純函式，不需要瀏覽器也不需要 Nuxt，一個測試幾毫秒
- **`nuxt`**：`app/` 的 `*.test.ts`。會啟動 Nuxt runtime（auto-import、Pinia、router），DOM 用 happy-dom 模擬；用 `mountSuspended()` 掛元件

**為什麼分**：推薦演算法是這個專案的核心，測試會最多，讓它們跑在最快的環境。

**親眼看**：`pnpm test` 的輸出每行前面有 `|unit|` 或 `|nuxt|`。

## 3. 這個專案的 schema 選擇

資料表、migration、unique 這些上一個專案學過了，這裡只記這次新的取捨。檔案在 `server/db/schema.ts`，對應的測試在 `server/db/schema.db.test.ts`。

| 選擇 | 為什麼 | 替代做法 |
|---|---|---|
| `visitors.id` 是 `uuid`，由伺服器產生 | 這個 ID 要放進 cookie。自動編號（1、2、3…）猜得到別人的 ID，隨機 uuid 猜不到 | `serial` 編號＋另一個隨機 token 欄位：多一個欄位，沒有好處 |
| `artists` 用 `name_norm` 當唯一鍵，不用 `mbid` | 很多冷門歌手在 Last.fm 沒有 MusicBrainz ID；Last.fm 本身也是用名字找歌手 | 用 `mbid`：冷門歌手存不進來 |
| `tags` 是 `text[]`（陣列欄位） | 標籤只會「整包讀出來」，不會單獨更新某個標籤 | 另開 `artist_tags` 表：要用標籤反查歌手時才值得 |
| `listeners >= 0` 用 check constraint | 規則寫在資料庫，任何程式寫錯都進不去 | 只在 zod 檢查：別的寫入路徑可能漏掉 |
| `fetched_at` 有預設值 | 30 天快取過期就是比較它和現在的時間 | — |

> **前端類比**：`name_norm` 就像做搜尋時先把輸入 `trim().toLowerCase()` 再比對。顯示用原本的 `name`，比對用正規化過的 `name_norm`。

**親眼看**：`pnpm db:studio` 打開 `artists` 表看欄位；或 `pnpm db:sandbox` 後輸入 `\d artists`，會看到 unique 和 check 兩個 constraint。
