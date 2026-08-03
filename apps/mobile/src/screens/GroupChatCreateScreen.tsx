import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

const GROUP_NAME_PREFIX = "GC_";

/**
 * グループチャット作成画面（7章 4番）
 * メンバーカテゴリを指定してメンバーを一括選択できる補助機能を提供する（5.2.1）
 * グループチャット名には作成時に自動で「GC_」を付与する（グループチャットと一目で区別するため）。
 */
export function GroupChatCreateScreen() {
  const [name, setName] = useState("");
  // TODO: MemberCategories一覧の取得、カテゴリ選択によるメンバー一括追加ロジック

  const handleCreate = () => {
    const groupName = `${GROUP_NAME_PREFIX}${name}`;
    // TODO: AppSync側にグループチャットルームを作成するmutationを実装する
    console.log("create group chat", groupName);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>グループ名</Text>
      <View style={styles.nameRow}>
        <View style={styles.prefixBadge}>
          <Text style={styles.prefixText}>{GROUP_NAME_PREFIX}</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="例）3歳児クラス"
          value={name}
          onChangeText={setName}
        />
      </View>
      <Text style={styles.preview}>
        表示名：{GROUP_NAME_PREFIX}
        {name || "（未入力）"}
      </Text>
      <Text style={styles.label}>メンバーカテゴリから一括選択</Text>
      {/* TODO: MemberCategoriesのチェックボックス一覧 */}
      <Text style={styles.label}>メンバー個別選択</Text>
      {/* TODO: Usersの検索・個別選択 */}
      <Pressable style={styles.createButton} onPress={handleCreate}>
        <Text style={styles.createButtonText}>作成</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 8 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  prefixBadge: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  prefixText: { color: colors.textMuted, fontWeight: "700" },
  input: {
    flex: 1,
    backgroundColor: "#F4FFFB",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    padding: 10,
  },
  preview: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  createButton: { marginTop: 24, backgroundColor: colors.brand, borderRadius: 12, padding: 12, alignItems: "center" },
  createButtonText: { fontWeight: "700" },
});
