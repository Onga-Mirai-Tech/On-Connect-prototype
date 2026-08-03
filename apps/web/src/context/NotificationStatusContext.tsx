import { createContext, useContext, useState, type ReactNode } from "react";
import { mockMembers, mockCurrentUserId, type NotificationStatus } from "@on-connect/shared";

const initialStatus: NotificationStatus =
  mockMembers.find((m) => m.userId === mockCurrentUserId)?.notificationStatus ?? "ON";

interface NotificationStatusContextValue {
  status: NotificationStatus;
  setStatus: (status: NotificationStatus) => void;
}

const NotificationStatusContext = createContext<NotificationStatusContextValue | undefined>(undefined);

/**
 * ログイン中メンバーの通知ステータス（ON/OFF）をヘッダーと個人設定画面で共有する。
 * TODO: 認証実装後はサーバー側のnotificationStatusと同期する。
 */
export function NotificationStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<NotificationStatus>(initialStatus);
  return (
    <NotificationStatusContext.Provider value={{ status, setStatus }}>
      {children}
    </NotificationStatusContext.Provider>
  );
}

export function useNotificationStatus() {
  const ctx = useContext(NotificationStatusContext);
  if (!ctx) {
    throw new Error("useNotificationStatus must be used within NotificationStatusProvider");
  }
  return ctx;
}
