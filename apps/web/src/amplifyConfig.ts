import { Amplify } from "aws-amplify";

/**
 * Cognito認証・AppSync(GraphQL)の設定。デプロイ前は環境変数が空文字列のままでも起動時エラーには
 * ならず、実際にAPIを呼んだ時点でAmplify側のエラーになる（想定内の挙動）。
 */
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
    },
  },
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_GRAPHQL_API_URL,
      region: import.meta.env.VITE_AWS_REGION,
      defaultAuthMode: "userPool",
    },
  },
});
