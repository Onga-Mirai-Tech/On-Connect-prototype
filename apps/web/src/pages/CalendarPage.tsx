import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { mockCalendarEvents, mockCalendarCategories } from "@on-connect/shared";
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

/**
 * カレンダー画面（7章 8番）：独立DB管理の共有カレンダー（Googleカレンダーとは同期しない）。
 * 全メンバーが予定を作成・編集できる。月表示・週表示は設けず、今後の予定をリスト形式で見せる。
 * TODO: GET /calendar-events から一覧を取得する（現状はダミーデータ表示）
 */
export function CalendarPage() {
  const now = Date.now();
  const events = [...mockCalendarEvents]
    .filter((e) => new Date(e.endAt).getTime() >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>今後の予定</h2>
        <Link to="/calendar/new">＋ 予定を追加</Link>
      </div>
      {events.length === 0 && <p>今後の予定はまだありません。</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {events.map((e) => (
          <li key={e.eventId} style={{ padding: "10px 0", borderBottom: `1px solid ${colors.surface}` }}>
            <Link
              to={`/calendar/${e.eventId}`}
              style={{ display: "flex", alignItems: "center", gap: 8, color: colors.text }}
            >
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
