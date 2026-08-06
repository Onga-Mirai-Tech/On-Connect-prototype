import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Pencil, Send } from "lucide-react";
import {
  mockBulletinPosts,
  mockBulletinComments,
  toggleReaction,
  type BulletinPost,
  type BulletinComment,
} from "@on-connect/shared";
import { colors } from "../theme/colors";
import { ReactionBar } from "../components/ReactionBar";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";
import { orgApi } from "../api/orgApi";

/**
 * 掲示板詳細画面：タイトル・本文（HTML表示）・リアクション・コメントを表示する。
 * Phase 8c：投稿本体をAPIに接続。Phase 9：コメント・リアクションもAPIに接続（失敗時はローカルstateに
 * フォールバック、他の画面と同じ方針）。
 */
export function BulletinDetailPage() {
  const { currentUserId } = useAuth();
  const { members, bulletinCategories } = useOrgData();
  const memberName = (userId: string) => members.find((m) => m.userId === userId)?.displayName ?? userId;
  const categoryName = (categoryId: string | undefined) =>
    bulletinCategories.find((c) => c.categoryId === categoryId)?.name;
  const { postId = "" } = useParams();

  const [post, setPost] = useState<BulletinPost | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [comments, setComments] = useState<BulletinComment[]>([]);
  const [commentBody, setCommentBody] = useState("");

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        setPost(await orgApi.getBulletinPost(postId));
      } catch {
        setPost(mockBulletinPosts.find((p) => p.postId === postId));
      } finally {
        setIsLoading(false);
      }
      try {
        setComments(await orgApi.listBulletinComments(postId));
      } catch {
        setComments(mockBulletinComments.filter((c) => c.postId === postId));
      }
    })();
  }, [postId]);

  if (isLoading) {
    return null;
  }

  if (!post) {
    return <p>投稿が見つかりません。</p>;
  }

  const handleToggleReaction = async (emoji: string) => {
    try {
      setPost(await orgApi.toggleBulletinPostReaction(postId, emoji));
    } catch {
      setPost((prev) => (prev ? { ...prev, reactions: toggleReaction(prev.reactions, emoji, currentUserId ?? "") } : prev));
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    try {
      const created = await orgApi.createBulletinComment(postId, commentBody);
      setComments((prev) => [...prev, created]);
    } catch {
      setComments((prev) => [
        ...prev,
        {
          commentId: `local-${Date.now()}`,
          postId,
          authorId: currentUserId ?? "",
          body: commentBody,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setCommentBody("");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h2 style={{ margin: 0 }}>{post.title}</h2>
        <Link to={`/bulletin/${post.postId}/edit`} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <Pencil size={14} /> 編集
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.textMuted, margin: "8px 0" }}>
        {categoryName(post.categoryId) === "緊急連絡" && <AlertTriangle size={12} color={colors.danger} />}
        <span>{categoryName(post.categoryId)}</span>
        <span>・{post.createdAt.slice(0, 10)}</span>
        {post.visibleCategoryIds.length > 0 && <span>・公開範囲限定</span>}
      </div>
      <div
        style={{ border: `1px solid ${colors.surface}`, borderRadius: 14, padding: 16 }}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: post.body }}
      />
      <div style={{ marginTop: 12 }}>
        <ReactionBar reactions={post.reactions} currentUserId={currentUserId ?? ""} onToggle={handleToggleReaction} />
      </div>

      <h3 style={{ marginTop: 24 }}>コメント（{comments.length}）</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {comments.map((c) => (
          <li key={c.commentId} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.surface}` }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{memberName(c.authorId)}</div>
            <div style={{ fontSize: 13 }}>{c.body}</div>
          </li>
        ))}
        {comments.length === 0 && <p style={{ color: colors.textMuted, fontSize: 13 }}>コメントはまだありません。</p>}
      </ul>
      <form onSubmit={handleAddComment} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          type="text"
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          placeholder="コメントを入力"
          style={{ flex: 1 }}
        />
        <button type="submit" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Send size={14} /> 送信
        </button>
      </form>
    </div>
  );
}
