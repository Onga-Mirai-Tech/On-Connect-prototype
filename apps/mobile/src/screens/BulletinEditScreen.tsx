import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockBulletinPosts, type BulletinPost } from "@on-connect/shared";
import type { BulletinStackParamList } from "../navigation/AppNavigator";
import { HtmlEditor } from "../components/HtmlEditor";
import { colors } from "../theme/colors";
import { useOrgData } from "../context/OrgDataContext";
import { orgApi } from "../api/orgApi";

type Props = NativeStackScreenProps<BulletinStackParamList, "BulletinEdit">;

/**
 * 掲示板投稿・編集画面（7章 7番）
 * 「タイトル」「本文（HTML編集対応）」「添付ファイル」の構成、閲覧対象のメンバーカテゴリを選択（5.3.3）
 * Phase 8c：投稿本体をAPIに接続。カテゴリー・公開範囲は元々このモバイル画面では表示のみで変更UIが
 * 無かったため、既存値をそのまま送信する（新規作成時は先頭カテゴリー・全体公開）
 */
export function BulletinEditScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const { memberCategories, bulletinCategories } = useOrgData();
  const [existingPost, setExistingPost] = useState<BulletinPost | undefined>(undefined);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postId) return;
    (async () => {
      let post: BulletinPost | undefined;
      try {
        post = await orgApi.getBulletinPost(postId);
      } catch {
        post = mockBulletinPosts.find((p) => p.postId === postId);
      }
      setExistingPost(post);
      setTitle(post?.title ?? "");
      setBody(post?.body ?? "");
    })();
  }, [postId]);

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const input = {
        title,
        body,
        categoryId: existingPost?.categoryId ?? bulletinCategories[0]?.categoryId,
        visibleCategoryIds: existingPost?.visibleCategoryIds ?? [],
      };
      if (postId) {
        await orgApi.updateBulletinPost(postId, input);
        navigation.navigate("BulletinDetail", { postId });
      } else {
        const post = await orgApi.createBulletinPost(input);
        navigation.navigate("BulletinDetail", { postId: post.postId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿の保存に失敗しました");
    } finally {
      setSaving(false);
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
      <Text style={styles.label}>
        カテゴリー：
        {bulletinCategories.find((c) => c.categoryId === existingPost?.categoryId)?.name ??
          bulletinCategories[0]?.name}
      </Text>
      <Text style={styles.label}>本文</Text>
      <HtmlEditor value={body} onChange={setBody} />
      <Text style={styles.label}>閲覧可能なメンバーカテゴリ（未選択なら全体公開）</Text>
      {memberCategories.map((c) => (
        <Text key={c.categoryId} style={styles.category}>
          {existingPost?.visibleCategoryIds.includes(c.categoryId) ? "☑" : "☐"} {c.name}
        </Text>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
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
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  saveButton: { marginTop: 20, backgroundColor: colors.brand, borderRadius: 12, padding: 12, alignItems: "center" },
  saveButtonText: { fontWeight: "700" },
});
