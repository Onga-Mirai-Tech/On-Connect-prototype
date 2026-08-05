import { useState } from "react";
import { useParams } from "react-router-dom";
import { Phone, Send, AlertTriangle, Clock, Bell, BellOff, Users, AtSign } from "lucide-react";
import {
  mockChatRooms,
  mockMembers,
  mockMessages,
  mockCurrentUserId,
  toggleReaction,
  type Message,
} from "@on-connect/shared";
import { colors } from "../theme/colors";
import { ReactionBar } from "../components/ReactionBar";
import { MemberPicker } from "../components/MemberPicker";

const memberName = (userId: string) => mockMembers.find((m) => m.userId === userId)?.displayName ?? userId;

/** 本文末尾の "@検索語" にマッチする（カーソルが末尾にある前提の簡易実装） */
const mentionPattern = /@([^\s@]*)$/;

/**
 * チャット詳細画面（7章 3番）
 * メッセージ作成時に予約送信・緊急通知オプション、1対1トークには発信ボタンを表示（5.2.2〜5.2.4）
 * TODO: AppSyncのクエリ・ミューテーション・サブスクリプションに置き換える（現状はダミーデータ表示）
 */
export function ChatRoomPage() {
  const { roomId = "" } = useParams();
  const room = mockChatRooms.find((r) => r.roomId === roomId);
  const otherMemberId = room?.memberUserIds.find((id) => id !== mockCurrentUserId);
  const otherMember = mockMembers.find((m) => m.userId === otherMemberId);
  const roomTitle = room ? (room.isGroup ? room.name ?? "グループ" : otherMember?.displayName ?? "") : roomId;
  const participantNames = room?.isGroup
    ? room.memberUserIds.map((id) => memberName(id)).join("、")
    : "";

  const [messages, setMessages] = useState<Message[]>(mockMessages[roomId] ?? []);
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [forceNotify, setForceNotify] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  const roomMembers = mockMembers.filter(
    (m) => room?.memberUserIds.includes(m.userId) && m.userId !== mockCurrentUserId,
  );
  const mentionMatch = mentionPattern.exec(body);

  const handleSelectMention = (member: (typeof roomMembers)[number]) => {
    if (!mentionMatch) return;
    const prefix = body.slice(0, body.length - mentionMatch[0].length);
    setBody(`${prefix}@${member.displayName} `);
    setMentionedUserIds((prev) => (prev.includes(member.userId) ? prev : [...prev, member.userId]));
  };

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
        mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
        createdAt: new Date().toISOString(),
      },
    ]);
    setBody("");
    setForceNotify(false);
    setScheduledAt("");
    setMentionedUserIds([]);
  };

  const handleCall = () => {
    // TODO: POST /calls を呼び出し、Chime SDK Meeting/Attendee を取得して発信画面へ遷移する
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    // TODO: AppSyncのミューテーションでリアクションを永続化する
    setMessages((prev) =>
      prev.map((m) =>
        m.messageId === messageId ? { ...m, reactions: toggleReaction(m.reactions, emoji, mockCurrentUserId) } : m,
      ),
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0 }}>{roomTitle}</h2>
          {room?.isGroup && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 4, fontSize: 12, color: colors.textMuted, marginTop: 4, maxWidth: 480 }}>
              <Users size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{participantNames}</span>
            </div>
          )}
          {room && !room.isGroup && otherMember && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, marginTop: 4 }}>
              {otherMember.notificationStatus === "ON" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: colors.brandDark }}>
                  <Bell size={14} /> 通知ON
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: colors.textMuted }}>
                  <BellOff size={14} /> 通知OFF（相手には届きにくい状態です）
                </span>
              )}
            </div>
          )}
        </div>
        {room && !room.isGroup && (
          <button onClick={handleCall} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
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
                {!!m.mentionedUserIds?.length && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: colors.brandDark, fontSize: 11 }}>
                    <AtSign size={12} /> {m.mentionedUserIds.map((id) => memberName(id)).join("、")} 宛
                  </div>
                )}
                <div>{m.body}</div>
              </div>
              <div style={{ marginTop: 4 }}>
                <ReactionBar
                  reactions={m.reactions}
                  currentUserId={mockCurrentUserId}
                  onToggle={(emoji) => handleToggleReaction(m.messageId, emoji)}
                />
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={room?.isGroup ? "メッセージを入力（@でメンション）" : "メッセージを入力"}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
          {room?.isGroup && mentionMatch && (
            <MemberPicker members={roomMembers} query={mentionMatch[1]} onSelect={handleSelectMention} />
          )}
        </div>
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
