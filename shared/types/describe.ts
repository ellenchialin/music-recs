// POST /api/describe: what the page sends and the events it streams back, shared by server and client

// A sentence or two is plenty to describe a sound, and it bounds what goes into the prompt
export const MAX_DESCRIPTION_LENGTH = 200;

export type SuggestedArtist = { name: string; why: string };

export type AgentStep =
  | { id: string; label: string; status: "running" }
  | { id: string; label: string; status: "done"; summary: string }
  | { id: string; label: string; status: "failed" };

export type DescribeStopReason = "off" | "limit" | "failed" | "timeout" | "nothing";

export type DescribeEvent =
  | ({ type: "step" } & AgentStep)
  | { type: "suggestion"; artists: SuggestedArtist[] }
  | { type: "done" }
  | { type: "stopped"; why: DescribeStopReason };
