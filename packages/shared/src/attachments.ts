/**
 * チャット・掲示板の添付ファイル共通定義（設計書5.2.1 / 5.3.2）。
 * インフラLambdaからは（Phase 6の`@holiday-jp/holiday_jp`バンドル肥大化の教訓に倣い）
 * バレル`index.ts`経由ではなくこのファイルを直接importすること。
 */

export type AttachmentContext = "chat" | "bulletin";

export interface AttachmentRef {
  /** S3オブジェクトキー。例: "chat/{roomId}/{attachmentId}-{fileName}" */
  key: string;
  /** 元のファイル名（表示・保存名に使用） */
  fileName: string;
  /** MIMEタイプ（画像サムネイル表示か汎用ファイル表示かの判定に使用） */
  contentType: string;
  /** バイト数 */
  size: number;
}

export const ATTACHMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const ATTACHMENT_ALLOWED_CONTENT_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

export function isAllowedAttachmentType(contentType: string): boolean {
  return ATTACHMENT_ALLOWED_CONTENT_TYPES.includes(contentType);
}

export function isImageAttachment(contentType: string): boolean {
  return contentType.startsWith("image/");
}

/** ファイル名からS3キーに使えない文字を除去する（日本語は許可） */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^\w.\-ぁ-んァ-ヶー一-龠]/g, "_").slice(-120);
}

/**
 * S3キー命名規則。prefix（chat/ or bulletin/）はライフサイクルルールの適用範囲と一致させる。
 */
export function buildAttachmentKey(
  context: AttachmentContext,
  ownerId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `${context}/${ownerId}/${attachmentId}-${sanitizeFileName(fileName)}`;
}

/**
 * 掲示板の新規投稿で、postId確定前に添付ファイルをアップロードするためのdraft ID生成。
 * React NativeのHermesエンジンには`crypto.randomUUID`が無い（`react-native-get-random-values`は
 * `getRandomValues`のみ追加）ため、web/mobile共通でこの非暗号強度の簡易生成器を使う
 * （認可には使わないS3キーprefix用の値のため、暗号学的な強度は不要）。
 */
export function generateDraftId(): string {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
