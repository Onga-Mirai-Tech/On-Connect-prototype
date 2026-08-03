import { useState } from "react";
import { useParams } from "react-router-dom";
import { Phone, Send, AlertTriangle, Clock } from "lucide-react";
import {
  mockChatRooms,
  mockMembers,
  mockMessages,
  mockCurrentUserId,
  type Message,
} from "@on-connect/shared";
import { colors } from "../theme/colors";

const memberName = (userId: string) => mockMembers.find((m) => m.userId === userId)?.displayName ?? userId;

/**
 * チャット詳細画面（7章 3番）
 * メッセージ作成時に予約送信・緊急通知オプション、1対1トークには発信ボタンを表示（5.2.2〜5.2.4）
 * TODO: AppSyncのクエリ・ミューテーション・サブスクリプションに置き換える（現状はダミーデータ表示）
 */
export function ChatRoomPage() {
  const { roomId = "" } = useParams();
  const room = mockChatRooms.find((r) => r.roomId === roomId);
  const otherMemberId = room?.memberUserIds.find((id) => id !== mockCurrentUserId);
  const roomTitle = room ? (room.isGroup ? room.name ?? "グループ" : memberName(otherMemberId ?? "")) : roomId;

  const [messages, setMessages] = useState<Message[]>(mockMessages[roomId] ?? []);
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [forceNotify, setForceNotify] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    // TODO: AppSync sendMessage mutation を呼び出す（scheduledAt指定時は予約送信）
    setMessages((prev) => [
      ...prev,
      {
        messageId: `local-${Date.now()}`,
        roomId,
        senderId: mockCurrentUserId,
        body,
        readByUserIds: [mockCurrentUserId],
        status: scheduledAt ? "scheduled" : "sent",
        scheduledAt: scheduledAt || undefined,
        forceNotify,
        createdAt: new Date().toISOString(),
      },
    ]);
    setBody("");
    setForceNotify(false);
    setScheduledAt("");
  };

  const handleCall = () => {
    // TODO: POST /calls を呼び出し、Chime SDK Meeting/Attendee を取得して発信画面へ遷移する
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>{roomTitle}</h2>
        {room && !room.isGroup && (
          <button onClick={handleCall} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Phone size={16} /> 発信
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", border: "1px solid #eee", borderRadius: 14, padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && <p>メッセージはまだありません。</p>}
        {messages.map((m) => {
          const isSelf = m.senderId === mockCurrentUserId;
          return (
            <div key={m.messageId} style={{ alignSelf: isSelf ? "flex-end" : "flex-start", maxWidth: "70%" }}>
              {room?.isGroup && !isSelf && (
                <div style={{ fontSize: 11, color: "#6B7280" }}>{memberName(m.senderId)}</div>
              )}
              <div
                style={{
                  background: m.forceNotify ? "#FDECEC" : isSelf ? colors.brand : colors.surface,
                  border: m.forceNotify ? `1px solid ${colors.danger}` : "none",
                  borderRadius: 16,
                  padding: "8px 12px",
                }}
              >
                {m.forceNotify && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: colors.danger, fontSize: 11, fontWeight: 700 }}>
                    <AlertTriangle size={12} /> 緊急連絡
                  </div>
                )}
                {m.status === "scheduled" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: colors.textMuted, fontSize: 11 }}>
                    <Clock size={12} /> 予約送信（{m.scheduledAt}）
                  </div>
                )}
                <div>{m.body}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="メッセージを入力" />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={16} /> 予約送信日時：
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={forceNotify}
            onChange={(e) => setForceNotify(e.target.checked)}
          />
          <AlertTriangle size={16} color={colors.danger} /> 緊急連絡として送信（管理者権限）
        </label>
        <button type="submit" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Send size={16} /> 送信
        </button>
      </form>
    </div>
  );
}
