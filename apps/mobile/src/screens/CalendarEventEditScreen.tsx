import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockCalendarEvents, type CalendarEvent } from "@on-connect/shared";
import type { CalendarStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import { useOrgData } from "../context/OrgDataContext";
import { orgApi } from "../api/orgApi";

type Props = NativeStackScreenProps<CalendarStackParamList, "CalendarEventEdit">;

/**
 * カレンダー予定の作成・編集画面。全メンバーが作成・編集できる（バックエンド側に権限チェックは無い）。
 * Phase 8c：保存処理をAPIに接続。カテゴリー・公開範囲は元々このモバイル画面では表示のみで変更UIが
 * 無かったため、既存値をそのまま送信する（新規作成時は先頭カテゴリー・全体公開）
 */
export function CalendarEventEditScreen({ route, navigation }: Props) {
  const headerHeight = useHeaderHeight();
  const { eventId } = route.params;
  const { memberCategories, calendarCategories } = useOrgData();
  const [existingEvent, setExistingEvent] = useState<CalendarEvent | undefined>(undefined);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      let event: CalendarEvent | undefined;
      try {
        event = await orgApi.getCalendarEvent(eventId);
      } catch {
        event = mockCalendarEvents.find((e) => e.eventId === eventId);
      }
      setExistingEvent(event);
      setTitle(event?.title ?? "");
      setDescription(event?.description ?? "");
      setStartAt(event?.startAt.slice(0, 16) ?? "");
      setEndAt(event?.endAt.slice(0, 16) ?? "");
    })();
  }, [eventId]);

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const input = {
        title,
        description,
        startAt,
        endAt,
        categoryId: existingEvent?.categoryId ?? calendarCategories[0]?.categoryId,
        visibleCategoryIds: existingEvent?.visibleCategoryIds ?? [],
      };
      if (eventId) {
        await orgApi.updateCalendarEvent(eventId, input);
        navigation.navigate("CalendarDetail", { eventId });
      } else {
        const event = await orgApi.createCalendarEvent(input);
        navigation.navigate("CalendarDetail", { eventId: event.eventId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "予定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
          表示カテゴリー：{calendarCategories.find((c) => c.categoryId === existingEvent?.categoryId)?.name ??
            calendarCategories[0]?.name}
        </Text>
        <Text style={styles.label}>閲覧可能なメンバーカテゴリ（未選択なら全体公開）</Text>
        {memberCategories.map((c) => (
          <Text key={c.categoryId} style={styles.category}>
            {existingEvent?.visibleCategoryIds.includes(c.categoryId) ? "☑" : "☐"} {c.name}
          </Text>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>保存</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: "#F4FFFB", borderRadius: 12, padding: 10 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  category: { paddingVertical: 4 },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  saveButton: { marginTop: 20, backgroundColor: colors.brand, borderRadius: 12, padding: 12, alignItems: "center" },
  saveButtonText: { fontWeight: "700" },
});
