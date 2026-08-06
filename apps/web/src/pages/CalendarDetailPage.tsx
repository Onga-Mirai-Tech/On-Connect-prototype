import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2, CalendarPlus } from "lucide-react";
import {
  mockCalendarEvents,
  mockCalendarCategories,
  mockMembers,
  buildIcsForEvent,
} from "@on-connect/shared";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

const categoryName = (categoryId: string | undefined) =>
  mockCalendarCategories.find((c) => c.categoryId === categoryId)?.name;
const memberName = (userId: string) => mockMembers.find((m) => m.userId === userId)?.displayName ?? userId;

const formatRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dateFmt: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", weekday: "short" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${start.toLocaleDateString("ja-JP", dateFmt)} ${start.toLocaleTimeString("ja-JP", timeFmt)}〜${end.toLocaleTimeString("ja-JP", timeFmt)}`;
};

/**
 * カレンダー予定の詳細画面。全メンバーが編集・削除できるが、誤操作防止のため削除前に確認ダイアログを出す
 * （自分が作成した予定でない場合は、その旨を強調して警告する）。
 * TODO: GET/DELETE /calendar-events/{eventId} をAPIに接続する（現状はダミーデータ表示）
 */
export function CalendarDetailPage() {
  const { currentUserId } = useAuth();
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const [event] = useState(() => mockCalendarEvents.find((e) => e.eventId === eventId));

  if (!event) {
    return <p>予定が見つかりません。</p>;
  }

  const isOwnEvent = event.authorId === currentUserId;

  const handleDelete = () => {
    const message = isOwnEvent
      ? "この予定を削除しますか？"
      : `この予定は${memberName(event.authorId)}さんが作成したものです。本当に削除しますか？`;
    if (!window.confirm(message)) return;
    // TODO: DELETE /calendar-events/{eventId} を呼び出す
    navigate("/calendar");
  };

  const handleAddToCalendar = () => {
    const blob = new Blob([buildIcsForEvent(event)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h2 style={{ margin: 0 }}>{event.title}</h2>
        <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
          <Link to={`/calendar/${event.eventId}/edit`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Pencil size={14} /> 編集
          </Link>
          <button type="button" onClick={handleDelete} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Trash2 size={14} /> 削除
          </button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.textMuted, margin: "8px 0" }}>
        <span>{formatRange(event.startAt, event.endAt)}</span>
        {categoryName(event.categoryId) && <span>・{categoryName(event.categoryId)}</span>}
        {event.visibleCategoryIds.length > 0 && <span>・公開範囲限定</span>}
      </div>
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
        作成者：{memberName(event.authorId)}
      </div>
      {event.description && (
        <div style={{ border: `1px solid ${colors.surface}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
          {event.description}
        </div>
      )}
      <button type="button" onClick={handleAddToCalendar} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <CalendarPlus size={16} /> カレンダーに追加（.icsをダウンロード）
      </button>
    </div>
  );
}
