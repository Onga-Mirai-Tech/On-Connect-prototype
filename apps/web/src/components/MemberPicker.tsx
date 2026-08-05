import { memberMatchesQuery, type User } from "@on-connect/shared";
import { colors } from "../theme/colors";

interface MemberPickerProps {
  members: User[];
  query: string;
  onSelect: (member: User) => void;
}

/**
 * メンバー検索・選択の共通コンポーネント（チャットの`@`メンション用に新設。
 * グループチャット作成時のメンバー個別選択でも将来利用できる汎用的な作り）。
 * 該当者が無ければ何も表示しない。
 */
export function MemberPicker({ members, query, onSelect }: MemberPickerProps) {
  const filtered = members.filter((m) => memberMatchesQuery(m, query));
  if (filtered.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 4px)",
        left: 0,
        minWidth: 200,
        maxHeight: 180,
        overflowY: "auto",
        background: colors.background,
        border: `1px solid ${colors.surface}`,
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        zIndex: 5,
      }}
    >
      {filtered.map((m) => (
        <button
          key={m.userId}
          type="button"
          onClick={() => onSelect(m)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "8px 12px",
            background: "transparent",
            border: "none",
          }}
        >
          {m.displayName}
        </button>
      ))}
    </div>
  );
}
