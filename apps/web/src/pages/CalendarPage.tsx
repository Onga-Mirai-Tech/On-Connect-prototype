import { CalendarDays, ExternalLink } from "lucide-react";
import { mockScheduleCacheEvents, mockOrgLinks } from "@on-connect/shared";
import { colors } from "../theme/colors";

const calendarLink = mockOrgLinks.find((l) => l.category === "カレンダー");

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
 * カレンダー画面（7章 8番）：Googleカレンダー閲覧専用、今後の予定をリスト形式で表示（5.4）
 * 共有カレンダーの作成・編集はGoogleカレンダー側で行う運用を変えず、アプリ内では
 * 閲覧のみを提供することでメンバーが確認するハードルを下げる。月表示・週表示は設けず、
 * シンプルに「今後の予定」のみをリストで見せる。
 * TODO: GET /calendar/events からScheduleCacheの予定一覧を取得する（現状はダミーデータ表示）
 */
export function CalendarPage() {
  const now = Date.now();
  const events = [...mockScheduleCacheEvents]
    .filter((e) => new Date(e.endAt).getTime() >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <div>
      <h2>今後の予定</h2>
      <p style={{ fontSize: 12, color: colors.textMuted }}>
        連携カレンダー：園の共有カレンダー（サービスアカウント方式、編集はGoogleカレンダー側で行ってください）
      </p>
      {calendarLink && (
        <a
          href={calendarLink.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 8 }}
        >
          <ExternalLink size={14} /> Googleカレンダーで開く（詳細確認・編集）
        </a>
      )}
      {events.length === 0 && <p>今後の予定はまだありません。</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {events.map((e) => (
          <li
            key={e.eventId}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: `1px solid ${colors.surface}` }}
          >
            <CalendarDays size={16} color={colors.brandDark} />
            <div>
              <div style={{ fontWeight: 700 }}>{e.title}</div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>{formatRange(e.startAt, e.endAt)}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
