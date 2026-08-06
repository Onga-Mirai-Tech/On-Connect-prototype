import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ComponentProps } from "react";
import type { MenuStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<MenuStackParamList, "MenuHome">;

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const menuItems: { to: keyof MenuStackParamList; label: string; icon: IoniconName }[] = [
  { to: "Members", label: "メンバー", icon: "people-outline" },
  { to: "ShiftManagement", label: "シフト管理", icon: "calendar-number-outline" },
  { to: "Links", label: "リンク集", icon: "link-outline" },
  { to: "Settings", label: "個人設定", icon: "settings-outline" },
];

/**
 * メニュー画面（Phase 4）：下部タブから溢れたメンバー一覧・シフト管理・リンク集・個人設定への導線。
 * 管理者機能はブラウザ版限定の既存方針を維持し、モバイル版には設けない。
 */
export function MenuScreen({ navigation }: Props) {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <FlatList
        data={menuItems}
        keyExtractor={(item) => item.to}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate(item.to)} style={styles.row}>
            <Ionicons name={item.icon} size={20} color={colors.brandDark} />
            <Text style={styles.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable onPress={() => signOut()} style={styles.signOutRow}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.signOutLabel}>サインアウト</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  label: { flex: 1, fontWeight: "700" },
  signOutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: 12,
  },
  signOutLabel: { color: colors.danger, fontWeight: "700" },
});
