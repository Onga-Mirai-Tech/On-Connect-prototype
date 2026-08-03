import { useState } from "react";
import { colors } from "../theme/colors";

const GROUP_NAME_PREFIX = "GC_";

/**
 * グループチャット作成画面（7章 4番）
 * メンバーカテゴリを指定してメンバーを一括選択できる補助機能を提供する（5.2.1）
 * グループチャット名には作成時に自動で「GC_」を付与する（グループチャットと一目で区別するため）。
 */
export function GroupChatCreatePage() {
  const [name, setName] = useState("");
  // TODO: MemberCategories一覧の取得、カテゴリ選択によるメンバー一括追加ロジック

  const handleCreate = () => {
    const groupName = `${GROUP_NAME_PREFIX}${name}`;
    // TODO: AppSync側にグループチャットルームを作成するmutationを実装する
    console.log("create group chat", groupName);
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
        <h3>メンバーカテゴリから一括選択</h3>
        {/* TODO: MemberCategoriesのチェックボックス一覧 */}
      </div>
      <div>
        <h3>メンバー個別選択</h3>
        {/* TODO: Usersの検索・個別選択 */}
      </div>
      <button type="button" onClick={handleCreate}>
        作成
      </button>
    </div>
  );
}
