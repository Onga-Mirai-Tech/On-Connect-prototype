import { useState } from "react";
import { View, Text, Pressable, ActionSheetIOS, Platform, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  isAllowedAttachmentType,
  isImageAttachment,
  type AttachmentContext,
  type AttachmentRef,
} from "@on-connect/shared";
import { orgApi } from "../api/orgApi";
import { colors } from "../theme/colors";

interface AttachmentPickerProps {
  context: AttachmentContext;
  /** チャットはroomId、掲示板はpostId（新規作成時はdraft ID）を渡す */
  ownerId: string;
  value: AttachmentRef[];
  onChange: (next: AttachmentRef[]) => void;
}

interface PickedAsset {
  uri: string;
  fileName: string;
  contentType: string;
  size: number;
}

interface PendingUpload {
  fileName: string;
  status: "uploading" | "error";
  message?: string;
}

/**
 * チャット・掲示板の添付ファイル選択＋アップロードUI（Phase 12、モバイル版）。
 * カメラ・カメラロールを優先表示（チャットは写真添付が主な想定）、文書選択は補助的な位置づけ。
 * アップロードは既存の`expo-file-system`（Phase 6で導入済み）の`uploadAsync`を再利用する。
 */
export function AttachmentPicker({ context, ownerId, value, onChange }: AttachmentPickerProps) {
  const [pending, setPending] = useState<PendingUpload[]>([]);

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("カメラの権限が必要です", "設定アプリから権限を許可してください。");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) await uploadAssets(toPickedAssets(result.assets));
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("カメラロールの権限が必要です", "設定アプリから権限を許可してください。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) await uploadAssets(toPickedAssets(result.assets));
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true, type: "*/*" });
    if (result.canceled || !result.assets) return;
    const assets: PickedAsset[] = result.assets.map((a) => ({
      uri: a.uri,
      fileName: a.name,
      contentType: a.mimeType ?? "application/octet-stream",
      size: a.size ?? 0,
    }));
    await uploadAssets(assets);
  }

  function toPickedAssets(assets: ImagePicker.ImagePickerAsset[] | undefined | null): PickedAsset[] {
    if (!assets) return [];
    return assets.map((a, i) => ({
      uri: a.uri,
      fileName: a.fileName ?? `photo-${Date.now()}-${i}.jpg`,
      contentType: a.mimeType ?? "image/jpeg",
      size: a.fileSize ?? 0,
    }));
  }

  async function uploadAssets(assets: PickedAsset[]) {
    for (const asset of assets) {
      if (!isAllowedAttachmentType(asset.contentType)) {
        setPending((prev) => [...prev, { fileName: asset.fileName, status: "error", message: "許可されていない形式です" }]);
        continue;
      }
      if (asset.size > ATTACHMENT_MAX_SIZE_BYTES) {
        setPending((prev) => [...prev, { fileName: asset.fileName, status: "error", message: "サイズが大きすぎます" }]);
        continue;
      }

      setPending((prev) => [...prev, { fileName: asset.fileName, status: "uploading" }]);
      try {
        const { uploadUrl, attachment } = await orgApi.requestUploadUrl({
          context,
          ownerId,
          fileName: asset.fileName,
          contentType: asset.contentType,
          size: asset.size,
        });
        await FileSystem.uploadAsync(uploadUrl, asset.uri, {
          httpMethod: "PUT",
          headers: { "Content-Type": asset.contentType },
        });
        onChange([...value, attachment]);
        setPending((prev) => prev.filter((p) => p.fileName !== asset.fileName));
      } catch {
        setPending((prev) =>
          prev.map((p) =>
            p.fileName === asset.fileName ? { ...p, status: "error", message: "アップロードに失敗しました" } : p,
          ),
        );
      }
    }
  }

  function handleAddPress() {
    const options = ["写真を撮る", "カメラロールから選択", "その他のファイルを選択", "キャンセル"];
    const actions = [pickFromCamera, pickFromLibrary, pickDocument];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1 },
        (index) => {
          if (index < actions.length) void actions[index]();
        },
      );
    } else {
      Alert.alert("添付ファイルを選択", undefined, [
        { text: options[0], onPress: () => void pickFromCamera() },
        { text: options[1], onPress: () => void pickFromLibrary() },
        { text: options[2], onPress: () => void pickDocument() },
        { text: options[3], style: "cancel" },
      ]);
    }
  }

  function handleRemove(key: string) {
    onChange(value.filter((a) => a.key !== key));
  }

  return (
    <View>
      <Pressable onPress={handleAddPress} style={styles.addButton}>
        <Ionicons name="attach" size={16} color={colors.text} />
        <Text style={styles.addButtonText}>ファイルを添付</Text>
      </Pressable>

      {(value.length > 0 || pending.length > 0) && (
        <View style={styles.list}>
          {value.map((a) => (
            <View key={a.key} style={styles.row}>
              <Ionicons name={isImageAttachment(a.contentType) ? "image" : "document"} size={14} color={colors.textMuted} />
              <Text style={styles.fileName} numberOfLines={1}>
                {a.fileName}
              </Text>
              <Pressable onPress={() => handleRemove(a.key)}>
                <Ionicons name="close" size={16} color={colors.danger} />
              </Pressable>
            </View>
          ))}
          {pending.map((p) => (
            <Text key={p.fileName} style={[styles.pendingText, p.status === "error" && { color: colors.danger }]}>
              {p.fileName}：{p.status === "uploading" ? "アップロード中…" : p.message}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  addButtonText: { fontSize: 13 },
  list: { marginTop: 8, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  fileName: { flex: 1, fontSize: 13 },
  pendingText: { fontSize: 12, color: colors.textMuted },
});
