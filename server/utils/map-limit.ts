// Promise.all(items.map(fn)) with at most `limit` calls in flight, results in input order.
// Keeps a 10-artist lookup under Last.fm's and iTunes' rate limits
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  // `limit` workers each take the next item when free; next++ is safe on a single thread
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
