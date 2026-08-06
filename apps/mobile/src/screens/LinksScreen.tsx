import { View, Text, SectionList, Pressable, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useOrgData } from "../context/OrgDataContext";

/** リンク集画面（7章 9番）：カテゴリー別一覧、タップで外部サイトを開く（5.5） */
export function LinksScreen() {
  const { orgLinks } = useOrgData();
  const links = [...orgLinks].sort((a, b) => a.sortOrder - b.sortOrder);
  const categories = Array.from(new Set(links.map((l) => l.category ?? "その他")));
  const sections = categories.map((category) => ({
    title: category,
    data: links.filter((l) => (l.category ?? "その他") === category),
  }));

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.linkId}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        ListEmptyComponent={<Text>リンクは登録されていません。</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => Linking.openURL(item.url)} style={styles.linkRow}>
            <Ionicons name="open-outline" size={16} color={colors.brandDark} />
            <Text style={styles.linkItem}>{item.title}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 12, color: colors.textMuted, marginTop: 12, marginBottom: 4 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  linkItem: { color: "#1A1A1A" },
});
