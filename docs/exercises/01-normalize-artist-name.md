# 練習 1：歌手名稱正規化

預計 30 分鐘。新概念只有一個：**Unicode 正規化**。看起來一樣的字，在電腦裡可能是不同的字元。

## 為什麼需要這個函式

`artists.name_norm` 有 unique 約束（上一步的 schema 測試驗證過）。這個欄位要放什麼，由 `normalizeArtistName` 決定：

- 太寬鬆（只做 `toLowerCase()`）：`ＲＡＤＷＩＭＰＳ` 和 `RADWIMPS` 會被當成兩位歌手，快取存兩份、推薦出現兩次
- 太嚴格（把重音拿掉）：`Sigur Rós` 會變成 `sigur ros`，可能撞到另一位真的叫 Sigur Ros 的歌手

> **前端類比**：做搜尋框時你一定寫過 `input.trim().toLowerCase()`。這題是同一件事，只是多處理「長得一樣、字元不同」的情況。

## 怎麼開始

```bash
pnpm test:unit
```

會看到 `normalize-artist-name.test.ts` 的 5 個測試是紅的，錯誤訊息是 `TODO: 練習 1`。其他測試都是綠的。

邊寫邊跑可以用 watch 模式，存檔就自動重跑：

```bash
pnpm vitest --project unit normalize-artist-name
```

要寫的檔案：`shared/utils/normalize-artist-name.ts`（原本在 `server/utils/`，之後前端也要用，搬到 `shared/`）。測試在旁邊的 `normalize-artist-name.test.ts`，**先讀一遍測試**，每個 `it` 上面的註解說明了它在檢查什麼。

## 第 1 步：先做實驗（5 分鐘）

**每一條執行之前，先寫下你的預測**，再執行對照。

```bash
node -e 'console.log("Bjo\u0308rk" === "Bj\u00F6rk")'
```

**預測**：`true` 還是 `false`？

```bash
node -e 'console.log("Bjo\u0308rk".length, "Bj\u00F6rk".length)'
```

**預測**：兩個長度各是多少？

```bash
node -e 'console.log("Bjo\u0308rk".normalize("NFC") === "Bj\u00F6rk")'
```

```bash
node -e 'console.log("ＲＡＤＷＩＭＰＳ".normalize("NFC"), "ＲＡＤＷＩＭＰＳ".normalize("NFKC"))'
```

**預測**：NFC 和 NFKC 對全形字母的處理一樣嗎？

```bash
node -e 'console.log("Sigur Rós".normalize("NFKC"))'
```

**預測**：NFKC 會不會把 `ó` 變成 `o`？

## 第 2 步：寫實作

讓 5 個測試全部變綠。卡住的話，依序打開提示，**一次只看一個**。

<details>
<summary>提示 1：要用到哪些方法</summary>

全部都是字串的內建方法，不需要套件：`normalize()`、`trim()`、`toLowerCase()`、`replace()`。

</details>

<details>
<summary>提示 2：NFC 還是 NFKC</summary>

回去看第 1 步最後兩個實驗。哪一個能同時處理「ö 的兩種存法」和「全形字母」，而且不會拿掉重音？

</details>

<details>
<summary>提示 3：連續空白</summary>

正規表示式 `\s` 符合任何空白字元（空格、Tab、換行），`+` 代表「一個以上」。`/\s+/g` 的 `g` 代表全部取代，不只第一個。

</details>

<details>
<summary>提示 4：還有一個紅的，看不出差在哪</summary>

Vitest 的錯誤會列出 `Expected`（測試要的）和 `Received`（你回傳的）。看起來一樣但還是紅的，通常是看不見的字元。把結果的每個字元碼印出來比對：

```bash
node -e 'console.log([..."Bjo\u0308rk"].map((c) => c.codePointAt(0).toString(16)))'
```

</details>

## 第 3 步：親眼看結果

測試全綠之後，跑一下 lint 和型別檢查：

```bash
pnpm lint
```

```bash
pnpm typecheck
```

## 做完之後

貼給我：

1. 第 1 步你**預測錯的地方**
2. 你的實作

我會問你幾個「如果……會怎樣」，再請你補一個測試案例。
