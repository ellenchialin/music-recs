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

## 4. 外部 API client：zod 驗證＋可替換的 fetch

程式在 `server/lastfm/`：`schemas.ts`（zod）、`client.ts`（呼叫 API）、`fixtures/`（錄好的真實回應）。

### zod 不只驗證，也負責「翻譯」

> **前端類比**：拿到後端 API 的資料後，你常會寫一個 `toViewModel()` 把它轉成畫面好用的形狀。這裡把驗證和轉換寫在同一個 schema 裡。

Last.fm 的原始回應很不好用：數字是字串（`"8500398"`）、沒有 MBID 時是 `""`、只有一筆時陣列會變成單一物件、每筆還帶一堆用不到的圖片網址。`schemas.ts` 一次處理掉，後面的推薦演算法只會看到乾淨的 `{ name, mbid: string | null, listeners: number }`。

格式變了（例如 Last.fm 改了欄位名稱）就在這裡丟錯，不會讓 `undefined` 一路流進演算法，最後變成畫面上的 `NaN`。

### 為什麼 fetch 要從外面傳進來

> **前端類比**：測試元件時用 MSW 或 mock 掉 `fetch`，不讓測試真的打後端。

`createLastfmClient({ apiKey, fetch })` 的 `fetch` 預設是全域的，測試傳一個假的進去，回傳 fixture 的內容。好處：

- 測試不需要網路、不需要 API key，CI 也能跑
- 測試可以檢查「送出去的網址對不對」（`client.test.ts` 第一個測試）
- 可以模擬真實世界很難觸發的情況，例如 503、回傳 HTML

這個寫法叫**依賴注入**：函式需要的東西由呼叫的人給，而不是自己去拿。

### Fixture 是錄下來的，不是手寫的

`pnpm record:lastfm` 打真的 API，連 HTTP 狀態一起存成 JSON。手寫的假資料容易「寫成你以為的樣子」；錄下來的才會有 `"listeners": "8500398"` 這種真實的怪癖。唯一手做的案例（只有一筆時變成物件）在測試裡有註解說明。

**親眼看**：打開 `server/lastfm/fixtures/similar-not-found.json`，找不到歌手時 Last.fm 回的是 **HTTP 200**，錯誤放在 body。所以 `client.ts` 看 body 的 `error` 欄位，不只看 `res.ok`。

### 第二個 client：同樣的形狀，不同的怪癖

`server/itunes/` 和 `server/lastfm/` 結構一樣（schema + 注入 fetch + 錄好的 fixture），差別都來自錄 fixture 時看到的真實行為：

| | Last.fm | iTunes |
|---|---|---|
| 出錯時 | HTTP 200 + `error` 欄位，要看 body | HTTP 4xx + `errorMessage`，看 `res.ok` 就夠 |
| 數字、陣列 | 數字是字串、單筆變物件，要在 schema 修 | 本來就是 number 和陣列 |
| 不要的資料 | — | 結果裡可能混 MV 等其他 `kind`：**先過濾再驗證**，不讓一筆不相干的資料讓整個回應失敗 |
| API key | 要 | 不用 |

> **前端類比**：同一個 `fetch` 包裝，接兩個後端；共用的是「回應進來先驗證、轉成自己的型別」這個習慣，不是共用一個萬用函式。兩個 client 才各 40 行，硬抽共用層反而要處理兩種錯誤格式的分支。

**地區會改變資料**：`country` 參數決定查哪一國的商店。台灣商店裡宇多田ヒカル 叫 `Hikaru Utada`；Radiohead 的原版〈Creep〉不在台灣商店，搜尋第一筆是 Acoustic 版。所以「從搜尋結果挑對的那首」要另外寫成純函式，不能直接拿第一筆。

## 5. 分級挑選：先找最好的，再退而求其次

> **前端類比**：`srcset` 或「有 2x 圖用 2x，沒有用 1x，再沒有用預設圖」。一串由好到差的選項，取第一個存在的。

外部資料常常沒有完美的答案：iTunes 台灣商店沒有 Radiohead 原版的〈Creep〉，只有 Acoustic 版。這時候有幾種寫法：

| 寫法 | 問題 |
|---|---|
| 直接拿第一筆 | 換一首歌就可能拿到別人的同名歌 |
| 只接受完全相符 | 太嚴格，很多歌會沒有試聽 |
| 給每筆打分數再排序 | 分數要調權重，規則藏在數字裡，難測也難解釋 |
| **分級挑選**（`filter` 出有資格的，再 `find(最好) ?? find(次好) ?? null`） | 規則一條一級，每級各有一個測試；要加一級就多一個 `??` |

