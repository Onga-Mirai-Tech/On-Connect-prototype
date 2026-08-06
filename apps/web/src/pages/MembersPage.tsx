import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, MessageCircle, Phone, Search } from "lucide-react";
import { mockChatRooms, memberMatchesQuery } from "@on-connect/shared";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";

/**
 * メンバー一覧画面（下部タブ）
 * 各メンバーの通知ON/OFF状況を確認でき、その場から個別チャット・音声通話を開始できる。
 * 氏名・ふりがな（ひらがな）検索とロール別グループ表示に対応する。
 */
export function MembersPage() {
  const { currentUserId } = useAuth();
  const { members, roles, memberCategories } = useOrgData();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const categoryName = (categoryId: string) =>
    memberCategories.find((c) => c.categoryId === categoryId)?.name ?? "";

  const handleChat = (memberId: string) => {
    // 既存の1対1ルームがあればそれを開き、無ければ仮のルームIDへ遷移する
    const existingRoom = mockChatRooms.find(
      (r) => !r.isGroup && r.memberUserIds.includes(currentUserId ?? "") && r.memberUserIds.includes(memberId),
    );
    navigate(`/chat/${existingRoom?.roomId ?? `dm-${memberId}`}`);
  };

  const handleCall = (memberName: string) => {
    // TODO: POST /calls を呼び出しChime SDK Meetingを開始する（現状はデモ用の着信画面へ遷移）
    navigate(`/calls/incoming?name=${encodeURIComponent(memberName)}`);
  };

  const filteredMembers = members.filter((m) => memberMatchesQuery(m, query));

  // ロール別（rolesの定義順）にグループ化して表示する
  const groups = roles
    .map((role) => ({
      role,
      members: filteredMembers.filter((m) => m.roleId === role.roleId),
    }))
    .filter((g) => g.members.length > 0);

  return (
    <div>
      <h2>メンバー一覧</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "12px 0" }}>
        <Search size={16} />
        <input
          type="text"
          placeholder="メンバー名・ふりがなで検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
      {groups.length === 0 && <p>該当するメンバーが見つかりません。</p>}
      {groups.map((group) => (
        <div key={group.role.roleId} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, color: colors.textMuted }}>{group.role.name}</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {group.members.map((member) => {
              const isSelf = member.userId === currentUserId;
              return (
                <li
                  key={member.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: `1px solid ${colors.surface}`,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <strong>{member.displayName}</strong>
                      {isSelf && <span style={{ fontSize: 12, color: colors.textMuted }}>（自分）</span>}
                      {member.notificationStatus === "ON" ? (
                        <Bell size={14} color={colors.brandDark} />
                      ) : (
                        <BellOff size={14} color={colors.textMuted} />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>
                      {categoryName(member.memberCategoryId)}
                      {member.className ? ` ・ ${member.className}` : ""}
                    </div>
                  </div>
                  {!isSelf && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleChat(member.userId)}
                        style={{ display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <MessageCircle size={14} /> チャット
                      </button>
                      <button
                        onClick={() => handleCall(member.displayName)}
                        style={{ display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Phone size={14} /> 通話
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
