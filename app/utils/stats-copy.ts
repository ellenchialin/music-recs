// Number formatting and wording for the results page

// A real minus sign, and no sign on a value that rounds to zero
function signed(n: number): string {
  const rounded = n.toFixed(1);
  if (Number(rounded) === 0) return "0.0";
  return n > 0 ? `+${rounded}` : `−${rounded.slice(1)}`;
}

export const formatDifference = signed;

// With one listener there's no spread to estimate an interval from
export function formatInterval(ci: [number, number] | null): string {
  return ci ? `${signed(ci[0])} to ${signed(ci[1])}` : "Needs 2+ listeners";
}

// The words under the big number
export function headline(difference: number): string {
  const rounded = Number(difference.toFixed(1));
  if (rounded === 0) return "points between picked and random songs";
  return `points ${rounded > 0 ? "higher" : "lower"} for picked songs`;
}
