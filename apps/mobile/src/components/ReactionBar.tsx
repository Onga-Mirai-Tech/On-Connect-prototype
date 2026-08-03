import { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { reactionEmojis, type Reaction } from "@on-connect/shared";
import { colors } from "../theme/colors";

interface ReactionBarProps {
  reactions: Reaction[] | undefined;
  currentUserId: string;
  onToggle: (emoji: string) => void;
}

/**
 * チャットメッセージ・掲示板投稿で共通利用する絵文字リアクションバー。
 * 既存のリアクションはチップとして表示し、タップで自分の参加をトグルする。
 * 「+」ボタンから新しい絵文字を選んで追加することもできる。
 */
export function ReactionBar({ reactions, currentUserId, onToggle }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const visibleReactions = (reactions ?? []).filter((r) => r.userIds.length > 0);

  return (
    <View style={styles.row}>
      {visibleReactions.map((r) => {
        const reacted = r.userIds.includes(currentUserId);
        return (
          <Pressable
            key={r.emoji}
            onPress={() => onToggle(r.emoji)}
            style={[styles.chip, reacted && styles.chipActive]}
          >
            <Text style={styles.emoji}>{r.emoji}</Text>
            <Text style={styles.count}>{r.userIds.length}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => setPickerOpen(true)} style={styles.addButton}>
        <Ionicons name="happy-outline" size={16} color={colors.textMuted} />
      </Pressable>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={styles.picker}>
            {reactionEmojis.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  onToggle(emoji);
                  setPickerOpen(false);
                }}
                style={styles.pickerItem}
              >
                <Text style={styles.pickerEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: "#D7FBEC", borderWidth: 1, borderColor: colors.brandDark },
  emoji: { fontSize: 13 },
  count: { fontSize: 11, color: colors.textMuted },
  addButton: { padding: 4 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", alignItems: "center" },
  picker: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 14,
  },
  pickerItem: { padding: 4 },
  pickerEmoji: { fontSize: 24 },
});
