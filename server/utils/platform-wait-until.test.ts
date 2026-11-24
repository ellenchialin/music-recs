import { describe, expect, it, vi } from "vitest";
import { bridgeWaitUntil, type WaitUntilContext } from "./platform-wait-until";

describe("bridgeWaitUntil", () => {
  it("hands background work to the platform's waitUntil", () => {
    const platformWaitUntil = vi.fn();
    const context: WaitUntilContext = {};

    bridgeWaitUntil(context, platformWaitUntil);
    const work = Promise.resolve();
    context.waitUntil?.(work);

    expect(platformWaitUntil).toHaveBeenCalledWith(work);
  });

  it("keeps a waitUntil the platform adapter already set", () => {
    const existing = vi.fn();
    const platformWaitUntil = vi.fn();
    const context: WaitUntilContext = { waitUntil: existing };

    bridgeWaitUntil(context, platformWaitUntil);
    context.waitUntil?.(Promise.resolve());

    expect(existing).toHaveBeenCalled();
    expect(platformWaitUntil).not.toHaveBeenCalled();
  });
});
