import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./same-origin";

// CSRF: another site can make a visitor's browser POST here with their cookie attached.
// Browsers send Origin on cross-site POSTs, so a mismatch means the request came from elsewhere
describe("isAllowedOrigin", () => {
  it("allows a request from our own site", () => {
    expect(isAllowedOrigin("https://musicrecs.ellenchen.dev", "musicrecs.ellenchen.dev")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("refuses a request from another site", () => {
    expect(isAllowedOrigin("https://evil.example", "musicrecs.ellenchen.dev")).toBe(false);
    expect(isAllowedOrigin("https://musicrecs.ellenchen.dev.evil.example", "musicrecs.ellenchen.dev")).toBe(false);
  });

  it("refuses an unparseable or opaque origin", () => {
    expect(isAllowedOrigin("null", "musicrecs.ellenchen.dev")).toBe(false);
    expect(isAllowedOrigin("not a url", "musicrecs.ellenchen.dev")).toBe(false);
  });

  // Non-browser clients (curl, tests) send no Origin, and they can't carry a visitor's cookie anyway
  it("allows a request without an Origin header", () => {
    expect(isAllowedOrigin(undefined, "musicrecs.ellenchen.dev")).toBe(true);
  });
});
