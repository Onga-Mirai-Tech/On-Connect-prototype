import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  mockCalendarEvents,
  mockCalendarCategories,
  weekdayLabelForDate,
  holidayNameForDate,
  toDateKey,
  parseDateKey,
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  eventsOnDate,
  type CalendarEvent,
} from "@on-connect/shared";
import { colors } from "../theme/colors";

const categoryName = (categoryId: string | undefined) =>
  mockCalendarCategories.find((c) => c.categoryId === categoryId)?.name;

const formatRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameDay = start.toDateString() === end.toDateString();
  const dateFmt: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", weekday: "short" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (sameDay) {
    return `${start.toLocaleDateString("ja-JP", dateFmt)} ${start.toLocaleTimeString("ja-JP", timeFmt)}〜${end.toLocaleTimeString("ja-JP", timeFmt)}`;
  }
  return `${start.toLocaleDateString("ja-JP", dateFmt)}〜${end.toLocaleDateString("ja-JP", dateFmt)}`;
};

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

const formatWeekLabel = (anchorKey: string) => {
  const days = buildWeekDays(anchorKey);
  const fmt: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric" };
  return `${parseDateKey(days[0]).toLocaleDateString("ja-JP", fmt)}〜${parseDateKey(days[6]).toLocaleDateString("ja-JP", fmt)}`;
};

type ViewMode = "month" | "week" | "list";
const viewModeLabels: Record<ViewMode, string> = { month: "月", week: "週", list: "リスト" };

/**
 * カレンダー画面（7章 8番）：独立DB管理の共有カレンダー（Googleカレンダーとは同期しない）。
 * 全メンバーが予定を作成・編集できる。月表示・週表示・リスト表示の3モードに対応する。
 * TODO: GET /calendar-events から一覧を取得する（現状はダミーデータ表示）
 */
export function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [refDate, setRefDate] = useState(() => toDateKey(new Date()));
  const todayKey = toDateKey(new Date());

  const goPrev = () => setRefDate((d) => (viewMode === "week" ? addDays(d, -7) : addMonths(d, -1)));
  const goNext = () => setRefDate((d) => (viewMode === "week" ? addDays(d, 7) : addMonths(d, 1)));
  const goToWeek = (dateKey: string) => {
    setRefDate(dateKey);
    setViewMode("week");
  };

  const refDateObj = parseDateKey(refDate);
  const year = refDateObj.getFullYear();
  const month = refDateObj.getMonth() + 1;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>カレンダー</h2>
        <Link to="/calendar/new">＋ 予定を追加</Link>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(Object.keys(viewModeLabels) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              style={{
                background: viewMode === mode ? colors.brand : colors.surface,
                fontWeight: viewMode === mode ? 700 : 400,
                border: "none",
                borderRadius: 8,
                padding: "6px 14px",
              }}
            >
              {viewModeLabels[mode]}
            </button>
          ))}
        </div>
        {viewMode !== "list" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={goPrev} aria-label="前へ" style={{ display: "flex", padding: 4 }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, minWidth: 100, textAlign: "center" }}>
              {viewMode === "month" ? `${year}年${month}月` : formatWeekLabel(refDate)}
            </span>
            <button type="button" onClick={goNext} aria-label="次へ" style={{ display: "flex", padding: 4 }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {viewMode === "month" && (
        <MonthGrid year={year} month={month} events={mockCalendarEvents} todayKey={todayKey} onSelectDay={goToWeek} />
      )}
      {viewMode === "week" && <WeekGrid anchorKey={refDate} events={mockCalendarEvents} todayKey={todayKey} />}
      {viewMode === "list" && <ListView events={mockCalendarEvents} />}
    </div>
  );
}

