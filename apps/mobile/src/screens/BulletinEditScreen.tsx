import { View, Text, TextInput, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockBulletinPosts, mockMemberCategories } from "@on-connect/shared";
import type { BulletinStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<BulletinStackParamList, "BulletinEdit">;

/** 掲示板投稿・編集画面（7章 7番）：閲覧対象のメンバーカテゴリを選択（5.3.3） */
export function BulletinEditScreen({ route }: Props) {
  const { postId } = route.params;
  // TODO: 保存処理をAPIに接続する（現状はダミーデータの表示のみ）
  const existingPost = postId ? mockBulletinPosts.find((p) => p.postId === postId) : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>カテゴリー：{existingPost?.category ?? "お知らせ"}</Text>
      <Text style={styles.label}>本文</Text>
      <TextInput style={styles.textarea} multiline placeholder="本文" defaultValue={existingPost?.body} />
      <Text style={styles.label}>閲覧可能なメンバーカテゴリ（未選択なら全体公開）</Text>
      {mockMemberCategories.map((c) => (
        <Text key={c.categoryId} style={styles.category}>
          {existingPost?.visibleCategoryIds.includes(c.categoryId) ? "☑" : "☐"} {c.name}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 8 },
  textarea: { backgroundColor: "#F4FFFB", borderRadius: 12, padding: 10, minHeight: 120 },
  category: { paddingVertical: 4 },
});
