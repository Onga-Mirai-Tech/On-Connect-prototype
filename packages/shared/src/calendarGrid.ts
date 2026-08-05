import type { CalendarEvent } from "./types";

/** ローカルタイムゾーン基準の "YYYY-MM-DD" 文字列に変換する */
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" をローカルタイムゾーンの深夜0時のDateに変換する */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key: string, delta: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export function addMonths(key: string, delta: number): string {
  const d = parseDateKey(key);
  d.setMonth(d.getMonth() + delta);
  return toDateKey(d);
}

/** その日を含む週の日曜日（週の始まり）を返す */
export function startOfWeek(key: string): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() - d.getDay());
  return toDateKey(d);
}

export interface MonthGridDay {
  dateKey: string;
  inCurrentMonth: boolean;
}

/**
 * 月表示カレンダー用のグリッドを組み立てる（日曜始まり、6週×7日=42マス固定）。
 * 前後月の日付でパディングすることで、月をまたいでも表示の高さが揺れない。
 */
export function buildMonthGrid(year: number, month: number): MonthGridDay[][] {
  const firstOfMonth = toDateKey(new Date(year, month - 1, 1));
  const gridStart = startOfWeek(firstOfMonth);

  const days: MonthGridDay[] = Array.from({ length: 42 }, (_, i) => {
    const dateKey = addDays(gridStart, i);
    return { dateKey, inCurrentMonth: parseDateKey(dateKey).getMonth() === month - 1 };
  });

  const weeks: MonthGridDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

/** 週表示カレンダー用に、指定日を含む週（日曜〜土曜）の7日分のdateKeyを返す */
export function buildWeekDays(anchorKey: string): string[] {
  const start = startOfWeek(anchorKey);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 指定した日付(dateKey)に該当する予定を返す（複数日にまたがる予定は該当する全日で該当扱いになる） */
export function eventsOnDate(events: CalendarEvent[], dateKey: string): CalendarEvent[] {
  return events.filter((e) => {
    const startKey = toDateKey(new Date(e.startAt));
    const endKey = toDateKey(new Date(e.endAt));
    return startKey <= dateKey && dateKey <= endKey;
  });
}
