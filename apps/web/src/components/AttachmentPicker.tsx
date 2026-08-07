import { useState } from "react";
import {
  ATTACHMENT_ALLOWED_CONTENT_TYPES,
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

interface PendingUpload {
  fileName: string;
  status: "uploading" | "error";
  message?: string;
}

/**
 * チャット・掲示板の添付ファイル選択＋アップロードUI（Phase 12）。
 * 選択後、`orgApi.requestUploadUrl`で署名付きURLを取得し、S3へ直接PUTする
 * （サーバーを経由しない。API GatewayのペイロードサイズやLambdaのタイムアウト制約を避けるため）。
 */
export function AttachmentPicker({ context, ownerId, value, onChange }: AttachmentPickerProps) {
  const [pending, setPending] = useState<PendingUpload[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!isAllowedAttachmentType(file.type)) {
        setPending((prev) => [...prev, { fileName: file.name, status: "error", message: "許可されていない形式です" }]);
        continue;
      }
      if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
        setPending((prev) => [...prev, { fileName: file.name, status: "error", message: "サイズが大きすぎます" }]);
        continue;
      }

      setPending((prev) => [...prev, { fileName: file.name, status: "uploading" }]);
      try {
        const { uploadUrl, attachment } = await orgApi.requestUploadUrl({
          context,
          ownerId,
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        });
        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        onChange([...value, attachment]);
        setPending((prev) => prev.filter((p) => p.fileName !== file.name));
      } catch {
        setPending((prev) =>
          prev.map((p) => (p.fileName === file.name ? { ...p, status: "error", message: "アップロードに失敗しました" } : p)),
        );
      }
    }
  }

  function handleRemove(key: string) {
    onChange(value.filter((a) => a.key !== key));
  }

  return (
    <div>
      <label
        style={{
          display: "inline-block",
          padding: "6px 12px",
          borderRadius: 8,
          background: colors.surface,
          color: colors.text,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        📎 ファイルを添付
        <input
          type="file"
          multiple
          accept={ATTACHMENT_ALLOWED_CONTENT_TYPES.join(",")}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
      </label>

      {(value.length > 0 || pending.length > 0) && (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
          {value.map((a) => (
            <li key={a.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "2px 0" }}>
              <span>{isImageAttachment(a.contentType) ? "🖼️" : "📄"}</span>
              <span>{a.fileName}</span>
              <button
                type="button"
                onClick={() => handleRemove(a.key)}
                style={{ border: "none", background: "transparent", color: colors.danger, cursor: "pointer" }}
              >
                ×
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.fileName} style={{ fontSize: 13, padding: "2px 0", color: p.status === "error" ? colors.danger : colors.textMuted }}>
              {p.fileName}：{p.status === "uploading" ? "アップロード中…" : p.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
