import { Amplify } from "aws-amplify";

/**
 * Cognito認証の設定。デプロイ前は環境変数が空文字列のままでも起動時エラーにはならず、
 * 実際に signIn() を呼んだ時点でAmplify側のエラーになる（想定内の挙動）。
 */
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
    },
  },
});