這個專案選分級挑選。規則少（三級）的時候最好讀；如果之後規則多到五六級、級與級之間還要互相比較，才改成打分數。

另一個原則：**寧可回 `null`，也不要猜**。挑不到試聽，卡片就不顯示播放鈕；挑錯了，使用者會聽到別人的歌，以為推薦壞了。

## 6. 快取：先查資料庫，沒有才打 API

> **前端類比**：TanStack Query／SWR 的 `staleTime`。有資料又沒過期就直接用，過期才重新 fetch。差別是這裡的快取存在 Postgres，所有訪客共用，伺服器重開也還在。

`server/cache/lastfm.ts` 的寫法叫 **cache-aside**：

1. 用正規化的名字查 `artists`
2. 有，而且 `isFresh(fetched_at, now)`（30 天內）→ 直接回傳，**不打 API**
3. 沒有或過期 → 打 Last.fm → 寫回資料庫 → 回傳

上一個專案學過的東西在這裡都用得到：

- **upsert（`onConflictDoUpdate`）**：兩個訪客同時查同一位新歌手，兩邊都沒查到、都打 API、都寫入。用 upsert 的話，後寫的變成更新，不會撞 unique 錯誤。
- **transaction**：相似清單過期時要「刪舊、寫新、更新 `similar_fetched_at`」三步。像超商換貨架：沒有 transaction，就是店員先把舊貨全撤掉、新貨還在推車上，這時走進來的客人（同時進來的另一個請求）會看到空貨架，拿到空的推薦；店員半路被叫走（寫新的那步失敗），貨架就一直空著，直到下一位客人觸發重抓。有 transaction，就像拉上簾子換完再拉開：別人只會看到舊貨架或新貨架；半路失敗就整個復原，舊清單還在。
- **`now` 由參數傳入**：和 fetch 一樣是依賴注入。測試可以直接傳「31 天後」，不必 mock 系統時間。

**親眼看**：`pnpm db:studio` 打開 `artists` 和 `artist_similar`。第一次查一位歌手要打 2 次 API（約 700ms），第二次 0 次（約 3ms）。

### 「沒有」也要快取，「壞了」不能快取

> **前端類比**：搜尋框打「zzqx」，後端回空陣列，SWR 會把空陣列也快取起來，不會每次重打。但如果是 500 錯誤，SWR 不會把錯誤當成資料存下來，下次會重試。

`server/cache/tracks.ts` 分兩種情況：

| 情況 | 處理 | 為什麼 |
|---|---|---|
| iTunes 正常回應，但挑不到歌 | 存一列，試聽欄位是 `null`（**negative cache**） | 不存的話，每次推薦到這位歌手都再問一次 iTunes，很快撞到每分鐘約 20 次的限制 |
| iTunes 出錯（403、當機） | 什麼都不存，錯誤往上丟 | 存了的話，iTunes 恢復後 30 天內這位歌手都沒有試聽 |

測試 `remembers that iTunes had nothing` 和 `does not cache anything when iTunes fails` 各檢查一種。

## 7. 推薦演算法是一條純函式的管線

> **前端類比**：Redux 的 selector（或 Vue 的 computed）。state 進去、畫面要的資料出來，不打 API、不改 state。同樣的輸入永遠得到同樣的輸出，所以測試只要準備輸入、比對輸出。

`server/utils/recommend/` 的每一步都是這樣：

```
每位種子的相似清單 ──mergeCandidates──▶ 合併、加總分數、排序
                     ──excludeArtists──▶ 拿掉種子本身、不喜歡的
                     ──取前 10 位────▶ 推薦結果（標上 algo_version）
```

資料從哪來（快取、Last.fm）是 `/api/recommendations` 的事，演算法只吃 `types.ts` 裡的普通物件。好處：

- 測試不需要資料庫，也不需要 fixture，手寫幾筆就能測一條規則
- 換資料來源（例如之後改用標籤找候選）不必改演算法
- 盲聽測驗要比較不同版本的演算法時，同樣的輸入一定得到同樣的輸出（所以分數一樣時要依名字排，不能靠 `Map` 或資料庫回傳的順序）

**用 Map 分組累加**（練習 3）：同一位歌手出現在好幾位種子的清單裡時，用 `nameNorm` 當 key 找到原本那筆，把分數加上去，而不是新增一筆。

## 8. API route：一層只做一件事

