import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./same-origin";

// CSRF: another site can make a visitor's browser POST here with their cookie attached.
// Browsers send Origin on cross-site POSTs, so a mismatch means the request came from elsewhere
describe("isAllowedOrigin", () => {
  it("allows a request from our own site", () => {
    expect(isAllowedOrigin("https://music-recs-roan.vercel.app", "music-recs-roan.vercel.app")).toBe(true);
    expect(isAllowedOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("refuses a request from another site", () => {
    expect(isAllowedOrigin("https://evil.example", "music-recs-roan.vercel.app")).toBe(false);
    expect(isAllowedOrigin("https://music-recs-roan.vercel.app.evil.example", "music-recs-roan.vercel.app")).toBe(false);
  });

  it("refuses an unparseable or opaque origin", () => {
    expect(isAllowedOrigin("null", "music-recs-roan.vercel.app")).toBe(false);
    expect(isAllowedOrigin("not a url", "music-recs-roan.vercel.app")).toBe(false);
  });

  // Non-browser clients (curl, tests) send no Origin, and they can't carry a visitor's cookie anyway
  it("allows a request without an Origin header", () => {
    expect(isAllowedOrigin(undefined, "music-recs-roan.vercel.app")).toBe(true);
  });
});
