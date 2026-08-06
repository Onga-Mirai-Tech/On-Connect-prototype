import { randomInt } from "node:crypto";
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";

const USER_POOL_ID = process.env.USER_POOL_ID!;

const cognitoClient = new CognitoIdentityProviderClient({});

// 紛らわしい文字（0/O/1/l/i）を除いた文字集合。紙に手書きで控える運用のため読み間違いを減らす。
const LOWERCASE_CHARS = "abcdefghjkmnpqrstuvwxyz";
const DIGIT_CHARS = "23456789";
const ALL_CHARS = LOWERCASE_CHARS + DIGIT_CHARS;

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * パスワードポリシー（10文字以上・小文字＋数字必須）を確実に満たす仮パスワードを生成する。
 * 管理者が紙に書き写す運用のため、紛らわしい文字は文字集合から除外している。
 */
export function generateTemporaryPassword(): string {
  const required = [
    LOWERCASE_CHARS[randomInt(LOWERCASE_CHARS.length)],
    DIGIT_CHARS[randomInt(DIGIT_CHARS.length)],
  ];
  const rest = Array.from({ length: 10 }, () => ALL_CHARS[randomInt(ALL_CHARS.length)]);
  return shuffle([...required, ...rest]).join("");
}

/**
 * Cognitoユーザーを作成する（メール/SMS自動送信は行わない＝管理者が紙で仮パスワードを手渡す運用のため）。
 * 戻り値のsubをDynamoDBのUsers.userIdとして使う。
 */
export async function createCognitoUser(
  loginId: string,
  displayName: string,
): Promise<{ sub: string; temporaryPassword: string }> {
  const temporaryPassword = generateTemporaryPassword();
  const result = await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: loginId,
      TemporaryPassword: temporaryPassword,
      MessageAction: "SUPPRESS",
      UserAttributes: [{ Name: "name", Value: displayName }],
    }),
  );
  const sub = result.User?.Attributes?.find((attr) => attr.Name === "sub")?.Value;
  if (!sub) throw new Error("Cognitoアカウント作成のレスポンスからsubを取得できませんでした");
  return { sub, temporaryPassword };
}

/** アカウント作成後にDynamoDB側の書き込みが失敗した場合の補償操作（不整合防止） */
export async function deleteCognitoUser(loginId: string): Promise<void> {
  await cognitoClient.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: loginId }));
}

/**
 * 初回ログイン完了状況を返す（"FORCE_CHANGE_PASSWORD" | "CONFIRMED" 等）。
 * まだCognitoアカウントが無い（移行前のダミーメンバー等）場合はundefinedを返す。
 */
export async function getCognitoUserStatus(loginId: string): Promise<string | undefined> {
  try {
    const result = await cognitoClient.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: loginId }),
    );
    return result.UserStatus;
  } catch (err) {
    if (err instanceof UserNotFoundException) return undefined;
    throw err;
  }
}

/** パスワード再発行（管理者操作）。新しい仮パスワードを設定し、初回ログイン待ち状態に戻す。 */
export async function reissueTemporaryPassword(loginId: string): Promise<string> {
  const temporaryPassword = generateTemporaryPassword();
  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: loginId,
      Password: temporaryPassword,
      Permanent: false,
    }),
  );
  return temporaryPassword;
}
