import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockCalendarEvents, mockCalendarCategories } from "@on-connect/shared";
import type { CalendarStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import { useOrgData } from "../context/OrgDataContext";

type Props = NativeStackScreenProps<CalendarStackParamList, "CalendarEventEdit">;

/**
 * カレンダー予定の作成・編集画面。全メンバーが作成・編集できる（バックエンド側に権限チェックは無い）。
 * TODO: 保存処理をAPIに接続する（現状はダミーデータの表示のみ、保存すると一覧に戻るだけ）
 */
export function CalendarEventEditScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { memberCategories } = useOrgData();
  const existingEvent = eventId ? mockCalendarEvents.find((e) => e.eventId === eventId) : undefined;

  const [title, setTitle] = useState(existingEvent?.title ?? "");
  const [description, setDescription] = useState(existingEvent?.description ?? "");
  const [startAt, setStartAt] = useState(existingEvent?.startAt.slice(0, 16) ?? "");
  const [endAt, setEndAt] = useState(existingEvent?.endAt.slice(0, 16) ?? "");

  const handleSave = () => {
    // TODO: POST/PUT /calendar-events を呼び出して保存する
    console.log("save calendar event", { title, description, startAt, endAt });
    if (eventId) {
      navigation.navigate("CalendarDetail", { eventId });
    } else {
      navigation.navigate("CalendarList");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>タイトル</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="例）定例会議" />
      <Text style={styles.label}>説明（任意）</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Text style={styles.label}>開始日時（YYYY-MM-DDTHH:mm）</Text>
      <TextInput style={styles.input} value={startAt} onChangeText={setStartAt} placeholder="2026-08-05T17:30" />
      <Text style={styles.label}>終了日時（YYYY-MM-DDTHH:mm）</Text>
      <TextInput style={styles.input} value={endAt} onChangeText={setEndAt} placeholder="2026-08-05T18:30" />
      <Text style={styles.label}>
        表示カテゴリー：{mockCalendarCategories.find((c) => c.categoryId === existingEvent?.categoryId)?.name ??
          mockCalendarCategories[0]?.name}
      </Text>
      <Text style={styles.label}>閲覧可能なメンバーカテゴリ（未選択なら全体公開）</Text>
      {memberCategories.map((c) => (
        <Text key={c.categoryId} style={styles.category}>
          {existingEvent?.visibleCategoryIds.includes(c.categoryId) ? "☑" : "☐"} {c.name}
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
  multiline: { minHeight: 72, textAlignVertical: "top" },
  category: { paddingVertical: 4 },
  saveButton: { marginTop: 20, backgroundColor: colors.brand, borderRadius: 12, padding: 12, alignItems: "center" },
  saveButtonText: { fontWeight: "700" },
});
