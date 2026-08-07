import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { isImageAttachment, type AttachmentContext, type AttachmentRef } from "@on-connect/shared";
import { orgApi } from "../api/orgApi";
import { colors } from "../theme/colors";

interface AttachmentPreviewProps {
  attachments: AttachmentRef[] | undefined;
  context: AttachmentContext;
  ownerId: string;
}

/**
 * チャットメッセージ・掲示板投稿の添付ファイル表示（Phase 12、モバイル版）。
 * 画像はサムネイル表示、文書は「ダウンロード」ボタン→シェアシート（Phase 6の`.ics`共有と同じパターン）。
 */
export function AttachmentPreview({ attachments, context, ownerId }: AttachmentPreviewProps) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!attachments || attachments.length === 0) return;
    let cancelled = false;

    void Promise.all(
      attachments
        .filter((a) => isImageAttachment(a.contentType))
        .map(async (a) => {
          try {
            const { downloadUrl } = await orgApi.requestDownloadUrl({ context, ownerId, key: a.key });
            return [a.key, downloadUrl] as const;
          } catch {
            return [a.key, undefined] as const;
          }
        }),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [key, url] of entries) if (url) next[key] = url;
      setUrls(next);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments?.map((a) => a.key).join(","), context, ownerId]);

  async function handleDownload(a: AttachmentRef) {
    try {
      const { downloadUrl } = await orgApi.requestDownloadUrl({ context, ownerId, key: a.key });
      const fileUri = `${FileSystem.cacheDirectory}${a.fileName}`;
      const { uri } = await FileSystem.downloadAsync(downloadUrl, fileUri);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: a.contentType });
      }
    } catch {
      // ダウンロード失敗時は何もしない（再度タップで再試行できる）
    }
  }

  if (!attachments || attachments.length === 0) return null;

  return (
    <View style={styles.container}>
      {attachments.map((a) =>
        isImageAttachment(a.contentType) ? (
          urls[a.key] ? (
            <Image key={a.key} source={{ uri: urls[a.key] }} style={styles.image} />
          ) : (
            <View key={a.key} style={[styles.image, styles.imagePlaceholder]} />
          )
        ) : (
          <Pressable key={a.key} onPress={() => void handleDownload(a)} style={styles.fileRow}>
            <Ionicons name="document" size={14} color={colors.text} />
            <Text style={styles.fileName} numberOfLines={1}>
              {a.fileName}
            </Text>
          </Pressable>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  image: { width: 120, height: 120, borderRadius: 8 },
  imagePlaceholder: { backgroundColor: colors.surface },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
    maxWidth: 200,
  },
  fileName: { flex: 1, fontSize: 13 },
});
