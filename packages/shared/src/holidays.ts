import holidayJp from "@holiday-jp/holiday_jp";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** "YYYY-MM-DD" からJST基準の曜日ラベル（例："月"）を返す */
export function weekdayLabelForDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()];
}

/** "YYYY-MM-DD" が祝日であれば祝日名を返す（祝日でなければundefined） */
export function holidayNameForDate(dateStr: string): string | undefined {
  const holidays = holidayJp.holidays as Record<string, { name: string }>;
  return holidays[dateStr]?.name;
}
