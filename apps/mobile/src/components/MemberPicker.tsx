import { View, Text, Pressable, StyleSheet } from "react-native";
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
    <View style={styles.container}>
      {filtered.map((m) => (
        <Pressable key={m.userId} onPress={() => onSelect(m)} style={styles.row}>
          <Text style={styles.name}>{m.displayName}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: 12,
    overflow: "hidden",
  },
  row: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.surface },
  name: { fontSize: 13 },
});