> **前端類比**：元件不直接 `fetch`，而是呼叫一個 hook 或 service；hook 再用 API client。元件只管畫面，service 只管資料流程。這裡是同樣的分層，只是在伺服器上。

`GET /api/recommendations?seed=Tame%20Impala&seed=Kokoroko` 經過四層：

| 層 | 檔案 | 只做這件事 |
|---|---|---|
| route | `server/api/recommendations.get.ts` | 驗證 query（zod）、呼叫 service、把錯誤轉成 HTTP 狀態碼（404、502） |
| service | `server/services/recommendations.ts` | 串接：種子 → 快取 → 演算法 → 每張卡片補試聽；決定哪些錯誤要往上丟、哪些自己接住 |
| 快取 | `server/cache/` | 先查 Postgres，沒有才打 Last.fm、iTunes |
| 演算法 | `server/utils/recommend/` | 純函式，不知道資料從哪來 |

測試也照層分：演算法用手寫資料（unit）、快取和 service 用假的 client ＋ 測試資料庫（db）、route 只剩幾行，用 `curl` 親眼看。

**錯誤要在哪一層接住？** 看它影響多大：

- 一位歌手的試聽查不到（iTunes 403）→ service 在**那張卡片**接住，回 `preview: { status: "error" }`，其他 9 張照常
- 種子找不到 → 整份推薦做不出來，丟 `SeedNotFoundError`，route 轉成 404 加上建議的歌手名
- Last.fm 當機 → route 轉成 502，不把 Last.fm 的原始錯誤訊息傳給前端

**同時打幾個 API？** `mapLimit(items, 3, fn)` 像 `Promise.all(items.map(fn))`，但同時最多 3 個。全部一起打比較快，但會撞到速率限制；一個一個打不會撞，但 10 位歌手要等很久。

## 9. 合併多份排行：看名次，不看原始分數（v2）

> **前端類比**：三個不同的評分網站，一個習慣打 9 分以上、一個平均 6 分。直接把分數加起來，愛打高分的那個網站會決定排名。比較公平的做法是看「它在各網站排第幾」。

v1 直接加總 Last.fm 的 `match`。Kokoroko 的相似清單前 10 名都在 0.8 以上，Tame Impala 的掉得比較快，結果 10 個名額 Kokoroko 拿 5 個、Tame Impala 只拿 1 個。

v2 用 **Reciprocal Rank Fusion**（搜尋引擎合併多份結果的常見做法）：在一位種子的清單裡排第 `rank` 名，得 `1 / (RANK_K + rank)` 分。

- 每位種子的第 1 名分數一樣、第 2 名一樣……所以前 10 名會輪流來自各位種子
- 被好幾位種子推薦的歌手，各種子的分數加起來，還是排在前面（SPEC 的要求）
- `RANK_K` 控制兩者的平衡：越大，名次之間差越少，「被好幾位種子推薦」越佔優勢。這裡用 5

**代價**：只看名次就丟掉了 `match` 的大小。一位種子的相似清單整體都很弱（第 1 名只有 0.2），它的第 1 名還是和別的種子的第 1 名一樣重。

## 10. 首頁：SSR、localStorage 和自動完成

### SSR 時 localStorage 的陷阱（`skipHydrate`）

> **前端類比**：Next.js 裡在 render 時讀 `localStorage` 會報錯或造成 hydration mismatch，要等 `useEffect` 才讀。Nuxt 也一樣，而且 Pinia 多了一層坑。

Nuxt 預設先在伺服器把頁面渲染成 HTML，再到瀏覽器「接手」（hydration）。伺服器沒有 `localStorage`，所以種子清單是空的；Pinia 會把這份**空狀態**連同 HTML 一起送到瀏覽器，瀏覽器接手時套用它——蓋掉 localStorage 讀出來的種子，再把空陣列寫回 localStorage。結果：重新整理後種子全不見。

`app/stores/seeds.ts` 的兩個修正：

- `skipHydrate(seeds)`：告訴 Pinia 這個欄位不要用伺服器送來的值
- `useLocalStorage(..., { initOnMounted: true })`：等瀏覽器掛載完才讀 localStorage，伺服器和瀏覽器第一次渲染出來的 HTML 一樣，不會 hydration mismatch

測試 `keeps the browser's seeds when the server sent an empty state` 模擬「伺服器送來空狀態」重現這個問題。

### 自動完成的兩個細節

- **debounce**：`refDebounced(query, 250)`，停止打字 250ms 才查，不是每按一個鍵就打一次 API
- **舊請求晚回來**：打「ta」「tam」「tame」送出三個請求，回來的順序不一定。每次送出記一個編號，只採用最後一個編號的結果（`latestRequest`）

