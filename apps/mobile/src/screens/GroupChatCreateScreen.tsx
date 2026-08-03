import { View, Text, TextInput, StyleSheet } from "react-native";

/**
 * グループチャット作成画面（7章 4番）
 * メンバーカテゴリを指定してメンバーを一括選択できる補助機能を提供する（5.2.1）
 */
export function GroupChatCreateScreen() {
  // TODO: MemberCategories一覧の取得、カテゴリ選択によるメンバー一括追加ロジック
  return (
    <View style={styles.container}>
      <Text style={styles.label}>グループ名</Text>
      <TextInput style={styles.input} placeholder="例）3歳児クラス" />
      <Text style={styles.label}>メンバーカテゴリから一括選択</Text>
      {/* TODO: MemberCategoriesのチェックボックス一覧 */}
      <Text style={styles.label}>メンバー個別選択</Text>
      {/* TODO: Usersの検索・個別選択 */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: "#F4FFFB", borderRadius: 12, padding: 10 },
});
