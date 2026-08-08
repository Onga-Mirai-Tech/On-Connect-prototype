import { useRef } from "react";
import { Bold, Italic, Underline, Link2, List } from "lucide-react";
import { colors } from "../theme/colors";

interface HtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
}

/**
 * 掲示板本文用の簡易HTML編集コンポーネント。
 * 選択したテキストをHTMLタグで囲むツールバー方式（textarea + 下部にライブプレビュー）。
 * TODO: 実際の保存時にはサーバー側でHTMLサニタイズ（許可タグのホワイトリスト化）を行うこと。
 *       プレビューの dangerouslySetInnerHTML も、信頼できない入力元では別途サニタイズが必要。
 */
export function HtmlEditor({ value, onChange }: HtmlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (before: string, after: string, placeholder = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const nextValue = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(nextValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const handleBulletList = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const items = (selected || "リスト項目")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => `  <li>${line}</li>`)
      .join("\n");
    const html = `<ul>\n${items}\n</ul>`;
    onChange(value.slice(0, start) + html + value.slice(end));
  };

  const handleLink = () => {
    const url = window.prompt("リンク先のURLを入力してください", "https://");
    if (!url) return;
    wrapSelection(`<a href="${url}" target="_blank" rel="noopener noreferrer">`, "</a>", "リンクテキスト");
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        <button type="button" onClick={() => wrapSelection("<strong>", "</strong>", "太字テキスト")} title="太字">
          <Bold size={14} />
        </button>
        <button type="button" onClick={() => wrapSelection("<em>", "</em>", "斜体テキスト")} title="斜体">
          <Italic size={14} />
        </button>
        <button type="button" onClick={() => wrapSelection("<u>", "</u>", "下線テキスト")} title="下線">
          <Underline size={14} />
        </button>
        <button type="button" onClick={handleLink} title="リンク">
          <Link2 size={14} />
        </button>
        <button type="button" onClick={handleBulletList} title="箇条書き">
          <List size={14} />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="本文（HTMLタグを使ったリッチな装飾ができます）"
        rows={8}
        style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }}
      />
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>プレビュー</div>
        <div
          style={{ border: `1px solid ${colors.surface}`, borderRadius: 12, padding: 12, minHeight: 60, whiteSpace: "pre-wrap" }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: value || "<p style=\"color:#9CA3AF\">（本文プレビュー）</p>" }}
        />
      </div>
    </div>
  );
}
