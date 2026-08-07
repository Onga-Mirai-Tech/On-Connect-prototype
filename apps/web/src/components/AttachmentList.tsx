import { useEffect, useState } from "react";
import { isImageAttachment, type AttachmentContext, type AttachmentRef } from "@on-connect/shared";
import { orgApi } from "../api/orgApi";
import { colors } from "../theme/colors";

interface AttachmentListProps {
  attachments: AttachmentRef[] | undefined;
  context: AttachmentContext;
  ownerId: string;
}

/**
 * チャットメッセージ・掲示板投稿の添付ファイル表示（Phase 12）。
 * ダウンロードURL（15分有効の署名付きURL）はマウント時に一括取得してキャッシュし、
 * 期限切れ（`<img onError>`）時のみ1回再取得する（常駐のタイマー等は導入しない）。
 */
export function AttachmentList({ attachments, context, ownerId }: AttachmentListProps) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!attachments || attachments.length === 0) return;
    let cancelled = false;

    void Promise.all(
      attachments.map(async (a) => {
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

  async function refetchUrl(key: string) {
    try {
      const { downloadUrl } = await orgApi.requestDownloadUrl({ context, ownerId, key });
      setUrls((prev) => ({ ...prev, [key]: downloadUrl }));
    } catch {
      // 再取得も失敗した場合は表示を諦める（次のマウント時に再挑戦される）
    }
  }

  if (!attachments || attachments.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {attachments.map((a) => {
        const url = urls[a.key];
        if (isImageAttachment(a.contentType)) {
          return (
            <img
              key={a.key}
              src={url}
              alt={a.fileName}
              style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, objectFit: "cover" }}
              onError={() => void refetchUrl(a.key)}
            />
          );
        }
        return (
          <a
            key={a.key}
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              if (!url) {
                e.preventDefault();
                void refetchUrl(a.key);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 8,
              background: colors.surface,
              color: colors.text,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            📄 {a.fileName}
          </a>
        );
      })}
    </div>
  );
}
