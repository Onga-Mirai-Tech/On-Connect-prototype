import { useState } from "react";
import { View, Text, TextInput, Pressable, Image, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

/**
 * ログイン画面（7章 1番）：Cognitoユーザープール認証（ユーザー名＋パスワード）。
 * 初回ログイン時は仮パスワードで入り、Cognitoから返る「新しいパスワードを設定してください」
 * というチャレンジに応じて2段階目のフォームを表示する（Phase 8a）。
 * サインイン成功後はAuthContextのcurrentUserIdが更新され、AppNavigatorが自動的にHomeへ切り替える
 * （このコンポーネントから明示的な画面遷移は行わない）。
 */
export function LoginScreen() {
  const { signIn, confirmNewPassword } = useAuth();

  const [step, setStep] = useState<"signIn" | "newPassword">("signIn");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    setError("");
    setSubmitting(true);
    const result = await signIn(loginId, password);
    setSubmitting(false);

    if (result.status === "NEW_PASSWORD_REQUIRED") {
      setStep("newPassword");
    } else if (result.status === "ERROR") {
      setError(result.message);
    }
  };

  const handleConfirmNewPassword = async () => {
    setError("");
    setSubmitting(true);
    const result = await confirmNewPassword(newPassword);
    setSubmitting(false);

    if (result.status === "ERROR") {
      setError(result.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} />
        <Text style={styles.title}>On-Connect</Text>
      </View>

      {step === "signIn" ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="ログインID"
            autoCapitalize="none"
            value={loginId}
            onChangeText={setLoginId}
          />
          <TextInput
            style={styles.input}
            placeholder="パスワード"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            初回ログインです。新しいパスワードを設定してください（10文字以上、小文字と数字を含む）。
          </Text>
          <TextInput
            style={styles.input}
            placeholder="新しいパスワード"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={styles.button}
        disabled={submitting}
        onPress={step === "signIn" ? handleSignIn : handleConfirmNewPassword}
      >
        <Text style={styles.buttonText}>{step === "signIn" ? "ログイン" : "パスワードを設定してログイン"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.surface },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24, alignSelf: "center" },
  logo: { width: 40, height: 40, borderRadius: 10 },
  title: { fontSize: 24, fontWeight: "700", color: colors.brandDark },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: 12 },
  button: { backgroundColor: colors.brand, borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { fontWeight: "700" },
});
