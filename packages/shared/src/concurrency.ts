/**
 * 同時実行数を制限しつつ配列の各要素を非同期処理する。
 * ShiftManagementPageの月間一括取得（最大31件×2種類）のような多数の並列fetchが
 * AWSアカウントのLambda同時実行数上限に達して500エラーになるのを避けるために使う。
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
