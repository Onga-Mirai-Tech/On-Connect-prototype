import { Bell, BellOff } from "lucide-react";
import { colors } from "../theme/colors";
import { useNotificationStatus } from "../context/NotificationStatusContext";

/** 個人設定画面（7章 10番）：通知ON/OFF切り替え（5.1.2、「つながらない権利」の中核機能） */
export function SettingsPage() {
  const { status, setStatus } = useNotificationStatus();

  const toggle = () => {
    setStatus(status === "ON" ? "OFF" : "ON");
  };

  return (
    <div>
      <h2>個人設定</h2>
      <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {status === "ON" ? <Bell size={18} color={colors.brandDark} /> : <BellOff size={18} color={colors.textMuted} />}
        通知ステータス：<strong>{status === "ON" ? "通知オン" : "通知オフ"}</strong>
      </p>
      <button onClick={toggle} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {status === "ON" ? <BellOff size={16} /> : <Bell size={16} />}
        {status === "ON" ? "通知をオフにする" : "通知をオンにする"}
      </button>
      <p style={{ fontSize: 12, color: colors.textMuted }}>
        通知オフ中は、緊急連絡フラグ付きメッセージを除き通知は届きません。
        音声通話の着信通知は例外なく届きません。
        毎朝7時（Asia/Tokyo）に自動的に通知オンへリセットされます。
      </p>
    </div>
  );
}
