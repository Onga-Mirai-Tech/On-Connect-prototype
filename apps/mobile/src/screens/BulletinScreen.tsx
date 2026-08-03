import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockBulletinPosts } from "@on-connect/shared";
import type { BulletinStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<BulletinStackParamList, "BulletinList">;

/**
 * 掲示板一覧・詳細画面（7章 6番）：カテゴリー別フィルター（5.3.1）＋本文検索
 * TODO: GET /bulletin-posts にサーバーサイド検索を実装する（現状はクライアント側フィルタ）。
 */
export function BulletinScreen({ navigation }: Props) {
  const [category, setCategory] = useState("すべて");
  const [query, setQuery] = useState("");
  const categories = ["すべて", "お知らせ", "行事", "緊急連絡"];
  const posts = [...mockBulletinPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filteredPosts = posts
    .filter((p) => category === "すべて" || p.category === category)
    .filter((p) => p.body.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.navigate("BulletinEdit", {})}>
        <Text style={styles.newPost}>＋ 新規投稿</Text>
      </Pressable>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="本文を検索" value={query} onChangeText={setQuery} />
      </View>
      <View style={styles.categories}>
        {categories.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.categoryChip, c === category && styles.categoryChipActive]}
          >
            <Text style={c === category ? styles.categoryActive : styles.category}>{c}</Text>
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
          <Pressable onPress={() => navigation.navigate("BulletinEdit", { postId: item.postId })} style={styles.postRow}>
            <View style={styles.postMeta}>
              {item.category === "緊急連絡" && <Ionicons name="alert-circle-outline" size={12} color={colors.danger} />}
              <Text style={styles.postCategory}>
                {item.category} ・ {item.createdAt.slice(0, 10)}
              </Text>
            </View>
            <Text style={styles.postItem} numberOfLines={2}>
              {item.body}
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
  postItem: { marginTop: 2 },
});
