# 練習 3：合併候選歌手

> 這題是 v1 的規則（分數 = match 加總）。之後的 v2 改成看名次（`docs/concepts.md` 第 9 節），程式和測試已經更新，這份題目留作紀錄。

預計 30 分鐘。新概念只有一個：**用 Map 依 key 分組累加**。同一個 key 出現好幾次時，不新增一筆，而是更新原本那筆。

## 為什麼需要這個函式

使用者選了 3–5 位種子歌手，每位種子在快取裡各有一份相似清單（`artist_similar`）。推薦要的是**一份**排好的清單，所以要把它們合併：

| 種子 | 相似清單 |
|---|---|
| Radiohead | Blur 0.8、Muse 0.5 |
| Coldplay | Muse 0.4 |

合併後 Muse 只出現一次，分數 0.5 + 0.4 = 0.9，排在 Blur（0.8）前面。這就是 SPEC 說的「跟越多個種子相似，分數越高」。

> **前端類比**：後端回一個陣列，你把它轉成 `{ [id]: item }` 存進 store（Redux 的 `byId`），之後用 id 找、用 id 更新，不必每次掃整個陣列。這題是同一件事，只是遇到重複的 id 時要把分數加上去。

## 怎麼開始

```bash
pnpm vitest --project unit merge-candidates
```

6 個測試是紅的，錯誤訊息是 `TODO: 練習 3`。

要寫的檔案：`server/utils/recommend/merge-candidates.ts`。規則寫在函式上方的註解，型別在旁邊的 `types.ts`。**先讀一遍測試**，每個 `it` 上面的註解說明它檢查哪一條規則。

## 第 1 步：先做實驗（5 分鐘）

**每一條執行之前，先寫下你的預測**，再執行對照。

```bash
node -e 'const m = new Map(); m.set("muse", 1); console.log(m.get("muse"), m.get("blur"), m.get("blur") ?? 0)'
```

**預測**：沒有的 key，`get` 回什麼？

```bash
node -e 'const m = new Map(); m.set("muse", 1); m.set("blur", 2); m.set("muse", 3); console.log([...m.values()], m.size)'
```

**預測**：同一個 key `set` 兩次，會有幾筆？`values()` 的順序是什麼？

```bash
node -e 'const box = { score: 1 }; const m = new Map([["muse", box]]); m.get("muse").score += 5; console.log(box.score)'
```

**預測**：改 `get` 回來的物件，Map 裡的那個會跟著變嗎？

```bash
node -e 'console.log(0 || "next", 0.1 || "next", [3, 1, 2].sort((a, b) => b - a))'
```

**預測**：`||` 左邊是 0 時會怎樣？這和排序「分數一樣時改比名字」有什麼關係？

## 第 2 步：寫實作

讓 6 個測試全部變綠。卡住的話，依序打開提示，**一次只看一個**。

<details>
<summary>提示 1：整體結構</summary>

兩層迴圈：外層跑每位種子，內層跑這位種子的相似清單。迴圈外面建一個 `Map<string, Candidate>`，key 用 `nameNorm`。

</details>

<details>
<summary>提示 2：遇到一位歌手時做什麼</summary>

先用 `get` 找。找不到就建一個新的 `Candidate`（分數從 0 開始、`sources` 是空陣列）。然後把 `weight * match` 加到分數上，把種子名稱加進 `sources`，再 `set` 回去。第 1 步的第 1、3 個實驗是關鍵。

</details>

<details>
<summary>提示 3：Map 怎麼變回陣列</summary>

`[...map.values()]`，順序是第一次 `set` 的順序，所以最後還要排序。

</details>

<details>
<summary>提示 4：排序的比較函式</summary>

分數由高到低是 `b.score - a.score`。分數一樣時這個值是 `0`，可以用 `||` 接第二個比較：名字由小到大，`a.nameNorm.localeCompare(b.nameNorm)`。

</details>

## 第 3 步：親眼看結果

```bash
pnpm lint
```

```bash
pnpm typecheck
```

再對照 Drizzle Studio 的 `artist_similar`：如果種子是宇多田ヒカル 和另一位 J-pop 歌手，你預期哪些歌手會因為「兩邊都有」而排到前面？

## 做完之後

貼給我：

1. 第 1 步你**預測錯的地方**
2. 你的實作

我會問你幾個「如果……會怎樣」，再請你補一個測試案例。
