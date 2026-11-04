import { describe, expect, it } from "vitest";
import { mapLimit } from "./map-limit";

// 一個可以手動決定何時完成的 Promise，用來觀察「同時有幾個在跑」
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("mapLimit", () => {
  // 結果的順序跟輸入一樣，不管哪個先完成
  it("keeps the input order in the results", async () => {
    const delays = [30, 10, 20];
    const result = await mapLimit(delays, 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return `${i}:${ms}`;
    });
    expect(result).toEqual(["0:30", "1:10", "2:20"]);
  });

  // 重點：同時最多 limit 個。推薦一次要查 10 位歌手，全部一起打會撞到 Last.fm、iTunes 的速率限制
  it("never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const gates = Array.from({ length: 6 }, deferred);

    const done = mapLimit(gates, 2, async (gate) => {
      running++;
      peak = Math.max(peak, running);
      await gate.promise;
      running--;
    });

    // 一個一個放行，每放一個，下一個才開始
    for (const gate of gates) {
      await new Promise((r) => setTimeout(r, 0));
      gate.resolve();
    }
    await done;
    expect(peak).toBe(2);
  });

  // 和 Promise.all 一樣：其中一個失敗，整體就失敗
  it("rejects when one of the calls fails", async () => {
    const result = mapLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    await expect(result).rejects.toThrow("boom");
  });

  it("returns an empty list for no items", async () => {
    expect(await mapLimit([], 3, async (x) => x)).toEqual([]);
  });
});
