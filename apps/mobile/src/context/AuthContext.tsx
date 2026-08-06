import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  signIn as amplifySignIn,
  confirmSignIn as amplifyConfirmSignIn,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchAuthSession,
} from "aws-amplify/auth";
import type { User } from "@on-connect/shared";

type SignInResult =
  | { status: "SIGNED_IN" }
  | { status: "NEW_PASSWORD_REQUIRED" }
  | { status: "ERROR"; message: string };

interface AuthContextValue {
  currentUserId: string | undefined;
  currentUser: User | undefined;
  isLoading: boolean;
  signIn: (loginId: string, password: string) => Promise<SignInResult>;
  confirmNewPassword: (newPassword: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * 自分自身のプロフィールを取得する。8aの時点では「ログインできること」がスコープのため、
 * このAuthContext内でしか使わない最小限のfetch実装（8b以降で全画面向けの本格的なAPIクライアントに置き換える）。
 */
async function fetchOwnProfile(userId: string): Promise<User | undefined> {
  try {
    if (!API_URL) return undefined;
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) return undefined;
    const res = await fetch(`${API_URL}/users/${userId}`, { headers: { Authorization: token } });
    if (!res.ok) return undefined;
    return (await res.json()) as User;
  } catch {
    return undefined;
  }
}

/**
 * ログイン中ユーザーのアイデンティティ（Phase 8a）。
 * チャット・掲示板等の業務データを本物のAPIから読むのは8b/8c以降の対象で、
 * ここでは「今ログインしている人は誰か」の解決とログイン/サインアウト操作のみを扱う。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [currentUser, setCurrentUser] = useState<User>();
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = async () => {
    try {
      const { userId } = await getCurrentUser();
      setCurrentUserId(userId);
      setCurrentUser(await fetchOwnProfile(userId));
    } catch {
      setCurrentUserId(undefined);
      setCurrentUser(undefined);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const signIn = async (loginId: string, password: string): Promise<SignInResult> => {
    try {
      const result = await amplifySignIn({ username: loginId, password });
      if (result.isSignedIn) {
        await loadSession();
        return { status: "SIGNED_IN" };
      }
      if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        return { status: "NEW_PASSWORD_REQUIRED" };
      }
      return { status: "ERROR", message: `未対応のログイン手順です: ${result.nextStep.signInStep}` };
    } catch (err) {
      return { status: "ERROR", message: err instanceof Error ? err.message : "ログインに失敗しました" };
    }
  };

  const confirmNewPassword = async (newPassword: string): Promise<SignInResult> => {
    try {
      const result = await amplifyConfirmSignIn({ challengeResponse: newPassword });
      if (result.isSignedIn) {
        await loadSession();
        return { status: "SIGNED_IN" };
      }
      return { status: "ERROR", message: "パスワードの設定に失敗しました" };
    } catch (err) {
      return { status: "ERROR", message: err instanceof Error ? err.message : "パスワードの設定に失敗しました" };
    }
  };

  const signOut = async () => {
    await amplifySignOut();
    setCurrentUserId(undefined);
    setCurrentUser(undefined);
  };

  return (
    <AuthContext.Provider value={{ currentUserId, currentUser, isLoading, signIn, confirmNewPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
