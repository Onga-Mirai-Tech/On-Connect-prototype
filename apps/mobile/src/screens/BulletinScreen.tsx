import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockBulletinPosts, mockBulletinCategories } from "@on-connect/shared";
import type { BulletinStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<BulletinStackParamList, "BulletinList">;

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const categoryName = (categoryId: string | undefined) =>
  mockBulletinCategories.find((c) => c.categoryId === categoryId)?.name;

/**
 * 掲示板一覧画面（7章 6番）：カテゴリー別フィルター（5.3.1）＋本文検索
 * タイトルを目立たせ、本文はHTMLタグを除いた冒頭数行をプレビュー表示する。
 * TODO: GET /bulletin-posts にサーバーサイド検索を実装する（現状はクライアント側フィルタ）。
 */
export function BulletinScreen({ navigation }: Props) {
  const [categoryId, setCategoryId] = useState("all");
  const [query, setQuery] = useState("");
  const posts = [...mockBulletinPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filteredPosts = posts
    .filter((p) => categoryId === "all" || p.categoryId === categoryId)
    .filter((p) => {
      const q = query.toLowerCase();
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || stripHtml(p.body).toLowerCase().includes(q);
    });

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.navigate("BulletinEdit", {})}>
        <Text style={styles.newPost}>＋ 新規投稿</Text>
      </Pressable>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="タイトル・本文を検索"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <View style={styles.categories}>
        <Pressable
          onPress={() => setCategoryId("all")}
          style={[styles.categoryChip, categoryId === "all" && styles.categoryChipActive]}
        >
          <Text style={categoryId === "all" ? styles.categoryActive : styles.category}>すべて</Text>
        </Pressable>
        {mockBulletinCategories.map((c) => (
          <Pressable
            key={c.categoryId}
            onPress={() => setCategoryId(c.categoryId)}
            style={[styles.categoryChip, c.categoryId === categoryId && styles.categoryChipActive]}
          >
            <Text style={c.categoryId === categoryId ? styles.categoryActive : styles.category}>{c.name}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.postId}
        ListEmptyComponent={
          <Text>{query.trim() ? "一致する投稿が見つかりません。" : "投稿はまだありません。"}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("BulletinDetail", { postId: item.postId })}
            style={styles.postRow}
          >
            <View style={styles.postMeta}>
              {categoryName(item.categoryId) === "緊急連絡" && (
                <Ionicons name="alert-circle-outline" size={12} color={colors.danger} />
              )}
              <Text style={styles.postCategory}>
                {categoryName(item.categoryId)} ・ {item.createdAt.slice(0, 10)}
              </Text>
            </View>
            <Text style={styles.postTitle}>{item.title}</Text>
            <Text style={styles.postPreview} numberOfLines={2}>
              {stripHtml(item.body)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  newPost: { fontWeight: "600", marginBottom: 12 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10 },
  categories: { flexDirection: "row", gap: 8, marginBottom: 12 },
  categoryChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.surface },
  categoryChipActive: { backgroundColor: "#D7FBEC" },
  category: { color: "#6B7280" },
  categoryActive: { color: "#33CC99", fontWeight: "700" },
  postRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.surface },
  postMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  postCategory: { fontSize: 12, color: colors.textMuted },
  postTitle: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  postPreview: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
