// 像 Promise.all(items.map(fn))，但同時最多跑 limit 個。結果的順序跟輸入一樣
// 用在打外部 API：推薦一次要查 10 位歌手，全部同時打會撞到 Last.fm、iTunes 的速率限制
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  // 開 limit 個「工人」，每個做完一件就去拿下一件，直到沒有為止
  // JavaScript 是單執行緒，next++ 不會有兩個工人拿到同一件
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
