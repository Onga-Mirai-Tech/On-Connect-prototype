import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { NotificationStatus } from "@on-connect/shared";
import { useAuth } from "./AuthContext";

interface NotificationStatusContextValue {
  status: NotificationStatus;
  setStatus: (status: NotificationStatus) => void;
}

const NotificationStatusContext = createContext<NotificationStatusContextValue | undefined>(undefined);

/**
 * ログイン中メンバーの通知ステータス（ON/OFF）をヘッダー表示と個人設定画面で共有する。
 * 初期値はAuthContextが取得した自分のプロフィール（currentUser）から取る（Phase 8a）。
 * TODO: 変更時にサーバー側のnotificationStatusと同期する（現状はローカルstateのみ）。
 */
export function NotificationStatusProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<NotificationStatus>(currentUser?.notificationStatus ?? "ON");

  useEffect(() => {
    if (currentUser?.notificationStatus) setStatus(currentUser.notificationStatus);
  }, [currentUser?.notificationStatus]);

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
