import { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, Users, User, Search } from "lucide-react";
import { mockChatRooms, mockMembers, mockMessages, mockCurrentUserId } from "@on-connect/shared";

/**
 * チャット一覧画面（7章 3番）：1対1／グループチャットの一覧、既読／未読表示
 * 本文検索：入力したキーワードを含むメッセージがあるルームのみに絞り込み、
 * 一致したメッセージのスニペットを表示する（現状はダミーデータに対するクライアント側フィルタ）。
 * TODO: AppSync側にメッセージ検索クエリを実装し、サーバーサイド検索に置き換える。
 */
export function ChatListPage() {
  const [query, setQuery] = useState("");

  const rooms = mockChatRooms
    .filter((room) => room.memberUserIds.includes(mockCurrentUserId))
    .map((room) => {
      const otherMemberId = room.memberUserIds.find((id) => id !== mockCurrentUserId);
      const otherMember = mockMembers.find((m) => m.userId === otherMemberId);
      const displayName = room.isGroup ? room.name ?? "グループ" : otherMember?.displayName ?? "不明なメンバー";
      const roomMessages = mockMessages[room.roomId] ?? [];
      const lastMessage = roomMessages[roomMessages.length - 1];

      if (!query.trim()) {
        return { ...room, displayName, previewMessage: lastMessage, matched: true };
      }
      const matches = roomMessages.filter((m) => m.body.toLowerCase().includes(query.toLowerCase()));
      const bestMatch = matches[matches.length - 1];
      return { ...room, displayName, previewMessage: bestMatch, matched: matches.length > 0 };
    })
    .filter((room) => room.matched)
    .sort((a, b) => (b.previewMessage?.createdAt ?? b.createdAt).localeCompare(a.previewMessage?.createdAt ?? a.createdAt));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>チャット</h2>
        <div style={{ display: "flex", gap: 16 }}>
          <Link to="/chat/new-direct" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <User size={16} /> 個別メッセージ
          </Link>
          <Link to="/chat/new-group" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <UserPlus size={16} /> グループ作成
          </Link>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "12px 0" }}>
        <Search size={16} />
        <input
          type="text"
          placeholder="メッセージ本文を検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
      {rooms.length === 0 && (
        <p>{query.trim() ? "一致するメッセージが見つかりません。" : "チャットルームはまだありません。"}</p>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {rooms.map((room) => (
          <li key={room.roomId} style={{ padding: "10px 0", borderBottom: "1px solid #F4FFFB" }}>
            <Link to={`/chat/${room.roomId}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {room.isGroup ? <Users size={18} /> : <User size={18} />}
              <div>
                <div style={{ fontWeight: 700 }}>{room.displayName}</div>
                {room.previewMessage && (
                  <div style={{ fontSize: 12, color: "#6B7280" }}>
                    {room.previewMessage.forceNotify && "【緊急】"}
                    {room.previewMessage.body}
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
