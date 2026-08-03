import { useState, useRef, useEffect } from "react";
import { SmilePlus } from "lucide-react";
import { reactionEmojis, type Reaction } from "@on-connect/shared";
import { colors } from "../theme/colors";

interface ReactionBarProps {
  reactions: Reaction[] | undefined;
  currentUserId: string;
  onToggle: (emoji: string) => void;
}

/**
 * チャットメッセージ・掲示板投稿で共通利用する絵文字リアクションバー。
 * 既存のリアクションはチップとして表示し、クリックで自分の参加をトグルする。
 * 「+」ボタンから新しい絵文字を選んで追加することもできる。
 */
export function ReactionBar({ reactions, currentUserId, onToggle }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

  const visibleReactions = (reactions ?? []).filter((r) => r.userIds.length > 0);

  return (
    <div ref={containerRef} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", position: "relative" }}>
      {visibleReactions.map((r) => {
        const reacted = r.userIds.includes(currentUserId);
        return (
          <button
            key={r.emoji}
            onClick={() => onToggle(r.emoji)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              fontSize: 13,
              background: reacted ? "#D7FBEC" : colors.surface,
              border: reacted ? `1px solid ${colors.brandDark}` : "1px solid transparent",
            }}
          >
            <span>{r.emoji}</span>
            <span style={{ fontSize: 11, color: colors.textMuted }}>{r.userIds.length}</span>
          </button>
        );
      })}
      <button
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="リアクションを追加"
        style={{ display: "flex", alignItems: "center", padding: "2px 6px" }}
      >
        <SmilePlus size={14} color={colors.textMuted} />
      </button>
      {pickerOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            display: "flex",
            gap: 4,
            padding: 6,
            background: colors.background,
            border: `1px solid ${colors.surface}`,
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            zIndex: 5,
          }}
        >
          {reactionEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onToggle(emoji);
                setPickerOpen(false);
              }}
              style={{ fontSize: 18, padding: 4, background: "transparent", border: "none" }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
