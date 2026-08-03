import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockBulletinPosts, mockMemberCategories } from "@on-connect/shared";
import type { BulletinStackParamList } from "../navigation/AppNavigator";
import { HtmlEditor } from "../components/HtmlEditor";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<BulletinStackParamList, "BulletinEdit">;

/**
 * 掲示板投稿・編集画面（7章 7番）
 * 「タイトル」「本文（HTML編集対応）」「添付ファイル」の構成、閲覧対象のメンバーカテゴリを選択（5.3.3）
 * TODO: 保存処理をAPIに接続する（現状はダミーデータの表示のみ、保存すると一覧に戻るだけ）
 */
export function BulletinEditScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const existingPost = postId ? mockBulletinPosts.find((p) => p.postId === postId) : undefined;

  const [title, setTitle] = useState(existingPost?.title ?? "");
  const [body, setBody] = useState(existingPost?.body ?? "");

  const handleSave = () => {
    // TODO: POST/PUT /bulletin-posts を呼び出して保存する
    console.log("save bulletin post", { title, body });
    if (postId) {
      navigation.navigate("BulletinDetail", { postId });
    } else {
      navigation.navigate("BulletinList");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>タイトル</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="例）夏祭り開催のお知らせ"
      />
      <Text style={styles.label}>カテゴリー：{existingPost?.category ?? "お知らせ"}</Text>
      <Text style={styles.label}>本文</Text>
      <HtmlEditor value={body} onChange={setBody} />
      <Text style={styles.label}>閲覧可能なメンバーカテゴリ（未選択なら全体公開）</Text>
      {mockMemberCategories.map((c) => (
        <Text key={c.categoryId} style={styles.category}>
          {existingPost?.visibleCategoryIds.includes(c.categoryId) ? "☑" : "☐"} {c.name}
        </Text>
      ))}
      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>保存</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: "#F4FFFB", borderRadius: 12, padding: 10 },
  category: { paddingVertical: 4 },
  saveButton: { marginTop: 20, backgroundColor: colors.brand, borderRadius: 12, padding: 12, alignItems: "center" },
  saveButtonText: { fontWeight: "700" },
});
