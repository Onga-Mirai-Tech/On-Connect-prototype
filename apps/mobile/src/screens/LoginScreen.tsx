import { useState } from "react";
import { View, Text, TextInput, Pressable, Image, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

/** ログイン画面（7章 1番）：Cognitoユーザープール認証（メール＋パスワード） */
export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    // TODO: AWS Amplify Auth (Cognito) でのサインイン処理
    navigation.replace("Home");
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} />
        <Text style={styles.title}>On-Connect</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="パスワード"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>ログイン</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.surface },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24, alignSelf: "center" },
  logo: { width: 40, height: 40, borderRadius: 10 },
  title: { fontSize: 24, fontWeight: "700", color: colors.brandDark },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  button: { backgroundColor: colors.brand, borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { fontWeight: "700" },
});
