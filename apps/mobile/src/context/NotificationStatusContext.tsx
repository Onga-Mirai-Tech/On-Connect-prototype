import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { NotificationStatus } from "@on-connect/shared";
import { useAuth } from "./AuthContext";
import { orgApi } from "../api/orgApi";

interface NotificationStatusContextValue {
  status: NotificationStatus;
  setStatus: (status: NotificationStatus) => void;
}

const NotificationStatusContext = createContext<NotificationStatusContextValue | undefined>(undefined);

/**
 * ログイン中メンバーの通知ステータス（ON/OFF）をヘッダー表示と個人設定画面で共有する。
 * 初期値はAuthContextが取得した自分のプロフィール（currentUser）から取る（Phase 8a）。
 * setStatusはローカルstateを即時反映しつつバックエンドへも同期する（失敗時は他のAPI呼び出しと
 * 同じくローカルstateのフォールバックのまま、ユーザー操作は妨げない。Phase 13で解消：
 * 従来は変更してもサーバー側に一切保存されずローカルstateのみで消えていた）。
 */
export function NotificationStatusProvider({ children }: { children: ReactNode }) {
  const { currentUser, currentUserId } = useAuth();
  const [status, setStatusState] = useState<NotificationStatus>(currentUser?.notificationStatus ?? "ON");

  useEffect(() => {
    if (currentUser?.notificationStatus) setStatusState(currentUser.notificationStatus);
  }, [currentUser?.notificationStatus]);

  const setStatus = (next: NotificationStatus) => {
    setStatusState(next);
    if (currentUserId) {
      orgApi.updateOwnNotificationStatus(currentUserId, next).catch(() => {});
    }
  };

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
