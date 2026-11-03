# 練習 2：從搜尋結果挑對的歌

預計 30 分鐘。新概念只有一個：**分級挑選**。先找最好的；找不到，才退一級再找。

## 為什麼需要這個函式

推薦卡片要放試聽。做法是拿 Last.fm 的「歌手 + 歌名」去搜尋 iTunes，但第一筆常常不是要的那首。下面是錄好的真實結果（`server/itunes/fixtures/search-radiohead-creep.json`），搜尋的是「Radiohead Creep」：

| # | 歌名 | 歌手 |
|---|---|---|
| 1 | Creep (Acoustic) | Radiohead |
| 2 | Creep (feat. Radiohead) [Very 2021 Rmx] | Thom Yorke |
| 3 | Creep | TLC |
| 4 | Creep | Daniela Andrade |
| 5 | Creep (SAN) | ATEEZ |

只比歌名會選到 TLC，直接拿第一筆碰巧對，但換一首歌就不一定。所以要寫成有規則、有測試的純函式。

> **前端類比**：做圖片元件時，你可能寫過「有 2x 圖用 2x，沒有就用 1x，再沒有就顯示預設圖」。這題是同一個模式：一串由好到差的選項，取第一個存在的。

## 怎麼開始

```bash
pnpm test:unit
```

會看到 `pick-track.test.ts` 的 7 個測試是紅的，錯誤訊息是 `TODO: 練習 2`。

邊寫邊跑：

```bash
pnpm vitest --project unit pick-track
```

要寫的檔案：`server/utils/pick-track.ts`。檔案上方的註解列了規則；**先讀一遍測試**，每個 `it` 上面的註解說明它在檢查哪一條規則。

## 第 1 步：先做實驗（5 分鐘）

**每一條執行之前，先寫下你的預測**，再執行對照。

```bash
node -e 'console.log([1, 2, 3].find((n) => n > 5))'
```

**預測**：找不到的時候 `find` 回什麼？

```bash
node -e 'console.log(undefined ?? "second", null ?? "second", 0 ?? "second", 0 || "second")'
```

**預測**：四個各印什麼？`??` 和 `||` 差在哪？

```bash
node -e 'console.log(undefined ?? undefined ?? "third")'
```

**預測**：`??` 可以串好幾個嗎？

```bash
node -e 'console.log("Creeping Death".startsWith("Creep"), "Creep (Acoustic)".startsWith("Creep ("))'
```

**預測**：為什麼測試 `does not treat a different song...` 會擋住第一種寫法？

## 第 2 步：寫實作

讓 7 個測試全部變綠。卡住的話，依序打開提示，**一次只看一個**。

<details>
<summary>提示 1：拆成兩段</summary>

先過濾出「有資格」的候選（規則 1：歌手對、有試聽），再從候選裡挑（規則 2、3）。過濾用 `filter`，挑用 `find`。

</details>

<details>
<summary>提示 2：大小寫和空白</summary>

練習 1 寫的 `normalizeArtistName` 也適用於歌名：它只做 NFKC、trim、小寫、合併空白，沒有任何「歌手專用」的處理。從 `./normalize-artist-name` import 進來，兩邊（`want` 和每一筆結果）都要正規化。

</details>

<details>
<summary>提示 3：怎麼表達「先找原版，找不到再找版本」</summary>

回去看第 1 步的第 3 個實驗。`find` 找不到時回 `undefined`，剛好可以接 `??`。最後一級找不到，要回 `null` 而不是 `undefined`（看函式的回傳型別）。

</details>

<details>
<summary>提示 4：怎樣算「版本」</summary>

歌名要以「原歌名 + 分隔符號」開頭。真實資料裡的分隔符號有三種：`" ("`、`" ["`、`" - "`（前面都有空白）。陣列的 `some` 可以檢查「任一個成立」。

</details>

## 第 3 步：親眼看結果

測試全綠之後：

```bash
pnpm lint
```

```bash
pnpm typecheck
```

再打開 `server/itunes/fixtures/search-utada-first-love.json`，對照最後一個測試：為什麼用 `宇多田ヒカル` 去挑會回 `null`？這是對的行為嗎？

## 做完之後

貼給我：

1. 第 1 步你**預測錯的地方**
2. 你的實作

我會問你幾個「如果……會怎樣」，再請你補一個測試案例。