### 全頁共用一個播放器

`createSharedComposable`（VueUse）：每張卡片呼叫 `usePreviewPlayer()` 拿到的是同一份狀態，像一個小型的全域 store。播 B 的時候 A 自動停，因為只有一個 `<audio>`。

## 11. Explore from here：路徑狀態是純函式

> **前端類比**：瀏覽器的上一頁／下一頁，或 React Router 的 history stack。每往下挖一層 push 一筆，點路徑回去就把後面的切掉。

`app/utils/explore-trail.ts` 把路徑存成陣列，每一層記三件事：從哪位歌手挖下來（第一層是 `null`）、推薦結果、看到第幾張。

- `exploreFrom`、`backTo` 都回傳新陣列、不改原本的：回上一層時前面各層原封不動，所以不用重新查詢
- `excludedFor` 算下一層的排除名單：原本的種子 ＋ 每一層顯示過的唱片，送給 API 的 `exclude`
- 「看到第幾張」用 `v-model:index` 綁到唱片箱：唱片箱改，路徑裡那一層跟著改；回到那一層時，唱片箱從那一張開始

演算法本身沒有變：往下挖只是「一位種子 ＋ 一份排除名單」再跑一次推薦。

## 12. 網址是推薦結果的唯一來源

> **前端類比**：React Router 的 `useSearchParams`，或篩選條件放在網址的商品列表頁。畫面由網址算出來，不是由按鈕點了幾次算出來。

`/recommendations?seed=Tame+Impala&seed=Kokoroko&explore=Pond`

- **解析網址**：`app/utils/recommendations-route.ts` 把 query 轉成 `{ seeds, explore }`。網址可以手改：多的、空的、重複的都去掉，最多 3 位種子、3 層
- **依網址查詢**：`useAsyncData` 監看網址，一層一層查。伺服器端渲染時就查好，打開頁面直接有結果；從首頁換過來時（`lazy`）先顯示唱盤
- **查過的不再查**：每一層的結果存在 `useState`，key 是「種子 ＋ 路徑」。伺服器查好的會跟著頁面送到瀏覽器；往下挖、回上一層、按上一頁都先看這裡
- **往下挖＝改網址**：先查好下一層、確認有新歌手，才 `router.push`；網址一變，`useAsyncData` 重跑時直接從快取拿

**SSR 的坑**：在 `setup` 裡用瀏覽器才有的東西（`Audio`、`window`、`localStorage`）會讓伺服器端渲染失敗。等真的要用時才建立（試聽播放器），或放在 `onMounted` 裡（種子的 localStorage）。

## 13. 速率限制：固定時間窗＋資料庫原子計數

> **前端類比**：按鈕的 throttle，只是放在伺服器、而且是對「每個人」各算一份。超過就回 `429 Too Many Requests`，`Retry-After` 告訴對方幾秒後再試。

- **固定時間窗**：時間切成一分鐘一格，每格各自計數，下一分鐘重新算（`server/utils/rate-limit.ts` 的 `windowStart`）。缺點是格子交界可能短時間內通過兩倍（59 秒 20 次＋下一分鐘 0 秒 20 次）；要更平均可以用滑動時間窗或 token bucket，但要存更多狀態。這個專案用固定的就夠
- **計數存在 Postgres**：Vercel 是 serverless，每個請求可能跑在不同機器，記憶體裡的計數不共用
- **原子計數**：`INSERT … ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`。「+1」在資料庫裡一次做完，同時來的兩個請求不會都讀到 5、都寫回 6。測試：同時送 25 個、上限 20，剛好 20 個通過
- **不存 IP**：存「IP ＋ 鹽」的 SHA-256。鹽是伺服器的祕密（`RATE_LIMIT_SALT`），沒有鹽就不能把所有 IP 算一遍來反查
- **清理**：每次寫入有 1% 機會順便刪掉一小時前的列，不另外排程

**兩個坑**：

1. **整個 route 快取時**（`defineCachedEventHandler`），快取命中不會經過限制，還會把第一個人的回應 header 重播給別人。改成只快取「打 Last.fm」那一步（`defineCachedFunction`），限制寫在外面
2. **SSR 看不到使用者的 IP**：頁面在伺服器上查自己的 API 不經過網路，API 拿不到 IP，所有人的 SSR 被算成同一個「unknown」。`useApiFetch` 在 SSR 時把使用者的 IP 放進 `x-forwarded-for` 帶過去（Vercel 會蓋掉使用者自己送的這個 header，不能假冒）
