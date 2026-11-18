// What one record's reason line shows, from what /api/reasons has sent for its level so far.
// A reason that arrived always wins; otherwise the stream's state decides

export type LevelReasons = {
  // Arrived so far: the reason, or null when the model had nothing it was sure of
  byArtist: Record<string, string | null>;
  // streaming until the stream ends with "done" or "stopped" (and why)
  status: "streaming" | "done" | "off" | "limit" | "failed" | "timeout";
};

export type ReasonState =
  | { kind: "pending" }
  | { kind: "ai"; text: string }
  // "Similar to …"; note says why there's no AI reason when the visitor should know
  | { kind: "fallback"; note?: "limit" }
  | { kind: "failed"; why: "failed" | "timeout" };

export function reasonStateFor(level: LevelReasons | undefined, artist: string): ReasonState {
  if (!level) return { kind: "pending" };
  if (artist in level.byArtist) {
    const reason = level.byArtist[artist];
    return reason ? { kind: "ai", text: reason } : { kind: "fallback" };
  }
  switch (level.status) {
    case "streaming":
      return { kind: "pending" };
    case "limit":
      return { kind: "fallback", note: "limit" };
    case "failed":
    case "timeout":
      return { kind: "failed", why: level.status };
    default:
      return { kind: "fallback" };
  }
}
