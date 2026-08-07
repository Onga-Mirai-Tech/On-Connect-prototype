import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { generateDraftId, mockBulletinPosts, type AttachmentRef } from "@on-connect/shared";
import { HtmlEditor } from "../components/HtmlEditor";
import { AttachmentPicker } from "../components/AttachmentPicker";
import { useOrgData } from "../context/OrgDataContext";
import { orgApi } from "../api/orgApi";
import { colors } from "../theme/colors";

/**
 * 掲示板投稿・編集画面（7章 7番）
 * 「タイトル」「本文（HTML編集対応）」「添付ファイル」の構成、閲覧対象のメンバーカテゴリを選択（5.3.3）
 * Phase 8c：投稿本体をAPIに接続（コメント・リアクションはPhase 9のまま対象外）
 */
export function BulletinEditPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { memberCategories, bulletinCategories, isLoading } = useOrgData();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // 新規作成時、postIdが確定する前に添付ファイルをアップロードするためのS3キーprefix用ID
  // （bulletinの投稿本体には権限チェックが無いため、DynamoDBの実レコードと対応している必要はない）
  const [draftId] = useState(generateDraftId);
  const attachmentOwnerId = postId ?? draftId;

  // 新規作成時のデフォルトカテゴリー：OrgDataContextの初期値はローディング中のモックフォールバックのため
  // bulletinCategoriesの中身だけでは実データか判定できない。isLoadingがfalseになる（取得試行完了）まで待つ
  useEffect(() => {
    if (postId || categoryId || isLoading) return;
    setCategoryId(bulletinCategories[0]?.categoryId ?? "");
  }, [postId, categoryId, isLoading, bulletinCategories]);

  useEffect(() => {
    if (!postId) return;
    (async () => {
      try {
        const post = await orgApi.getBulletinPost(postId);
        setTitle(post.title);
        setBody(post.body);
        setCategoryId(post.categoryId ?? "");
        setVisibleCategoryIds(post.visibleCategoryIds);
        setAttachments(post.attachments ?? []);
      } catch {
        const post = mockBulletinPosts.find((p) => p.postId === postId);
        setTitle(post?.title ?? "");
        setBody(post?.body ?? "");
        setCategoryId(post?.categoryId ?? "");
        setVisibleCategoryIds(post?.visibleCategoryIds ?? []);
        setAttachments(post?.attachments ?? []);
      }
    })();
  }, [postId]);

  const toggleVisibleCategory = (categoryId: string) => {
    setVisibleCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      // attachmentsは（他フィールド同様）常に明示的に送る。空配列で送ることで、編集時に全添付を
      // 削除したケースをサーバー側が「未指定＝現状維持」と誤解せず、正しくS3クリーンアップできるようにする
      const input = { title, body, categoryId: categoryId || undefined, visibleCategoryIds, attachments };
      if (postId) {
        await orgApi.updateBulletinPost(postId, input);
        navigate(`/bulletin/${postId}`);
      } else {
        const post = await orgApi.createBulletinPost(input);
        navigate(`/bulletin/${post.postId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>{postId ? "掲示板編集" : "新規投稿"}</h2>
      <label style={{ display: "block", marginBottom: 8 }}>
        タイトル
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例）夏祭り開催のお知らせ"
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <label>
        カテゴリー：
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {bulletinCategories.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ marginTop: 8 }}>
        <div style={{ marginBottom: 4 }}>本文</div>
        <HtmlEditor value={body} onChange={setBody} />
      </div>
      <div>
        <h3>閲覧可能なメンバーカテゴリ（未選択なら全体公開）</h3>
        {memberCategories.map((c) => (
          <label key={c.categoryId} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={visibleCategoryIds.includes(c.categoryId)}
              onChange={() => toggleVisibleCategory(c.categoryId)}
            />
            {c.name}
          </label>
        ))}
      </div>
      <div>
        <div style={{ marginBottom: 4 }}>添付ファイル</div>
        <AttachmentPicker context="bulletin" ownerId={attachmentOwnerId} value={attachments} onChange={setAttachments} />
      </div>
      {error && <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>}
      <button type="button" onClick={handleSave} disabled={saving} style={{ marginTop: 12 }}>
        保存
      </button>
    </div>
  );
}