function MonthGrid({
  year,
  month,
  events,
  todayKey,
  onSelectDay,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  todayKey: string;
  onSelectDay: (dateKey: string) => void;
}) {
  const weeks = buildMonthGrid(year, month);
  const weekdayHeaders = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", fontSize: 12, marginBottom: 4 }}>
        {weekdayHeaders.map((w, i) => (
          <div key={w} style={{ color: i === 0 ? colors.danger : i === 6 ? colors.brandDark : colors.textMuted }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {weeks.flat().map((cell) => {
          const dayEvents = eventsOnDate(events, cell.dateKey);
          const day = parseDateKey(cell.dateKey);
          const weekday = weekdayLabelForDate(cell.dateKey);
          const holiday = holidayNameForDate(cell.dateKey);
          const isRedDay = weekday === "日" || !!holiday;
          const isSaturday = weekday === "土";
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;
          const isToday = cell.dateKey === todayKey;

          return (
            <div
              key={cell.dateKey}
              onClick={() => onSelectDay(cell.dateKey)}
              style={{
                minHeight: 84,
                padding: 4,
                borderRadius: 8,
                border: isToday ? `2px solid ${colors.brandDark}` : `1px solid ${colors.surface}`,
                background: cell.inCurrentMonth ? colors.background : colors.surface,
                opacity: cell.inCurrentMonth ? 1 : 0.5,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: isToday ? 700 : 400,
                  color: isRedDay ? colors.danger : isSaturday ? colors.brandDark : colors.text,
                }}
              >
                {day.getDate()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                {visible.map((e) => (
                  <Link
                    key={e.eventId}
                    to={`/calendar/${e.eventId}`}
                    onClick={(ev) => ev.stopPropagation()}
                    style={{
                      display: "block",
                      fontSize: 11,
                      padding: "1px 4px",
                      borderRadius: 4,
                      background: colors.brand,
                      color: colors.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {e.title}
                  </Link>
                ))}
                {overflow > 0 && <div style={{ fontSize: 10, color: colors.textMuted }}>+{overflow}件</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ anchorKey, events, todayKey }: { anchorKey: string; events: CalendarEvent[]; todayKey: string }) {
  const days = buildWeekDays(anchorKey);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
      {days.map((dateKey) => {
        const dayEvents = eventsOnDate(events, dateKey).sort((a, b) => a.startAt.localeCompare(b.startAt));
        const day = parseDateKey(dateKey);
        const weekday = weekdayLabelForDate(dateKey);
        const holiday = holidayNameForDate(dateKey);
        const isRedDay = weekday === "日" || !!holiday;
        const isSaturday = weekday === "土";
        const isToday = dateKey === todayKey;

        return (
          <div
            key={dateKey}
            style={{
              border: isToday ? `2px solid ${colors.brandDark}` : `1px solid ${colors.surface}`,
              borderRadius: 8,
              padding: 6,
              minHeight: 180,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: isRedDay ? colors.danger : isSaturday ? colors.brandDark : colors.text }}>
              {day.getMonth() + 1}/{day.getDate()}（{weekday}）
            </div>
            {holiday && <div style={{ fontSize: 10, color: colors.danger, marginBottom: 4 }}>{holiday}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
              {dayEvents.map((e) => (
                <Link
                  key={e.eventId}
                  to={`/calendar/${e.eventId}`}
                  style={{ display: "block", fontSize: 11, padding: "3px 5px", borderRadius: 6, background: colors.brand, color: colors.text }}
                >
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div style={{ fontSize: 10, color: colors.textMuted }}>
                    {formatTime(e.startAt)}〜{formatTime(e.endAt)}
                  </div>
                </Link>
              ))}
              {dayEvents.length === 0 && <div style={{ fontSize: 10, color: colors.textMuted }}>予定なし</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ events }: { events: CalendarEvent[] }) {
  const now = Date.now();
  const upcoming = [...events]
    .filter((e) => new Date(e.endAt).getTime() >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>今後の予定</h3>
      {upcoming.length === 0 && <p>今後の予定はまだありません。</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {upcoming.map((e) => (
          <li key={e.eventId} style={{ padding: "10px 0", borderBottom: `1px solid ${colors.surface}` }}>
            <Link to={`/calendar/${e.eventId}`} style={{ display: "flex", alignItems: "center", gap: 8, color: colors.text }}>
              <CalendarDays size={16} color={colors.brandDark} />
              <div>
                <div style={{ fontWeight: 700 }}>{e.title}</div>
                <div style={{ fontSize: 12, color: colors.textMuted }}>
                  {formatRange(e.startAt, e.endAt)}
                  {categoryName(e.categoryId) && `・${categoryName(e.categoryId)}`}
                  {e.visibleCategoryIds.length > 0 && "・公開範囲限定"}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
