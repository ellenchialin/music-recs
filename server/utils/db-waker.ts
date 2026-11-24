// Neon sleeps after 5 idle minutes and its first query then takes 0.6–1.2 s (2.6 s after a quiet weekend). Waking it while a
// page renders hides that behind the visitor's first seconds on any page, before they ask for
// anything. Throttled per server instance, so a busy minute costs one query, not one per page

type Options = { wake: () => Promise<unknown>; intervalMs: number };

// Returns the wake to hand to waitUntil, or null when this request doesn't need one
export function createDbWaker({ wake, intervalMs }: Options) {
  let lastWokeAt = -Infinity;

  return (path: string, now: Date): Promise<void> | null => {
    if (!isPage(path) || now.getTime() - lastWokeAt < intervalMs) return null;
    // Set before the query, so pages requested while it runs don't start another
    lastWokeAt = now.getTime();
    return wake().then(
      () => {},
      () => {
        lastWokeAt = -Infinity;
      },
    );
  };
}

// API routes query the database themselves; assets and files never need it
function isPage(path: string) {
  const pathname = path.split("?")[0]!;
  return !pathname.startsWith("/api/") && !pathname.startsWith("/_") && !pathname.split("/").pop()!.includes(".");
}
