/**
 * Asia/Tokyo基準の YYYY-MM-DD 文字列を返す（offsetDays日ぶんずらす）。
 * 日本にサマータイムは無いため、単純な24時間加算で安全に日付をずらせる。
 */
export function tokyoDateString(offsetDays = 0): string {
  const shifted = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(shifted);
}

/** 任意のISO日時文字列を、Asia/Tokyo基準の YYYY-MM-DD 文字列に変換する */
export function toTokyoDateString(isoString: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(isoString));
}

/**
 * 任意のISO日時文字列を、Asia/Tokyo基準の YYYY-MM-DDTHH:mm:ss 文字列に変換する
 * （EventBridge Schedulerの`at()`式にそのまま渡せる形式。ScheduleExpressionTimezoneに
 * "Asia/Tokyo"を指定する前提で、こちらはJSTのwall-clock表記を返す）
 */
export function toTokyoDateTimeString(isoString: string): string {
  const date = toTokyoDateString(isoString);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(isoString));
  return `${date}T${time}`;
}
