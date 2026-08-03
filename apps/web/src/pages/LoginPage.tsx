import { useState } from "react";
import { colors } from "../theme/colors";

/** ログイン画面（7章 1番）：Cognitoユーザープール認証（メール＋パスワード） */
export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Amazon Cognito (amazon-cognito-identity-js / aws-amplify) でのサインイン処理
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
        onSubmit={handleSubmit}
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
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" style={{ background: colors.brand, border: "none", padding: 10, borderRadius: 8 }}>
          ログイン
        </button>
      </form>
    </div>
  );
}
