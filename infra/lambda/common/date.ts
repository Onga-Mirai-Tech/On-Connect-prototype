/**
 * Asia/Tokyo基準の YYYY-MM-DD 文字列を返す（offsetDays日ぶんずらす）。
 * 日本にサマータイムは無いため、単純な24時間加算で安全に日付をずらせる。
 */
export function tokyoDateString(offsetDays = 0): string {
  const shifted = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(shifted);
}
