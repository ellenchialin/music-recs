import { describe, expect, it, vi } from "vitest";
import { createDbWaker } from "./db-waker";

const at = (seconds: number) => new Date(Date.UTC(2026, 10, 16, 12, 0, seconds));

function setup(wake = vi.fn(async () => {})) {
  return { wake, waker: createDbWaker({ wake, intervalMs: 60_000 }) };
}

describe("createDbWaker", () => {
  it("wakes the database when a page is requested", async () => {
    const { wake, waker } = setup();
    await waker("/", at(0));
    await waker("/recommendations?seed=Khruangbin", at(1));
    expect(wake).toHaveBeenCalledTimes(1);
  });

  it("ignores API, asset and file requests", () => {
    const { wake, waker } = setup();
    expect(waker("/api/recommendations?seed=Khruangbin", at(0))).toBeNull();
    expect(waker("/_nuxt/entry.js", at(0))).toBeNull();
    expect(waker("/favicon.ico", at(0))).toBeNull();
    expect(wake).not.toHaveBeenCalled();
  });

  it("wakes at most once a minute", async () => {
    const { wake, waker } = setup();
    await waker("/", at(0));
    expect(waker("/taste-check", at(59))).toBeNull();
    await waker("/", at(61));
    expect(wake).toHaveBeenCalledTimes(2);
  });

  it("starts only one wake for pages requested while one is running", () => {
    const { wake, waker } = setup(vi.fn(() => new Promise<void>(() => {})));
    waker("/", at(0));
    expect(waker("/", at(0))).toBeNull();
    expect(wake).toHaveBeenCalledTimes(1);
  });

  it("retries on the next page after a failed wake, without rejecting", async () => {
    const wake = vi.fn().mockRejectedValueOnce(new Error("connect ETIMEDOUT")).mockResolvedValue(undefined);
    const { waker } = setup(wake);
    await expect(waker("/", at(0))).resolves.toBeUndefined();
    await waker("/", at(1));
    expect(wake).toHaveBeenCalledTimes(2);
  });
});
