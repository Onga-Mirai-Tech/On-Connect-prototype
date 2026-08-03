import { useSearchParams } from "react-router-dom";
import { Phone, PhoneOff } from "lucide-react";
import { colors } from "../theme/colors";

/**
 * 着信画面（7章 5番）：音声通話着信時のフルスクリーン表示。
 * 通知オフのユーザーには例外なく届かない（5.2.4）ため、本画面はプッシュ通知経由の
 * ディープリンク、またはアプリ起動中のAppSyncリアルタイム通知を受けて表示される想定。
 * メンバー一覧・チャット詳細からの発信時は、デモ表示として本画面を流用している（TODO: 発信中UIを別途用意）。
 */
export function IncomingCallPage() {
  const [searchParams] = useSearchParams();
  const displayName = searchParams.get("name") ?? "発信者名（仮）";

  const handleAccept = () => {
    // TODO: Chime SDK Meetingへ参加する
  };
  const handleDecline = () => {
    // TODO: CallLogsにdeclinedとして記録する
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: colors.brandDark,
        color: "#fff",
        gap: 24,
      }}
    >
      <p style={{ fontSize: 14 }}>着信中...</p>
      <h1>{displayName}</h1>
      <div style={{ display: "flex", gap: 24 }}>
        <button
          onClick={handleDecline}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", background: colors.danger, borderRadius: "50%", width: 64, height: 64 }}
        >
          <PhoneOff color="#fff" />
        </button>
        <button
          onClick={handleAccept}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", background: colors.brand, borderRadius: "50%", width: 64, height: 64 }}
        >
          <Phone color="#1A1A1A" />
        </button>
      </div>
    </div>
  );
}
