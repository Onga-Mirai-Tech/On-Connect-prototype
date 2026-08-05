import type { CalendarEvent } from "./types";

function formatIcsDate(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** iCalendar(RFC 5545)のTEXT値エスケープ規則（バックスラッシュ・カンマ・セミコロン・改行） */
function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/**
 * カレンダーの予定1件分をiCalendar(.ics)形式の文字列に変換する純粋関数。
 * Lambda（GET /calendar-events/{eventId}/ical）・Web・Mobileの3箇所から共通利用する。
 */
export function buildIcsForEvent(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//On-Connect//Calendar//JA",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.eventId}@on-connect.app`,
    `DTSTAMP:${formatIcsDate(event.updatedAt)}`,
    `DTSTART:${formatIcsDate(event.startAt)}`,
    `DTEND:${formatIcsDate(event.endAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
