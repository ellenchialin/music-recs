import { describe, expect, it } from "vitest";
import { MAX_REASON_LENGTH, TARGET_REASON_LENGTH, buildReasonsPrompt, seedKey, usableReason, type ReasonsInput } from "./reasons-prompt";

const input: ReasonsInput = {
  seeds: [
    { name: "Tame Impala", tags: ["psychedelic rock", "indie"] },
    { name: "Kokoroko", tags: ["afrobeat", "jazz"] },
  ],
  records: [
    { artist: "Khruangbin", sources: ["Tame Impala", "Kokoroko"], track: "Maria También" },
    { artist: "Pond", sources: ["Tame Impala"], track: null },
  ],
};

describe("buildReasonsPrompt", () => {
  it("gives the model the seeds with their tags", () => {
    const { user } = buildReasonsPrompt(input);
    expect(user).toContain("Tame Impala (psychedelic rock, indie)");
    expect(user).toContain("Kokoroko (afrobeat, jazz)");
  });

  it("lists every record with the seeds it came from and its track when known", () => {
    const { user } = buildReasonsPrompt(input);
    expect(user).toContain('Khruangbin, similar to Tame Impala and Kokoroko, track "Maria También"');
    expect(user).toContain("Pond, similar to Tame Impala");
    expect(user).not.toContain("Pond, similar to Tame Impala, track");
  });

  it("tells the model to stick to what it knows and answer null otherwise", () => {
    const { system } = buildReasonsPrompt(input);
    expect(system).toMatch(/null/);
    expect(system).toContain(`${TARGET_REASON_LENGTH} characters or fewer`);
  });

  // Nothing time-based or random, so the same list always gets the same request
  it("is the same for the same input", () => {
    expect(buildReasonsPrompt(input)).toEqual(buildReasonsPrompt(structuredClone(input)));
  });
});

describe("usableReason", () => {
  it("trims a reason", () => {
    expect(usableReason(" Same hazy, groove-first guitar. ")).toBe("Same hazy, groove-first guitar.");
  });

  it("drops reasons that are missing, empty, too long or more than one line", () => {
    expect(usableReason(null)).toBeNull();
    expect(usableReason("  ")).toBeNull();
    expect(usableReason("x".repeat(MAX_REASON_LENGTH + 1))).toBeNull();
    expect(usableReason("Line one\nline two")).toBeNull();
  });
});

describe("seedKey", () => {
  it("is the same whatever the order or spelling of the seeds", () => {
    expect(seedKey(["Tame Impala", "Kokoroko"])).toBe(seedKey(["kokoroko ", "TAME IMPALA"]));
  });

  it("differs for different seeds", () => {
    expect(seedKey(["Tame Impala"])).not.toBe(seedKey(["Tame Impala", "Kokoroko"]));
  });
});
