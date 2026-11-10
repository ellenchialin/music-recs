// How tall the autocomplete list may be so it stays inside the visible area. On phones the keyboard
// covers the lower part of the screen without changing 100dvh, so CSS alone can't know the room;
// the caller passes the visual viewport (window.visualViewport) and where the list sits now. The
// list grows away from its anchored edge: the bottom when it opens upward, the top when downward

// Two rows: anything shorter isn't usable
export const MIN_LIST_HEIGHT = 96;
// Gap from the screen edge
const GAP = 8;

type Edges = { top: number; bottom: number };

export function listMaxHeight({
  list,
  viewport,
  opensUp,
  cap,
}: {
  // Both relative to the page's layout viewport, as getBoundingClientRect and visualViewport.offsetTop are
  list: Edges;
  viewport: { top: number; height: number };
  opensUp: boolean;
  cap: number;
}): number {
  const room = opensUp ? list.bottom - viewport.top : viewport.top + viewport.height - list.top;
  return Math.min(cap, Math.max(MIN_LIST_HEIGHT, Math.floor(room - GAP)));
}
