// Plain-language results for the Taste Check: no "control group" or confidence intervals on screen

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const format = (n: number) => String(Number(n.toFixed(1)));

function describeSide(label: string, ratings: number[]) {
  return ratings.length === 1
    ? `the ${label} ${format(ratings[0]!)}`
    : `the ${label.replace(/^song /, "songs ").replace(/pick$/, "picks")} ${format(mean(ratings))} on average`;
}

// "You gave the songs picked for you 3.5 on average, and the random pick 3. The picks won this round."
export function describeRound(songs: { isRecommended: boolean; rating: number }[]): string {
  const picked = songs.filter((s) => s.isRecommended).map((s) => s.rating);
  const random = songs.filter((s) => !s.isRecommended).map((s) => s.rating);
  const diff = mean(picked) - mean(random);
  const verdict = diff > 0 ? "The picks won this round." : diff < 0 ? "The random picks won this round." : "It's a tie this round.";
  return `You gave ${describeSide("song picked for you", picked)}, and ${describeSide("random pick", random)}. ${verdict}`;
}

// Only claims a difference once the 95% interval excludes zero; until then it could be chance
export function describeOverall({ difference, ci, visitors }: { difference: number; ci: [number, number] | null; visitors: number }) {
  const listeners = `${visitors} ${visitors === 1 ? "listener" : "listeners"}`;
  const clear = ci !== null && (ci[0] > 0 || ci[1] < 0);
  if (!clear) return `No clear difference yet across ${listeners}. More ratings will tell.`;
  const direction = difference > 0 ? "higher" : "lower";
  return `Across ${listeners}, songs picked for them score ${format(Math.abs(difference))} points ${direction} (out of 5) than random picks.`;
}
