import { useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { colors } from "../theme/colors";

interface HtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
}

/**
 * 掲示板本文用の簡易HTML編集コンポーネント。
 * 選択したテキストをHTMLタグで囲むツールバー方式（TextInput + 下部にWebViewでのライブプレビュー）。
 * TODO: 実際の保存時にはサーバー側でHTMLサニタイズ（許可タグのホワイトリスト化）を行うこと。
 */
export function HtmlEditor({ value, onChange }: HtmlEditorProps) {
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const { start, end } = selection;
    const selected = value.slice(start, end) || placeholder;
    const nextValue = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(nextValue);
  };

  const handleBulletList = () => {
    const { start, end } = selection;
    const selected = value.slice(start, end);
    const items = (selected || "リスト項目")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => `<li>${line}</li>`)
      .join("");
    onChange(value.slice(0, start) + `<ul>${items}</ul>` + value.slice(end));
  };

  return (
    <View>
      <View style={styles.toolbar}>
        <Pressable style={styles.toolButton} onPress={() => wrapSelection("<strong>", "</strong>", "太字テキスト")}>
          <Text style={styles.toolButtonTextBold}>B</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => wrapSelection("<em>", "</em>", "斜体テキスト")}>
          <Text style={styles.toolButtonTextItalic}>I</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => wrapSelection("<u>", "</u>", "下線テキスト")}>
          <Text style={styles.toolButtonTextUnderline}>U</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={handleBulletList}>
          <Ionicons name="list" size={16} />
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        placeholder="本文（HTMLタグを使ったリッチな装飾ができます）"
        multiline
      />
      <Text style={styles.previewLabel}>プレビュー</Text>
      <View style={styles.previewBox}>
        {Platform.OS === "web" ? (
          <Text>{value.replace(/<[^>]+>/g, "")}</Text>
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html: `<html><body style="font-family:-apple-system,sans-serif;font-size:14px;margin:0;">${value || "（本文プレビュー）"}</body></html>` }}
            style={styles.webview}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", gap: 8, marginBottom: 6 },
  toolButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  toolButtonTextBold: { fontWeight: "700" },
  toolButtonTextItalic: { fontStyle: "italic" },
  toolButtonTextUnderline: { textDecorationLine: "underline" },
  input: {
    backgroundColor: "#F4FFFB",
    borderRadius: 12,
    padding: 10,
    minHeight: 120,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    textAlignVertical: "top",
  },
  previewLabel: { fontSize: 12, color: colors.textMuted, marginTop: 8, marginBottom: 4 },
  previewBox: {
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
  },
  webview: { height: 120, backgroundColor: "transparent" },
});
