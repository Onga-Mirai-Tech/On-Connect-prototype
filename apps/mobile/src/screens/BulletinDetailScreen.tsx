import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, Platform, StyleSheet, KeyboardAvoidingView } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  mockBulletinPosts,
  mockBulletinComments,
  toggleReaction,
  type BulletinPost,
  type BulletinComment,
} from "@on-connect/shared";
import type { BulletinStackParamList } from "../navigation/AppNavigator";
import { ReactionBar } from "../components/ReactionBar";
import { AttachmentPreview } from "../components/AttachmentPreview";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";
import { orgApi } from "../api/orgApi";

type Props = NativeStackScreenProps<BulletinStackParamList, "BulletinDetail">;

/**
 * 掲示板詳細画面：タイトル・本文（HTML表示）・リアクション・コメントを表示する。
 * Phase 8c：投稿本体をAPIに接続。Phase 9：コメント・リアクションもAPIに接続（失敗時はローカルstateに
 * フォールバック、他の画面と同じ方針）。
 */
export function BulletinDetailScreen({ route, navigation }: Props) {
  const headerHeight = useHeaderHeight();
  const { currentUserId } = useAuth();
  const { members, bulletinCategories } = useOrgData();
  const memberName = (userId: string) => members.find((m) => m.userId === userId)?.displayName ?? userId;
  const categoryName = (categoryId: string | undefined) =>
    bulletinCategories.find((c) => c.categoryId === categoryId)?.name;
  const { postId } = route.params;

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
    return <View style={styles.container} />;
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <Text>投稿が見つかりません。</Text>
      </View>
    );
  }

  const handleToggleReaction = async (emoji: string) => {
    try {
      setPost(await orgApi.toggleBulletinPostReaction(postId, emoji));
    } catch {
      setPost((prev) => (prev ? { ...prev, reactions: toggleReaction(prev.reactions, emoji, currentUserId ?? "") } : prev));
    }
  };

  const handleAddComment = async () => {
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        data={comments}
        keyExtractor={(item) => item.commentId}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{post.title}</Text>
              <Pressable
                onPress={() => navigation.navigate("BulletinEdit", { postId: post.postId })}
                style={styles.editButton}
              >
                <Ionicons name="pencil-outline" size={14} color={colors.brandDark} />
                <Text style={styles.editText}>編集</Text>
              </Pressable>
            </View>
            <View style={styles.metaRow}>
              {categoryName(post.categoryId) === "緊急連絡" && (
                <Ionicons name="alert-circle-outline" size={12} color={colors.danger} />
              )}
              <Text style={styles.metaText}>
                {categoryName(post.categoryId)} ・ {post.createdAt.slice(0, 10)}
                {post.visibleCategoryIds.length > 0 ? " ・公開範囲限定" : ""}
              </Text>
            </View>
            <View style={styles.bodyBox}>
              {Platform.OS === "web" ? (
                <Text>{post.body.replace(/<[^>]+>/g, " ")}</Text>
              ) : (
                <WebView
                  originWhitelist={["*"]}
                  source={{ html: `<html><body style="font-family:-apple-system,sans-serif;font-size:14px;margin:0;">${post.body}</body></html>` }}
                  style={styles.webview}
                />
              )}
            </View>
            <AttachmentPreview attachments={post.attachments} context="bulletin" ownerId={post.postId} />
            <View style={styles.reactionRow}>
              <ReactionBar reactions={post.reactions} currentUserId={currentUserId ?? ""} onToggle={handleToggleReaction} />
            </View>
            <Text style={styles.commentsHeading}>コメント（{comments.length}）</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyComments}>コメントはまだありません。</Text>}
        renderItem={({ item }) => (
          <View style={styles.commentRow}>
            <Text style={styles.commentAuthor}>{memberName(item.authorId)}</Text>
            <Text style={styles.commentBody}>{item.body}</Text>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.commentForm}>
            <TextInput
              style={styles.commentInput}
              placeholder="コメントを入力"
              value={commentBody}
              onChangeText={setCommentBody}
            />
            <Pressable onPress={handleAddComment} style={styles.commentSendButton}>
              <Ionicons name="send-outline" size={16} color={colors.text} />
            </Pressable>
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { flex: 1, fontSize: 20, fontWeight: "700", marginRight: 8 },
  editButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  editText: { color: colors.brandDark },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  metaText: { fontSize: 12, color: colors.textMuted },
  bodyBox: { borderWidth: 1, borderColor: colors.surface, borderRadius: 14, padding: 12, marginTop: 12 },
  webview: { height: 150, backgroundColor: "transparent" },
  reactionRow: { marginTop: 12 },
  commentsHeading: { fontSize: 16, fontWeight: "700", marginTop: 24, marginBottom: 8 },
  emptyComments: { color: colors.textMuted, fontSize: 13 },
  commentRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.surface },
  commentAuthor: { fontSize: 12, fontWeight: "700" },
  commentBody: { fontSize: 13, marginTop: 2 },
  commentForm: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 24 },
  commentInput: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 10 },
  commentSendButton: { backgroundColor: colors.brand, borderRadius: 12, padding: 10, justifyContent: "center" },
});
