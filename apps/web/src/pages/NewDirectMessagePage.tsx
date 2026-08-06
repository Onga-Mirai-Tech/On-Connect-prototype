import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserRound } from "lucide-react";
import { mockChatRooms, memberMatchesQuery } from "@on-connect/shared";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";
import { chatClient } from "../api/chatClient";

/**
 * 個別メッセージ開始画面（登録メンバーを検索し、1対1チャットを開く窓口）
 * チャット一覧画面の「＋ 個別メッセージ」から遷移する。
 * Phase 8d：既存ルームをAppSyncで検索し、無ければcreateRoomで新規作成する（失敗時はダミーデータで
 * 遷移のみ行う従来の簡易フォールバック）。
 */
export function NewDirectMessagePage() {
  const { currentUserId } = useAuth();
  const { members: allMembers } = useOrgData();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null);
  const members = allMembers.filter((m) => m.userId !== currentUserId);

  const handleSelect = async (userId: string) => {
    if (!currentUserId) return;
    setCreatingUserId(userId);
    try {
      const rooms = await chatClient.listChatRoomsForUser(currentUserId);
      const existingRoom = rooms.find((r) => !r.isGroup && r.memberUserIds.includes(userId));
      if (existingRoom) {
        navigate(`/chat/${existingRoom.roomId}`);
        return;
      }
      const created = await chatClient.createRoom({ isGroup: false, memberUserIds: [currentUserId, userId] });
      navigate(`/chat/${created.roomId}`);
    } catch {
      const existingRoom = mockChatRooms.find(
        (r) => !r.isGroup && r.memberUserIds.includes(currentUserId) && r.memberUserIds.includes(userId),
      );
      navigate(`/chat/${existingRoom?.roomId ?? `dm-${userId}`}`);
    } finally {
      setCreatingUserId(null);
    }
  };

  return (
    <div>
      <h2>個別メッセージ</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Search size={16} />
        <input
          type="text"
          placeholder="メンバー名・ふりがなで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        />
      </div>
      {members.length === 0 && <p>登録メンバーが見つかりません。</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {members
          .filter((m) => memberMatchesQuery(m, query))
          .map((m) => (
            <li key={m.userId}>
              <button
                onClick={() => handleSelect(m.userId)}
                disabled={creatingUserId === m.userId}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: 8 }}
              >
                <UserRound size={18} />
                {m.displayName}
                {m.className && <span style={{ color: "#6B7280", fontSize: 12 }}>（{m.className}）</span>}
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
