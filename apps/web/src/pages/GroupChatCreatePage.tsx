import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { memberMatchesQuery } from "@on-connect/shared";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";
import { chatClient } from "../api/chatClient";

const GROUP_NAME_PREFIX = "GC_";

/**
 * グループチャット作成画面（7章 4番）
 * グループチャット名には作成時に自動で「GC_」を付与する（グループチャットと一目で区別するため）。
 * Phase 8d：メンバー個別選択UIを新設しcreateRoomに接続。
 * 「メンバーカテゴリから一括選択」は既存のTODOのまま対象外（個別選択のみで最低限機能させる）。
 */
export function GroupChatCreatePage() {
  const { currentUserId } = useAuth();
  const { members: allMembers } = useOrgData();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const members = allMembers.filter((m) => m.userId !== currentUserId);

  const toggleMember = (userId: string) => {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleCreate = async () => {
    if (!currentUserId) return;
    if (!name.trim()) {
      setError("グループ名を入力してください。");
      return;
    }
    if (selectedUserIds.length === 0) {
      setError("メンバーを1人以上選択してください。");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const room = await chatClient.createRoom({
        isGroup: true,
        name: `${GROUP_NAME_PREFIX}${name}`,
        memberUserIds: [...selectedUserIds, currentUserId],
      });
      navigate(`/chat/${room.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "グループチャットの作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2>グループチャット作成</h2>
      <label>
        グループ名：
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 4 }}>
          <span
            style={{
              padding: "8px 10px",
              background: colors.surface,
              borderRadius: "10px 0 0 10px",
              color: colors.textMuted,
              fontWeight: 600,
            }}
          >
            {GROUP_NAME_PREFIX}
          </span>
          <input
            type="text"
            placeholder="例）3歳児クラス"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ borderRadius: "0 10px 10px 0", flex: 1 }}
          />
        </div>
        <p style={{ fontSize: 12, color: colors.textMuted, margin: "4px 0 0" }}>
          表示名：{GROUP_NAME_PREFIX}
          {name || "（未入力）"}
        </p>
      </label>
      <div>
        <h3>メンバー個別選択（{selectedUserIds.length}人選択中）</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="メンバー名・ふりがなで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
        </div>
        <ul style={{ listStyle: "none", padding: 0, maxHeight: 320, overflowY: "auto" }}>
          {members
            .filter((m) => memberMatchesQuery(m, query))
            .map((m) => (
              <li key={m.userId}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(m.userId)}
                    onChange={() => toggleMember(m.userId)}
                  />
                  {m.displayName}
                  {m.className && <span style={{ color: colors.textMuted, fontSize: 12 }}>（{m.className}）</span>}
                </label>
              </li>
            ))}
        </ul>
      </div>
      {error && <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>}
      <button type="button" onClick={handleCreate} disabled={submitting}>
        作成
      </button>
    </div>
  );
}
