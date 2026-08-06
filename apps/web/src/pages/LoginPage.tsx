import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

/**
 * ログイン画面（7章 1番）：Cognitoユーザープール認証（ユーザー名＋パスワード）。
 * 初回ログイン時は仮パスワードで入り、Cognitoから返る「新しいパスワードを設定してください」
 * というチャレンジに応じて2段階目のフォームを表示する（Phase 8a）。
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, confirmNewPassword } = useAuth();

  const [step, setStep] = useState<"signIn" | "newPassword">("signIn");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await signIn(loginId, password);
    setSubmitting(false);

    if (result.status === "SIGNED_IN") {
      navigate("/");
    } else if (result.status === "NEW_PASSWORD_REQUIRED") {
      setStep("newPassword");
    } else {
      setError(result.message);
    }
  };

  const handleConfirmNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await confirmNewPassword(newPassword);
    setSubmitting(false);

    if (result.status === "SIGNED_IN") {
      navigate("/");
    } else if (result.status === "ERROR") {
      setError(result.message);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.surface,
      }}
    >
      <form
        onSubmit={step === "signIn" ? handleSignIn : handleConfirmNewPassword}
        style={{
          background: colors.background,
          padding: 32,
          borderRadius: 12,
          width: 320,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
          <img src="/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
          <h1 style={{ color: colors.brandDark, fontSize: 20 }}>On-Connect</h1>
        </div>

        {step === "signIn" ? (
          <>
            <input
              type="text"
              placeholder="ログインID"
              autoCapitalize="none"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: 0 }}>
              初回ログインです。新しいパスワードを設定してください（10文字以上、小文字と数字を含む）。
            </p>
            <input
              type="password"
              placeholder="新しいパスワード"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={10}
            />
          </>
        )}

        {error && <p style={{ color: colors.danger, fontSize: 13, margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{ background: colors.brand, border: "none", padding: 10, borderRadius: 8 }}
        >
          {step === "signIn" ? "ログイン" : "パスワードを設定してログイン"}
        </button>
      </form>
    </div>
  );
}
