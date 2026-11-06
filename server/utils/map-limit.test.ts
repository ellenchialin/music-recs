import { describe, expect, it } from "vitest";
import { mapLimit } from "./map-limit";

// A promise resolved by hand, to see how many calls run at once
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("mapLimit", () => {
  it("keeps the input order in the results", async () => {
    const delays = [30, 10, 20];
    const result = await mapLimit(delays, 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return `${i}:${ms}`;
    });
    expect(result).toEqual(["0:30", "1:10", "2:20"]);
  });

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

    for (const gate of gates) {
      await new Promise((r) => setTimeout(r, 0));
      gate.resolve();
    }
    await done;
    expect(peak).toBe(2);
  });

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
